-- Day 3: Attachment and Envelope Validation Tests
begin;
select plan(14);

-- 1. v1 content envelope accepted
select ok(
  public.securebin_valid_envelope(
    '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
    'content',
    true,
    524304
  ),
  'v1 content envelope is valid'
);

-- 2. v2 content envelope accepted
select ok(
  public.securebin_valid_envelope(
    '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
    'content',
    true,
    524315
  ),
  'v2 content envelope is valid'
);

-- 3. v2 file envelope accepted without ciphertext
select ok(
  public.securebin_valid_envelope(
    '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
    'file',
    false,
    1
  ),
  'v2 file metadata envelope is valid'
);

-- 4. v1 file envelope rejected
select ok(
  not public.securebin_valid_envelope(
    '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
    'file',
    false,
    1
  ),
  'v1 file envelope is rejected'
);

-- 5. v3 envelope rejected
select ok(
  not public.securebin_valid_envelope(
    '{"version":3,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
    'content',
    true,
    524315
  ),
  'v3 content envelope is rejected'
);

-- 6. Create upload reservation with v2 file envelope
select lives_ok(
  $$
    select * from public.create_upload_reservation(
      'AQEBAQEBAQEBAQEBAQEBAQ',
      decode('0101010101010101010101010101010101010101010101010101010101010101', 'hex'),
      '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      10486422::bigint
    );
  $$,
  'create_upload_reservation accepts v2 file envelope and max 10486422 size'
);

-- 7. Upload reservation rejects v1 file envelope
select throws_ok(
  $$
    select * from public.create_upload_reservation(
      'AQEBAQEBAQEBAQEBAQEBAQ',
      decode('0202020202020202020202020202020202020202020202020202020202020202', 'hex'),
      '{"version":1,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      2048::bigint
    );
  $$,
  '22023',
  'invalid file metadata envelope',
  'create_upload_reservation rejects v1 file envelope'
);

-- 8. Upload reservation rejects size > 10486422
select throws_ok(
  $$
    select * from public.create_upload_reservation(
      'AQEBAQEBAQEBAQEBAQEBAQ',
      decode('0303030303030303030303030303030303030303030303030303030303030303', 'hex'),
      '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      10486423::bigint
    );
  $$,
  '22023',
  'invalid expected ciphertext size',
  'create_upload_reservation rejects size greater than 10486422'
);

-- 9. Anon role cannot execute create_upload_reservation
set local role anon;
select throws_ok(
  $$
    select * from public.create_upload_reservation(
      'AQEBAQEBAQEBAQEBAQEBAQ',
      decode('0101010101010101010101010101010101010101010101010101010101010101', 'hex'),
      '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      2048::bigint
    );
  $$,
  '42501',
  NULL,
  'anon role cannot execute create_upload_reservation'
);

-- 10. Anon role cannot execute create_share
select throws_ok(
  $$
    select * from public.create_share(
      'AQEBAQEBAQEBAQEBAQEBAQ',
      '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
      null,
      now() + interval '24 hours',
      null,
      decode('0101010101010101010101010101010101010101010101010101010101010101', 'hex'),
      false,
      false,
      decode('0101010101010101010101010101010101010101010101010101010101010101', 'hex')
    );
  $$,
  '42501',
  NULL,
  'anon role cannot execute create_share'
);


set local role postgres;

-- 11. Content ciphertext at exactly the v2 maximum (524315 bytes) passes.
insert into public.shares (
  public_id, content_envelope, available_at, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required, idempotency_key_hash, reveal_count
) values (
  'AAAAAAAAAAAAAAAAAAAAAA',
  jsonb_build_object(
    'version', 2, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
    'factorMask', 'link', 'ciphertext', repeat('A', 699087)
  ),
  null, now() + interval '24 hours', null,
  gen_random_bytes(32), false, false, gen_random_bytes(32), 0
);
select is(
  (select count(*) from public.shares where public_id = 'AAAAAAAAAAAAAAAAAAAAAA'),
  1::bigint,
  'share with exactly 524315-byte content ciphertext inserts'
);

-- 12. One byte above the maximum violates the Day-3 constraint.
select throws_ok(
  $$
    insert into public.shares (
      public_id, content_envelope, available_at, expires_at, max_reveals,
      delete_token_hash, password_required, unlock_required, idempotency_key_hash, reveal_count
    ) values (
      'BBBBBBBBBBBBBBBBBBBBBA',
      jsonb_build_object(
        'version', 2, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
        'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
        'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
        'factorMask', 'link', 'ciphertext', repeat('A', 699088)
      ),
      null, now() + interval '24 hours', null,
      gen_random_bytes(32), false, false, gen_random_bytes(32), 0
    )
  $$,
  NULL,
  NULL,
  'content ciphertext above 524315 bytes is rejected'
);

-- 13. File ciphertext at exactly 10486422 bytes passes.
insert into public.shares (
  public_id, content_envelope, available_at, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required, idempotency_key_hash,
  file_object_path, file_envelope, file_ciphertext_size, reveal_count
) values (
  'CCCCCCCCCCCCCCCCCCCCCA',
  jsonb_build_object(
    'version', 2, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
    'factorMask', 'link', 'ciphertext', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ),
  null, now() + interval '24 hours', null,
  gen_random_bytes(32), false, false, gen_random_bytes(32),
  'objects/' || repeat('a', 48) || '.bin',
  jsonb_build_object(
    'version', 2, 'objectType', 'file', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb, 'factorMask', 'link'
  ),
  10486422, 0
);
select is(
  (
    select count(*) from public.shares
    where file_ciphertext_size = 10486422 and public_id = 'CCCCCCCCCCCCCCCCCCCCCA'
  ),
  1::bigint,
  'attachment at exactly 10486422-byte ciphertext size inserts'
);

-- 14. File size above the maximum violates the constraint.
select throws_ok(
  $$
    insert into public.shares (
      public_id, content_envelope, available_at, expires_at, max_reveals,
      delete_token_hash, password_required, unlock_required, idempotency_key_hash,
      file_object_path, file_envelope, file_ciphertext_size, reveal_count
    ) values (
      'DDDDDDDDDDDDDDDDDDDDDA',
      jsonb_build_object(
        'version', 2, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
        'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
        'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
        'factorMask', 'link', 'ciphertext', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
      ),
      null, now() + interval '24 hours', null,
      gen_random_bytes(32), false, false, gen_random_bytes(32),
      'objects/' || repeat('b', 48) || '.bin',
      jsonb_build_object(
        'version', 2, 'objectType', 'file', 'algorithm', 'AES-256-GCM',
        'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
        'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb, 'factorMask', 'link'
      ),
      10486423, 0
    )
  $$,
  NULL, NULL,
  'file ciphertext above 10486422 bytes is rejected'
);

reset role;
select * from finish();
rollback;
