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

/**
 * El usuario autenticado, o null si no hay sesion.
 *
 * Va envuelto en el cache de React porque `getUser()` no lee la cookie y ya:
 * pregunta a Supabase por la red para validar el token. En una sola pagina lo
 * necesitan el layout, el encabezado y la consulta de turno, y sin esto cada
 * uno pagaba su propia vuelta contra el mismo dato. El cache dura lo que dura
 * el request, asi que sigue sin cruzarse entre visitantes.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
