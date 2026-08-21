begin;

select plan(3);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shares'::regclass
      and conname = 'shares_reveal_limit'
      and pg_get_constraintdef(oid) ilike '%1%3%5%10%'
  ),
  'shares reveal limit constraint contains only the supported presets'
);

select throws_ok(
  $$
    insert into public.shares (
      public_id, content_envelope, expires_at, max_reveals,
      delete_token_hash, password_required, unlock_required, idempotency_key_hash
    ) values (
      'BQEBAQEBAQEBAQEBAQEBAQ',
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      now() + interval '1 hour',
      2,
      decode(repeat('20', 32), 'hex'), false, false,
      decode(repeat('21', 32), 'hex')
    )
  $$,
  '23514',
  null,
  'database rejects unsupported reveal limit 2'
);

select throws_ok(
  $$
    insert into public.shares (
      public_id, content_envelope, expires_at, max_reveals,
      delete_token_hash, password_required, unlock_required, idempotency_key_hash
    ) values (
      'BQEBAQEBAQEBAQEBAQEBBA',
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      now() + interval '1 hour',
      100,
      decode(repeat('22', 32), 'hex'), false, false,
      decode(repeat('23', 32), 'hex')
    )
  $$,
  '23514',
  null,
  'database rejects unsupported reveal limit 100'
);

select * from finish();
rollback;
