import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * El resto de actions.ts: votar, reclamar, registrarse, escribir un mensaje, la
 * visibilidad del perfil y lo de admin. Mismos dobles y mismo criterio que
 * actions.test.ts.
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
vi.mock("@/lib/github", () => ({ listPublicRepos: vi.fn() }));
vi.mock("@/lib/queries", () => ({ isCurrentUserAdmin: vi.fn() }));
vi.mock("@/lib/email", () => ({ domainAcceptsMail: vi.fn() }));
vi.mock("@/lib/mailer", () => ({ notifyNewMessage: vi.fn() }));

import { revalidatePath } from "next/cache";

import { domainAcceptsMail } from "@/lib/email";
import { listPublicRepos } from "@/lib/github";
import { notifyNewMessage } from "@/lib/mailer";
import {
  checkRegistration,
  claimProject,
  claimWithGithub,
  listMyGithubRepos,
  markMessageHandled,
  resolveClaim,
  sendMessage,
  setProfileVisibility,
  signOut,
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

describe("checkRegistration", () => {
  function registro(cambios: Record<string, string> = {}) {
    return form({ email: "alejandra@ejemplo.cr", phone: "8123-4567", ...cambios });
  }

  it("rechaza un correo con mala sintaxis", async () => {
    db({ rpc: { data: false } });

    const state = await checkRegistration(null, registro({ email: "arroba-perdida" }));

    expect(state?.fields?.email).toBe("Ese correo no parece valido.");
  });

  it("rechaza los correos temporales", async () => {
    db({ rpc: { data: false } });

    const state = await checkRegistration(null, registro({ email: "alguien@mailinator.com" }));

    expect(state?.fields?.email).toContain("correos temporales");
  });

  it("rechaza un dominio que no recibe correo", async () => {
    db({ rpc: { data: false } });
    vi.mocked(domainAcceptsMail).mockResolvedValue(false);

    const state = await checkRegistration(null, registro());

    expect(state?.fields?.email).toContain("no recibe correo");
  });

  it("rechaza fijos, VoIP y numeros de relleno", async () => {
    for (const phone of ["2233-4455", "4000-1234", "8888-8888", "123"]) {
      db({ rpc: { data: false } });
      const state = await checkRegistration(null, registro({ phone }));
      expect(state?.fields?.phone, phone).toContain("movil de Costa Rica");
    }
  });

  it("no pregunta si el numero esta tomado cuando ya hay errores", async () => {
    const { rpcCalls } = db({ rpc: { data: false } });

    await checkRegistration(null, registro({ phone: "2233-4455" }));

    expect(rpcCalls).toHaveLength(0);
  });

  it("acepta el movil con prefijo y lo devuelve normalizado a 8 digitos", async () => {
    const { rpcCalls } = db({ rpc: { data: false } });

    const state = await checkRegistration(null, registro({ phone: "+506 8123 4567" }));

    expect(state).toEqual({ ok: "81234567" });
    // La funcion de la base solo contesta si o no; nunca de quien es.
    expect(rpcCalls).toEqual([{ name: "phone_taken", args: { p_phone: "81234567" } }]);
  });

  it("avisa si el numero ya tiene cuenta, sin decir de quien", async () => {
    db({ rpc: { data: true } });

    const state = await checkRegistration(null, registro());

    expect(state?.fields?.phone).toBe("Ese numero ya tiene una cuenta. Entra con ella.");
    expect(JSON.stringify(state)).not.toContain("ejemplo.cr");
  });
});

describe("resolveClaim", () => {
  it("aprueba pasandole el reclamo a la funcion de la base", async () => {
    const { rpcCalls } = db({ user: { id: "admin" } });

    await resolveClaim("c1", true);

    expect(rpcCalls).toEqual([
      { name: "resolve_claim", args: { p_claim_id: "c1", p_approve: true } },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/reclamos");
  });

  it("rechazar es la misma llamada con el booleano en false", async () => {
    const { rpcCalls } = db({ user: { id: "admin" } });

    await resolveClaim("c1", false);

    expect(rpcCalls[0].args).toEqual({ p_claim_id: "c1", p_approve: false });
  });
});

describe("markMessageHandled", () => {
  it("marca el mensaje y refresca la cola", async () => {
    const { escrituras } = db({ user: { id: "admin" } });

    await markMessageHandled("m1", true);

    expect(escrituras).toEqual([
      {
        table: "messages",
        op: "update",
        payload: { handled: true },
        filters: [["id", "m1"]],
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/mensajes");
  });

  it("tambien sirve para desmarcarlo", async () => {
    const { escrituras } = db({ user: { id: "admin" } });

    await markMessageHandled("m1", false);

    expect(escrituras[0].payload).toEqual({ handled: false });
  });
});

describe("signOut", () => {
  it("cierra la sesion y manda a la portada", async () => {
    const { authCalls } = db({ user: { id: "u1" } });

    const { destino } = await correr(() => signOut());

    expect(authCalls).toEqual(["signOut"]);
    expect(destino).toBe("/");
  });
});

describe("listMyGithubRepos", () => {
  const REPO = {
    name: "consulta-de-placas",
    fullName: "alejandra/consulta-de-placas",
    description: "Historial de un vehiculo por su placa.",
    homepage: "https://placas.cr",
    htmlUrl: "https://github.com/alejandra/consulta-de-placas",
    topics: ["open-data", "typescript"],
    stars: 12,
    language: "TypeScript",
    archived: false,
    pushedAt: "2026-09-01T00:00:00Z",
  };

  it("sin sesion no consulta GitHub", async () => {
    db({ user: null });

    const estado = await listMyGithubRepos();

    expect(estado).toEqual({
      ok: false,
      message: "Entra con tu cuenta para traer tus repositorios.",
    });
    expect(listPublicRepos).not.toHaveBeenCalled();
  });

  it("sin cuenta de GitHub enlazada, dice como enlazarla", async () => {
    // Perfil sin handle y sesion sin identidad de GitHub.
    db({ user: { id: "u1", identities: [{ provider: "email" }] }, singles: [{ data: {} }] });

    const estado = await listMyGithubRepos();

    expect(estado.ok).toBe(false);
    expect(estado.ok === false && estado.message).toContain("Conecta tu cuenta de GitHub");
    expect(listPublicRepos).not.toHaveBeenCalled();
  });

  it("usa el handle guardado en el perfil", async () => {
    db({
      user: { id: "u1" },
      singles: [{ data: { github_handle: "alejandra" } }],
      reads: [{ data: [] }],
    });
    vi.mocked(listPublicRepos).mockResolvedValue({ ok: true, repos: [REPO] });

    await listMyGithubRepos();

    expect(listPublicRepos).toHaveBeenCalledWith("alejandra");
  });

  /*
   * Quien acaba de entrar con GitHub tiene la identidad en la sesion antes de
   * que syncGithubHandle haya guardado el handle en el perfil.
   */
  it("cae a la identidad de la sesion si el perfil todavia no lo tiene", async () => {
    db({
      user: {
        id: "u1",
        identities: [{ provider: "github", identity_data: { user_name: "alejandra" } }],
      },
      singles: [{ data: { github_handle: null } }],
      reads: [{ data: [] }],
    });
    vi.mocked(listPublicRepos).mockResolvedValue({ ok: true, repos: [REPO] });

    const estado = await listMyGithubRepos();

    expect(estado.ok && estado.handle).toBe("alejandra");
    expect(listPublicRepos).toHaveBeenCalledWith("alejandra");
  });

  it("arma el borrador del formulario a partir del repo", async () => {
    db({
      user: { id: "u1" },
      singles: [{ data: { github_handle: "alejandra" } }],
      reads: [{ data: [] }],
    });
    vi.mocked(listPublicRepos).mockResolvedValue({ ok: true, repos: [REPO] });

    const estado = await listMyGithubRepos();

    expect(estado.ok && estado.repos[0]).toEqual({
      // El nombre del repo se vuelve un titulo presentable.
      name: "Consulta De Placas",
      fullName: "alejandra/consulta-de-placas",
      tagline: "Historial de un vehiculo por su placa.",
      // El enlace es el sitio, no el repo, cuando el repo declara homepage.
      url: "https://placas.cr",
      repoUrl: "https://github.com/alejandra/consulta-de-placas",
      // "typescript" no dice de que es el proyecto; "open-data" si.
      tags: ["datos"],
      stars: 12,
      language: "TypeScript",
      archived: false,
      alreadyListed: false,
    });
  });

  it("sin homepage, el enlace es el propio repositorio", async () => {
    db({
      user: { id: "u1" },
      singles: [{ data: { github_handle: "alejandra" } }],
      reads: [{ data: [] }],
    });
    vi.mocked(listPublicRepos).mockResolvedValue({
      ok: true,
      repos: [{ ...REPO, homepage: null }],
    });

    const estado = await listMyGithubRepos();

    expect(estado.ok && estado.repos[0].url).toBe(REPO.htmlUrl);
  });

  it("una descripcion demasiado corta se deja vacia, que la bajada pide diez", async () => {
    db({
      user: { id: "u1" },
      singles: [{ data: { github_handle: "alejandra" } }],
      reads: [{ data: [] }],
    });
    vi.mocked(listPublicRepos).mockResolvedValue({
      ok: true,
      repos: [{ ...REPO, description: "placas" }],
    });

    const estado = await listMyGithubRepos();

    expect(estado.ok && estado.repos[0].tagline).toBe("");
  });

  it("marca los que ya estan en el directorio", async () => {
    const { consultas } = db({
      user: { id: "u1" },
      singles: [{ data: { github_handle: "alejandra" } }],
      reads: [{ data: [{ repo_url: REPO.htmlUrl }] }],
    });
    vi.mocked(listPublicRepos).mockResolvedValue({
      ok: true,
      repos: [REPO, { ...REPO, name: "otro", htmlUrl: "https://github.com/alejandra/otro" }],
    });

    const estado = await listMyGithubRepos();

    expect(estado.ok && estado.repos.map((repo) => repo.alreadyListed)).toEqual([true, false]);
    // Se pregunta por los repos que se van a mostrar, no por toda la tabla.
    expect(consultas.at(-1)?.in).toEqual([
      "repo_url",
      [REPO.htmlUrl, "https://github.com/alejandra/otro"],
    ]);
  });

  it("traduce cada fallo de GitHub a algo que se pueda leer", async () => {
    const esperado = {
      "no-existe": "No encontramos la cuenta @alejandra en GitHub.",
      limite: "GitHub nos pidio esperar un momento. Proba de nuevo en unos minutos.",
      "sin-respuesta": "No pudimos hablar con GitHub. Proba de nuevo en un rato.",
    } as const;

    for (const [reason, message] of Object.entries(esperado)) {
      db({ user: { id: "u1" }, singles: [{ data: { github_handle: "alejandra" } }] });
      vi.mocked(listPublicRepos).mockResolvedValue({
        ok: false,
        reason: reason as keyof typeof esperado,
      });

      expect(await listMyGithubRepos(), reason).toEqual({ ok: false, message });
    }
  });
});
