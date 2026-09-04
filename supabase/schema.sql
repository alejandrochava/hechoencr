-- =====================================================================
-- Esquema del directorio de proyectos ticos
-- Correr entero en el SQL Editor de Supabase (es idempotente).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type project_status as enum ('published', 'pending', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type claim_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Perfiles (espejo de auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text unique,
  display_name  text,
  avatar_url    text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Datos que se agregaron despues de la primera version.
alter table public.profiles add column if not exists github_handle text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists phone text;

-- Movil de Costa Rica: 8 digitos que empiezan en 6, 7 u 8 (los fijos usan 2).
do $$ begin
  alter table public.profiles
    add constraint profiles_phone_cr check (phone is null or phone ~ '^[678][0-9]{7}$');
exception when duplicate_object then null; end $$;
alter table public.profiles add column if not exists public_profile boolean not null default true;

/*
 * Una identidad, una cuenta. El correo ya es unico en auth.users; aca cerramos
 * las otras dos puertas. Son indices unicos (no constraints) para poder
 * ignorar los nulos: alguien que entro con correo todavia no tiene GitHub.
 */
create unique index if not exists profiles_github_handle_key
  on public.profiles (lower(github_handle))
  where github_handle is not null;

create unique index if not exists profiles_phone_key
  on public.profiles (phone)
  where phone is not null;

-- Crea el perfil automaticamente cuando alguien se registra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, handle, display_name, avatar_url, github_handle, phone)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when new.raw_app_meta_data ->> 'provider' = 'github'
      then new.raw_user_meta_data ->> 'user_name'
    end,
    -- El telefono viene del formulario de registro, ya normalizado a 8 digitos.
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Proyectos
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null check (char_length(name) between 2 and 60),
  tagline       text not null check (char_length(tagline) between 10 and 140),
  description   text check (char_length(description) <= 4000),
  url           text not null check (url ~* '^https?://'),
  repo_url      text check (repo_url ~* '^https?://'),
  logo_url      text,
  image_url     text,
  tags          text[] not null default '{}',
  status        project_status not null default 'published',
  owner_id      uuid references public.profiles (id) on delete set null,
  submitted_by  uuid references public.profiles (id) on delete set null,
  vote_count    integer not null default 0,
  view_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Para bases creadas antes de que existiera la vista previa.
alter table public.projects add column if not exists image_url text;

-- Enlaces extra que quiera sumar quien publica: docs, demo, changelog, etc.
-- Se guarda como [{"label": "...", "url": "..."}]; la app valida la forma.
alter table public.projects add column if not exists links jsonb not null default '[]'::jsonb;

create index if not exists projects_created_at_idx on public.projects (created_at desc);
create index if not exists projects_vote_count_idx on public.projects (vote_count desc);
create index if not exists projects_tags_idx on public.projects using gin (tags);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Votos (un voto por persona por proyecto, garantizado por la PK)
-- ---------------------------------------------------------------------
create table if not exists public.votes (
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists votes_recent_idx on public.votes (created_at desc);

-- Mantiene projects.vote_count sincronizado.
create or replace function public.sync_vote_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.projects set vote_count = vote_count + 1 where id = new.project_id;
  elsif tg_op = 'DELETE' then
    update public.projects set vote_count = greatest(vote_count - 1, 0) where id = old.project_id;
  end if;
  return null;
end;
$$;

drop trigger if exists votes_sync_count on public.votes;
create trigger votes_sync_count
  after insert or delete on public.votes
  for each row execute function public.sync_vote_count();

-- ---------------------------------------------------------------------
-- Reclamos de propiedad ("Este es mi proyecto")
-- ---------------------------------------------------------------------
create table if not exists public.claims (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  evidence    text not null check (char_length(evidence) between 10 and 1000),
  contact     text,
  status      claim_status not null default 'pending',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (project_id, user_id)
);

-- ---------------------------------------------------------------------
-- Mensajes: contacto, ayuda y sugerencias. Los lee un admin desde el panel.
-- ---------------------------------------------------------------------
do $$ begin
  create type message_kind as enum ('contacto', 'ayuda', 'sugerencia');
exception when duplicate_object then null; end $$;

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  kind        message_kind not null default 'contacto',
  name        text not null check (char_length(name) between 2 and 80),
  email       text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  body        text not null check (char_length(body) between 10 and 4000),
  user_id     uuid references public.profiles (id) on delete set null,
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists messages_created_at_idx on public.messages (created_at desc);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Suma una visita sin exponer un UPDATE abierto sobre projects.
create or replace function public.register_view(p_slug text)
returns void language sql security definer set search_path = public as $$
  update public.projects set view_count = view_count + 1 where slug = p_slug;
$$;

-- Aprueba un reclamo y le asigna la propiedad del proyecto a quien lo pidio.
create or replace function public.resolve_claim(p_claim_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.claims;
begin
  if not public.is_admin() then
    raise exception 'solo un admin puede resolver reclamos';
  end if;

  select * into c from public.claims where id = p_claim_id;
  if not found then
    raise exception 'reclamo no encontrado';
  end if;

  update public.claims
     set status = case when p_approve then 'approved' else 'rejected' end::claim_status,
         resolved_at = now()
   where id = p_claim_id;

  if p_approve then
    update public.projects set owner_id = c.user_id where id = c.project_id;
  end if;
end;
$$;

/*
 * Un telefono no se puede consultar libremente (es dato personal), pero si
 * hace falta saber si ya esta tomado antes de registrar. Esta funcion devuelve
 * solo un booleano: no filtra de quien es.
 */
create or replace function public.phone_taken(p_phone text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where phone = p_phone);
$$;

/*
 * Completa el perfil despues de registrarse. El correo lo pone la identidad de
 * Supabase; aca solo caen telefono y nombre. Si el telefono ya existe en otra
 * cuenta, la restriccion unica lo rechaza y la app lo reporta.
 */
create or replace function public.complete_profile(p_phone text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'necesitas sesion';
  end if;

  update public.profiles
     set phone = coalesce(nullif(p_phone, ''), phone),
         display_name = coalesce(nullif(p_name, ''), display_name)
   where id = auth.uid();
end;
$$;

-- Dueno de un repo de GitHub a partir de su URL.
create or replace function public.github_owner(p_url text)
returns text language sql immutable as $$
  select lower((regexp_match(p_url, '^https?://(?:www\.)?github\.com/([^/]+)/'))[1]);
$$;

/*
 * Reclamo automatico: si el repo del proyecto vive en la cuenta de GitHub que
 * la persona tiene enlazada, la propiedad se asigna sola. El handle no lo
 * escribe el usuario a mano, viene de la identidad de OAuth.
 */
create or replace function public.claim_with_github(p_project_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_handle text;
  v_repo   text;
begin
  if v_user is null then
    raise exception 'necesitas sesion';
  end if;

  select lower(github_handle) into v_handle from public.profiles where id = v_user;
  if v_handle is null then
    return false;
  end if;

  select repo_url into v_repo
    from public.projects
   where id = p_project_id and owner_id is null;
  if v_repo is null then
    return false;
  end if;

  if public.github_owner(v_repo) is distinct from v_handle then
    return false;
  end if;

  update public.projects set owner_id = v_user where id = p_project_id;

  insert into public.claims (project_id, user_id, evidence, status, resolved_at)
  values (
    p_project_id, v_user,
    'Verificado automaticamente: el repositorio pertenece a @' || v_handle,
    'approved', now()
  )
  on conflict (project_id, user_id)
  do update set status = 'approved', resolved_at = now();

  return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Vista del feed: agrega el puntaje de "destacados" y los votos recientes
-- ---------------------------------------------------------------------
-- Se recrea entera: "create or replace view" no permite agregar columnas
-- en medio, y el orden de las columnas aca cambia con el tiempo.
drop view if exists public.project_feed;

create view public.project_feed
with (security_invoker = on) as
select
  p.id, p.slug, p.name, p.tagline, p.url, p.repo_url, p.logo_url, p.image_url, p.tags,
  p.submitted_by,
  p.vote_count, p.view_count, p.created_at, p.owner_id,
  (p.owner_id is not null) as is_claimed,
  -- Ranking tipo Hacker News: los votos pesan menos conforme pasan las horas.
  (p.vote_count::numeric / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5)) as hot_score,
  coalesce(v.recent_votes, 0) as recent_votes
from public.projects p
left join (
  select project_id, count(*) as recent_votes
  from public.votes
  where created_at > now() - interval '7 days'
  group by project_id
) v on v.project_id = p.id
where p.status = 'published';

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.votes    enable row level security;
alter table public.claims   enable row level security;
alter table public.messages enable row level security;

drop policy if exists "perfiles visibles para todos" on public.profiles;
create policy "perfiles visibles para todos" on public.profiles
  for select using (true);

drop policy if exists "cada quien edita su perfil" on public.profiles;
create policy "cada quien edita su perfil" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "proyectos publicados son publicos" on public.projects;
create policy "proyectos publicados son publicos" on public.projects
  for select using (
    status = 'published'
    or owner_id = auth.uid()
    or submitted_by = auth.uid()
    or public.is_admin()
  );

drop policy if exists "publicar requiere sesion" on public.projects;
create policy "publicar requiere sesion" on public.projects
  for insert to authenticated with check (submitted_by = auth.uid());

drop policy if exists "solo el duenno edita" on public.projects;
create policy "solo el duenno edita" on public.projects
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "votos visibles para todos" on public.votes;
create policy "votos visibles para todos" on public.votes
  for select using (true);

drop policy if exists "votar requiere sesion" on public.votes;
create policy "votar requiere sesion" on public.votes
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "cada quien quita su voto" on public.votes;
create policy "cada quien quita su voto" on public.votes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "ver mis reclamos" on public.claims;
create policy "ver mis reclamos" on public.claims
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "reclamar requiere sesion" on public.claims;
create policy "reclamar requiere sesion" on public.claims
  for insert to authenticated with check (user_id = auth.uid());

-- Cualquiera puede escribir; solo un admin puede leer o marcar como atendido.
drop policy if exists "cualquiera puede escribir" on public.messages;
create policy "cualquiera puede escribir" on public.messages
  for insert with check (user_id is null or user_id = auth.uid());

drop policy if exists "solo admins leen mensajes" on public.messages;
create policy "solo admins leen mensajes" on public.messages
  for select using (public.is_admin());

drop policy if exists "solo admins marcan mensajes" on public.messages;
create policy "solo admins marcan mensajes" on public.messages
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
