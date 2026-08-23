-- Phase C: per-comment edit capabilities and orphan-preserving deletion.
-- Raw edit tokens are received only long enough to hash them in the API
-- service; this schema stores the SHA-256 digest, never the token itself.

alter table public.share_comments
  add column if not exists edit_token_hash bytea,
  add column if not exists edited_at timestamptz;

-- Keep the deleted parent UUID on replies so recipients can render an honest
-- "[comment removed]" marker instead of silently losing the reply.
alter table public.share_comments
  drop constraint if exists share_comments_parent_comment_id_fkey;

alter table public.share_comments
  drop constraint if exists share_comments_edit_token_hash_size;

alter table public.share_comments
  add constraint share_comments_edit_token_hash_size check (
    edit_token_hash is null or octet_length(edit_token_hash) = 32
  );

drop function if exists public.add_share_comment(text, bytea, uuid, jsonb, jsonb);

create or replace function public.add_share_comment(
  p_public_id text,
  p_discussion_capability bytea,
  p_edit_token_hash bytea,
  p_parent_comment_id uuid,
  p_body_envelope jsonb,
  p_nickname_envelope jsonb default null
)
returns table (comment_id uuid, created_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
#variable_conflict use_column
declare
  share public.shares%rowtype;
  parent public.share_comments%rowtype;
  inserted uuid;
  rate_ok boolean;
begin
  share := public.securebin_discussion_share(p_public_id, p_discussion_capability);

  if p_edit_token_hash is null or octet_length(p_edit_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid comment edit token';
  end if;
  if p_body_envelope is null or jsonb_typeof(p_body_envelope) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid comment envelope';
  end if;
  if p_nickname_envelope is not null and jsonb_typeof(p_nickname_envelope) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid nickname envelope';
  end if;

  if p_parent_comment_id is not null then
    select * into parent from public.share_comments c where c.id = p_parent_comment_id;
    if not found or parent.share_id <> share.id then
      raise exception using errcode = '22023', message = 'invalid parent comment';
    end if;
  end if;

  select public.consume_rate_limit(
           sha256(convert_to('discussion/' || share.id::text, 'UTF8')),
           'discussion', 60)
    into rate_ok;
  if rate_ok is not true then
    raise exception using errcode = 'P0001', message = 'discussion_rate_limited';
  end if;

  insert into public.share_comments (
    share_id, parent_comment_id, body_envelope, nickname_envelope, edit_token_hash
  ) values (
    share.id, p_parent_comment_id, p_body_envelope, p_nickname_envelope, p_edit_token_hash
  )
  returning id into inserted;

  return query select inserted, now();
end;
$$;

create or replace function public.edit_share_comment(
  p_public_id text,
  p_discussion_capability bytea,
  p_comment_id uuid,
  p_edit_token_hash bytea,
  p_body_envelope jsonb
)
returns table (comment_id uuid, edited_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  share public.shares%rowtype;
  comment_share_id uuid;
  stored_token_hash bytea;
  rate_ok boolean;
begin
  share := public.securebin_discussion_share(p_public_id, p_discussion_capability);

  if p_edit_token_hash is null or octet_length(p_edit_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid comment edit token';
  end if;
  if p_body_envelope is null or jsonb_typeof(p_body_envelope) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid comment envelope';
  end if;

  select c.share_id, c.edit_token_hash
    into comment_share_id, stored_token_hash
    from public.share_comments c
   where c.id = p_comment_id;
  if not found or comment_share_id <> share.id or stored_token_hash is null or stored_token_hash <> p_edit_token_hash then
    raise exception using errcode = '22023', message = 'invalid comment edit token';
  end if;

  select public.consume_rate_limit(
           sha256(convert_to('discussion/' || share.id::text, 'UTF8')),
           'discussion', 60)
    into rate_ok;
  if rate_ok is not true then
    raise exception using errcode = 'P0001', message = 'discussion_rate_limited';
  end if;

  return query
    update public.share_comments c
       set body_envelope = p_body_envelope,
           edited_at = now()
     where c.id = p_comment_id
       and c.share_id = share.id
     returning c.id, c.edited_at;
end;
$$;

create or replace function public.delete_share_comment(
  p_public_id text,
  p_discussion_capability bytea,
  p_comment_id uuid,
  p_edit_token_hash bytea
)
returns table (deleted boolean)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  share public.shares%rowtype;
  comment_share_id uuid;
  stored_token_hash bytea;
  rate_ok boolean;
begin
  share := public.securebin_discussion_share(p_public_id, p_discussion_capability);

  if p_edit_token_hash is null or octet_length(p_edit_token_hash) <> 32 then
    raise exception using errcode = '22023', message = 'invalid comment edit token';
  end if;

  select c.share_id, c.edit_token_hash
    into comment_share_id, stored_token_hash
    from public.share_comments c
   where c.id = p_comment_id;
  if not found or comment_share_id <> share.id or stored_token_hash is null or stored_token_hash <> p_edit_token_hash then
    raise exception using errcode = '22023', message = 'invalid comment edit token';
  end if;

  select public.consume_rate_limit(
           sha256(convert_to('discussion/' || share.id::text, 'UTF8')),
           'discussion', 60)
    into rate_ok;
  if rate_ok is not true then
    raise exception using errcode = 'P0001', message = 'discussion_rate_limited';
  end if;

  delete from public.share_comments c where c.id = p_comment_id and c.share_id = share.id;
  return query select true;
end;
$$;

drop function if exists public.list_share_comments(text, bytea);

create or replace function public.list_share_comments(
  p_public_id text,
  p_discussion_capability bytea
)
returns table (
  comment_id uuid,
  parent_comment_id uuid,
  body_envelope jsonb,
  nickname_envelope jsonb,
  created_at timestamptz,
  edited_at timestamptz
)
language sql
security definer
stable
set search_path = public, extensions, pg_temp
as $$
  select c.id, c.parent_comment_id, c.body_envelope, c.nickname_envelope, c.created_at, c.edited_at
    from public.share_comments c
   where c.share_id = (public.securebin_discussion_share(p_public_id, p_discussion_capability)).id
   order by c.created_at asc, c.id asc;
$$;

revoke all on function public.add_share_comment(text, bytea, bytea, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.add_share_comment(text, bytea, bytea, uuid, jsonb, jsonb) to service_role;

revoke all on function public.edit_share_comment(text, bytea, uuid, bytea, jsonb)
  from public, anon, authenticated;
grant execute on function public.edit_share_comment(text, bytea, uuid, bytea, jsonb) to service_role;

revoke all on function public.delete_share_comment(text, bytea, uuid, bytea)
  from public, anon, authenticated;
grant execute on function public.delete_share_comment(text, bytea, uuid, bytea) to service_role;

revoke all on function public.list_share_comments(text, bytea) from public, anon, authenticated;
grant execute on function public.list_share_comments(text, bytea) to service_role;
