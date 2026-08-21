-- Day 2: Lifecycle Policy Hardening and Upload Reservation Tuple

-- 1. Update upload_reservations table to bind to (reserved_public_id, idempotency_key_hash)
alter table public.upload_reservations
  add column if not exists reserved_public_id text,
  add column if not exists file_envelope jsonb,
  add column if not exists idempotency_key_hash bytea;

-- Drop old reservation_token_hash if it exists and clean up constraints
alter table public.upload_reservations
  drop column if exists reservation_token_hash cascade;

-- Apply constraints and validation to upload_reservations
alter table public.upload_reservations
  alter column reserved_public_id set not null,
  alter column file_envelope set not null,
  alter column idempotency_key_hash set not null;

alter table public.upload_reservations
  drop constraint if exists upload_reservations_idempotency_key_hash_len,
  add constraint upload_reservations_idempotency_key_hash_len check (octet_length(idempotency_key_hash) = 32);

alter table public.upload_reservations
  drop constraint if exists upload_reservations_public_id_idempotency_unique,
  add constraint upload_reservations_public_id_idempotency_unique unique (reserved_public_id, idempotency_key_hash);

-- Fix path regex format with standard character class
alter table public.upload_reservations
  drop constraint if exists upload_reservation_path_format,
  add constraint upload_reservation_path_format check (object_path ~ '^objects/[0-9a-f]{48}[.]bin$');

alter table public.shares
  drop constraint if exists shares_file_path_format,
  add constraint shares_file_path_format check (file_object_path is null or file_object_path ~ '^objects/[0-9a-f]{48}[.]bin$');

-- 2. Drop old RPC overloads
drop function if exists public.create_upload_reservation(bytea, bigint);
drop function if exists public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, jsonb, bigint);

-- 3. New create_upload_reservation RPC bound to (public_id, idempotency_key_hash)
create or replace function public.create_upload_reservation(
  p_public_id text,
  p_idempotency_key_hash bytea,
  p_file_envelope jsonb,
  p_expected_ciphertext_size bigint
)
returns table (
  reservation_id uuid,
  object_path text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
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

  if p_file_envelope is null
     or not securebin_valid_envelope(p_file_envelope, 'file', false, 1) then
    raise exception using errcode = '22023', message = 'invalid file metadata envelope';
  end if;

  if p_expected_ciphertext_size is null
     or p_expected_ciphertext_size not between 16 and 10485776 then
    raise exception using errcode = '22023', message = 'invalid expected ciphertext size';
  end if;

  select * into existing
    from public.upload_reservations
    where reserved_public_id = p_public_id
      and idempotency_key_hash = p_idempotency_key_hash
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
      return query select existing.id, existing.object_path, existing.expires_at;
      return;
    end if;

    -- Expired and unattached: transactionally reinitialize with fresh path and 15-min expiry
    update public.upload_reservations
      set object_path = new_path,
          expires_at = new_expiry
      where id = existing.id;

    return query select existing.id, new_path, new_expiry;
    return;
  end if;

  insert into public.upload_reservations (
    id, reserved_public_id, idempotency_key_hash, file_envelope,
    expected_ciphertext_size, object_path, expires_at
  ) values (
    new_id, p_public_id, p_idempotency_key_hash, p_file_envelope,
    p_expected_ciphertext_size, new_path, new_expiry
  );

  return query select new_id, new_path, new_expiry;
end;
$$;

-- 4. New 11-argument create_share RPC with strict idempotency comparison
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

  if not securebin_valid_envelope(p_content_envelope, 'content', true, 524304) then
    raise exception using errcode = '22023', message = 'invalid content envelope';
  end if;

  if p_password_required is distinct from
       (p_content_envelope->>'factorMask' in ('link+password', 'link+password+unlock'))
     or p_unlock_required is distinct from
       (p_content_envelope->>'factorMask' in ('link+unlock', 'link+password+unlock')) then
    raise exception using errcode = '22023', message = 'factor prompt flags do not match envelope';
  end if;

  if p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '30 days'
     or p_available_at is not null and p_available_at >= p_expires_at
     or p_max_reveals is not null and p_max_reveals not in (1, 3, 5, 10) then
    raise exception using errcode = '22023', message = 'invalid lifecycle policy';
  end if;

  if (p_file_envelope is null and p_file_ciphertext_size is not null)
     or (p_file_envelope is not null and p_file_ciphertext_size is null) then
    raise exception using errcode = '22023', message = 'invalid file attachment fields';
  end if;

  if p_file_envelope is not null then
    if not securebin_valid_envelope(p_file_envelope, 'file', false, 1)
       or p_file_envelope->>'factorMask' <> p_content_envelope->>'factorMask'
       or p_file_ciphertext_size not between 16 and 10485776 then
      raise exception using errcode = '22023', message = 'invalid encrypted file envelope';
    end if;

    select * into reservation
      from public.upload_reservations
      where reserved_public_id = p_public_id
        and idempotency_key_hash = p_idempotency_key_hash
      for update;

    if not found
       or reservation.expected_ciphertext_size <> p_file_ciphertext_size
       or reservation.file_envelope <> p_file_envelope then
      raise exception using errcode = '22023', message = 'invalid or missing upload reservation';
    end if;

    if reservation.attached_share_id is not null then
      select * into existing from public.shares where id = reservation.attached_share_id;
      if found and existing.idempotency_key_hash = p_idempotency_key_hash
         and existing.public_id = p_public_id then
        return query select existing.id, existing.public_id, false;
        return;
      end if;
      raise exception using errcode = '22023', message = 'upload reservation already attached';
    end if;

    if reservation.expires_at <= now() then
      raise exception using errcode = '22023', message = 'upload reservation expired';
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

  insert into public.shares (
    public_id, content_envelope, available_at, expires_at, max_reveals,
    delete_token_hash, password_required, unlock_required, file_object_path,
    file_envelope, file_ciphertext_size, idempotency_key_hash
  ) values (
    p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
    p_delete_token_hash, p_password_required, p_unlock_required,
    case when has_file then reservation.object_path else null end,
    p_file_envelope, p_file_ciphertext_size, p_idempotency_key_hash
  )
  on conflict (idempotency_key_hash) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select * into existing from public.shares where idempotency_key_hash = p_idempotency_key_hash for update;
    if not found then
      raise exception using errcode = '40001', message = 'share creation retry conflicted';
    end if;

    if existing.public_id <> p_public_id
       or existing.content_envelope <> p_content_envelope
       or existing.delete_token_hash <> p_delete_token_hash
       or existing.password_required <> p_password_required
       or existing.unlock_required <> p_unlock_required
       or existing.expires_at <> p_expires_at
       or (existing.available_at is distinct from p_available_at)
       or (existing.max_reveals is distinct from p_max_reveals)
       or (existing.file_envelope is distinct from p_file_envelope)
       or (existing.file_ciphertext_size is distinct from p_file_ciphertext_size) then
      raise exception using errcode = '23505', message = 'idempotency_conflict';
    end if;

    return query select existing.id, existing.public_id, false;
    return;
  end if;

  if has_file then
    update public.upload_reservations
      set attached_share_id = inserted_id,
          attached_at = now()
      where id = reservation.id;
  end if;

  return query select inserted_id, p_public_id, true;
end;
$$;

-- 5. Revoke and grant privileges
revoke all on function public.create_upload_reservation(text, bytea, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint) from public, anon, authenticated;

grant execute on function public.create_upload_reservation(text, bytea, jsonb, bigint) to service_role;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint) to service_role;
