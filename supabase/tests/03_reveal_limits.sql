begin;

select plan(4);

-- Day 5: reveal limits widened from the four presets to any integer 1..100.
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shares'::regclass
      and conname = 'shares_reveal_limit'
      and pg_get_constraintdef(oid) ilike '%1 and 100%' or pg_get_constraintdef(oid) ilike '%>= 1%<= 100%'
  ),
  'shares reveal limit constraint accepts any integer between 1 and 100'
);

-- Custom limits inside the range are accepted (7 and 100).
insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required, idempotency_key_hash
) values (
  'BQEBAQEBAQEBAQEBAQEBAQ',
  '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
  now() + interval '1 hour',
  7,
  decode(repeat('24', 32), 'hex'), false, false,
  decode(repeat('25', 32), 'hex')
);
select is(
  (
    select count(*)::integer from public.shares
    where max_reveals = 7 and public_id = 'BQEBAQEBAQEBAQEBAQEBAQ'
  ),
  1,
  'custom reveal limit 7 is accepted'
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
      0,
      decode(repeat('20', 32), 'hex'), false, false,
      decode(repeat('21', 32), 'hex')
    )
  $$,
  '23514',
  null,
  'database rejects unsupported reveal limit 0'
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
      101,
      decode(repeat('22', 32), 'hex'), false, false,
      decode(repeat('23', 32), 'hex')
    )
  $$,
  '23514',
  null,
  'database rejects unsupported reveal limit 101'
);

select * from finish();
rollback;
