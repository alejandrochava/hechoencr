import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, SUPABASE_KEY, SUPABASE_SERVER_URL } from "./config";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * Lee y escribe la sesion en cookies.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_SERVER_URL, SUPABASE_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies; el refresco de
          // sesion lo hace src/proxy.ts, asi que ignorar aqui es correcto.
        }
      },
    },
  });
});

/** Quien esta autenticado, con lo que el token trae y el sitio usa. */
export type SessionUser = {
  id: string;
  email: string | null;
  /** aal2 solo despues de probar el segundo factor. La administracion lo exige. */
  aal: string;
};

/**
 * El usuario autenticado, o null si no hay sesion.
 *
 * El token se verifica **localmente**: el proyecto firma con ES256 y publica
 * su JWKS, asi que `getClaims()` comprueba la firma con WebCrypto en vez de
 * preguntarle a Supabase por la red si el token vale, que es lo que hace
 * `getUser()`. Esa vuelta la pagaban el proxy, el layout, el encabezado y la
 * consulta de la pagina, una detras de otra.
 *
 * El cache de React deja ademas una sola verificacion por request.
 *
 * Lo que se cede: una sesion cerrada desde otro dispositivo se sigue
 * aceptando hasta que el token vence. No afecta a los permisos —los aplica
 * RLS contra la base en cada consulta, con ese mismo token— ni a ser admin,
 * que se lee de `profiles` y no del token.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data) return null;

  const { sub, email, aal } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null, aal };
});

/**
 * Las identidades enlazadas a la sesion (GitHub, Google, correo).
 *
 * No viajan en el token, asi que esto si le pregunta a Supabase. Lo usa solo
 * quien necesita saber con que cuenta ajena entro la persona.
 */
export const getLinkedIdentities = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUserIdentities();
  return data?.identities ?? [];
});
