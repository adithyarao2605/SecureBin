-- Fix canonical base64url comparison for values longer than 76 characters.
--
-- Postgres `encode(bytea, 'base64')` inserts a newline every 76 characters.
-- The canonical round-trip check stripped only "=" padding, so any ciphertext
-- whose base64url exceeded 76 characters (most real notes and attachments'
-- larger payloads validated through this path) was falsely rejected with
-- "invalid content envelope". Strip line breaks before trimming padding so
-- canonical comparison matches RFC 4648 section 3.1 expectations used by the
-- browser's encoder.

create or replace function public.securebin_b64url(
  value text,
  expected_bytes integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
declare
  decoded bytea;
  canonical text;
begin
  if expected_bytes < 1
     or value !~ '^[A-Za-z0-9_-]+$'
     or length(value) <> ceil(expected_bytes * 8.0 / 6.0)::integer then
    return false;
  end if;

  decoded := decode(
    translate(value, '-_', '+/') || repeat('=', (4 - length(value) % 4) % 4),
    'base64'
  );
  canonical := replace(replace(rtrim(replace(encode(decoded, 'base64'), E'\n', ''), '='), '+', '-'), '/', '_');
  return octet_length(decoded) = expected_bytes and canonical = value;
exception when invalid_text_representation or invalid_parameter_value then
  return false;
end;
$$;

create or replace function public.securebin_b64url_range(
  value text,
  minimum_bytes integer,
  maximum_bytes integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = public, extensions, pg_temp
as $$
declare
  decoded bytea;
  canonical text;
begin
  if minimum_bytes < 1
     or maximum_bytes < minimum_bytes
     or value !~ '^[A-Za-z0-9_-]+$'
     or length(value) < ceil(minimum_bytes * 8.0 / 6.0)::integer
     or length(value) > ceil(maximum_bytes * 8.0 / 6.0)::integer then
    return false;
  end if;

  decoded := decode(
    translate(value, '-_', '+/') || repeat('=', (4 - length(value) % 4) % 4),
    'base64'
  );
  canonical := replace(replace(rtrim(replace(encode(decoded, 'base64'), E'\n', ''), '='), '+', '-'), '/', '_');
  return octet_length(decoded) between minimum_bytes and maximum_bytes
    and canonical = value;
exception when invalid_text_representation or invalid_parameter_value then
  return false;
end;
$$;
