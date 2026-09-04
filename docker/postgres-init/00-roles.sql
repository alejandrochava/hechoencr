-- Roles y funciones que Supabase normalmente ya trae y que aca creamos a mano,
-- porque este stack usa Postgres puro + GoTrue + PostgREST.

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- Roles del modelo de Supabase.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

-- PostgREST entra como authenticator y se cambia al rol que diga el JWT.
create role authenticator noinherit login password 'postgres';
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

-- auth.uid(): el id del usuario que viene firmado en el JWT.
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
