-- Day 2 follow-up: durable cleanup for paths abandoned by reservation rotation.

create table if not exists public.upload_rotation_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  source_reservation_id uuid not null,
  object_path text not null,
  queued_at timestamptz not null default now(),
  constraint upload_rotation_cleanup_path_format
    check (object_path ~ '^objects/[0-9a-f]{48}[.]bin$'),
  constraint upload_rotation_cleanup_path_unique unique (object_path)
);

create index if not exists upload_rotation_cleanup_queue_queued_at_idx
  on public.upload_rotation_cleanup_queue (queued_at, id);

alter table public.upload_rotation_cleanup_queue enable row level security;
alter table public.upload_rotation_cleanup_queue force row level security;

revoke all on table public.upload_rotation_cleanup_queue
  from public, anon, authenticated, service_role;

-- Rotation must enqueue the old path before changing the reservation path in
-- the same transaction. The queue deliberately has no foreign key: deleting
-- the reservation after Storage cleanup must not discard an old path that is
-- still awaiting Storage cleanup.
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

-- Candidate shape remains compatible with existing callers. For rotation
-- candidates, reservation_id carries the queue row ID and candidate_type
-- identifies that interpretation.
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
  return query
    select 'share'::text, s.id, null::uuid, s.file_object_path
      from public.shares as s
      where (s.expires_at <= now() or s.revoked_at is not null)
        and s.file_object_path is not null
    union all
    select 'upload'::text, null::uuid, u.id, u.object_path
      from public.upload_reservations as u
      where u.attached_share_id is null and u.expires_at <= now()
    union all
    select 'upload_rotation'::text, null::uuid, q.id, q.object_path
      from public.upload_rotation_cleanup_queue as q
      where not exists (
          select 1 from public.shares as s
          where s.file_object_path = q.object_path
        )
        and not exists (
          select 1 from public.upload_reservations as u
          where u.object_path = q.object_path
        );
end;
$$;

-- The return shape gains a separate count for durable rotation paths. Drop
-- old overloads first because PostgreSQL cannot change OUT parameters in place.
drop function if exists public.cleanup_expired_securebin();
drop function if exists public.finalize_expired_securebin(uuid[], uuid[]);
drop function if exists public.finalize_expired_securebin(uuid[], uuid[], uuid[]);

create function public.finalize_expired_securebin(
  p_share_ids uuid[],
  p_reservation_ids uuid[],
  p_rotation_ids uuid[]
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
declare
  share_count integer;
  upload_count integer;
  rotation_count integer;
  lease_count integer;
  bucket_count integer;
begin
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

  delete from public.upload_rotation_cleanup_queue as q
    -- Unlike lifecycle rows, queue rows are finalized only for paths whose
    -- Storage API call returned deleted/missing in this cleanup run. A NULL
    -- list therefore preserves every queue row after an API failure.
    where p_rotation_ids is not null
      and q.id = any (p_rotation_ids)
      and not exists (
        select 1 from public.shares as s
        where s.file_object_path = q.object_path
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

-- Preserve the deployed two-array RPC for callers that do not need to pass
-- queue IDs; it cannot finalize a path whose Storage deletion was not proven.
create function public.finalize_expired_securebin(
  p_share_ids uuid[] default null,
  p_reservation_ids uuid[] default null
)
returns table (
  deleted_shares integer,
  deleted_uploads integer,
  deleted_rotated_uploads integer,
  deleted_leases integer,
  deleted_buckets integer
)
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select * from public.finalize_expired_securebin($1, $2, null::uuid[]);
$$;

create function public.cleanup_expired_securebin()
returns table (
  deleted_shares integer,
  deleted_uploads integer,
  deleted_rotated_uploads integer,
  deleted_leases integer,
  deleted_buckets integer
)
language sql
security definer
set search_path = public, extensions, pg_temp
as $$
  select * from public.finalize_expired_securebin(null::uuid[], null::uuid[], null::uuid[]);
$$;

revoke all on function public.create_upload_reservation(text, bytea, jsonb, bigint)
  from public, anon, authenticated;
revoke all on function public.list_cleanup_candidates() from public, anon, authenticated;
revoke all on function public.finalize_expired_securebin(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.finalize_expired_securebin(uuid[], uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.cleanup_expired_securebin() from public, anon, authenticated;

grant execute on function public.create_upload_reservation(text, bytea, jsonb, bigint) to service_role;
grant execute on function public.list_cleanup_candidates() to service_role;
grant execute on function public.finalize_expired_securebin(uuid[], uuid[]) to service_role;
grant execute on function public.finalize_expired_securebin(uuid[], uuid[], uuid[]) to service_role;
grant execute on function public.cleanup_expired_securebin() to service_role;
