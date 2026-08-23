-- Day 5: encrypted discussions.
--
-- A share may enable discussions. The sender generates a random 32-byte
-- capability; only its SHA-256 digest is stored. The raw capability is sealed
-- inside the encrypted content payload (SBCT 0x02 trailer), so a recipient
-- learns it only after a successful local decryption, and the public id alone
-- can never list or post comments.
--
-- Comment bodies and optional nicknames arrive as pre-encrypted envelopes
-- (AES-256-GCM under the discussion key derived client-side with the
-- securebin/v2/{mask}/discussion label); the server stores opaque jsonb.

create table if not exists public.share_comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares(id) on delete cascade,
  parent_comment_id uuid references public.share_comments(id) on delete cascade,
  body_envelope jsonb not null,
  nickname_envelope jsonb,
  created_at timestamptz not null default now(),
  constraint share_comments_body_envelope check (jsonb_typeof(body_envelope) = 'object'),
  constraint share_comments_body_envelope_size check (octet_length(body_envelope::text) <= 4096),
  constraint share_comments_nickname_envelope check (
    nickname_envelope is null or jsonb_typeof(nickname_envelope) = 'object'
  ),
  constraint share_comments_nickname_envelope_size check (
    coalesce(octet_length(nickname_envelope::text), 0) <= 1024
  )
);

create index if not exists share_comments_thread_idx
  on public.share_comments (share_id, created_at);

alter table public.share_comments enable row level security;
alter table public.share_comments force row level security;

revoke all on public.share_comments from public, anon, authenticated;

alter table public.shares
  add column if not exists discussion_capability_hash bytea;

-- ------------------------------------------------------------------- helpers

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
declare
  share public.shares%rowtype;
  capability_hash bytea := sha256(p_capability_raw);
begin
  if p_capability_raw is null or octet_length(p_capability_raw) <> 32 then
    raise exception using errcode = '22023', message = 'invalid discussion capability';
  end if;

  select * into share from public.shares where public_id = p_public_id;
  if not found then
    raise exception using errcode = '22023', message = 'discussion unavailable';
  end if;

  if share.discussion_capability_hash is null
     or not exists (
       select 1
         where share.discussion_capability_hash = capability_hash
     ) then
    raise exception using errcode = '22023', message = 'discussion capability mismatch';
  end if;

  -- Lifecycle inheritance: revoked, expired, exhausted, or not-yet-available
  -- shares disable their threads. Enforced here so BOTH list_share_comments
  -- and add_share_comment inherit the same gating.
  if share.revoked_at is not null
     or share.expires_at <= now()
     or share.max_reveals is not null and share.reveal_count >= share.max_reveals
     or share.available_at is not null and share.available_at > now() then
    raise exception using errcode = '22023', message = 'discussion unavailable';
  end if;

  return share;
end;
$$;

-- ----------------------------------------------------------------------- add

create or replace function public.add_share_comment(
  p_public_id text,
  p_discussion_capability bytea,
  p_parent_comment_id uuid,
  p_body_envelope jsonb,
  p_nickname_envelope jsonb default null
)
returns table (comment_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  share public.shares%rowtype;
  parent public.share_comments%rowtype;
  inserted uuid;
  rate_ok boolean;
begin
  share := public.securebin_discussion_share(p_public_id, p_discussion_capability);

  if p_body_envelope is null or jsonb_typeof(p_body_envelope) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid comment envelope';
  end if;

  if p_nickname_envelope is not null and jsonb_typeof(p_nickname_envelope) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid nickname envelope';
  end if;

  if p_parent_comment_id is not null then
    select * into parent from public.share_comments c where c.id = p_parent_comment_id;
    if not found or parent.share_id <> share.id then
      raise exception using errcode = '22023', message = 'invalid parent comment';
    end if;
  end if;

  -- Coarse per-share abuse ceiling keyed on the share id digest. The API
  -- route additionally applies its own discriminator limit before calling.
  select public.consume_rate_limit(
           sha256(convert_to('discussion/' || share.id::text, 'UTF8')),
           'discussion', 60)
    into rate_ok;
  if rate_ok is not true then
    raise exception using errcode = 'P0001', message = 'discussion_rate_limited';
  end if;

  insert into public.share_comments (
    share_id, parent_comment_id, body_envelope, nickname_envelope
  ) values (
    share.id, p_parent_comment_id, p_body_envelope, p_nickname_envelope
  )
  returning id into inserted;

  return query select inserted, now();
end;
$$;

-- ---------------------------------------------------------------------- list

create or replace function public.list_share_comments(
  p_public_id text,
  p_discussion_capability bytea
)
returns table (
  comment_id uuid,
  parent_comment_id uuid,
  body_envelope jsonb,
  nickname_envelope jsonb,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select c.id, c.parent_comment_id, c.body_envelope, c.nickname_envelope, c.created_at
    from public.share_comments c
   where c.share_id = (public.securebin_discussion_share(p_public_id, p_discussion_capability)).id
   order by c.created_at asc, c.id asc;
$$;

-- --------------------------------------------------------------------- grants

revoke all on function public.securebin_discussion_share(text, bytea)
  from public, anon, authenticated;
grant execute on function public.securebin_discussion_share(text, bytea) to service_role;

revoke all on function public.add_share_comment(text, bytea, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.add_share_comment(text, bytea, uuid, jsonb, jsonb) to service_role;

revoke all on function public.list_share_comments(text, bytea) from public, anon, authenticated;
grant execute on function public.list_share_comments(text, bytea) to service_role;

-- The discussion action joins the shared rate-limit vocabulary.
alter table public.rate_limit_buckets
  drop constraint if exists rate_limit_buckets_action_check;
alter table public.rate_limit_buckets
  add constraint rate_limit_buckets_action_check
    check (action in ('upload','create','status','reveal','delete','discussion'));

-- create_share gains the optional discussion capability digest. The earlier
-- 9-argument overload is dropped so PostgREST resolution stays unambiguous.
drop function if exists public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea);

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
  p_discussion_capability_hash bytea default null
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
      discussion_capability_hash
    ) values (
      p_public_id, p_content_envelope, p_available_at, p_expires_at, p_max_reveals,
      p_delete_token_hash, p_password_required, p_unlock_required, p_idempotency_key_hash,
      p_discussion_capability_hash
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

revoke all on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea)
  from public, anon, authenticated;
grant execute on function public.create_share(text, jsonb, timestamptz, timestamptz, integer, bytea, boolean, boolean, bytea, bytea)
  to service_role;

-- Audit fix: widen the shared rate-limit whitelist to include 'discussion'.
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
     or p_action not in ('upload','create','status','reveal','delete','discussion')
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

alter table public.rate_limit_buckets
  drop constraint if exists rate_limit_action_allowed;
