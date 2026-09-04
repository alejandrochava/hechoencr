-- Permisos que en Supabase hosted ya vienen puestos. Row Level Security sigue
-- siendo la que decide fila por fila; esto solo abre la puerta a nivel de tabla.

grant usage on schema public to anon, authenticated, service_role;

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete on public.projects, public.votes, public.claims, public.profiles
  to authenticated;

-- El formulario de contacto funciona sin sesion: RLS limita que se puede leer.
grant insert on public.messages to anon, authenticated;
grant update on public.messages to authenticated;
grant execute on all functions in schema public to anon, authenticated;

alter default privileges in schema public
  grant select on tables to anon, authenticated;
