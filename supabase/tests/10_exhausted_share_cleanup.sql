begin;

select plan(5);

-- An exhausted note-only share has no attachment row, but it must still reach
-- the cleanup service so the share row and ciphertext can be finalized.
insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals, reveal_count,
  delete_token_hash, password_required, unlock_required, idempotency_key_hash
) values (
  'UQEBAQEBAQEBAQEBAQEBAQ',
  jsonb_build_object(
    'version', 1, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
    'factorMask', 'link', 'ciphertext', 'AAAAAAAAAAAAAAAAAAAAAA'
  ),
  now() + interval '1 hour', 1, 1,
  decode(repeat('d1', 32), 'hex'), false, false, decode(repeat('d2', 32), 'hex')
);

select is(
  (select count(*)::integer
     from public.list_cleanup_candidates() c
    where c.candidate_type = 'share'
      and c.share_id = (select id from public.shares where public_id = 'UQEBAQEBAQEBAQEBAQEBAQ')
      and c.object_path is null),
  1,
  'exhausted note-only share is a cleanup candidate'
);

select is(
  (select count(*)::integer
     from public.list_cleanup_candidates() c
    where c.share_id = (select id from public.shares where public_id = 'UQEBAQEBAQEBAQEBAQEBAQ')),
  1,
  'note-only share emits exactly one candidate'
);

insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals, reveal_count,
  delete_token_hash, password_required, unlock_required, idempotency_key_hash
) values (
  'VQEBAQEBAQEBAQEBAQEBAQ',
  jsonb_build_object(
    'version', 1, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
    'factorMask', 'link', 'ciphertext', 'AAAAAAAAAAAAAAAAAAAAAA'
  ),
  now() + interval '1 hour', 1, 0,
  decode(repeat('d3', 32), 'hex'), false, false, decode(repeat('d4', 32), 'hex')
);

select is(
  (select count(*)::integer
     from public.list_cleanup_candidates() c
    where c.share_id = (select id from public.shares where public_id = 'VQEBAQEBAQEBAQEBAQEBAQ')),
  0,
  'active share is not a cleanup candidate'
);

insert into public.shares (
  public_id, content_envelope, expires_at, max_reveals, reveal_count,
  delete_token_hash, password_required, unlock_required, idempotency_key_hash
) values (
  'WQEBAQEBAQEBAQEBAQEBAQ',
  jsonb_build_object(
    'version', 1, 'objectType', 'content', 'algorithm', 'AES-256-GCM',
    'nonce', 'AAAAAAAAAAAAAAAA', 'hkdfSalt', 'AAAAAAAAAAAAAAAAAAAAAA',
    'passwordSalt', null, 'kdf', 'none', 'kdfParameters', '{}'::jsonb,
    'factorMask', 'link', 'ciphertext', 'AAAAAAAAAAAAAAAAAAAAAA'
  ),
  now() + interval '1 hour', 1, 1,
  decode(repeat('d5', 32), 'hex'), false, false, decode(repeat('d6', 32), 'hex')
);

insert into public.reveal_leases (share_id, request_token_hash, issued_at, retry_expires_at)
select id, decode(repeat('d7', 32), 'hex'), now(), now() + interval '1 minute'
  from public.shares
 where public_id = 'WQEBAQEBAQEBAQEBAQEBAQ';

select is(
  (select count(*)::integer
     from public.list_cleanup_candidates() c
    where c.share_id = (select id from public.shares where public_id = 'WQEBAQEBAQEBAQEBAQEBAQ')),
  0,
  'active retry lease protects exhausted share from cleanup'
);

delete from public.reveal_leases
 where share_id = (select id from public.shares where public_id = 'WQEBAQEBAQEBAQEBAQEBAQ');

select is(
  (select deleted_shares
     from public.finalize_expired_securebin(
       array[(select id from public.shares where public_id = 'UQEBAQEBAQEBAQEBAQEBAQ')],
       null::uuid[], null::uuid[])),
  1,
  'exhausted note-only share finalizes after retry lease closes'
);

select * from finish();
rollback;
