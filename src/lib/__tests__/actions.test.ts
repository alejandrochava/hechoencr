import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Publicar y editar un proyecto.
 *
 * Los limites van dobles: la base, la red y lo de Next. No por comodidad, sino
 * porque lo que se prueba es la decision —que reglas rechazan que, que queda
 * guardado, en que orden se consulta— y con la base y la red de verdad eso no
 * se puede afirmar: dependeria de que un dominio ajeno conteste hoy igual que
 * ayer.
 *
 * Lo que no se dobla es text.ts: normalizeUrl, sanitizeProjectLinks y slugify
 * corren de verdad, porque son parte de la decision.
 */

const dobles = vi.hoisted(() => ({ cliente: null as unknown }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// redirect() en Next corta la ejecucion lanzando; el doble hace lo mismo para
// que la funcion no siga despues de redirigir y el destino se pueda afirmar.
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw Object.assign(new Error(`redirect: ${destino}`), { destino });
  },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => dobles.cliente }));
vi.mock("@/lib/link-check", () => ({
  checkSite: vi.fn(),
  checkRepo: vi.fn(),
  checkProjectLinks: vi.fn(),
}));
vi.mock("@/lib/preview", () => ({ findPreviewImage: vi.fn() }));
vi.mock("@/lib/queries", () => ({ isCurrentUserAdmin: vi.fn() }));
vi.mock("@/lib/email", () => ({ domainAcceptsMail: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ notifyNewMessage: vi.fn() }));

import { checkProjectLinks, checkRepo, checkSite } from "@/lib/link-check";
import { findPreviewImage } from "@/lib/preview";
import { isCurrentUserAdmin } from "@/lib/queries";
import { submitProject, updateProject } from "@/lib/actions";
import type { ProjectLink } from "@/lib/text";

import { correr, fakeSupabase, type ConfigFake } from "./fake-supabase";

/** Monta el doble y lo deja donde el modulo mockeado lo va a buscar. */
function db(config: ConfigFake = {}) {
  const fake = fakeSupabase(config);
  dobles.cliente = fake.client;
  return fake;
}

/** Un formulario valido; cada prueba cambia solo lo que le interesa. */
function formulario(cambios: Record<string, string | string[] | ProjectLink[]> = {}) {
  const base: Record<string, string | string[] | ProjectLink[]> = {
    name: "Consulta de Placas",
    tagline: "Escribis la placa y te devuelve el historial del vehiculo.",
    description: "Una descripcion cualquiera.",
    url: "https://placas.cr",
    repo_url: "",
    tags: ["datos"],
    links: [],
    is_mine: "on",
    ...cambios,
  };

  const formData = new FormData();
  for (const [clave, valor] of Object.entries(base)) {
    if (clave === "tags") {
      for (const tag of valor as string[]) formData.append("tags", tag);
    } else if (clave === "links") {
      formData.set("links", JSON.stringify(valor));
    } else {
      formData.set(clave, String(valor));
    }
  }
  return formData;
}

beforeEach(() => {
  vi.mocked(checkSite).mockImplementation(async (url: string) => ({ ok: true, url }));
  vi.mocked(checkRepo).mockImplementation(async (url: string) => ({
    ok: true,
    ref: {
      host: "github.com",
      label: "GitHub",
      owner: "usuario",
      repo: "repo",
      url: url.replace(/\.git$/, ""),
    },
  }));
  vi.mocked(checkProjectLinks).mockImplementation(async (links: ProjectLink[]) =>
    links.map((link) => ({ link, check: { ok: true as const, url: link.url } })),
  );
  vi.mocked(findPreviewImage).mockResolvedValue("https://imagen/vista-previa.png");
  vi.mocked(isCurrentUserAdmin).mockResolvedValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("submitProject", () => {
  it("sin sesion no guarda nada y pide entrar", async () => {
    const { escrituras } = db({ user: null });

    expect(await submitProject(null, formulario())).toEqual({ error: "necesita-sesion" });
    expect(escrituras).toHaveLength(0);
  });

  it("rechaza los campos que no cumplen, cada uno con su mensaje", async () => {
    db({ user: { id: "u1" } });

    const state = await submitProject(
      null,
      formulario({ name: "a", tagline: "corta", url: "no-es-una-url", tags: [] }),
    );

    expect(state?.error).toBe("Revisa los campos marcados.");
    expect(state?.fields).toMatchObject({
      name: expect.stringContaining("dos caracteres"),
      tagline: expect.stringContaining("minimo 10"),
      url: expect.stringContaining("direccion web valida"),
      tags: expect.stringContaining("al menos una categoria"),
    });
  });

  it("no toca la red si lo barato ya no pasa", async () => {
    db({ user: { id: "u1" } });

    await submitProject(null, formulario({ name: "a" }));

    expect(checkSite).not.toHaveBeenCalled();
    expect(checkProjectLinks).not.toHaveBeenCalled();
  });

  it("devuelve juntos el enlace, el repositorio y los enlaces extra", async () => {
    db({ user: { id: "u1" } });
    vi.mocked(checkSite).mockResolvedValue({ ok: false, reason: "no-existe" });
    vi.mocked(checkRepo).mockResolvedValue({ ok: false, reason: "no-es-forja" });
    vi.mocked(checkProjectLinks).mockResolvedValue([
      {
        link: { label: "Documentacion", url: "https://docs.cr" },
        check: { ok: false, reason: "sin-https" },
      },
    ]);

    const state = await submitProject(
      null,
      formulario({
        repo_url: "https://miservidor.cr/git/repo",
        links: [{ label: "Documentacion", url: "https://docs.cr" }],
      }),
    );

    expect(state?.fields?.url).toContain("No encontramos nada");
    expect(state?.fields?.repo_url).toContain("GitHub");
    // El enlace extra se nombra por su etiqueta, no por su URL.
    expect(state?.fields?.links).toBe("Revisa estos enlaces: Documentacion (no carga por https).");
  });

  it("guarda lo comprobado, no lo que se escribio", async () => {
    const { escrituras } = db({ user: { id: "u1" } });
    vi.mocked(checkSite).mockResolvedValue({ ok: true, url: "https://placas.cr/" });

    const form = formulario({
      url: "http://placas.cr",
      repo_url: "github.com/usuario/repo.git",
      links: [{ label: "Docs", url: "docs.placas.cr" }],
    });
    const { destino } = await correr(() => submitProject(null, form));

    expect(destino).toBe("/p/consulta-de-placas?publicado=1");
    expect(escrituras).toHaveLength(1);
    expect(escrituras[0]).toMatchObject({ table: "projects", op: "insert" });
    expect(escrituras[0].payload).toMatchObject({
      slug: "consulta-de-placas",
      url: "https://placas.cr/",
      repo_url: "https://github.com/usuario/repo",
      image_url: "https://imagen/vista-previa.png",
      submitted_by: "u1",
      owner_id: "u1",
      tags: ["datos"],
    });
    // sanitizeProjectLinks completo el esquema que faltaba.
    expect(escrituras[0].payload.links).toEqual([{ label: "Docs", url: "https://docs.placas.cr" }]);
  });

  it("descarta las categorias inventadas y corta en tres", async () => {
    const { escrituras } = db({ user: { id: "u1" } });

    const form = formulario({ tags: ["datos", "inventada", "utilidades", "mapas", "ia"] });
    await correr(() => submitProject(null, form));

    expect(escrituras[0].payload.tags).toEqual(["datos", "utilidades", "mapas"]);
  });

  it("si no es tuyo, queda sin duenno para que su autor lo reclame", async () => {
    const { escrituras } = db({ user: { id: "u1" } });

    await correr(() => submitProject(null, formulario({ is_mine: "" })));

    expect(escrituras[0].payload).toMatchObject({ owner_id: null, submitted_by: "u1" });
  });

  it("si el slug esta tomado, numera el siguiente", async () => {
    const { escrituras } = db({
      user: { id: "u1" },
      singles: [{ data: { id: "otro" } }, { data: null }],
    });

    const { destino } = await correr(() => submitProject(null, formulario()));

    expect(escrituras[0].payload.slug).toBe("consulta-de-placas-2");
    expect(destino).toBe("/p/consulta-de-placas-2?publicado=1");
  });

  it("avisa si la base falla, sin redirigir", async () => {
    db({ user: { id: "u1" }, writeError: { message: "boom" } });

    const { resultado, destino } = await correr(() => submitProject(null, formulario()));

    expect(destino).toBeNull();
    expect((resultado as { error?: string })?.error).toContain("No se pudo guardar");
  });
});

describe("updateProject", () => {
  const existente = { data: { id: "p1", url: "https://placas.cr/", owner_id: "u1" } };

  function formularioEdicion(cambios: Record<string, string | string[] | ProjectLink[]> = {}) {
    return formulario({ slug: "consulta-de-placas", ...cambios });
  }

  it("sin sesion no guarda nada", async () => {
    const { escrituras } = db({ user: null });

    expect(await updateProject(null, formularioEdicion())).toEqual({ error: "necesita-sesion" });
    expect(escrituras).toHaveLength(0);
  });

  it("sin slug no adivina que proyecto editar", async () => {
    db({ user: { id: "u1" } });

    const state = await updateProject(null, formulario({ slug: "" }));

    expect(state?.error).toContain("No sabemos que proyecto");
  });

  it("avisa si el proyecto no existe", async () => {
    db({ user: { id: "u1" }, singles: [{ data: null }] });

    expect(await updateProject(null, formularioEdicion())).toEqual({
      error: "Ese proyecto no existe.",
    });
  });

  it("no deja editar un proyecto ajeno", async () => {
    const { escrituras } = db({ user: { id: "otro" }, singles: [existente] });

    const state = await updateProject(null, formularioEdicion());

    expect(state?.error).toBe("Este proyecto no esta a tu nombre.");
    expect(escrituras).toHaveLength(0);
  });

  it("un admin si puede editar uno ajeno", async () => {
    const { escrituras } = db({ user: { id: "admin" }, singles: [existente] });
    vi.mocked(isCurrentUserAdmin).mockResolvedValue(true);

    await correr(() => updateProject(null, formularioEdicion({ name: "Nombre corregido" })));

    expect(escrituras).toHaveLength(1);
    expect(escrituras[0].payload).toMatchObject({ name: "Nombre corregido" });
  });

  it("guarda los cambios sin tocar el slug ni el duenno", async () => {
    const { escrituras } = db({ user: { id: "u1" }, singles: [existente] });

    const form = formularioEdicion({ name: "Otro nombre", description: "" });
    const { destino } = await correr(() => updateProject(null, form));

    expect(destino).toBe("/p/consulta-de-placas?guardado=1");
    expect(escrituras[0]).toMatchObject({ op: "update", filters: [["id", "p1"]] });
    expect(escrituras[0].payload).toMatchObject({ name: "Otro nombre", description: null });
    // La URL es la identidad del proyecto: renombrar no la cambia.
    expect(escrituras[0].payload).not.toHaveProperty("slug");
    expect(escrituras[0].payload).not.toHaveProperty("owner_id");
  });

  it("no rehace la vista previa si el enlace no cambio", async () => {
    const { escrituras } = db({ user: { id: "u1" }, singles: [existente] });
    vi.mocked(checkSite).mockResolvedValue({ ok: true, url: "https://placas.cr/" });

    await correr(() => updateProject(null, formularioEdicion({ description: "Otra cosa" })));

    expect(findPreviewImage).not.toHaveBeenCalled();
    expect(escrituras[0].payload).not.toHaveProperty("image_url");
  });

  it("la rehace si el enlace cambio", async () => {
    const { escrituras } = db({ user: { id: "u1" }, singles: [existente] });
    vi.mocked(checkSite).mockResolvedValue({ ok: true, url: "https://placas.co.cr/" });

    await correr(() => updateProject(null, formularioEdicion({ url: "https://placas.co.cr" })));

    expect(findPreviewImage).toHaveBeenCalledWith("https://placas.co.cr/");
    expect(escrituras[0].payload).toMatchObject({
      url: "https://placas.co.cr/",
      image_url: "https://imagen/vista-previa.png",
    });
  });

  it("valida con las mismas reglas que publicar", async () => {
    db({ user: { id: "u1" }, singles: [existente] });
    vi.mocked(checkSite).mockResolvedValue({ ok: false, reason: "sin-https" });

    const state = await updateProject(null, formularioEdicion({ url: "http://placas.cr" }));

    expect(state?.fields?.url).toContain("conexion segura");
  });
});
