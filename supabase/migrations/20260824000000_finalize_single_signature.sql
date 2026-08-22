-- Collapse finalize_expired_securebin to a single three-argument signature.
--
-- The deployed two-array overload made PostgREST function resolution ambiguous
-- for callers that omit p_rotation_ids, and the base three-argument function
-- now defaults every parameter, so no caller needs the wrapper. This forward
-- migration drops the overload and normalizes grants in already-deployed
-- projects; fresh resets reach the same state through 20260821010000 plus this
-- file.
drop function if exists public.finalize_expired_securebin(uuid[], uuid[]);

revoke all on function public.finalize_expired_securebin(uuid[], uuid[], uuid[])
  from public, anon, authenticated;
grant execute on function public.finalize_expired_securebin(uuid[], uuid[], uuid[])
  to service_role;
