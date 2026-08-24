begin;

select plan(9);

-- The v1 envelope is intentionally minimal but valid for a link-only object.
create or replace function pg_temp.pre_freeze_envelope(p_mask text default 'link')
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 1, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
    'factorMask', p_mask, 'ciphertext', 'AAAAAAAAAAAAAAAAAAAAAA'
  )
$$;

select lives_ok($$select public.create_share(
  'RQEBAQEBAQEBAQEBAQEBAQ', pg_temp.pre_freeze_envelope('link+unlock'), null,
  now() + interval '1 hour', 3, decode(repeat('a1', 32), 'hex'), false, true,
  decode(repeat('a2', 32), 'hex'), null, null
)$$, 'unlock-only create accepts kdf=none');

select is(
  (select status from public.get_share_status('RQEBAQEBAQEBAQEBAQEBAQ')),
  'active', 'unlock-only share is active'
);

insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals, delete_token_hash,
  password_required, unlock_required, idempotency_key_hash,
  reveal_window_seconds, window_ends_at
) values (
  'SQEBAQEBAQEBAQEBAQEBAQ', pg_temp.pre_freeze_envelope(), now() + interval '1 hour',
  3, decode(repeat('b1', 32), 'hex'), false, false, decode(repeat('b2', 32), 'hex'),
  60, now() - interval '1 second'
);

select is((select status from public.get_share_status('SQEBAQEBAQEBAQEBAQEBAQ')),
  'unavailable', 'single status closes a release window');
select is((select status from public.get_share_status_batch(array['SQEBAQEBAQEBAQEBAQEBAQ'])),
  'unavailable', 'batch status closes a release window');
select is((select status from public.reveal_share('SQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('b3', 32), 'hex'))),
  'unavailable', 'new reveal token cannot enter a closed window');

insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals, delete_token_hash,
  password_required, unlock_required, idempotency_key_hash
) values (
  'TQEBAQEBAQEBAQEBAQEBAQ', pg_temp.pre_freeze_envelope(), now() + interval '1 hour',
  3, decode(repeat('c1', 32), 'hex'), false, false, decode(repeat('c2', 32), 'hex')
);

select is((select status from public.reveal_share('TQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('c3', 32), 'hex'))),
  'authorized', 'first reveal creates a retry lease');
update public.shares set revoked_at = now() where public_id = 'TQEBAQEBAQEBAQEBAQEBAQ';
select is((select status from public.reveal_share('TQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('c3', 32), 'hex'))),
  'unavailable', 'revocation overrides an active retry lease');

select throws_ok($$select public.create_share(
  'RQEBAQEBAQEBAQEBAQEBAQ', pg_temp.pre_freeze_envelope(), null,
  now() + interval '1 hour', 3, decode(repeat('a1', 32), 'hex'), false, false,
  decode(repeat('a2', 32), 'hex'), null, null
)$$, '23505', 'idempotency_conflict',
  'same public id and token with a changed envelope conflicts');

select ok(
  exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_upload_reservation'
      and pg_get_function_result(p.oid) like '%already_uploaded%'),
  'upload reservation exposes already_uploaded recovery state'
);

select * from finish();
rollback;
