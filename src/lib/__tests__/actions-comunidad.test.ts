import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * El resto de actions.ts: votar, reclamar, escribir un mensaje y la visibilidad
 * del perfil. Mismos dobles y mismo criterio que actions.test.ts.
 */

const dobles = vi.hoisted(() => ({ cliente: null as unknown }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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

import { revalidatePath } from "next/cache";

import { domainAcceptsMail } from "@/lib/email";
import { notifyNewMessage } from "@/lib/mailer";
import {
  claimProject,
  claimWithGithub,
  sendMessage,
  setProfileVisibility,
  syncGithubHandle,
  toggleVote,
} from "@/lib/actions";

import { correr, fakeSupabase, type ConfigFake } from "./fake-supabase";

function db(config: ConfigFake = {}) {
  const fake = fakeSupabase(config);
  dobles.cliente = fake.client;
  return fake;
}

function form(campos: Record<string, string>) {
  const formData = new FormData();
  for (const [clave, valor] of Object.entries(campos)) formData.set(clave, valor);
  return formData;
}

beforeEach(() => {
  vi.mocked(domainAcceptsMail).mockResolvedValue(true);
  vi.mocked(notifyNewMessage).mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("toggleVote", () => {
  it("sin sesion manda a entrar en vez de votar", async () => {
    const { escrituras } = db({ user: null });

    const { destino } = await correr(() => toggleVote("p1", "placas"));

    expect(destino).toBe("/entrar");
    expect(escrituras).toHaveLength(0);
  });

  it("si no habia voto, lo agrega", async () => {
    const { escrituras } = db({ user: { id: "u1" }, singles: [{ data: null }] });

    await toggleVote("p1", "placas");

    expect(escrituras).toEqual([
      {
        table: "votes",
        op: "insert",
        payload: { project_id: "p1", user_id: "u1" },
        filters: [],
      },
    ]);
  });

  it("si ya habia voto, lo quita, y solo el de esa persona", async () => {
    const { escrituras } = db({
      user: { id: "u1" },
      singles: [{ data: { project_id: "p1" } }],
    });

    await toggleVote("p1", "placas");

    expect(escrituras[0]).toMatchObject({ table: "votes", op: "delete" });
    // Los dos filtros importan: sin user_id se borraria el voto de cualquiera.
    expect(escrituras[0].filters).toEqual([
      ["project_id", "p1"],
      ["user_id", "u1"],
    ]);
  });

  it("refresca la portada y la ficha", async () => {
    db({ user: { id: "u1" }, singles: [{ data: null }] });

    await toggleVote("p1", "placas");

    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/p/placas");
  });

  it("sin slug refresca solo la portada", async () => {
    db({ user: { id: "u1" }, singles: [{ data: null }] });

    await toggleVote("p1");

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});

describe("claimProject", () => {
  const reclamo = {
    project_id: "p1",
    slug: "placas",
    evidence: "Soy el autor, el repo esta en mi cuenta.",
    contact: "",
  };

  it("sin sesion no envia el reclamo", async () => {
    const { escrituras } = db({ user: null });

    const state = await claimProject(null, form(reclamo));

    expect(state?.error).toContain("Entra con tu cuenta");
    expect(escrituras).toHaveLength(0);
  });

  it("exige que cuenten como verificarlo", async () => {
    const { escrituras } = db({ user: { id: "u1" } });

    const state = await claimProject(null, form({ ...reclamo, evidence: "es mio" }));

    expect(state?.error).toContain("Conta como podemos verificar");
    expect(escrituras).toHaveLength(0);
  });

  it("guarda el reclamo a nombre de quien lo manda", async () => {
    const { escrituras } = db({ user: { id: "u1" } });

    const state = await claimProject(null, form(reclamo));

    expect(state?.ok).toContain("Reclamo enviado");
    expect(escrituras[0]).toMatchObject({ table: "claims", op: "insert" });
    expect(escrituras[0].payload).toEqual({
      project_id: "p1",
      user_id: "u1",
      evidence: reclamo.evidence,
      // Vacio se guarda como null, no como cadena vacia.
      contact: null,
    });
  });

  it("traduce el choque de unicidad a un mensaje entendible", async () => {
    db({ user: { id: "u1" }, writeError: { message: "duplicate key", code: "23505" } });

    const state = await claimProject(null, form(reclamo));

    expect(state?.error).toBe("Ya enviaste un reclamo para este proyecto.");
  });

  it("cualquier otro fallo de la base no se explica de mas", async () => {
    db({ user: { id: "u1" }, writeError: { message: "boom", code: "42501" } });

    const state = await claimProject(null, form(reclamo));

    expect(state?.error).toBe("No se pudo enviar el reclamo.");
  });
});

describe("claimWithGithub", () => {
  it("si el repositorio es tuyo, queda a tu nombre", async () => {
    db({ user: { id: "u1" }, rpc: { data: true } });

    const state = await claimWithGithub("p1", "placas");

    expect(state?.ok).toContain("quedo a tu nombre");
    expect(revalidatePath).toHaveBeenCalledWith("/p/placas");
  });

  it("si no lo es, propone el reclamo manual", async () => {
    db({ user: { id: "u1" }, rpc: { data: false } });

    const state = await claimWithGithub("p1", "placas");

    expect(state?.error).toContain("Mandanos el reclamo");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un fallo de la funcion no se confunde con un no", async () => {
    db({ user: { id: "u1" }, rpc: { data: null, error: { message: "boom" } } });

    const state = await claimWithGithub("p1", "placas");

    expect(state?.error).toBe("No se pudo verificar el repositorio.");
  });

  it("le pasa el proyecto a la funcion de la base", async () => {
    const { rpcCalls } = db({ user: { id: "u1" }, rpc: { data: true } });

    await claimWithGithub("p1", "placas");

    expect(rpcCalls).toEqual([{ name: "claim_with_github", args: { p_project_id: "p1" } }]);
  });
});

describe("syncGithubHandle", () => {
  it("guarda el usuario de GitHub de la identidad enlazada", async () => {
    const { escrituras } = db({
      user: {
        id: "u1",
        identities: [
          { provider: "email" },
          { provider: "github", identity_data: { user_name: "AlejandroChava" } },
        ],
      },
    });

    expect(await syncGithubHandle()).toBe("AlejandroChava");
    expect(escrituras[0]).toMatchObject({
      table: "profiles",
      op: "update",
      payload: { github_handle: "AlejandroChava" },
      filters: [["id", "u1"]],
    });
  });

  it("acepta preferred_username cuando no viene user_name", async () => {
    db({
      user: {
        id: "u1",
        identities: [{ provider: "github", identity_data: { preferred_username: "otro" } }],
      },
    });

    expect(await syncGithubHandle()).toBe("otro");
  });

  it("sin identidad de GitHub no escribe nada", async () => {
    const { escrituras } = db({ user: { id: "u1", identities: [{ provider: "email" }] } });

    expect(await syncGithubHandle()).toBeNull();
    expect(escrituras).toHaveLength(0);
  });

  it("sin sesion no escribe nada", async () => {
    const { escrituras } = db({ user: null });

    expect(await syncGithubHandle()).toBeNull();
    expect(escrituras).toHaveLength(0);
  });
});

describe("sendMessage", () => {
  const mensaje = {
    kind: "contacto",
    name: "Alejandra",
    email: "alejandra@ejemplo.cr",
    body: "Queria consultarles algo sobre el directorio.",
  };

  it("rechaza los campos que no cumplen", async () => {
    db({ user: null });

    const state = await sendMessage(
      null,
      form({ ...mensaje, name: "a", email: "no-es-correo", body: "corto" }),
    );

    expect(state?.fields).toMatchObject({
      name: expect.stringContaining("como te llamas"),
      email: expect.stringContaining("no parece valido"),
      body: expect.stringContaining("minimo 10"),
    });
  });

  it("rechaza un dominio que no recibe correo", async () => {
    db({ user: null });
    vi.mocked(domainAcceptsMail).mockResolvedValue(false);

    const state = await sendMessage(null, form(mensaje));

    expect(state?.fields?.email).toBe("Ese dominio no recibe correo.");
  });

  it("no consulta el DNS si la sintaxis ya esta mal", async () => {
    db({ user: null });

    await sendMessage(null, form({ ...mensaje, email: "arroba-perdida" }));

    expect(domainAcceptsMail).not.toHaveBeenCalled();
  });

  it("guarda el mensaje y avisa por correo", async () => {
    const { escrituras } = db({ user: null });

    const state = await sendMessage(null, form(mensaje));

    expect(state?.ok).toContain("Mensaje enviado");
    expect(escrituras[0]).toMatchObject({ table: "messages", op: "insert" });
    expect(escrituras[0].payload).toMatchObject({
      kind: "contacto",
      name: "Alejandra",
      email: "alejandra@ejemplo.cr",
      // Sin sesion igual se puede escribir; queda sin dueno.
      user_id: null,
    });
    expect(notifyNewMessage).toHaveBeenCalledOnce();
  });

  it("ata el mensaje a la cuenta si hay sesion", async () => {
    const { escrituras } = db({ user: { id: "u1" } });

    await sendMessage(null, form(mensaje));

    expect(escrituras[0].payload).toMatchObject({ user_id: "u1" });
  });

  it("un tipo inventado cae en contacto", async () => {
    const { escrituras } = db({ user: null });

    await sendMessage(null, form({ ...mensaje, kind: "spam" }));

    expect(escrituras[0].payload).toMatchObject({ kind: "contacto" });
  });

  it("si no se pudo guardar, no manda el correo", async () => {
    db({ user: null, writeError: { message: "boom" } });

    const state = await sendMessage(null, form(mensaje));

    expect(state?.error).toContain("No se pudo enviar");
    expect(notifyNewMessage).not.toHaveBeenCalled();
  });
});

describe("setProfileVisibility", () => {
  it("sin sesion no cambia nada", async () => {
    const { escrituras } = db({ user: null });

    await setProfileVisibility(false);

    expect(escrituras).toHaveLength(0);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("guarda la eleccion y refresca el perfil", async () => {
    const { escrituras } = db({
      user: { id: "u1" },
      singles: [{ data: { handle: "alejandra" } }],
    });

    await setProfileVisibility(false);

    expect(escrituras[0]).toMatchObject({
      table: "profiles",
      op: "update",
      payload: { public_profile: false },
      filters: [["id", "u1"]],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/u/alejandra");
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("sin handle todavia, refresca solo la portada", async () => {
    db({ user: { id: "u1" }, singles: [{ data: { handle: null } }] });

    await setProfileVisibility(true);

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
});
