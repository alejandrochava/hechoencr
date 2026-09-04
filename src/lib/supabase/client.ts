import { createBrowserClient } from "@supabase/ssr";

import { AUTH_COOKIE_NAME, SUPABASE_KEY, SUPABASE_URL } from "./config";

/** Cliente de Supabase para componentes del navegador (login, logout). */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
    cookieOptions: { name: AUTH_COOKIE_NAME },
  });
}
