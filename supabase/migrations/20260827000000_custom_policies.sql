-- Day 5 policy expansion: custom reveal counts and Never expiry.
--
-- Reveal limits widen from the four presets to any integer 1..100. Shares may
-- now omit expires_at entirely ("Never"): they stay revocable, never expire,
-- and every expiry comparison treats NULL as non-expiring. Unlimited reveals
-- and Never expiry remain independent concepts.

alter table public.shares
  drop constraint if exists shares_reveal_limit,
  add constraint shares_reveal_limit check (max_reveals is null or max_reveals between 1 and 100);

alter table public.shares
  alter column expires_at drop not null;

alter table public.shares
  drop constraint if exists shares_expiry_order,
  add constraint shares_expiry_order check (expires_at is null or expires_at > created_at);

alter table public.shares
  drop constraint if exists shares_expiry_cap,
  add constraint shares_expiry_cap check (expires_at is null or expires_at <= created_at + interval '30 days');

alter table public.shares
  drop constraint if exists shares_availability_before_expiry,
  add constraint shares_availability_before_expiry check (
    available_at is null or expires_at is null or available_at < expires_at
  );

-- create_share: optional p_expires_at with identical validation semantics.
create or replace function public.create_share(
  p_public_id text,
  p_content_envelope jsonb,
  p_available_at timestamptz,
  p_expires_at timestamptz,
  p_max_reveals integer,
  p_delete_token_hash bytea,
  p_password_required boolean,
  p_unlock_required boolean,
  p_idempotency_key_hash bytea,
  p_file_envelope jsonb default null,
  p_file_ciphertext_size bigint default null
)
returns table (share_id uuid, public_id text, created boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  inserted_id uuid;
  existing public.shares%rowtype;
  reservation public.upload_reservations%rowtype;
  object_size bigint;
  has_file boolean := false;
begin
  if p_delete_token_hash is null or octet_length(p_delete_token_hash) <> 32
     or p_idempotency_key_hash is null or octet_length(p_idempotency_key_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid capability digest';
  end if;

  if not securebin_b64url(p_public_id, 16) then
    raise exception using errcode = '22023', message = 'invalid public id format';
  end if;

  if not securebin_valid_envelope(p_content_envelope, 'content', true, 524315) then
    raise exception using errcode = '22023', message = 'invalid content envelope';
  end if;

  if p_password_required is distinct from
       (p_content_envelope->>'factorMask' in ('link+password', 'link+password+unlock'))
     or p_unlock_required is distinct from
       (p_content_envelope->>'factorMask' in ('link+unlock', 'link+password+unlock')) then
    raise exception using errcode = '22023', message = 'factor prompt flags do not match envelope';
  end if;

  if (p_password_required or p_unlock_required)
     and p_content_envelope->>'kdf' <> 'PBKDF2-HMAC-SHA-256' then
    raise exception using errcode = '22023', message = 'protected share requires pbkdf2 envelope';
  end if;

  if p_expires_at is not null
     and (p_expires_at <= now()
          or p_expires_at > now() + interval '30 days'
          or p_available_at is not null and p_available_at >= p_expires_at) then
    raise exception using errcode = '22023', message = 'invalid lifecycle policy';
  end if;

  if p_max_reveals is not null and p_max_reveals not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid reveal limit';
  end if;

  if (p_file_envelope is null) <> (p_file_ciphertext_size is null) then
    raise exception using errcode = '22023', message = 'invalid file attachment fields';
  end if;

  if p_file_envelope is not null then
    if not securebin_valid_envelope(p_file_envelope, 'file', false, 1)
       or p_file_envelope->>'factorMask' <> p_content_envelope->>'factorMask'
       or p_file_ciphertext_size not between 16 and 10486422 then
      raise exception using errcode = '22023', message = 'invalid encrypted file envelope';
    end if;

    select * into reservation
      from public.upload_reservations
      where reserved_public_id = p_public_id
        and idempotency_key_hash = p_idempotency_key_hash
      for update;

    if not found
       or reservation.attached_share_id is not null
       or reservation.expires_at <= now()
       or reservation.expected_ciphertext_size <> p_file_ciphertext_size
       or reservation.file_envelope <> p_file_envelope then
      raise exception using errcode = '22023', message = 'invalid or missing upload reservation';
    end if;

    select case
      when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint
      else null
    end into object_size
      from storage.objects
      where bucket_id = 'securebin-files'
        and name = reservation.object_path;

    if object_size is null or object_size <> reservation.expected_ciphertext_size then
      raise exception using errcode = '22023', message = 'uploaded encrypted object size mismatch';
    end if;

    has_file := true;
  end if;

  select * into existing from public.shares where public_id = p_public_id for update;
  if found then
    if existing.idempotency_key_hash = p_idempotency_key_hash then
      return query select existing.id, existing.public_id, false;
      return;
    end if;
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end if;

  -- A hash is unique across ALL shares: reuse with another public id is a conflict.
  if exists (
    select 1 from public.shares s
     where s.idempotency_key_hash = p_idempotency_key_hash
       and s.public_id <> p_public_id
     limit 1
  ) then
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end if;

  begin
    insert into public.shares (
      public_id, content_envelope, available_at, expires_at, max_reveals,
      delete_token_hash, password_required, unlock_required, idempotency_key_hash,
      file_object_path, file_envelope, file_ciphertext_size
    ) values (
      p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
      p_delete_token_hash, p_password_required, p_unlock_required, p_idempotency_key_hash,
      case when has_file then reservation.object_path else null end,
      p_file_envelope,
      p_file_ciphertext_size
    )
    returning id into inserted_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end;

  if has_file then
    update public.upload_reservations
      set attached_share_id = inserted_id
      where id = reservation.id;
  end if;

  return query select inserted_id, p_public_id, true;
end;
$$;

-- get_share_status: NULL expiry never becomes unavailable.
create or replace function public.get_share_status(p_public_id text)
returns table (
  status text,
  available_at timestamptz,
  expires_at timestamptz,
  password_required boolean,
  unlock_required boolean,
  max_reveals integer,
  remaining_reveals integer
)
language plpgsql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  share public.shares%rowtype;
  now_utc timestamptz := now();
begin
  select * into share from public.shares where public_id = p_public_id;
  if not found
     or share.revoked_at is not null
     or share.expires_at is not null and share.expires_at <= now_utc
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals then
    return query select 'unavailable'::text, null::timestamptz, null::timestamptz,
      false, false, null::integer, null::integer;
    return;
  end if;
  if share.available_at is not null and share.available_at > now_utc then
    return query select 'scheduled'::text, share.available_at, share.expires_at,
      share.password_required, share.unlock_required, share.max_reveals,
      case when share.max_reveals is null then null else share.max_reveals - share.reveal_count end;
    return;
  end if;
  return query select 'active'::text, null::timestamptz, share.expires_at,
    share.password_required, share.unlock_required, share.max_reveals,
    case when share.max_reveals is null then null else share.max_reveals - share.reveal_count end;
end;
$$;

-- Cleanup candidates: NULL expiry never expires; revocation still qualifies.
create or replace function public.list_cleanup_candidates()
returns table (
  candidate_type text,
  share_id uuid,
  reservation_id uuid,
  object_path text
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select 'share'::text, s.id, null::uuid, s.file_object_path
    from public.shares s
   where (s.expires_at is not null and s.expires_at <= now() or s.revoked_at is not null)
     and s.file_object_path is not null
  union all
  select 'upload'::text, null::uuid, u.id, u.object_path
    from public.upload_reservations u
   where u.attached_share_id is null
     and u.expires_at <= now()
  union all
  select 'upload_rotation'::text, null::uuid, q.id, q.object_path
    from public.upload_rotation_cleanup_queue q
   where not exists (
     select 1 from public.shares s where s.file_object_path = q.object_path
   )
$$;

revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint)
  from public, anon, authenticated;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint)
  to service_role;

revoke all on function public.get_share_status(text) from public, anon, authenticated;
grant execute on function public.get_share_status(text) to service_role;

revoke all on function public.list_cleanup_candidates() from public, anon, authenticated;
grant execute on function public.list_cleanup_candidates() to service_role;

-- reveal_share: NULL expiry never becomes unavailable.
create or replace function public.reveal_share(
  p_public_id text,
  p_request_token_hash bytea
)
returns table (
  status text,
  share_id uuid,
  content_envelope jsonb,
  file_object_path text,
  file_envelope jsonb,
  file_ciphertext_size bigint,
  reveal_count integer,
  max_reveals integer,
  retry_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  share public.shares%rowtype;
  lease public.reveal_leases%rowtype;
  share_found boolean;
  lease_found boolean;
  now_utc timestamptz := now();
begin
  if p_request_token_hash is null or octet_length(p_request_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid reveal request token digest';
  end if;

  select * into share from public.shares where public_id = p_public_id for update;
  share_found := found;
  if share_found then
    select * into lease
      from public.reveal_leases as rl
      where rl.share_id = share.id and rl.request_token_hash = p_request_token_hash;
    lease_found := found;
  else
    lease_found := false;
  end if;

  if share_found and share.available_at is not null and share.available_at > now_utc and not lease_found then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::text,
      null::jsonb, null::bigint, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  if lease_found then
    if lease.retry_expires_at > now_utc then
      return query select 'authorized'::text, share.id, share.content_envelope,
        share.file_object_path, share.file_envelope, share.file_ciphertext_size,
        share.reveal_count, share.max_reveals, lease.retry_expires_at;
      return;
    end if;
    -- A consumed token is never refunded or allowed to consume a second reveal.
    return query select 'request_expired'::text, null::uuid, null::jsonb, null::text,
      null::jsonb, null::bigint, null::integer, null::integer, lease.retry_expires_at;
    return;
  end if;

  if not share_found or share.revoked_at is not null
     or share.expires_at is not null and share.expires_at <= now_utc
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::text,
      null::jsonb, null::bigint, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  update public.shares
    set reveal_count = reveal_count + 1
    where id = share.id
    returning reveal_count into share.reveal_count;

  insert into public.reveal_leases (share_id, request_token_hash, issued_at, retry_expires_at)
    values (share.id, p_request_token_hash, now_utc, now_utc + interval '5 minutes')
    returning retry_expires_at into lease.retry_expires_at;

  return query select 'authorized'::text, share.id, share.content_envelope,
    share.file_object_path, share.file_envelope, share.file_ciphertext_size,
    share.reveal_count, share.max_reveals, lease.retry_expires_at;
end;
$$;

revoke all on function public.reveal_share(text, bytea) from public, anon, authenticated;
grant execute on function public.reveal_share(text, bytea) to service_role;
