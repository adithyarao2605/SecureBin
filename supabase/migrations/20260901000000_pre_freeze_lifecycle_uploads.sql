-- Pre-freeze lifecycle and upload recovery corrections.
-- This is intentionally forward-only: deployed migrations remain immutable.

-- ---------------------------------------------------------------- lifecycle status

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
     or share.window_ends_at is not null and share.window_ends_at <= now_utc
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

create or replace function public.get_share_status_batch(p_public_ids text[])
returns table (
  public_id text,
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
declare
  now_utc timestamptz := now();
begin
  if p_public_ids is null
     or cardinality(p_public_ids) < 1
     or cardinality(p_public_ids) > 50
     or cardinality(p_public_ids) <> (select count(distinct value) from unnest(p_public_ids) as ids(value))
     or exists (select 1 from unnest(p_public_ids) as ids(value) where not securebin_b64url(ids.value, 16)) then
    raise exception using errcode = '22023', message = 'invalid status batch';
  end if;

  return query
  with requested as (
    select ids.value as public_id, ids.ordinality
      from unnest(p_public_ids) with ordinality as ids(value, ordinality)
  ), classified as (
    select r.public_id, r.ordinality, s.available_at, s.expires_at,
           s.password_required, s.unlock_required, s.max_reveals, s.reveal_count,
           case
             when s.id is null
               or s.revoked_at is not null
               or s.expires_at is not null and s.expires_at <= now_utc
               or s.window_ends_at is not null and s.window_ends_at <= now_utc
               or s.max_reveals is not null and s.reveal_count >= s.max_reveals
               then 'unavailable'
             when s.available_at is not null and s.available_at > now_utc then 'scheduled'
             else 'active'
           end as resolved_status
      from requested r
      left join public.shares s on s.public_id = r.public_id
  )
  select c.public_id, c.resolved_status,
         case when c.resolved_status = 'scheduled' then c.available_at else null end,
         case when c.resolved_status in ('active', 'scheduled') then c.expires_at else null end,
         case when c.resolved_status in ('active', 'scheduled') then c.password_required else false end,
         case when c.resolved_status in ('active', 'scheduled') then c.unlock_required else false end,
         case when c.resolved_status in ('active', 'scheduled') then c.max_reveals else null end,
         case when c.resolved_status in ('active', 'scheduled') and c.max_reveals is not null
           then c.max_reveals - c.reveal_count else null end
    from classified c
   order by c.ordinality;
end;
$$;

-- --------------------------------------------------------------- discussions

create or replace function public.securebin_discussion_share(
  p_public_id text,
  p_capability_raw bytea
)
returns public.shares
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  share public.shares%rowtype;
  capability_hash bytea;
begin
  if p_capability_raw is null or octet_length(p_capability_raw) <> 32 then
    raise exception using errcode = '22023', message = 'invalid discussion capability';
  end if;
  capability_hash := sha256(p_capability_raw);
  select * into share from public.shares where public_id = p_public_id;
  if not found then
    raise exception using errcode = '22023', message = 'discussion unavailable';
  end if;
  if share.revoked_at is not null
     or share.expires_at is not null and share.expires_at <= now()
     or share.window_ends_at is not null and share.window_ends_at <= now()
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals
     or share.available_at is not null and share.available_at > now() then
    raise exception using errcode = '22023', message = 'discussion unavailable';
  end if;
  if share.discussion_capability_hash is null or share.discussion_capability_hash <> capability_hash then
    raise exception using errcode = '22023', message = 'discussion capability mismatch';
  end if;
  return share;
end;
$$;

-- --------------------------------------------------------------- create_share

drop function if exists public.create_share(
  text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, integer
);

create function public.create_share(
  p_public_id text,
  p_content_envelope jsonb,
  p_available_at timestamptz,
  p_expires_at timestamptz,
  p_max_reveals integer,
  p_delete_token_hash bytea,
  p_password_required boolean,
  p_unlock_required boolean,
  p_idempotency_key_hash bytea,
  p_discussion_capability_hash bytea default null,
  p_reveal_window_seconds integer default null
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
  staged record;
  staged_count integer := 0;
  object_size bigint;
begin
  if p_delete_token_hash is null or octet_length(p_delete_token_hash) <> 32
     or p_idempotency_key_hash is null or octet_length(p_idempotency_key_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid capability digest';
  end if;
  if p_discussion_capability_hash is not null and octet_length(p_discussion_capability_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid discussion capability digest';
  end if;
  if p_reveal_window_seconds is not null and p_reveal_window_seconds not between 10 and 86400 then
    raise exception using errcode = '22023', message = 'invalid reveal window';
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
  -- Unlock-only shares deliberately use kdf=none. Password-bearing shares use PBKDF2.
  if (p_password_required and p_content_envelope->>'kdf' <> 'PBKDF2-HMAC-SHA-256')
     or (not p_password_required and p_content_envelope->>'kdf' <> 'none') then
    raise exception using errcode = '22023', message = 'factor kdf does not match envelope';
  end if;
  if p_expires_at is not null and (p_expires_at <= now() or p_expires_at > now() + interval '30 days') then
    raise exception using errcode = '22023', message = 'invalid lifecycle policy';
  end if;
  if p_available_at is not null and p_expires_at is not null and p_available_at >= p_expires_at then
    raise exception using errcode = '22023', message = 'invalid lifecycle policy';
  end if;
  if p_max_reveals is not null and p_max_reveals not between 1 and 100 then
    raise exception using errcode = '22023', message = 'invalid reveal limit';
  end if;

  select * into existing from public.shares where public_id = p_public_id for update;
  if found then
    if existing.idempotency_key_hash <> p_idempotency_key_hash
       or existing.content_envelope <> p_content_envelope
       or existing.available_at is distinct from p_available_at
       or existing.expires_at is distinct from p_expires_at
       or existing.max_reveals is distinct from p_max_reveals
       or existing.delete_token_hash <> p_delete_token_hash
       or existing.password_required is distinct from p_password_required
       or existing.unlock_required is distinct from p_unlock_required
       or existing.discussion_capability_hash is distinct from p_discussion_capability_hash
       or existing.reveal_window_seconds is distinct from p_reveal_window_seconds
       or (select count(*) from public.share_attachments a where a.share_id = existing.id)
          <> (select count(*) from public.upload_reservations u
                where u.reserved_public_id = p_public_id
                  and u.idempotency_key_hash = p_idempotency_key_hash
                  and u.attached_share_id = existing.id)
       or exists (
            select 1 from public.share_attachments a
             where a.share_id = existing.id
               and not exists (
                 select 1 from public.upload_reservations u
                  where u.reserved_public_id = p_public_id
                    and u.idempotency_key_hash = p_idempotency_key_hash
                    and u.attached_share_id = existing.id
                    and u.attachment_slot = a.attachment_slot
                    and u.object_path = a.object_path
                    and u.file_envelope = a.file_envelope
                    and u.expected_ciphertext_size = a.file_ciphertext_size)) then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;
    return query select existing.id, existing.public_id, false;
    return;
  end if;
  if exists (select 1 from public.shares s where s.idempotency_key_hash = p_idempotency_key_hash) then
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end if;

  begin
    insert into public.shares (
      public_id, content_envelope, available_at, expires_at, max_reveals,
      delete_token_hash, password_required, unlock_required, idempotency_key_hash,
      discussion_capability_hash, reveal_window_seconds
    ) values (
      p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
      p_delete_token_hash, p_password_required, p_unlock_required, p_idempotency_key_hash,
      p_discussion_capability_hash, p_reveal_window_seconds
    ) returning id into inserted_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end;

  for staged in
    select * from public.upload_reservations
     where reserved_public_id = p_public_id
       and idempotency_key_hash = p_idempotency_key_hash
       and attached_share_id is null
       and expires_at > now()
     order by attachment_slot
     for update
  loop
    if staged_count >= 5 then
      raise exception using errcode = '22023', message = 'too many attachments';
    end if;
    select case when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint else null end
      into object_size
      from storage.objects where bucket_id = 'securebin-files' and name = staged.object_path;
    if object_size is null or object_size <> staged.expected_ciphertext_size then
      raise exception using errcode = '22023', message = 'uploaded encrypted object size mismatch';
    end if;
    if staged.file_envelope->>'factorMask' <> p_content_envelope->>'factorMask' then
      raise exception using errcode = '22023', message = 'attachment factor mask mismatch';
    end if;
    insert into public.share_attachments (share_id, attachment_slot, object_path, file_envelope, file_ciphertext_size)
      values (inserted_id, staged.attachment_slot, staged.object_path, staged.file_envelope, staged.expected_ciphertext_size);
    update public.upload_reservations set attached_share_id = inserted_id, attached_at = now() where id = staged.id;
    staged_count := staged_count + 1;
  end loop;
  return query select inserted_id, p_public_id, true;
end;
$$;

revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, integer)
  from public, anon, authenticated;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, integer)
  to service_role;

-- --------------------------------------------------------------- reveal_share

drop function if exists public.reveal_share(text, bytea);

create function public.reveal_share(p_public_id text, p_request_token_hash bytea)
returns table (
  status text, share_id uuid, content_envelope jsonb, attachments jsonb,
  reveal_count integer, max_reveals integer, retry_expires_at timestamptz, window_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  share public.shares%rowtype;
  lease public.reveal_leases%rowtype;
  share_found boolean := false;
  lease_found boolean := false;
  now_utc timestamptz := now();
  attachments_json jsonb;
begin
  if p_request_token_hash is null or octet_length(p_request_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid reveal request token digest';
  end if;
  select * into share from public.shares where public_id = p_public_id for update;
  if found then
    share_found := true;
    select * into lease from public.reveal_leases rl
      where rl.share_id = share.id and rl.request_token_hash = p_request_token_hash;
    lease_found := found;
  end if;

  -- Revocation and expiry always win. A lease only preserves its own release
  -- through exhaustion and release-window closure.
  if not share_found or share.revoked_at is not null
     or share.expires_at is not null and share.expires_at <= now_utc
     or share.available_at is not null and share.available_at > now_utc then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, null::timestamptz, null::timestamptz;
    return;
  end if;
  if lease_found then
    if lease.retry_expires_at > now_utc then
      select coalesce(jsonb_agg(jsonb_build_object('slot', a.attachment_slot, 'objectPath', a.object_path,
        'envelope', a.file_envelope, 'ciphertextSize', a.file_ciphertext_size) order by a.attachment_slot), '[]'::jsonb)
        into attachments_json from public.share_attachments a where a.share_id = share.id;
      return query select 'authorized'::text, share.id, share.content_envelope, attachments_json,
        share.reveal_count, share.max_reveals, lease.retry_expires_at, share.window_ends_at;
      return;
    end if;
    return query select 'request_expired'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, lease.retry_expires_at, null::timestamptz;
    return;
  end if;
  if share.max_reveals is not null and share.reveal_count >= share.max_reveals
     or share.window_ends_at is not null and share.window_ends_at <= now_utc then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, null::timestamptz, null::timestamptz;
    return;
  end if;
  update public.shares as s set reveal_count = s.reveal_count + 1,
      first_released_at = coalesce(s.first_released_at, now_utc),
      window_ends_at = case when s.reveal_window_seconds is null then s.window_ends_at
        else coalesce(s.window_ends_at, now_utc + make_interval(secs => s.reveal_window_seconds)) end
    where s.id = share.id
    returning s.reveal_count, s.first_released_at, s.window_ends_at
      into share.reveal_count, share.first_released_at, share.window_ends_at;
  insert into public.reveal_leases as rl (share_id, request_token_hash, issued_at, retry_expires_at)
    values (share.id, p_request_token_hash, now_utc, now_utc + interval '5 minutes')
    returning rl.retry_expires_at into lease.retry_expires_at;
  select coalesce(jsonb_agg(jsonb_build_object('slot', a.attachment_slot, 'objectPath', a.object_path,
    'envelope', a.file_envelope, 'ciphertextSize', a.file_ciphertext_size) order by a.attachment_slot), '[]'::jsonb)
    into attachments_json from public.share_attachments a where a.share_id = share.id;
  return query select 'authorized'::text, share.id, share.content_envelope, attachments_json,
    share.reveal_count, share.max_reveals, lease.retry_expires_at, share.window_ends_at;
end;
$$;

revoke all on function public.reveal_share(text, bytea) from public, anon, authenticated;
grant execute on function public.reveal_share(text, bytea) to service_role;

-- --------------------------------------------------------------- upload recovery

drop function if exists public.create_upload_reservation(text, bytea, jsonb, bigint, integer);

create function public.create_upload_reservation(
  p_public_id text, p_idempotency_key_hash bytea, p_file_envelope jsonb,
  p_expected_ciphertext_size bigint, p_attachment_slot integer default 0
)
returns table (reservation_id uuid, object_path text, expires_at timestamptz,
              attachment_slot integer, already_uploaded boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  existing public.upload_reservations%rowtype;
  new_path text := 'objects/' || encode(gen_random_bytes(24), 'hex') || '.bin';
  new_expiry timestamptz := now() + interval '15 minutes';
  object_size bigint;
begin
  if not securebin_b64url(p_public_id, 16) then raise exception using errcode = '22023', message = 'invalid public id format'; end if;
  if p_idempotency_key_hash is null or octet_length(p_idempotency_key_hash) <> 32 then raise exception using errcode = '22023', message = 'invalid idempotency digest'; end if;
  if p_attachment_slot is null or p_attachment_slot not between 0 and 4 then raise exception using errcode = '22023', message = 'invalid attachment slot'; end if;
  if p_file_envelope is null or not securebin_valid_envelope(p_file_envelope, 'file', false, 1) then raise exception using errcode = '22023', message = 'invalid file metadata envelope'; end if;
  if p_expected_ciphertext_size is null or p_expected_ciphertext_size not between 16 and 10486422 then raise exception using errcode = '22023', message = 'invalid expected ciphertext size'; end if;
  select * into existing from public.upload_reservations
    where reserved_public_id = p_public_id and idempotency_key_hash = p_idempotency_key_hash
      and attachment_slot = p_attachment_slot for update;
  if found then
    if existing.attached_share_id is not null then raise exception using errcode = '22023', message = 'reservation_attached'; end if;
    if existing.file_envelope <> p_file_envelope or existing.expected_ciphertext_size <> p_expected_ciphertext_size then
      raise exception using errcode = '23505', message = 'reservation_conflict';
    end if;
    select case when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint else null end into object_size
      from storage.objects where bucket_id = 'securebin-files' and name = existing.object_path;
    if existing.expires_at > now() and object_size = existing.expected_ciphertext_size then
      return query select existing.id, existing.object_path, existing.expires_at, existing.attachment_slot, true;
      return;
    end if;
    if existing.expires_at > now() and object_size is null then
      return query select existing.id, existing.object_path, existing.expires_at, existing.attachment_slot, false;
      return;
    end if;
    insert into public.upload_rotation_cleanup_queue (source_reservation_id, object_path)
      values (existing.id, existing.object_path) on conflict on constraint upload_rotation_cleanup_path_unique do nothing;
    update public.upload_reservations set object_path = new_path, created_at = now(), expires_at = new_expiry where id = existing.id;
    return query select existing.id, new_path, new_expiry, existing.attachment_slot, false;
    return;
  end if;
  insert into public.upload_reservations (reserved_public_id, idempotency_key_hash, attachment_slot,
    object_path, file_envelope, expected_ciphertext_size, expires_at)
    values (p_public_id, p_idempotency_key_hash, p_attachment_slot, new_path, p_file_envelope,
      p_expected_ciphertext_size, new_expiry)
    returning id into reservation_id;
  return query select reservation_id, new_path, new_expiry, p_attachment_slot, false;
end;
$$;

revoke all on function public.create_upload_reservation(text, bytea, jsonb, bigint, integer) from public, anon, authenticated;
grant execute on function public.create_upload_reservation(text, bytea, jsonb, bigint, integer) to service_role;

-- Cleanup consumers use the historical `share` candidate vocabulary. Emit
-- every attachment path (the service deduplicates share ids before finalize),
-- so a failed Storage deletion leaves the share retryable and a missing object
-- is treated as already removed by finalize_expired_securebin.
create or replace function public.list_cleanup_candidates()
returns table (candidate_type text, share_id uuid, reservation_id uuid, object_path text)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select 'share'::text, s.id, null::uuid, a.object_path
    from public.share_attachments a
    join public.shares s on s.id = a.share_id
   where (s.expires_at is not null and s.expires_at <= now() or s.revoked_at is not null)
  union all
  select 'upload'::text, null::uuid, u.id, u.object_path
    from public.upload_reservations u
   where u.attached_share_id is null and u.expires_at <= now()
  union all
  select 'upload_rotation'::text, null::uuid, q.id, q.object_path
    from public.upload_rotation_cleanup_queue q
   where not exists (select 1 from public.share_attachments a where a.object_path = q.object_path)
$$;

revoke all on function public.list_cleanup_candidates() from public, anon, authenticated;
grant execute on function public.list_cleanup_candidates() to service_role;
