-- Day 5: multiple encrypted attachments per share.
--
-- Model change: the single (file_object_path, file_envelope,
-- file_ciphertext_size) triple on shares becomes a child table. Reservations
-- gain an attachment slot so one create attempt can stage several objects
-- under the same idempotency key. create_share loses its file parameters and
-- instead binds every staged reservation for its tuple. reveal_share returns
-- the attachment array; signed URLs are minted server-side per reveal as
-- before.

-- ---------------------------------------------------------------- reservations

alter table public.upload_reservations
  add column if not exists attachment_slot integer not null default 0;

alter table public.upload_reservations
  drop constraint if exists upload_reservations_public_id_key_hash_unique;

alter table public.upload_reservations
  add constraint upload_reservations_tuple_slot_unique
    unique (reserved_public_id, idempotency_key_hash, attachment_slot);

alter table public.upload_reservations
  drop constraint if exists upload_reservations_slot_nonnegative;
alter table public.upload_reservations
  add constraint upload_reservations_slot_nonnegative check (attachment_slot >= 0);

-- ---------------------------------------------------------------- attachments

create table if not exists public.share_attachments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares(id) on delete cascade,
  attachment_slot integer not null,
  object_path text not null,
  file_envelope jsonb not null,
  file_ciphertext_size bigint not null,
  created_at timestamptz not null default now(),
  constraint share_attachments_path_format
    check (object_path ~ '^objects/[0-9a-f]{48}[.]bin$'),
  constraint share_attachments_size_range
    check (file_ciphertext_size between 16 and 10486422),
  constraint share_attachments_slot_nonnegative check (attachment_slot >= 0),
  constraint share_attachments_slot_unique unique (share_id, attachment_slot),
  constraint share_attachments_envelope_valid
    check (securebin_valid_envelope(file_envelope, 'file', false, 1))
);

alter table public.share_attachments enable row level security;
alter table public.share_attachments force row level security;

revoke all on public.share_attachments from public, anon, authenticated;

create index if not exists share_attachments_share_idx
  on public.share_attachments (share_id, attachment_slot);

-- Backfill legacy single-file shares (slot 0), then retire the columns.
insert into public.share_attachments (share_id, attachment_slot, object_path, file_envelope, file_ciphertext_size)
select id, 0, file_object_path, file_envelope, file_ciphertext_size
  from public.shares
 where file_object_path is not null
on conflict (share_id, attachment_slot) do nothing;

alter table public.shares
  drop constraint if exists shares_file_fields_together,
  drop constraint if exists shares_file_path_format,
  drop constraint if exists shares_file_envelope_format,
  drop constraint if exists shares_file_size_limit;

alter table public.shares
  drop column if exists file_object_path,
  drop column if exists file_envelope,
  drop column if exists file_ciphertext_size;

-- ------------------------------------------------- create_upload_reservation

drop function if exists public.create_upload_reservation(text, bytea, jsonb, bigint);

create function public.create_upload_reservation(
  p_public_id text,
  p_idempotency_key_hash bytea,
  p_file_envelope jsonb,
  p_expected_ciphertext_size bigint,
  p_attachment_slot integer default 0
)
returns table (
  reservation_id uuid,
  object_path text,
  expires_at timestamptz,
  attachment_slot integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  existing public.upload_reservations%rowtype;
  new_id uuid := gen_random_uuid();
  new_path text := 'objects/' || encode(gen_random_bytes(24), 'hex') || '.bin';
  new_expiry timestamptz := now() + interval '15 minutes';
begin
  if not securebin_b64url(p_public_id, 16) then
    raise exception using errcode = '22023', message = 'invalid public id format';
  end if;

  if p_idempotency_key_hash is null or octet_length(p_idempotency_key_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid idempotency digest';
  end if;

  if p_attachment_slot is null or p_attachment_slot < 0 or p_attachment_slot > 4 then
    raise exception using errcode = '22023', message = 'invalid attachment slot';
  end if;

  if p_file_envelope is null
     or not securebin_valid_envelope(p_file_envelope, 'file', false, 1) then
    raise exception using errcode = '22023', message = 'invalid file metadata envelope';
  end if;

  if p_expected_ciphertext_size is null
     or p_expected_ciphertext_size not between 16 and 10486422 then
    raise exception using errcode = '22023', message = 'invalid expected ciphertext size';
  end if;

  select * into existing
    from public.upload_reservations
    where reserved_public_id = p_public_id
      and idempotency_key_hash = p_idempotency_key_hash
      and attachment_slot = p_attachment_slot
    for update;

  if found then
    if existing.attached_share_id is not null then
      raise exception using errcode = '22023', message = 'reservation_attached';
    end if;

    if existing.file_envelope <> p_file_envelope
       or existing.expected_ciphertext_size <> p_expected_ciphertext_size then
      raise exception using errcode = '23505', message = 'reservation_conflict';
    end if;

    if existing.expires_at > now() then
      return query select existing.id, existing.object_path, existing.expires_at, existing.attachment_slot;
      return;
    end if;

    insert into public.upload_rotation_cleanup_queue (source_reservation_id, object_path)
      values (existing.id, existing.object_path)
      on conflict on constraint upload_rotation_cleanup_path_unique do nothing;

    update public.upload_reservations
      set object_path = new_path,
          created_at = now(),
          expires_at = new_expiry
      where id = existing.id;

    return query select existing.id, new_path, new_expiry, existing.attachment_slot;
    return;
  end if;

  insert into public.upload_reservations (
    reserved_public_id, idempotency_key_hash, attachment_slot,
    object_path, file_envelope, expected_ciphertext_size, expires_at
  ) values (
    p_public_id, p_idempotency_key_hash, p_attachment_slot,
    new_path, p_file_envelope, p_expected_ciphertext_size, new_expiry
  )
  returning id into new_id;

  return query select new_id, new_path, new_expiry, p_attachment_slot;
end;
$$;

-- ------------------------------------------------------------------ create_share

drop function if exists public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint);

create function public.create_share(
  p_public_id text,
  p_content_envelope jsonb,
  p_available_at timestamptz,
  p_expires_at timestamptz,
  p_max_reveals integer,
  p_delete_token_hash bytea,
  p_password_required boolean,
  p_unlock_required boolean,
  p_idempotency_key_hash bytea
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
      return query select existing.id, existing.public_id, false;
      return;
    end if;
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end if;

  -- A key bound to another public id is always a hard conflict.
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
      delete_token_hash, password_required, unlock_required, idempotency_key_hash
    ) values (
      p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
      p_delete_token_hash, p_password_required, p_unlock_required, p_idempotency_key_hash
    )
    returning id into inserted_id;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'idempotency_conflict';
  end;

  -- Bind every staged reservation for this tuple, verifying real object sizes.
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
      set attached_share_id = inserted_id
      where id = staged.id;

    staged_count := staged_count + 1;
  end loop;

  if staged_count > 5 then
    raise exception using errcode = '22023', message = 'too many attachments';
  end if;

  return query select inserted_id, p_public_id, true;
end;
$$;

-- ------------------------------------------------------------------ reveal_share

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
      null::integer, null::integer, null::timestamptz;
    return;
  end if;

  if lease_found then
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
        attachments_json, share.reveal_count, share.max_reveals, lease.retry_expires_at;
      return;
    end if;
    return query select 'request_expired'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, lease.retry_expires_at;
    return;
  end if;

  if not share_found or share.revoked_at is not null
     or share.expires_at is not null and share.expires_at <= now_utc
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::jsonb,
      null::integer, null::integer, null::timestamptz;
    return;
  end if;

  update public.shares
    set reveal_count = reveal_count + 1
    where id = share.id
    returning reveal_count into share.reveal_count;

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
    attachments_json, share.reveal_count, share.max_reveals, lease.retry_expires_at;
end;
$$;

-- ------------------------------------------------------------------- cleanup

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
  select 'attachment'::text, s.id, null::uuid, a.object_path
    from public.share_attachments a
    join public.shares s on s.id = a.share_id
   where s.expires_at is not null and s.expires_at <= now() or s.revoked_at is not null
  union all
  select 'upload'::text, null::uuid, u.id, u.object_path
    from public.upload_reservations u
   where u.attached_share_id is null
     and u.expires_at <= now()
  union all
  select 'upload_rotation'::text, null::uuid, q.id, q.object_path
    from public.upload_rotation_cleanup_queue q
   where not exists (
     select 1 from public.share_attachments a where a.object_path = q.object_path
   )
$$;

-- --------------------------------------------------------------------- grants

revoke all on function public.create_upload_reservation(text, bytea, jsonb, bigint, integer)
  from public, anon, authenticated;
grant execute on function public.create_upload_reservation(text, bytea, jsonb, bigint, integer)
  to service_role;

revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea)
  from public, anon, authenticated;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea)
  to service_role;

revoke all on function public.reveal_share(text, bytea) from public, anon, authenticated;
grant execute on function public.reveal_share(text, bytea) to service_role;

revoke all on function public.list_cleanup_candidates() from public, anon, authenticated;
grant execute on function public.list_cleanup_candidates() to service_role;

-- finalize_expired_securebin: attachment-aware finalization. Shares finalize
-- only when every staged attachment path is proven gone from Storage (or the
-- share has none); rotation queue rows compare against share_attachments.
create or replace function public.finalize_expired_securebin(
  p_share_ids uuid[] default null,
  p_reservation_ids uuid[] default null,
  p_rotation_ids uuid[] default null
)
returns table (
  deleted_shares integer,
  deleted_uploads integer,
  deleted_rotated_uploads integer,
  deleted_leases integer,
  deleted_buckets integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  share_count integer;
  upload_count integer;
  rotation_count integer;
  lease_count integer;
  bucket_count integer;
begin
  delete from public.shares as s
    where (p_share_ids is null or s.id = any (p_share_ids))
      and (s.expires_at is not null and s.expires_at <= now() or s.revoked_at is not null)
      and not exists (
        select 1 from public.share_attachments as a
        where a.share_id = s.id
          and exists (
            select 1 from storage.objects as object_row
            where object_row.bucket_id = 'securebin-files'
              and object_row.name = a.object_path
          )
      );
  get diagnostics share_count = row_count;

  delete from public.upload_reservations as u
    where (p_reservation_ids is null or u.id = any (p_reservation_ids))
      and u.attached_share_id is null
      and u.expires_at <= now()
      and not exists (
        select 1 from storage.objects as object_row
        where object_row.bucket_id = 'securebin-files'
          and object_row.name = u.object_path
      );
  get diagnostics upload_count = row_count;

  delete from public.upload_rotation_cleanup_queue as q
    where p_rotation_ids is not null
      and q.id = any (p_rotation_ids)
      and not exists (
        select 1 from public.share_attachments as a
        where a.object_path = q.object_path
      )
      and not exists (
        select 1 from public.upload_reservations as u
        where u.object_path = q.object_path
      )
      and not exists (
        select 1 from storage.objects as object_row
        where object_row.bucket_id = 'securebin-files'
          and object_row.name = q.object_path
      );
  get diagnostics rotation_count = row_count;

  delete from public.reveal_leases
    where retry_expires_at <= now() - interval '24 hours';
  get diagnostics lease_count = row_count;

  delete from public.rate_limit_buckets
    where expires_at <= now();
  get diagnostics bucket_count = row_count;

  return query select share_count, upload_count, rotation_count, lease_count, bucket_count;
end;
$$;

revoke all on function public.finalize_expired_securebin(uuid[], uuid[], uuid[])
  from public, anon, authenticated;
grant execute on function public.finalize_expired_securebin(uuid[], uuid[], uuid[])
  to service_role;
