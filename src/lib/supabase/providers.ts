import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./config";

/** Proveedores de OAuth que ofrece el sitio, en el orden en que se muestran. */
export const OAUTH_PROVIDERS = ["github", "google"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Cuales de esos proveedores acepta hoy el proyecto de Supabase.
 *
 * Se pregunta en vez de fijarlo en el codigo porque encenderlos es una casilla
 * del panel, no un despliegue. Mientras esten apagados, /authorize contesta 400
 * sin redirigir: el navegador se queda en el JSON de Supabase y el boton parece
 * roto. Preferimos no ofrecerlo.
 *
 * Si la consulta falla se devuelven todos. Una caida de red no es motivo para
 * esconder un login que puede estar funcionando.
 */
export async function enabledProviders(): Promise<OAuthProvider[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_KEY },
      // La respuesta solo cambia cuando alguien toca el panel.
      next: { revalidate: 300 },
    });
    if (!response.ok) return [...OAUTH_PROVIDERS];

    const settings = (await response.json()) as { external?: Record<string, boolean> };
    const external = settings.external ?? {};
    return OAUTH_PROVIDERS.filter((provider) => external[provider] === true);
  } catch {
    return [...OAUTH_PROVIDERS];
  }
}
