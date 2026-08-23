-- Day 5: multi-file attachment tests.
begin;

select plan(8);

-- 1. Slot 0 reservation succeeds.
select lives_ok(
  $$
    select * from public.create_upload_reservation(
      'BQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('30', 32), 'hex'),
      '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      45::bigint,
      0
    );
  $$,
  'slot 0 reservation is staged'
);

-- 2. A different slot under the same tuple succeeds.
select lives_ok(
  $$
    select * from public.create_upload_reservation(
      'BQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('30', 32), 'hex'),
      '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      45::bigint,
      1
    );
  $$,
  'slot 1 reservation under the same tuple succeeds'
);

-- 3. Same tuple + same slot with different payload conflicts (23505).
select throws_ok(
  $$
    select * from public.create_upload_reservation(
      'BQEBAQEBAQEBAQEBAQEBAQ',
      decode(repeat('30', 32), 'hex'),
      '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
      46::bigint,
      0
    );
  $$,
  '23505',
  'reservation_conflict',
  'same-slot reservation with a different envelope or size conflicts'
);

-- Fixture: an expired, unattached reservation for the same tuple that
-- create_share must NOT bind.
insert into public.upload_reservations (
  reserved_public_id, idempotency_key_hash, attachment_slot,
  object_path, file_envelope, expected_ciphertext_size,
  created_at, expires_at
) values (
  'BQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('30', 32), 'hex'), 2,
  'objects/' || repeat('e', 48) || '.bin',
  '{"version":2,"objectType":"file","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link"}'::jsonb,
  45::bigint,
  now() - interval '16 minutes', now() - interval '1 minute'
);

-- Fixture: fake uploaded objects sized to match the live reservations.
insert into storage.objects (bucket_id, name, metadata)
select 'securebin-files', r.object_path, '{"size":"45"}'::jsonb
  from public.upload_reservations r
 where r.reserved_public_id = 'BQEBAQEBAQEBAQEBAQEBAQ'
   and r.idempotency_key_hash = decode(repeat('30', 32), 'hex')
   and r.attachment_slot in (0, 1);

select lives_ok(
  $$
    select * from public.create_share(
      'BQEBAQEBAQEBAQEBAQEBAQ',
      '{"version":2,"objectType":"content","algorithm":"AES-256-GCM","nonce":"AQEBAQEBAQEBAQEB","hkdfSalt":"AQEBAQEBAQEBAQEBAQEBAQ","passwordSalt":null,"kdf":"none","kdfParameters":{},"factorMask":"link","ciphertext":"AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE"}'::jsonb,
      null,
      now() + interval '24 hours',
      null,
      decode(repeat('31', 32), 'hex'),
      false,
      false,
      decode(repeat('30', 32), 'hex'),
      null
    );
  $$,
  'create_share binds the staged reservations'
);

-- 5. Exactly the two live reservations are bound; expired one excluded.
select is(
  (
    select count(*)::integer from public.share_attachments a
    join public.shares s on s.id = a.share_id
    where s.public_id = 'BQEBAQEBAQEBAQEBAQEBAQ'
  ),
  2,
  'create_share binds exactly the two unexpired staged reservations'
);

select is(
  (
    select count(*)::integer from public.upload_reservations
    where reserved_public_id = 'BQEBAQEBAQEBAQEBAQEBAQ'
      and attachment_slot = 2
      and attached_share_id is null
  ),
  1,
  'expired unattached reservation stays unbound'
);

-- 7. reveal_share returns an attachments array of length 2.
select is(
  (
    select jsonb_array_length(attachments)
      from public.reveal_share('BQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('32', 32), 'hex'))
     where status = 'authorized'
  ),
  2,
  'reveal_share returns two attachments for the two-slot share'
);

-- 8. Attachments are ordered by slot ascending with bound payloads.
select is(
  (
    select (attachments->0->>'slot', attachments->1->>'slot',
            attachments->0->>'ciphertextSize')::text
      from public.reveal_share('BQEBAQEBAQEBAQEBAQEBAQ', decode(repeat('32', 32), 'hex'))
     where status = 'authorized'
  ),
  '(0,1,45)',
  'attachments are slot-ordered and carry envelope sizes'
);

select * from finish();
rollback;
