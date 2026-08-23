begin;

select plan(30);

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

-- Regression (20260825000000): encode(...,'base64') wraps at 76 characters;
-- canonical comparison must ignore the inserted newlines.
select ok(
  public.securebin_b64url_range(
    'R-t9Ew-xctpjR6E6t5WGx0y4n8uiq-BuC6mQOiiz7RQzrW0Y3fjZBQOvYFzzSYOwfk-DvmHnp_E2QcTMfBII4UFzEMsF-Wyzx3T-WBkcLMUE-dLe6SX7DvaQ',
    16, 524315
  ),
  'canonical base64url longer than 76 characters validates'
);
select is(
  public.securebin_b64url_range(
    'R-t9Ew-xctpjR6E6t5WGx0y4n8uiq-BuC6mQOiiz7RQzrW0Y3fjZBQOvYFzzSYOwfk-DvmHnp_E2QcTMfBII4UFzEMsF-Wyzx3T-WBkcLMUE-dLe6SX7DvaQ=',
    16, 524315
  ),
  false,
  'padded base64url is rejected by the unpadded alphabet rule'
);
select is(
  public.securebin_b64url_range(repeat('A', 700000), 16, 524315),
  false,
  'base64url above the maximum byte budget is rejected'
);

select has_function('public', 'create_upload_reservation', array['text','bytea','jsonb','bigint','integer'], 'reservation RPC exists');
select has_table('public', 'share_attachments', 'share attachments table exists');
select has_column('public', 'share_attachments', 'attachment_slot', 'attachment slot column exists');
select has_function('public', 'create_share', array['text','jsonb','timestamp with time zone','timestamp with time zone','integer','bytea','boolean','boolean','bytea','bytea'], '10-arg share creation RPC exists (with discussion digest)');
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
