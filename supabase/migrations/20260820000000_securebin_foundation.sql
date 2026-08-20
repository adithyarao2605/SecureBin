-- SecureBin Day 1 database foundation.
--
-- The browser owns all content keys.  This schema intentionally stores only
-- encrypted envelopes, lifecycle metadata, and one-way capability digests.
-- RPCs are SECURITY DEFINER and are callable only by the server service role.

create extension if not exists pgcrypto with schema extensions;

set check_function_bodies = on;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    raise exception 'SecureBin requires the Supabase service_role';
  end if;
end
$$;

create or replace function public.securebin_b64url(value text, expected_bytes integer)
returns boolean
language plpgsql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
declare
  decoded bytea;
  canonical text;
begin
  if expected_bytes < 1
     or value !~ '^[A-Za-z0-9_-]+$'
     or length(value) <> ceil(expected_bytes * 8.0 / 6.0)::integer then
    return false;
  end if;

  decoded := decode(
    translate(value, '-_', '+/') || repeat('=', (4 - length(value) % 4) % 4),
    'base64'
  );
  canonical := replace(replace(rtrim(encode(decoded, 'base64'), '='), '+', '-'), '/', '_');
  return octet_length(decoded) = expected_bytes and canonical = value;
exception when invalid_text_representation or invalid_parameter_value then
  return false;
end;
$$;

create or replace function public.securebin_b64url_range(
  value text,
  minimum_bytes integer,
  maximum_bytes integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
declare
  decoded bytea;
  canonical text;
begin
  if minimum_bytes < 1
     or maximum_bytes < minimum_bytes
     or value !~ '^[A-Za-z0-9_-]+$'
     or length(value) < ceil(minimum_bytes * 8.0 / 6.0)::integer
     or length(value) > ceil(maximum_bytes * 8.0 / 6.0)::integer then
    return false;
  end if;

  decoded := decode(
    translate(value, '-_', '+/') || repeat('=', (4 - length(value) % 4) % 4),
    'base64'
  );
  canonical := replace(replace(rtrim(encode(decoded, 'base64'), '='), '+', '-'), '/', '_');
  return octet_length(decoded) between minimum_bytes and maximum_bytes
    and canonical = value;
exception when invalid_text_representation or invalid_parameter_value then
  return false;
end;
$$;

create or replace function public.securebin_valid_kdf_parameters(
  kdf text,
  parameters jsonb,
  factor_mask text
)
returns boolean
language sql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
  select case
    when kdf = 'none' then parameters = '{}'::jsonb
      and factor_mask in ('link', 'link+unlock')
    when kdf = 'PBKDF2-HMAC-SHA-256' then
      jsonb_typeof(parameters) = 'object'
      and parameters = '{"iterations":600000}'::jsonb
      and factor_mask in ('link+password', 'link+password+unlock')
    else false
  end;
$$;

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
     or envelope->>'version' <> '1'
     or envelope->>'objectType' <> expected_object_type
     or envelope->>'algorithm' <> 'AES-256-GCM'
     or envelope->>'factorMask' not in ('link','link+password','link+unlock','link+password+unlock')
     or not securebin_b64url(envelope->>'nonce', 12)
     or not securebin_b64url(envelope->>'hkdfSalt', 16)
     or jsonb_typeof(envelope->'passwordSalt') <> 'null' and not securebin_b64url(envelope->>'passwordSalt', 16)
     or not securebin_valid_kdf_parameters(envelope->>'kdf', envelope->'kdfParameters', envelope->>'factorMask') then
    return false;
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

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique,
  content_envelope jsonb not null,
  created_at timestamptz not null default now(),
  available_at timestamptz,
  expires_at timestamptz not null,
  max_reveals integer,
  reveal_count integer not null default 0,
  revoked_at timestamptz,
  delete_token_hash bytea not null,
  password_required boolean not null default false,
  unlock_required boolean not null default false,
  file_object_path text,
  file_envelope jsonb,
  file_ciphertext_size bigint,
  idempotency_key_hash bytea not null unique,
  constraint shares_public_id_format check (securebin_b64url(public_id, 16)),
  constraint shares_content_envelope_format check (
    securebin_valid_envelope(content_envelope, 'content', true, 524304)
  ),
  constraint shares_factor_prompt_flags check (
    password_required = (content_envelope->>'factorMask' in ('link+password', 'link+password+unlock'))
    and unlock_required = (content_envelope->>'factorMask' in ('link+unlock', 'link+password+unlock'))
  ),
  constraint shares_expiry_order check (expires_at > created_at),
  constraint shares_expiry_cap check (expires_at <= created_at + interval '30 days'),
  constraint shares_availability_before_expiry check (available_at is null or available_at < expires_at),
  constraint shares_reveal_limit check (max_reveals is null or max_reveals in (1, 3, 5, 10)),
  constraint shares_reveal_count_nonnegative check (reveal_count >= 0),
  constraint shares_reveal_count_within_limit check (max_reveals is null or reveal_count <= max_reveals),
  constraint shares_delete_token_hash_size check (octet_length(delete_token_hash) = 32),
  constraint shares_idempotency_hash_size check (octet_length(idempotency_key_hash) = 32),
  constraint shares_file_fields_together check (
    (file_object_path is null and file_envelope is null and file_ciphertext_size is null)
    or (file_object_path is not null and file_envelope is not null and file_ciphertext_size is not null)
  ),
  constraint shares_file_path_format check (
    file_object_path is null or file_object_path ~ '^objects/[0-9a-f]{48}\\.bin$'
  ),
  constraint shares_file_envelope_format check (
    file_envelope is null or (
      securebin_valid_envelope(file_envelope, 'file', false, 1)
      and file_envelope->>'factorMask' = content_envelope->>'factorMask'
    )
  ),
  constraint shares_file_size_limit check (
    file_ciphertext_size is null or file_ciphertext_size between 16 and 10485776
  )
);

create index if not exists shares_active_lookup_idx
  on public.shares (public_id, expires_at, available_at)
  where revoked_at is null;

create index if not exists shares_cleanup_idx
  on public.shares (expires_at)
  where revoked_at is null;

create table if not exists public.upload_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_token_hash bytea not null unique,
  object_path text not null unique,
  expected_ciphertext_size bigint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attached_share_id uuid references public.shares(id) on delete cascade,
  attached_at timestamptz,
  constraint upload_reservation_hash_size check (octet_length(reservation_token_hash) = 32),
  constraint upload_reservation_path_format check (object_path ~ '^objects/[0-9a-f]{48}\\.bin$'),
  constraint upload_reservation_size_limit check (expected_ciphertext_size between 16 and 10485776),
  constraint upload_reservation_expiry_order check (expires_at > created_at),
  constraint upload_reservation_expiry_cap check (expires_at <= created_at + interval '15 minutes'),
  constraint upload_reservation_attachment_fields check (
    (attached_share_id is null and attached_at is null)
    or (attached_share_id is not null and attached_at is not null)
  )
);

create index if not exists upload_reservations_cleanup_idx
  on public.upload_reservations (expires_at)
  where attached_share_id is null;

create table if not exists public.reveal_leases (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares(id) on delete cascade,
  request_token_hash bytea not null,
  issued_at timestamptz not null default now(),
  retry_expires_at timestamptz not null,
  constraint reveal_lease_token_hash_size check (octet_length(request_token_hash) = 32),
  constraint reveal_lease_expiry_order check (retry_expires_at > issued_at),
  constraint reveal_lease_expiry_cap check (retry_expires_at <= issued_at + interval '5 minutes'),
  constraint reveal_lease_share_token_unique unique (share_id, request_token_hash)
);

create index if not exists reveal_leases_cleanup_idx
  on public.reveal_leases (retry_expires_at);

create table if not exists public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  discriminator_hash bytea not null,
  action text not null,
  bucket_started_at timestamptz not null,
  request_count integer not null default 0,
  expires_at timestamptz not null,
  constraint rate_limit_discriminator_hash_size check (octet_length(discriminator_hash) = 32),
  constraint rate_limit_action_allowed check (action in ('upload','create','status','reveal','delete')),
  constraint rate_limit_count_nonnegative check (request_count >= 0),
  constraint rate_limit_expiry_order check (expires_at > bucket_started_at),
  constraint rate_limit_bucket_unique unique (discriminator_hash, action, bucket_started_at)
);

create index if not exists rate_limit_cleanup_idx
  on public.rate_limit_buckets (expires_at);

-- The service role reaches these records only through server-side RPCs.  There
-- are deliberately no client policies, so anon/authenticated have no rows.
alter table public.shares enable row level security;
alter table public.shares force row level security;
alter table public.upload_reservations enable row level security;
alter table public.upload_reservations force row level security;
alter table public.reveal_leases enable row level security;
alter table public.reveal_leases force row level security;
alter table public.rate_limit_buckets enable row level security;
alter table public.rate_limit_buckets force row level security;

revoke all on table public.shares, public.upload_reservations, public.reveal_leases, public.rate_limit_buckets from public, anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('securebin-files', 'securebin-files', false, 14680064, array['application/octet-stream']::text[])
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Do not expose Storage metadata or object rows to browser roles.  Signed
-- operations are generated server-side with the service role.
revoke all on table storage.buckets, storage.objects from public, anon, authenticated;
grant all on table storage.buckets, storage.objects to service_role;

create or replace function public.create_upload_reservation(
  p_reservation_token_hash bytea,
  p_expected_ciphertext_size bigint
)
returns table (reservation_id uuid, object_path text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  new_id uuid := gen_random_uuid();
  new_path text := 'objects/' || encode(gen_random_bytes(24), 'hex') || '.bin';
  new_expiry timestamptz := now() + interval '15 minutes';
  existing public.upload_reservations%rowtype;
begin
  if p_reservation_token_hash is null or octet_length(p_reservation_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid reservation capability digest';
  end if;
  if p_expected_ciphertext_size is null or p_expected_ciphertext_size not between 16 and 10485776 then
    raise exception using errcode = '22023', message = 'invalid encrypted object size';
  end if;

  select * into existing
    from public.upload_reservations
    where reservation_token_hash = p_reservation_token_hash;
  if found then
    if existing.expected_ciphertext_size <> p_expected_ciphertext_size then
      raise exception using errcode = '23505', message = 'reservation capability belongs to another upload';
    end if;
    return query select existing.id, existing.object_path, existing.expires_at;
    return;
  end if;

  insert into public.upload_reservations (
    id, reservation_token_hash, object_path, expected_ciphertext_size, expires_at
  ) values (
    new_id, p_reservation_token_hash, new_path, p_expected_ciphertext_size, new_expiry
  );

  return query select new_id, new_path, new_expiry;
end;
$$;

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
  p_reservation_token_hash bytea default null,
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
  has_reservation boolean := false;
begin
  if p_delete_token_hash is null or octet_length(p_delete_token_hash) <> 32
     or p_idempotency_key_hash is null or octet_length(p_idempotency_key_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid capability digest';
  end if;
  if not securebin_b64url(p_public_id, 16)
     or not securebin_valid_envelope(p_content_envelope, 'content', true, 524304) then
    raise exception using errcode = '22023', message = 'invalid content envelope';
  end if;
  if p_password_required is distinct from
       (p_content_envelope->>'factorMask' in ('link+password', 'link+password+unlock'))
     or p_unlock_required is distinct from
       (p_content_envelope->>'factorMask' in ('link+unlock', 'link+password+unlock')) then
    raise exception using errcode = '22023', message = 'factor prompt flags do not match envelope';
  end if;

  -- Fast path for a lost response.  This also prevents a retry from trying
  -- to re-attach an upload reservation that the first attempt already used.
  select * into existing
    from public.shares
    where idempotency_key_hash = p_idempotency_key_hash;
  if found then
    if existing.public_id <> p_public_id then
      raise exception using errcode = '23505', message = 'idempotency key belongs to another share';
    end if;
    return query select existing.id, existing.public_id, false;
    return;
  end if;

  if p_expires_at is null or p_expires_at <= now()
     or p_expires_at > now() + interval '30 days'
     or p_available_at is not null and p_available_at >= p_expires_at
     or p_max_reveals is not null and p_max_reveals not in (1, 3, 5, 10) then
    raise exception using errcode = '22023', message = 'invalid lifecycle policy';
  end if;

  if p_reservation_token_hash is null then
    if p_file_envelope is not null or p_file_ciphertext_size is not null then
      raise exception using errcode = '22023', message = 'file fields require an upload reservation';
    end if;
  else
    if octet_length(p_reservation_token_hash) <> 32
       or p_file_envelope is null
       or not securebin_valid_envelope(p_file_envelope, 'file', false, 1)
       or p_file_envelope->>'factorMask' <> p_content_envelope->>'factorMask'
       or p_file_ciphertext_size is null
       or p_file_ciphertext_size not between 16 and 10485776 then
      raise exception using errcode = '22023', message = 'invalid encrypted file reservation';
    end if;

    select * into reservation
      from public.upload_reservations
      where reservation_token_hash = p_reservation_token_hash
      for update;
    if not found or reservation.expires_at <= now()
       or reservation.expected_ciphertext_size <> p_file_ciphertext_size then
      raise exception using errcode = '22023', message = 'invalid or expired upload reservation';
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
    has_reservation := true;
  end if;

  insert into public.shares (
    public_id, content_envelope, available_at, expires_at, max_reveals,
    delete_token_hash, password_required, unlock_required, file_object_path,
    file_envelope, file_ciphertext_size, idempotency_key_hash
  ) values (
    p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
    p_delete_token_hash, p_password_required, p_unlock_required,
    case when has_reservation then reservation.object_path else null end,
    p_file_envelope, p_file_ciphertext_size, p_idempotency_key_hash
  )
  on conflict (idempotency_key_hash) do nothing
  returning id into inserted_id;

  if inserted_id is null then
    select * into existing from public.shares where idempotency_key_hash = p_idempotency_key_hash;
    if not found then
      raise exception using errcode = '40001', message = 'share creation retry conflicted';
    end if;
    if existing.public_id <> p_public_id then
      raise exception using errcode = '23505', message = 'idempotency key belongs to another share';
    end if;
    return query select existing.id, existing.public_id, false;
    return;
  end if;

  if has_reservation then
    update public.upload_reservations
      set attached_share_id = inserted_id,
          attached_at = now()
      where id = reservation.id;
  end if;

  return query select inserted_id, p_public_id, true;
end;
$$;

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
declare
  share public.shares%rowtype;
  now_utc timestamptz := now();
begin
  select * into share from public.shares where public_id = p_public_id;
  if not found or share.revoked_at is not null or share.expires_at <= now_utc
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

  if not share_found or share.revoked_at is not null or share.expires_at <= now_utc
     or share.available_at is not null and share.available_at > now_utc
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals then
    return query select 'unavailable'::text, null::uuid, null::jsonb, null::text,
      null::jsonb, null::bigint, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  update public.shares as s
    set reveal_count = s.reveal_count + 1
    where s.id = share.id;

  insert into public.reveal_leases (share_id, request_token_hash, issued_at, retry_expires_at)
  values (share.id, p_request_token_hash, now_utc, now_utc + interval '5 minutes')
  returning * into lease;

  return query select 'authorized'::text, share.id, share.content_envelope,
    share.file_object_path, share.file_envelope, share.file_ciphertext_size,
    share.reveal_count + 1, share.max_reveals, lease.retry_expires_at;
end;
$$;

create or replace function public.revoke_share(
  p_public_id text,
  p_delete_token_hash bytea
)
returns table (valid_capability boolean, revoked boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  changed integer;
begin
  if p_delete_token_hash is null or octet_length(p_delete_token_hash) <> 32 then
    return query select false, false;
    return;
  end if;
  update public.shares
    set revoked_at = coalesce(revoked_at, now())
    where public_id = p_public_id and delete_token_hash = p_delete_token_hash;
  get diagnostics changed = row_count;
  if changed = 1 then
    return query select true, true;
  else
    return query select false, false;
  end if;
end;
$$;

create or replace function public.consume_rate_limit(
  p_discriminator_hash bytea,
  p_action text,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  bucket timestamptz := date_trunc('minute', now());
  current_count integer;
begin
  if p_discriminator_hash is null or octet_length(p_discriminator_hash) <> 32
     or p_action not in ('upload','create','status','reveal','delete')
     or p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception using errcode = '22023', message = 'invalid rate-limit input';
  end if;
  insert into public.rate_limit_buckets (
    discriminator_hash, action, bucket_started_at, request_count, expires_at
  ) values (
    p_discriminator_hash, p_action, bucket, 1, bucket + interval '2 minutes'
  )
  on conflict (discriminator_hash, action, bucket_started_at)
  do update set request_count = public.rate_limit_buckets.request_count + 1
  returning request_count into current_count;
  return current_count <= p_limit;
end;
$$;

create or replace function public.list_cleanup_candidates()
returns table (
  candidate_type text,
  share_id uuid,
  reservation_id uuid,
  object_path text
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- The server must delete these paths through the Supabase Storage API. SQL
  -- DELETE on storage.objects only removes metadata and can orphan blobs.
  return query
    select 'share'::text, s.id, null::uuid, s.file_object_path
      from public.shares as s
      where (s.expires_at <= now() or s.revoked_at is not null)
        and s.file_object_path is not null
    union all
    select 'upload'::text, null::uuid, u.id, u.object_path
      from public.upload_reservations as u
      where u.attached_share_id is null and u.expires_at <= now();
end;
$$;

create or replace function public.finalize_expired_securebin(
  p_share_ids uuid[] default null,
  p_reservation_ids uuid[] default null
)
returns table (deleted_shares integer, deleted_uploads integer, deleted_leases integer, deleted_buckets integer)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  share_count integer;
  upload_count integer;
  lease_count integer;
  bucket_count integer;
begin
  -- A file-backed row is removed only after the Storage API has removed the
  -- object and its metadata row is no longer visible. No SQL object delete is
  -- attempted here, so a failed API deletion leaves the share recoverable.
  delete from public.shares as s
    where (p_share_ids is null or s.id = any (p_share_ids))
      and (s.expires_at <= now() or s.revoked_at is not null)
      and (
        s.file_object_path is null
        or not exists (
          select 1 from storage.objects as object_row
          where object_row.bucket_id = 'securebin-files'
            and object_row.name = s.file_object_path
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

  delete from public.reveal_leases
    where retry_expires_at <= now() - interval '24 hours';
  get diagnostics lease_count = row_count;

  delete from public.rate_limit_buckets
    where expires_at <= now();
  get diagnostics bucket_count = row_count;

  return query select share_count, upload_count, lease_count, bucket_count;
end;
$$;

create or replace function public.cleanup_expired_securebin()
returns table (deleted_shares integer, deleted_uploads integer, deleted_leases integer, deleted_buckets integer)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  -- Call list_cleanup_candidates, delete objects through the Storage API,
  -- then invoke this finalizer. This safe fallback only removes rows whose
  -- encrypted object is already absent or which never had one.
  return query select * from public.finalize_expired_securebin(null, null);
end;
$$;

revoke all on function public.securebin_b64url(text, integer) from public, anon, authenticated;
revoke all on function public.securebin_b64url_range(text, integer, integer) from public, anon, authenticated;
revoke all on function public.securebin_valid_kdf_parameters(text, jsonb, text) from public, anon, authenticated;
revoke all on function public.securebin_valid_envelope(jsonb, text, boolean, integer) from public, anon, authenticated;
revoke all on function public.create_upload_reservation(bytea, bigint) from public, anon, authenticated;
revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.get_share_status(text) from public, anon, authenticated;
revoke all on function public.reveal_share(text, bytea) from public, anon, authenticated;
revoke all on function public.revoke_share(text, bytea) from public, anon, authenticated;
revoke all on function public.consume_rate_limit(bytea, text, integer) from public, anon, authenticated;
revoke all on function public.list_cleanup_candidates() from public, anon, authenticated;
revoke all on function public.finalize_expired_securebin(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.cleanup_expired_securebin() from public, anon, authenticated;

grant execute on function public.create_upload_reservation(bytea, bigint) to service_role;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea, jsonb, bigint) to service_role;
grant execute on function public.get_share_status(text) to service_role;
grant execute on function public.reveal_share(text, bytea) to service_role;
grant execute on function public.revoke_share(text, bytea) to service_role;
grant execute on function public.consume_rate_limit(bytea, text, integer) to service_role;
grant execute on function public.list_cleanup_candidates() to service_role;
grant execute on function public.finalize_expired_securebin(uuid[], uuid[]) to service_role;
grant execute on function public.cleanup_expired_securebin() to service_role;
