begin;

select plan(25);

select has_table('public', 'shares', 'shares table exists');
select has_table('public', 'upload_reservations', 'upload reservations table exists');
select has_table('public', 'reveal_leases', 'reveal leases table exists');
select has_table('public', 'rate_limit_buckets', 'rate-limit table exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.shares'::regclass),
  'shares has RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.shares'::regclass),
  'shares forces RLS'
);
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('shares', 'upload_reservations', 'reveal_leases', 'rate_limit_buckets')
      and column_name in ('ip', 'ip_address', 'client_ip', 'remote_ip', 'network_address')
  ),
  'no raw IP column is persisted'
);
select ok(
  (select not public from storage.buckets where id = 'securebin-files'),
  'encrypted object bucket is private'
);
select ok(
  public.securebin_b64url('AAAAAAAAAAAAAAAAAAAAAA', 16),
  'canonical unpadded base64url decodes to 16 bytes'
);
select ok(
  public.securebin_b64url('AAAAAAAAAAAAAAAA', 12),
  'canonical unpadded base64url decodes to 12 bytes'
);

select has_function('public', 'create_upload_reservation', array['text','bytea','jsonb','bigint'], 'reservation RPC exists');
select has_function('public', 'create_share', array['text','jsonb','timestamp with time zone','timestamp with time zone','integer','bytea','boolean','boolean','bytea','jsonb','bigint'], 'share creation RPC exists');
select has_function('public', 'get_share_status', array['text'], 'status RPC exists');
select has_function('public', 'reveal_share', array['text','bytea'], 'atomic reveal RPC exists');
select has_function('public', 'revoke_share', array['text','bytea'], 'revocation RPC exists');
select has_function('public', 'list_cleanup_candidates', array[]::text[], 'cleanup candidate RPC exists');
select has_function('public', 'finalize_expired_securebin', array['uuid[]','uuid[]','uuid[]'], 'cleanup finalizer RPC exists');
select has_function('public', 'cleanup_expired_securebin', array[]::text[], 'cleanup RPC exists');

select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('create_share','reveal_share','revoke_share','list_cleanup_candidates','finalize_expired_securebin','cleanup_expired_securebin')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ),
  'anonymous clients cannot execute lifecycle RPCs'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('shares','upload_reservations','reveal_leases','rate_limit_buckets')
  ),
  'no direct table policies expose lifecycle rows'
);

insert into public.shares (
  public_id,
  content_envelope,
  expires_at,
  max_reveals,
  delete_token_hash,
  password_required,
  unlock_required,
  idempotency_key_hash
) values (
  'AAAAAAAAAAAAAAAAAAAAAA',
  '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
  now() + interval '1 hour',
  1,
  decode(repeat('00', 32), 'hex'),
  false,
  false,
  decode(repeat('01', 32), 'hex')
);

select ok(
  not public.securebin_valid_envelope(
    jsonb_set(
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      '{ciphertext}', '"AA"'::jsonb
    ),
    'content', true, 524304
  ),
  'envelopes with ciphertext shorter than an AES-GCM tag are rejected'
);
select ok(
  not public.securebin_valid_envelope(
    jsonb_set(
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      '{ciphertext}', '"AAAAAAAAAAAAAAAAAAAAAA=="'::jsonb
    ),
    'content', true, 524304
  ),
  'envelopes with padded noncanonical base64url are rejected'
);

select ok(
  (select status = 'authorized' and reveal_count = 1
     from public.reveal_share('AAAAAAAAAAAAAAAAAAAAAA', decode(repeat('11', 32), 'hex'))),
  'first reveal authorizes and consumes exactly one lease'
);
select ok(
  (select status = 'authorized' and reveal_count = 1
     from public.reveal_share('AAAAAAAAAAAAAAAAAAAAAA', decode(repeat('11', 32), 'hex'))),
  'retrying an active reveal lease does not increment the counter'
);
select ok(
  (select status = 'unavailable'
     from public.reveal_share('AAAAAAAAAAAAAAAAAAAAAA', decode(repeat('22', 32), 'hex'))),
  'a distinct token cannot exceed a one-reveal limit'
);

select * from finish();
rollback;
