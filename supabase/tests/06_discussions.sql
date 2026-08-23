-- Day 5: encrypted discussion tests.
begin;

select plan(15);

-- Primary share S1 with discussion capability cap1 = 0x77 * 32.
insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required,
  idempotency_key_hash, discussion_capability_hash
) values (
  'DQEBAQEBAQEBAQEBAQEBAQ',
  '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
  now() + interval '1 hour', null,
  decode(repeat('40', 32), 'hex'), false, false,
  decode(repeat('41', 32), 'hex'),
  sha256(decode(repeat('77', 32), 'hex'))
);

-- Secondary share S2 with its own capability cap2 = 0x88 * 32.
insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required,
  idempotency_key_hash, discussion_capability_hash
) values (
  'DREBAQEBAQEBAQEBAQEBAQ',
  '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
  now() + interval '1 hour', null,
  decode(repeat('42', 32), 'hex'), false, false,
  decode(repeat('43', 32), 'hex'),
  sha256(decode(repeat('88', 32), 'hex'))
);

-- 1. Happy path: a comment posts under the correct capability.
select lives_ok(
  $$
    select * from public.add_share_comment(
      'DQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('77', 32), 'hex'),
      null,
      '{"v":1}'::jsonb,
      null
    );
  $$,
  'add_share_comment inserts under the correct capability'
);

select is(
  (
    select count(*)::integer from public.share_comments c
    join public.shares s on s.id = c.share_id
    where s.public_id = 'DQEBAQEBAQEBAQEBAQEBAQ'
  ),
  1,
  'exactly one comment row is stored for the share'
);

-- 3. Wrong capability is rejected.
select throws_ok(
  $$
    select * from public.add_share_comment(
      'DQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('88', 32), 'hex'),
      null,
      '{"v":1}'::jsonb,
      null
    );
  $$,
  '22023',
  'discussion capability mismatch',
  'wrong capability is rejected'
);

-- Fixture comment on S2 for the cross-share parent test.
insert into public.share_comments (
  share_id, parent_comment_id, body_envelope, nickname_envelope
)
select id, null, '{"v":1}'::jsonb, null
  from public.shares where public_id = 'DREBAQEBAQEBAQEBAQEBAQ';

-- 4. A parent from another share is rejected.
select throws_ok(
  $$
    select * from public.add_share_comment(
      'DQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('77', 32), 'hex'),
      (select c.id from public.share_comments c
        join public.shares s on s.id = c.share_id
       where s.public_id = 'DREBAQEBAQEBAQEBAQEBAQ'),
      '{"v":1}'::jsonb,
      null
    );
  $$,
  '22023',
  'invalid parent comment',
  'parent comment from another share is rejected'
);

-- 5. A same-share threaded reply succeeds.
select lives_ok(
  $$
    select * from public.add_share_comment(
      'DQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('77', 32), 'hex'),
      (select c.id from public.share_comments c
        join public.shares s on s.id = c.share_id
       where s.public_id = 'DQEBAQEBAQEBAQEBAQEBAQ'),
      '{"v":1}'::jsonb,
      null
    );
  $$,
  'reply with a parent from the same share is accepted'
);

-- 6. Non-object body envelope is rejected.
select throws_ok(
  $$
    select * from public.add_share_comment(
      'DQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('77', 32), 'hex'),
      null,
      '"not-an-object"'::jsonb,
      null
    );
  $$,
  '22023',
  'invalid comment envelope',
  'non-object body envelope is rejected'
);

-- 7. Body envelope above 4096 text bytes violates the table bound.
select throws_ok(
  format(
    'select public.add_share_comment(''DQEBAQEBAQEBAQEBAQEBAQ'', decode(repeat(''77'', 32), ''hex''), null, %L::jsonb, null)',
    jsonb_build_object('pad', repeat('A', 4200))::text
  ),
  '23514',
  NULL,
  'body envelope above 4096 bytes is rejected'
);

-- 8. Nickname envelope above 1024 text bytes violates the table bound.
select throws_ok(
  format(
    'select public.add_share_comment(''DQEBAQEBAQEBAQEBAQEBAQ'', decode(repeat(''77'', 32), ''hex''), null, ''{"v":1}''::jsonb, %L::jsonb)',
    jsonb_build_object('pad', repeat('A', 1200))::text
  ),
  '23514',
  NULL,
  'nickname envelope above 1024 bytes is rejected'
);

-- 9. Listing is capability-scoped: S1 sees only its own two comments.
select is(
  (
    select count(*)::integer
      from public.list_share_comments('DQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('77', 32), 'hex'))
  ),
  2,
  'list_share_comments returns only the matching share comments'
);

-- 10. S2's list never contains S1's comments.
select is(
  (
    select count(*)::integer
      from public.list_share_comments('DREBAQEBAQEBAQEBAQEBAQ', decode(repeat('88', 32), 'hex'))
  ),
  1,
  'other shares comments are excluded from the listing'
);

-- 11. Expired share: posting is gated by the helper lifecycle check.
-- Fixture first: created in the past so the expiry order constraint
-- accepts an already-expired row.
insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required,
  idempotency_key_hash, discussion_capability_hash,
  created_at
) values (
  'DSEBAQEBAQEBAQEBAQEBAQ',
  '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
  now() - interval '1 minute', null,
  decode(repeat('44', 32), 'hex'), false, false,
  decode(repeat('45', 32), 'hex'),
  sha256(decode(repeat('99', 32), 'hex')),
  now() - interval '2 hours'
);

select throws_ok(
  $$
    select * from public.add_share_comment(
      'DSEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('99', 32), 'hex'),
      null,
      '{"v":1}'::jsonb,
      null
    );
  $$,
  '22023',
  'discussion unavailable',
  'expired share rejects add_share_comment'
);

-- 12. Expired share: listing is gated by the same lifecycle check.
select throws_ok(
  $$
    select * from public.list_share_comments(
      'DSEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('99', 32), 'hex')
    );
  $$,
  '22023',
  'discussion unavailable',
  'expired share rejects list_share_comments'
);

-- Rate-limit fixture: fresh share with zero prior discussion consumption.
insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals,
  delete_token_hash, password_required, unlock_required,
  idempotency_key_hash, discussion_capability_hash
) values (
  'DTEBAQEBAQEBAQEBAQEBAQ',
  '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
  now() + interval '1 hour', null,
  decode(repeat('46', 32), 'hex'), false, false,
  decode(repeat('47', 32), 'hex'),
  sha256(decode(repeat('aa', 32), 'hex'))
);

-- 13. Sixty comments inside one minute are accepted.
select lives_ok(
  $$
    do $body$
    begin
      for i in 1..60 loop
        perform public.add_share_comment(
          'DTEBAQEBAQEBAQEBAQEBAQ',
          decode(repeat('aa', 32), 'hex'),
          null,
          '{"v":1}'::jsonb,
          null
        );
      end loop;
    end
    $body$;
  $$,
  'sixty comments within the rate window are accepted'
);

-- 14. The sixty-first comment hits the per-share discussion ceiling.
select throws_ok(
  $$
    select * from public.add_share_comment(
      'DTEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('aa', 32), 'hex'),
      null,
      '{"v":1}'::jsonb,
      null
    );
  $$,
  'P0001',
  'discussion_rate_limited',
  'the sixty-first comment within a minute is rate limited'
);

-- 15. Scheduled (not yet available) shares also gate their threads.
insert into public.shares (
  public_id, content_envelope, expires_at, available_at, max_reveals,
  delete_token_hash, password_required, unlock_required,
  idempotency_key_hash, discussion_capability_hash
) values (
  'DUEBAQEBAQEBAQEBAQEBAQ',
  '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
  now() + interval '2 hours', now() + interval '1 hour', null,
  decode(repeat('48', 32), 'hex'), false, false,
  decode(repeat('49', 32), 'hex'),
  sha256(decode(repeat('bb', 32), 'hex'))
);

select throws_ok(
  $$
    select * from public.list_share_comments(
      'DUEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('bb', 32), 'hex')
    );
  $$,
  '22023',
  'discussion unavailable',
  'scheduled share rejects list_share_comments'
);

select * from finish();
rollback;
