-- Post-freeze lifecycle correction: cleanup must also see note-only shares and
-- shares whose release limit has been exhausted. Exhausted shares wait until
-- every five-minute retry lease has closed so a lost response can still be
-- recovered before ciphertext is physically removed.

create or replace function public.list_cleanup_candidates()
returns table (candidate_type text, share_id uuid, reservation_id uuid, object_path text)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  with eligible_shares as (
    select s.id
      from public.shares s
     where (
       (s.expires_at is not null and s.expires_at <= now())
       or s.revoked_at is not null
       or (
         s.max_reveals is not null
         and s.reveal_count >= s.max_reveals
         and not exists (
           select 1
             from public.reveal_leases rl
            where rl.share_id = s.id
              and rl.retry_expires_at > now()
         )
       )
     )
  )
  select 'share'::text, s.id, null::uuid, a.object_path
    from public.share_attachments a
    join eligible_shares s on s.id = a.share_id
  union all
  select 'share'::text, s.id, null::uuid, null::text
    from eligible_shares s
   where not exists (
     select 1 from public.share_attachments a where a.share_id = s.id
   )
  union all
  select 'upload'::text, null::uuid, u.id, u.object_path
    from public.upload_reservations u
   where u.attached_share_id is null and u.expires_at <= now()
  union all
  select 'upload_rotation'::text, null::uuid, q.id, q.object_path
    from public.upload_rotation_cleanup_queue q
   where not exists (select 1 from public.share_attachments a where a.object_path = q.object_path)
$$;

create or replace function public.finalize_expired_securebin(
  p_share_ids uuid[] default null,
  p_reservation_ids uuid[] default null,
  p_rotation_ids uuid[] default null
)
returns table (
  deleted_shares integer,
  deleted_uploads integer,
  deleted_rotated_uploads integer,
  deleted_leases integer,
  deleted_buckets integer
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  share_count integer;
  upload_count integer;
  rotation_count integer;
  lease_count integer;
  bucket_count integer;
begin
  delete from public.shares as s
    where (p_share_ids is null or s.id = any (p_share_ids))
      and (
        (s.expires_at is not null and s.expires_at <= now())
        or s.revoked_at is not null
        or (
          s.max_reveals is not null
          and s.reveal_count >= s.max_reveals
          and not exists (
            select 1
              from public.reveal_leases rl
             where rl.share_id = s.id
               and rl.retry_expires_at > now()
          )
        )
      )
      and not exists (
        select 1
          from public.share_attachments a
         where a.share_id = s.id
           and exists (
             select 1
               from storage.objects object_row
              where object_row.bucket_id = 'securebin-files'
                and object_row.name = a.object_path
           )
      );
  get diagnostics share_count = row_count;

  delete from public.upload_reservations as u
    where (p_reservation_ids is null or u.id = any (p_reservation_ids))
      and u.attached_share_id is null
      and u.expires_at <= now()
      and not exists (
        select 1
          from storage.objects object_row
         where object_row.bucket_id = 'securebin-files'
           and object_row.name = u.object_path
      );
  get diagnostics upload_count = row_count;

  delete from public.upload_rotation_cleanup_queue as q
    where p_rotation_ids is not null
      and q.id = any (p_rotation_ids)
      and not exists (
        select 1 from public.share_attachments a where a.object_path = q.object_path
      )
      and not exists (
        select 1 from public.upload_reservations u where u.object_path = q.object_path
      )
      and not exists (
        select 1
          from storage.objects object_row
         where object_row.bucket_id = 'securebin-files'
           and object_row.name = q.object_path
      );
  get diagnostics rotation_count = row_count;

  delete from public.reveal_leases
   where retry_expires_at <= now() - interval '24 hours';
  get diagnostics lease_count = row_count;

  delete from public.rate_limit_buckets
   where expires_at <= now();
  get diagnostics bucket_count = row_count;

  return query select share_count, upload_count, rotation_count, lease_count, bucket_count;
end;
$$;

revoke all on function public.list_cleanup_candidates() from public, anon, authenticated;
grant execute on function public.list_cleanup_candidates() to service_role;
revoke all on function public.finalize_expired_securebin(uuid[], uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.finalize_expired_securebin(uuid[], uuid[], uuid[]) to service_role;
