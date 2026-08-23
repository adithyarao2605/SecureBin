-- Reveal window (Day 6 §2): an optional sender-chosen window that starts at
-- the FIRST successful ciphertext release and closes `reveal_window_seconds`
-- later. Once the window has closed, new reveal authorizations take the
-- uniform unavailable path; the original request token keeps its normal
-- five-minute retry-lease semantics inside reveal_share.

-- ------------------------------------------------------------------- columns

alter table public.shares
  add column if not exists reveal_window_seconds integer,
  add column if not exists first_released_at timestamptz,
  add column if not exists window_ends_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'shares_reveal_window_bounds'
  ) then
    alter table public.shares
      add constraint shares_reveal_window_bounds
      check (reveal_window_seconds is null or reveal_window_seconds between 10 and 86400);
  end if;
end;
$$;

-- --------------------------------------------------------------- create_share

drop function if exists public.create_share(
  text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea
);

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
  staged_count integer := 0;
  staged record;
  object_size bigint;
begin
  if p_delete_token_hash is null or octet_length(p_delete_token_hash) <> 32
     or p_idempotency_key_hash is null or octet_length(p_idempotency_key_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid capability digest';
  end if;

  if p_discussion_capability_hash is not null
     and octet_length(p_discussion_capability_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid discussion capability digest';
  end if;

  if p_reveal_window_seconds is not null
     and p_reveal_window_seconds not between 10 and 86400 then
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

  if (p_password_required or p_unlock_required)
     and p_content_envelope->>'kdf' <> 'PBKDF2-HMAC-SHA-256' then
    raise exception using errcode = '22023', message = 'protected share requires pbkdf2 envelope';
  end if;

  if p_expires_at is not null
     and (p_expires_at <= now() or p_expires_at > now() + interval '30 days') then
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
    if existing.idempotency_key_hash = p_idempotency_key_hash then
      if existing.reveal_window_seconds is distinct from p_reveal_window_seconds then
        raise exception using errcode = '23505', message = 'idempotency_conflict';
      end if;
      return query select existing.id, existing.public_id, false;
      return;
    end if;
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end if;

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
      discussion_capability_hash, reveal_window_seconds
    ) values (
      p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
      p_delete_token_hash, p_password_required, p_unlock_required, p_idempotency_key_hash,
      p_discussion_capability_hash, p_reveal_window_seconds
    )
    returning id into inserted_id;
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
    select case
      when (metadata->>'size') ~ '^[0-9]+$' then (metadata->>'size')::bigint
      else null
    end into object_size
      from storage.objects
      where bucket_id = 'securebin-files'
        and name = staged.object_path;

    if object_size is null or object_size <> staged.expected_ciphertext_size then
      raise exception using errcode = '22023', message = 'uploaded encrypted object size mismatch';
    end if;

    if staged.file_envelope->>'factorMask' <> p_content_envelope->>'factorMask' then
      raise exception using errcode = '22023', message = 'attachment factor mask mismatch';
    end if;

    insert into public.share_attachments (
      share_id, attachment_slot, object_path, file_envelope, file_ciphertext_size
    ) values (
      inserted_id, staged.attachment_slot, staged.object_path,
      staged.file_envelope, staged.expected_ciphertext_size
    );

    update public.upload_reservations
      set attached_share_id = inserted_id,
          attached_at = now()
      where id = staged.id;

    staged_count := staged_count + 1;
  end loop;

  if staged_count > 5 then
    raise exception using errcode = '22023', message = 'too many attachments';
  end if;

  return query select inserted_id, p_public_id, true;
end;
$$;

revoke all on function public.create_share(
  text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, integer
) from public, anon, authenticated;
grant execute on function public.create_share(
  text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, integer
) to service_role;

-- --------------------------------------------------------------- reveal_share

drop function if exists public.reveal_share(text, bytea);

create function public.reveal_share(
  p_public_id text,
  p_request_token_hash bytea
)
returns table (
  status text,
  share_id uuid,
  content_envelope jsonb,
  attachments jsonb,
  reveal_count integer,
  max_reveals integer,
  retry_expires_at timestamptz,
  window_ends_at timestamptz
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
  attachments_json jsonb;
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
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, null::timestamptz, null::timestamptz;
    return;
  end if;

  if lease_found then
    -- Retry-lease semantics are preserved even after the window closes: the
    -- token re-mints the SAME release it already authorized.
    if lease.retry_expires_at > now_utc then
      select coalesce(jsonb_agg(jsonb_build_object(
                 'slot', a.attachment_slot,
                 'objectPath', a.object_path,
                 'envelope', a.file_envelope,
                 'ciphertextSize', a.file_ciphertext_size
               ) order by a.attachment_slot), '[]'::jsonb)
        into attachments_json
        from public.share_attachments a
       where a.share_id = share.id;
      return query select 'authorized'::text, share.id, share.content_envelope,
        attachments_json, share.reveal_count, share.max_reveals,
        lease.retry_expires_at, share.window_ends_at;
      return;
    end if;
    return query select 'request_expired'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, lease.retry_expires_at, null::timestamptz;
    return;
  end if;

  if not share_found or share.revoked_at is not null
     or share.expires_at is not null and share.expires_at <= now_utc
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals
     or share.window_ends_at is not null and now_utc > share.window_ends_at then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, null::timestamptz, null::timestamptz;
    return;
  end if;

  update public.shares
    set reveal_count = reveal_count + 1,
        first_released_at = coalesce(first_released_at, now_utc),
        window_ends_at = case
          when reveal_window_seconds is null then window_ends_at
          else coalesce(window_ends_at, now_utc + make_interval(secs => reveal_window_seconds))
        end
    where id = share.id
    returning reveal_count, first_released_at, window_ends_at
      into share.reveal_count, share.first_released_at, share.window_ends_at;

  insert into public.reveal_leases (share_id, request_token_hash, issued_at, retry_expires_at)
    values (share.id, p_request_token_hash, now_utc, now_utc + interval '5 minutes')
    returning retry_expires_at into lease.retry_expires_at;

  select coalesce(jsonb_agg(jsonb_build_object(
             'slot', a.attachment_slot,
             'objectPath', a.object_path,
             'envelope', a.file_envelope,
             'ciphertextSize', a.file_ciphertext_size
           ) order by a.attachment_slot), '[]'::jsonb)
    into attachments_json
    from public.share_attachments a
   where a.share_id = share.id;

  return query select 'authorized'::text, share.id, share.content_envelope,
    attachments_json, share.reveal_count, share.max_reveals,
    lease.retry_expires_at, share.window_ends_at;
end;
$$;

revoke all on function public.reveal_share(text, bytea) from public, anon, authenticated;
grant execute on function public.reveal_share(text, bytea) to service_role;
