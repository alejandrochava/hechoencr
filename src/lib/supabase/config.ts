/** URL publica: la que usa el navegador. Se incrusta en el bundle al compilar. */
const clean = (value: string | undefined) => (value && value.trim() ? value.trim() : "");

export const SUPABASE_URL = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);

/**
 * URL interna para el servidor. En Docker el contenedor no puede usar
 * "localhost" para llegar al gateway, asi que apunta al nombre del servicio.
 * En Vercel o en local sin Docker no se define y usa la misma URL publica.
 */
export const SUPABASE_SERVER_URL =
  typeof window === "undefined"
    ? (clean(process.env.SUPABASE_INTERNAL_URL) || SUPABASE_URL)
    : SUPABASE_URL;

/** Supabase renombro la "anon key" a "publishable key"; aceptamos las dos. */
export const SUPABASE_KEY =
  clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/**
 * supabase-js deriva el nombre de la cookie de sesion del hostname de la URL.
 * Como el navegador usa una URL y el servidor otra (ver arriba), sin un nombre
 * fijo cada lado buscaria una cookie distinta y la sesion nunca cuadraria.
 */
export const AUTH_COOKIE_NAME = "sb-hechoencr-auth-token";
