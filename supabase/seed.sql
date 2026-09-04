-- =====================================================================
-- Datos de ejemplo SOLO para ver la interfaz con contenido.
-- Son inventados: borralos antes de abrir el sitio al publico con
--   delete from public.projects where slug like 'demo-%';
-- =====================================================================

insert into public.projects (slug, name, tagline, description, url, tags, vote_count, view_count, created_at)
values
  ('demo-leyes', 'Demo: Leyes al Dia',
   'Los proyectos de ley de la Asamblea, legibles y actualizados todos los dias.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/leyes', array['gobierno abierto', 'datos'], 42, 380, now() - interval '2 days'),

  ('demo-placas', 'Demo: Consulta de Placas',
   'Escribis la placa y te devuelve todo el historial del vehiculo en un solo lugar.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/placas', array['datos', 'utilidades'], 61, 720, now() - interval '9 days'),

  ('demo-buses', 'Demo: Horarios de Buses',
   'Horarios y rutas de buses de todo el pais en un mapa que si carga en el celular.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/buses', array['movilidad', 'mapas'], 28, 210, now() - interval '5 hours'),

  ('demo-facturas', 'Demo: Facturador Tico',
   'Factura electronica para independientes sin pelear con el sistema de Hacienda.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/facturas', array['saas', 'finanzas'], 35, 415, now() - interval '21 days'),

  ('demo-olas', 'Demo: Reporte de Olas',
   'Pronostico de surf por playa con datos de boyas y reportes de la comunidad.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/olas', array['comunidad', 'datos'], 17, 96, now() - interval '3 hours'),

  ('demo-apiscr', 'Demo: API de Cantones',
   'API abierta con provincias, cantones y distritos actualizados, gratis y sin llave.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/api', array['open source', 'api'], 53, 640, now() - interval '40 days'),

  ('demo-tramites', 'Demo: Guia de Tramites',
   'Explica paso a paso los tramites mas comunes, en espanol claro y sin vueltas.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/tramites', array['gobierno abierto', 'educacion'], 12, 150, now() - interval '1 day'),

  ('demo-ferias', 'Demo: Ferias del Agricultor',
   'Que feria abre hoy, donde queda y a que hora, con precios de la semana.',
   'Ejemplo de ficha. Reemplazalo por proyectos reales.',
   'https://ejemplo.cr/ferias', array['comunidad', 'mapas'], 8, 74, now() - interval '11 hours')
on conflict (slug) do nothing;
