begin;

select plan(7);

select has_function(
  'public',
  'get_share_status_batch',
  array['text[]'],
  'batch status RPC exists'
);

select ok(
  (select p.prosecdef
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_share_status_batch'),
  'batch status RPC is security definer'
);

select ok(
  not has_function_privilege('anon', 'public.get_share_status_batch(text[])', 'EXECUTE'),
  'anonymous clients cannot execute batch status RPC'
);

select throws_ok(
  $$select * from public.get_share_status_batch(array_fill('AAAAAAAAAAAAAAAAAAAAAA'::text, array[51]))$$,
  '22023',
  'invalid status batch',
  'batch status RPC caps requests at 50 ids'
);

select throws_ok(
  $$select * from public.get_share_status_batch(array['not-a-public-id'])$$,
  '22023',
  'invalid status batch',
  'batch status RPC rejects malformed ids'
);

create temp table batch_status on commit drop as
select * from public.get_share_status_batch(array[
  'AAAAAAAAAAAAAAAAAAAAAA',
  'AQEBAQEBAQEBAQEBAQEBAQ'
]);

select is((select count(*)::integer from batch_status), 2, 'batch returns one row per requested id');
select is((select count(*)::integer from batch_status where status = 'unavailable'), 2, 'missing ids use uniform unavailable rows');

select * from finish();
rollback;
