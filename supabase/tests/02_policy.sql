begin;

select plan(29);

-- 1. Check function signatures
select has_function('public', 'create_upload_reservation', array['text','bytea','jsonb','bigint'], 'tuple upload reservation RPC exists');
select has_function('public', 'create_share', array['text','jsonb','timestamp with time zone','timestamp with time zone','integer','bytea','boolean','boolean','bytea','jsonb','bigint'], '11-arg create_share RPC exists');

-- Verify old overloads are dropped
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_upload_reservation'
      and p.pronargs = 2
  ),
  'old 2-arg create_upload_reservation is dropped'
);

select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'create_share'
      and p.pronargs = 12
  ),
  'old 12-arg create_share is dropped'
);

-- 2. Verify security privileges
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_upload_reservation', 'create_share', 'get_share_status', 'reveal_share', 'revoke_share')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anon role cannot execute lifecycle RPCs'
);

select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_upload_reservation', 'create_share', 'get_share_status', 'reveal_share', 'revoke_share')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  ),
  'authenticated role cannot execute lifecycle RPCs'
);

-- 3. Test idempotent share creation
create temp table test_share_1 on commit drop as
select * from public.create_share(
  'AQEBAQEBAQEBAQEBAQEBAQ',
  '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
  null,
  now() + interval '1 day',
  null,
  decode(repeat('02', 32), 'hex'),
  false,
  false,
  decode(repeat('02', 32), 'hex'),
  null,
  null
);

select is(
  (select created from test_share_1),
  true,
  'first create_share call returns created = true'
);

-- Identical retry
create temp table test_share_retry on commit drop as
select * from public.create_share(
  'AQEBAQEBAQEBAQEBAQEBAQ',
  '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
  null,
  (select expires_at from public.shares where public_id = 'AQEBAQEBAQEBAQEBAQEBAQ'),
  null,
  decode(repeat('02', 32), 'hex'),
  false,
  false,
  decode(repeat('02', 32), 'hex'),
  null,
  null
);

select is(
  (select created from test_share_retry),
  false,
  'identical create_share retry returns created = false'
);

-- Conflicting retry throws 23505
select throws_ok(
  $$
    select * from public.create_share(
      'AgICAgICAgICAgICAgICAg',
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      null,
      now() + interval '1 day',
      null,
      decode(repeat('02', 32), 'hex'),
      false,
      false,
      decode(repeat('02', 32), 'hex'),
      null,
      null
    )
  $$,
  '23505',
  'idempotency_conflict',
  'conflicting idempotency key throws 23505 idempotency_conflict'
);

-- 4. Test upload reservation tuple
create temp table test_res_1 on commit drop as
select * from public.create_upload_reservation(
  'AwMDAwMDAwMDAwMDAwMDAw',
  decode(repeat('03', 32), 'hex'),
  '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
  1024
);

select ok(
  (select reservation_id is not null from test_res_1),
  'upload reservation created with UUID'
);

-- Identical reservation retry returns existing
create temp table test_res_retry on commit drop as
select * from public.create_upload_reservation(
  'AwMDAwMDAwMDAwMDAwMDAw',
  decode(repeat('03', 32), 'hex'),
  '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
  1024
);

select is(
  (select reservation_id from test_res_retry),
  (select reservation_id from test_res_1),
  'identical upload reservation returns same reservation_id'
);

-- Conflicting reservation throws 23505
select throws_ok(
  $$
    select * from public.create_upload_reservation(
      'AwMDAwMDAwMDAwMDAwMDAw',
      decode(repeat('03', 32), 'hex'),
      '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      2048
    )
  $$,
  '23505',
  'reservation_conflict',
  'conflicting reservation size throws 23505 reservation_conflict'
);

-- 5. Test atomic reveal and limits
create temp table test_burn_share on commit drop as
select * from public.create_share(
  'BAQEBAQEBAQEBAQEBAQEBA',
  '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
  null,
  now() + interval '1 day',
  1,
  decode(repeat('04', 32), 'hex'),
  false,
  false,
  decode(repeat('04', 32), 'hex'),
  null,
  null
);

-- First reveal
create temp table test_reveal_1 on commit drop as
select * from public.reveal_share(
  'BAQEBAQEBAQEBAQEBAQEBA',
  decode(repeat('10', 32), 'hex')
);

select is(
  (select status from test_reveal_1),
  'authorized',
  'first reveal of burn note is authorized'
);

select is(
  (select reveal_count from public.shares where public_id = 'BAQEBAQEBAQEBAQEBAQEBA'),
  1,
  'reveal_count is exactly 1'
);

-- Retry same token within lease returns authorized without incrementing count
create temp table test_reveal_retry on commit drop as
select * from public.reveal_share(
  'BAQEBAQEBAQEBAQEBAQEBA',
  decode(repeat('10', 32), 'hex')
);

select is(
  (select status from test_reveal_retry),
  'authorized',
  'reveal retry with same token returns authorized'
);

select is(
  (select reveal_count from public.shares where public_id = 'BAQEBAQEBAQEBAQEBAQEBA'),
  1,
  'reveal_count remains 1 after same-token retry'
);

-- Second distinct reveal on burn note is unavailable
create temp table test_reveal_2 on commit drop as
select * from public.reveal_share(
  'BAQEBAQEBAQEBAQEBAQEBA',
  decode(repeat('11', 32), 'hex')
);

select is(
  (select status from test_reveal_2),
  'unavailable',
  'second distinct reveal on max_reveals=1 is unavailable'
);

select is(
  (select reveal_count from public.shares where public_id = 'BAQEBAQEBAQEBAQEBAQEBA'),
  1,
  'reveal_count is not incremented on exhausted share'
);

-- 6. Test revocation
create temp table test_revoke on commit drop as
select * from public.revoke_share(
  'BAQEBAQEBAQEBAQEBAQEBA',
  decode(repeat('04', 32), 'hex')
);

select is(
  (select revoked from test_revoke),
  true,
  'revoke_share with valid capability succeeds'
);

-- Invalid capability revocation fails
create temp table test_invalid_revoke on commit drop as
select * from public.revoke_share(
  'BAQEBAQEBAQEBAQEBAQEBA',
  decode(repeat('99', 32), 'hex')
);

select is(
  (select revoked from test_invalid_revoke),
  false,
  'revoke_share with invalid capability fails'
);

-- Status of revoked share is unavailable
create temp table test_revoked_status on commit drop as
select * from public.get_share_status('BAQEBAQEBAQEBAQEBAQEBA');

select is(
  (select status from test_revoked_status),
  'unavailable',
  'status of revoked share is uniform unavailable'
);

-- 7. Test real role execution and direct access restrictions
set local role anon;

select throws_ok(
  $$ select * from public.shares $$,
  '42501',
  null,
  'anon role cannot select from public.shares'
);

select throws_ok(
  $$ select * from public.upload_reservations $$,
  '42501',
  null,
  'anon role cannot select from public.upload_reservations'
);

select throws_ok(
  $$ select * from public.reveal_leases $$,
  '42501',
  null,
  'anon role cannot select from public.reveal_leases'
);

select throws_ok(
  $$ select * from public.reveal_share('BAQEBAQEBAQEBAQEBAQEBA', decode(repeat('01', 32), 'hex')) $$,
  '42501',
  null,
  'anon role cannot execute reveal_share'
);

set local role authenticated;

select throws_ok(
  $$ select * from public.shares $$,
  '42501',
  null,
  'authenticated role cannot select from public.shares'
);

select throws_ok(
  $$ select * from public.upload_reservations $$,
  '42501',
  null,
  'authenticated role cannot select from public.upload_reservations'
);

select throws_ok(
  $$ select * from public.reveal_leases $$,
  '42501',
  null,
  'authenticated role cannot select from public.reveal_leases'
);

select throws_ok(
  $$ select * from public.reveal_share('BAQEBAQEBAQEBAQEBAQEBA', decode(repeat('01', 32), 'hex')) $$,
  '42501',
  null,
  'authenticated role cannot execute reveal_share'
);

reset role;

select * from finish();
rollback;
