import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * config.ts lee el entorno al cargarse, asi que cada caso reinicia los modulos
 * y fija las variables antes de importar.
 */
async function conAjustes(
  respuesta: { ok?: boolean; body?: unknown; falla?: boolean },
  entorno: { url?: string; llave?: string } = {},
) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", entorno.url ?? "https://proyecto.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", entorno.llave ?? "llave-publica");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      if (respuesta.falla) throw new Error("sin red");
      return { ok: respuesta.ok ?? true, json: async () => respuesta.body };
    }),
  );

  const { enabledProviders } = await import("@/lib/supabase/providers");
  return enabledProviders();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("proveedores de OAuth", () => {
  it("ofrece solo los que Supabase tiene encendidos", async () => {
    const body = { external: { github: true, google: false, email: true } };
    await expect(conAjustes({ body })).resolves.toEqual(["github"]);
  });

  it("no ofrece ninguno si estan todos apagados", async () => {
    const body = { external: { github: false, google: false, email: true } };
    await expect(conAjustes({ body })).resolves.toEqual([]);
  });

  it("los ofrece todos si la consulta falla, para no esconder un login que anda", async () => {
    await expect(conAjustes({ falla: true })).resolves.toEqual(["github", "google"]);
    await expect(conAjustes({ ok: false })).resolves.toEqual(["github", "google"]);
  });

  it("no ofrece ninguno si el proyecto no esta configurado", async () => {
    await expect(conAjustes({ body: {} }, { url: "" })).resolves.toEqual([]);
  });
});
