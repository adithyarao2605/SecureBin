-- Day 3: Safe Content and Encrypted Attachment Contracts

-- 1. Update securebin_valid_envelope to support v1 content, v2 content, and v2 file (rejecting v1 file)
create or replace function public.securebin_valid_envelope(
  envelope jsonb,
  expected_object_type text,
  require_ciphertext boolean,
  max_ciphertext_bytes integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
declare
  keys text[];
  ciphertext text;
  password_salt jsonb;
  env_version integer;
begin
  if jsonb_typeof(envelope) <> 'object'
     or expected_object_type not in ('content', 'file')
     or max_ciphertext_bytes < (case when require_ciphertext then 16 else 1 end) then
    return false;
  end if;

  select array_agg(key order by key)
    into keys
    from jsonb_object_keys(envelope) as object_keys(key);

  if require_ciphertext then
    if keys <> array['algorithm','ciphertext','factorMask','hkdfSalt','kdf','kdfParameters','nonce','objectType','passwordSalt','version']::text[] then
      return false;
    end if;
  elsif keys <> array['algorithm','factorMask','hkdfSalt','kdf','kdfParameters','nonce','objectType','passwordSalt','version']::text[] then
    return false;
  end if;

  if jsonb_typeof(envelope->'version') <> 'number'
     or jsonb_typeof(envelope->'objectType') <> 'string'
     or jsonb_typeof(envelope->'algorithm') <> 'string'
     or jsonb_typeof(envelope->'nonce') <> 'string'
     or jsonb_typeof(envelope->'hkdfSalt') <> 'string'
     or jsonb_typeof(envelope->'kdf') <> 'string'
     or jsonb_typeof(envelope->'factorMask') <> 'string'
     or envelope->>'objectType' <> expected_object_type
     or envelope->>'algorithm' <> 'AES-256-GCM'
     or envelope->>'factorMask' not in ('link','link+password','link+unlock','link+password+unlock')
     or not securebin_b64url(envelope->>'nonce', 12)
     or not securebin_b64url(envelope->>'hkdfSalt', 16)
     or jsonb_typeof(envelope->'passwordSalt') <> 'null' and not securebin_b64url(envelope->>'passwordSalt', 16)
     or not securebin_valid_kdf_parameters(envelope->>'kdf', envelope->'kdfParameters', envelope->>'factorMask') then
    return false;
  end if;

  env_version := (envelope->>'version')::integer;
  if expected_object_type = 'content' then
    if env_version not in (1, 2) then
      return false;
    end if;
  elsif expected_object_type = 'file' then
    -- File envelopes MUST be version 2 in Day 3
    if env_version <> 2 then
      return false;
    end if;
  end if;

  password_salt := envelope->'passwordSalt';
  if envelope->>'factorMask' in ('link+password', 'link+password+unlock') then
    if password_salt is null or jsonb_typeof(password_salt) = 'null' then
      return false;
    end if;
  elsif password_salt is not null and jsonb_typeof(password_salt) <> 'null' then
    return false;
  end if;

  if require_ciphertext then
    if jsonb_typeof(envelope->'ciphertext') <> 'string' then
      return false;
    end if;
    ciphertext := envelope->>'ciphertext';
    if ciphertext is null
       or not securebin_b64url_range(ciphertext, 16, max_ciphertext_bytes) then
      return false;
    end if;
  end if;

  return true;
end;
$$;

-- 2. Update create_upload_reservation RPC with 10_486_422 size bound and v2 file envelope validation
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
     or p_expected_ciphertext_size not between 16 and 10486422 then
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

    insert into public.upload_rotation_cleanup_queue (
      source_reservation_id, object_path
    ) values (
      existing.id, existing.object_path
    ) on conflict (object_path) do nothing;

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

-- 3. Update create_share RPC with v2 content limit (524315), v2 file envelope limit (10486422), and actual storage size verification
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

  if not securebin_valid_envelope(p_content_envelope, 'content', true, 524315) then
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
       or p_file_ciphertext_size not between 16 and 10486422 then
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

-- 4. Revoke and grant privileges
revoke all on function public.create_upload_reservation(text, bytea, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint) from public, anon, authenticated;

grant execute on function public.create_upload_reservation(text, bytea, jsonb, bigint) to service_role;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, jsonb, bigint) to service_role;
