create or replace function public.get_share_status_batch(p_public_ids text[])
returns table (
  public_id text,
  status text,
  available_at timestamptz,
  expires_at timestamptz,
  password_required boolean,
  unlock_required boolean,
  max_reveals integer,
  remaining_reveals integer
)
language plpgsql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
declare
  now_utc timestamptz := now();
begin
  if p_public_ids is null
     or cardinality(p_public_ids) < 1
     or cardinality(p_public_ids) > 50
     or cardinality(p_public_ids) <> (select count(distinct value) from unnest(p_public_ids) as ids(value))
     or exists (select 1 from unnest(p_public_ids) as ids(value) where not securebin_b64url(ids.value, 16)) then
    raise exception using errcode = '22023', message = 'invalid status batch';
  end if;

  return query
  with requested as (
    select ids.value as public_id, ids.ordinality
      from unnest(p_public_ids) with ordinality as ids(value, ordinality)
  ), classified as (
    select r.public_id,
           r.ordinality,
           s.available_at,
           s.expires_at,
           s.password_required,
           s.unlock_required,
           s.max_reveals,
           s.reveal_count,
           case
             when s.id is null
               or s.revoked_at is not null
               or s.expires_at is not null and s.expires_at <= now_utc
               or s.max_reveals is not null and s.reveal_count >= s.max_reveals
               then 'unavailable'
             when s.available_at is not null and s.available_at > now_utc then 'scheduled'
             else 'active'
           end as resolved_status
      from requested r
      left join public.shares s on s.public_id = r.public_id
  )
  select c.public_id,
         c.resolved_status,
         case when c.resolved_status = 'scheduled' then c.available_at else null end,
         case when c.resolved_status in ('active', 'scheduled') then c.expires_at else null end,
         case when c.resolved_status in ('active', 'scheduled') then c.password_required else false end,
         case when c.resolved_status in ('active', 'scheduled') then c.unlock_required else false end,
         case when c.resolved_status in ('active', 'scheduled') then c.max_reveals else null end,
         case when c.resolved_status in ('active', 'scheduled') and c.max_reveals is not null
           then c.max_reveals - c.reveal_count else null end
    from classified c
   order by c.ordinality;
end;
$$;

revoke all on function public.get_share_status_batch(text[]) from public, anon, authenticated;
grant execute on function public.get_share_status_batch(text[]) to service_role;
