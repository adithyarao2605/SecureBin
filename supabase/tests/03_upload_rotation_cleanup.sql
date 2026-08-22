begin;

select plan(15);

select has_table(
  'public',
  'upload_rotation_cleanup_queue',
  'rotation cleanup queue exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.upload_rotation_cleanup_queue'::regclass),
  'rotation cleanup queue has RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.upload_rotation_cleanup_queue'::regclass),
  'rotation cleanup queue forces RLS'
);

set local role anon;
select throws_ok(
  $$ select * from public.upload_rotation_cleanup_queue $$,
  '42501',
  null,
  'anonymous clients cannot read rotation cleanup queue'
);
set local role authenticated;
select throws_ok(
  $$ select * from public.upload_rotation_cleanup_queue $$,
  '42501',
  null,
  'authenticated clients cannot read rotation cleanup queue'
);
reset role;

-- A queue row is visible to the privileged cleanup RPC but has no direct table
-- access path for anonymous or authenticated clients.
create temp table queued_path on commit drop as
with ins as (
  insert into public.upload_rotation_cleanup_queue (source_reservation_id, object_path)
  values (gen_random_uuid(), 'objects/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bin')
  returning id, object_path
)
select * from ins;

select is(
  (select count(*)::integer from public.list_cleanup_candidates()
    where candidate_type = 'upload_rotation'
      and reservation_id = (select id from queued_path)),
  1,
  'queued rotation path is a cleanup candidate'
);

select is(
  (select deleted_rotated_uploads from public.finalize_expired_securebin(
    null::uuid[], null::uuid[], (select array_agg(id) from queued_path))),
  1,
  'missing queued path is finalized'
);
select is(
  (select count(*)::integer from public.upload_rotation_cleanup_queue
    where id = (select id from queued_path)),
  0,
  'finalized queue row is removed'
);

-- Reinitializing an expired unattached reservation records its old path and
-- changes the current reservation path in one transaction.
create temp table expired_reservation on commit drop as
with ins as (
  insert into public.upload_reservations (
    id, reserved_public_id, idempotency_key_hash, file_envelope,
    expected_ciphertext_size, object_path, created_at, expires_at
  ) values (
    gen_random_uuid(),
    'CQkJCQkJCQkJCQkJCQkJCQ',
    decode(repeat('44', 32), 'hex'),
    '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
    1024,
    'objects/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.bin',
    now() - interval '30 minutes',
    now() - interval '15 minutes'
  )
  returning id, object_path
)
select * from ins;

create temp table rotated_reservation on commit drop as
select * from public.create_upload_reservation(
  'CQkJCQkJCQkJCQkJCQkJCQ',
  decode(repeat('44', 32), 'hex'),
  '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
  1024
);

select is(
  (select object_path from rotated_reservation),
  (select object_path from public.upload_reservations where id = (select id from expired_reservation)),
  'rotation returns the current reservation path'
);
select isnt(
  (select object_path from rotated_reservation),
  (select object_path from expired_reservation),
  'rotation changes the current reservation path'
);
select is(
  (select count(*)::integer from public.upload_rotation_cleanup_queue
    where source_reservation_id = (select id from expired_reservation)
      and object_path = (select object_path from expired_reservation)),
  1,
  'rotation queues the old path transactionally'
);

select is(
  (select deleted_rotated_uploads from public.finalize_expired_securebin(
    null::uuid[], null::uuid[],
    (select array_agg(id) from public.upload_rotation_cleanup_queue
      where source_reservation_id = (select id from expired_reservation)))),
  1,
  'rotated queue path can be finalized independently of current reservation'
);

-- A path referenced by a live share is never a cleanup candidate and its queue
-- row is retained even when a caller passes its queue ID.
create temp table protected_queue on commit drop as
with ins as (
  insert into public.upload_rotation_cleanup_queue (source_reservation_id, object_path)
  values (gen_random_uuid(), 'objects/cccccccccccccccccccccccccccccccccccccccccccccccc.bin')
  returning id
)
select * from ins;

insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required,
  file_object_path, idempotency_key_hash
) values (
  'DQ0NDQ0NDQ0NDQ0NDQ0NDA',
  '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
  now() + interval '1 day',
  1,
  decode(repeat('55', 32), 'hex'),
  false,
  false,
  'objects/cccccccccccccccccccccccccccccccccccccccccccccccc.bin',
  decode(repeat('56', 32), 'hex')
);

select is(
  (select count(*)::integer from public.list_cleanup_candidates()
    where reservation_id = (select id from protected_queue)),
  0,
  'queue path referenced by an active share is not a candidate'
);
select is(
  (select deleted_rotated_uploads from public.finalize_expired_securebin(
    null::uuid[], null::uuid[], (select array_agg(id) from protected_queue))),
  0,
  'active share protects queued path during finalization'
);
select is(
  (select count(*)::integer from public.upload_rotation_cleanup_queue
    where id = (select id from protected_queue)),
  1,
  'protected queue row is preserved'
);

select * from finish();
rollback;
