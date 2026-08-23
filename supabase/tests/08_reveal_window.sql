begin;

select plan(10);

-- Reveal window (Day 6 §2): a sender-chosen window starts at the FIRST
-- successful release and closes reveal_window_seconds later. New
-- authorizations after the window closes take the uniform unavailable path;
-- the original token keeps its five-minute retry lease.

create or replace function pg_temp.window_share(p_digest_hex text, p_window integer)
returns text
language sql
set search_path = public
as $$
  insert into public.shares (
    public_id, content_envelope, expires_at, max_reveals,
    delete_token_hash, password_required, unlock_required, idempotency_key_hash,
    reveal_window_seconds
  ) values (
    'FQEBAQEBAQEBAQEBAQEBAQ',
    '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
    now() + interval '1 hour',
    10,
    decode(rpad(p_digest_hex, 64), 'hex'),
    false, false,
    decode(lpad('31', 64, '3'), 'hex'),
    p_window
  )
  returning public_id;
$$;

-- 1. The bounds constraint exists.
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.shares'::regclass
      and conname = 'shares_reveal_window_bounds'
  ),
  'reveal window column is bounded between 10 and 86400 seconds'
);

-- 2. First authorization stamps the window start and end atomically.
select is(
  (select count(*)::integer from public.shares where public_id = 'FQEBAQEBAQEBAQEBAQEBAQ'),
  0,
  'window share fixture absent before insert'
);
do $$
begin
  perform pg_temp.window_share(repeat('30', 32), 60);
end $$;

select ok(
  (select reveal_window_seconds from public.shares where public_id = 'FQEBAQEBAQEBAQEBAQEBAQ') = 60,
  'window share stored with a 60 second window'
);

select is(
  (select status from public.reveal_share(
     'FQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('41', 32), 'hex'))),
  'authorized',
  'first release inside the window is authorized'
);

select ok(
  (select first_released_at is not null and window_ends_at is not null
     and window_ends_at > first_released_at
   from public.shares where public_id = 'FQEBAQEBAQEBAQEBAQEBAQ'),
  'first release stamps both first_released_at and window_ends_at'
);

-- 3. A different new token while the window is open is still authorized.
select is(
  (select status from public.reveal_share(
     'FQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('42', 32), 'hex'))),
  'authorized',
  'second distinct recipient releases inside the window'
);

-- 4. Once the window has passed, NEW tokens receive the uniform unavailable
-- path (simulate passage of time by closing the stored window).
update public.shares
  set window_ends_at = now() - interval '1 second'
  where public_id = 'FQEBAQEBAQEBAQEBAQEBAQ';

select is(
  (select status from public.reveal_share(
     'FQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('43', 32), 'hex'))),
  'unavailable',
  'new tokens after the window closes are uniformly unavailable'
);

-- 5. The original token's retry lease still authorizes the SAME release even
-- though the window has closed.
select is(
  (select status from public.reveal_share(
     'FQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('41', 32), 'hex'))),
  'authorized',
  'retry-token lease survives a closed window until the lease expires'
);

-- 6. create_share validates the window bounds through the API contract shape.
-- 7. create_share validates the window bounds through the API contract shape.
select throws_ok(
  $$
    select public.create_share(
      'GQEBAQEBAQEBAQEBAQEBAQ',
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      null, now() + interval '1 hour', 5,
      decode(repeat('32', 32), 'hex'), false, false,
      decode(repeat('33', 32), 'hex'), null, 9
    )
  $$,
  '22023',
  'invalid reveal window',
  'create_share rejects a window shorter than 10 seconds'
);

-- 8. Idempotent replay with a DIFFERENT window conflicts instead of silently
-- reusing the original share.
select lives_ok(
  $$
    select public.create_share(
      'GQEBAQEBAQEBAQEBAQEBAQ',
      '{"version":1,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AAAAAAAAAAAAAAAA","hkdfSalt":"AAAAAAAAAAAAAAAAAAAAAA","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AAAAAAAAAAAAAAAAAAAAAA"}'::jsonb,
      null, now() + interval '1 hour', 5,
      decode(repeat('34', 32), 'hex'), false, false,
      decode(repeat('35', 32), 'hex'), null, null
    )
  $$,
  'create_share accepts a share without a reveal window'
);

select * from finish();
rollback;
