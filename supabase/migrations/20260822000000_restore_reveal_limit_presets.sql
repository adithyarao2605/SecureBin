-- Restore the public reveal-limit contract to the supported presets.
alter table public.shares
  drop constraint if exists shares_reveal_limit,
  add constraint shares_reveal_limit check (max_reveals is null or max_reveals in (1, 3, 5, 10));
