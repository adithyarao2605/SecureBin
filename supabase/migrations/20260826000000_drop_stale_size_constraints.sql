-- Drop stale foundation constraints that Day 3 failed to remove.
--
-- Migration 20260823000000 attempted `drop constraint if exists
-- shares_content_envelope` / `file_size_limit`, but the foundation created
-- these checks under different names. Both old constraints therefore remained
-- active alongside their Day-3 replacements, silently capping content
-- ciphertext at 524304 bytes (instead of 524315) and file ciphertext at
-- 10485776 bytes (instead of 10486422), making advertised-maximum creates
-- fail with SQLSTATE 23514 mapped to an opaque 503.

alter table public.shares
  drop constraint if exists shares_content_envelope_format,
  drop constraint if exists shares_file_size_limit;
