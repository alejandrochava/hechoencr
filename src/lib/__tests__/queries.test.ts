import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Las consultas de lectura.
 *
 * Aca lo que importa no es la fila que vuelve —eso lo decide Postgres— sino la
 * consulta que sale y como se acomoda lo que llega: por que columna se ordena,
 * que rango se pide, que filtros van explicitos, que pasa cuando PostgREST
 * devuelve una relacion como arreglo, y que un error no tumbe la pagina.
 *
 * Por eso el doble registra la consulta y las pruebas afirman sobre ella.
 */

const dobles = vi.hoisted(() => ({ cliente: null as unknown, configurado: true }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => dobles.cliente,
  // El modulo real lo envuelve en el cache de React, que fuera de un render no
  // existe; aca alcanza con preguntarle al cliente falso lo mismo.
  getCurrentUser: async () => (await dobles.cliente.auth.getUser()).data.user,
}));

// Un getter y no un valor: hay una prueba que necesita el proyecto sin
// configurar, y el modulo real lo resuelve una sola vez al cargarse.
vi.mock("@/lib/supabase/config", () => ({
  get isSupabaseConfigured() {
    return dobles.configurado;
  },
}));

import {
  PAGE_SIZE,
  getFeed,
  getMessages,
  getMyClaimStatus,
  getPendingClaims,
  getProfileByHandle,
  getProject,
  getProjectsByOwner,
  getSitemapEntries,
  getVotedIds,
  isCurrentUserAdmin,
} from "@/lib/queries";

import { fakeSupabase, type ConfigFake } from "./fake-supabase";

function db(config: ConfigFake = {}) {
  const fake = fakeSupabase(config);
  dobles.cliente = fake.client;
  return fake;
}

beforeEach(() => {
  dobles.configurado = true;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getFeed", () => {
  it("ordena por la columna del orden elegido, con created_at como desempate", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "destacados" });

    expect(consultas[0].table).toBe("project_feed");
    expect(consultas[0].order).toEqual([
      { column: "hot_score", ascending: false },
      { column: "created_at", ascending: false },
    ]);
  });

  it("cada orden pide su columna", async () => {
    const esperado = {
      destacados: "hot_score",
      nuevos: "created_at",
      tendencia: "recent_votes",
      vistos: "view_count",
    } as const;

    for (const [sort, columna] of Object.entries(esperado)) {
      const { consultas } = db({ reads: [{ data: [], count: 0 }] });
      await getFeed({ sort: sort as keyof typeof esperado });
      expect(consultas[0].order[0].column, sort).toBe(columna);
    }
  });

  it("pide la pagina que le toca", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "nuevos", page: 3 });

    expect(consultas[0].range).toEqual([2 * PAGE_SIZE, 3 * PAGE_SIZE - 1]);
  });

  it("la primera pagina arranca en cero", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "nuevos" });

    expect(consultas[0].range).toEqual([0, PAGE_SIZE - 1]);
  });

  it("filtra por categoria solo si viene una", async () => {
    const conTag = db({ reads: [{ data: [], count: 0 }] });
    await getFeed({ sort: "nuevos", tag: "datos" });
    expect(conTag.consultas[0].contains).toEqual(["tags", ["datos"]]);

    const sinTag = db({ reads: [{ data: [], count: 0 }] });
    await getFeed({ sort: "nuevos" });
    expect(sinTag.consultas[0].contains).toBeUndefined();
  });

  it("busca por nombre y por bajada", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "nuevos", q: "placas" });

    expect(consultas[0].or).toBe("name.ilike.%placas%,tagline.ilike.%placas%");
  });

  /*
   * La que de verdad importa: el `or` de PostgREST es una gramatica de texto
   * donde la coma abre otra condicion y los parentesis agrupan. Si el termino
   * llegara crudo, se podrian inyectar condiciones en el filtro.
   */
  it("no deja que el termino de busqueda abra otra condicion en el or", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "nuevos", q: "x,is_admin.eq.true,name.ilike.*" });

    const or = consultas[0].or ?? "";

    /*
     * Lo que protege no es que las palabras desaparezcan —"is_admin" queda,
     * como texto adentro del patron del ilike, y ahi no significa nada— sino
     * que no sobreviva ni una coma ni un parentesis. Sin ellos el termino no
     * puede dejar de ser un valor y pasar a ser una condicion.
     */
    expect(or.split(",")).toHaveLength(2);
    expect(or).toMatch(/^name\.ilike\.%[^,()]*%,tagline\.ilike\.%[^,()]*%$/);
    expect(or).not.toContain("*");
  });

  it("tampoco deja pasar parentesis, que es como se agrupa", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "nuevos", q: "(placas)" });

    expect(consultas[0].or).toBe("name.ilike.%placas%,tagline.ilike.%placas%");
  });

  it("un termino que queda vacio al limpiarlo no filtra nada", async () => {
    const { consultas } = db({ reads: [{ data: [], count: 0 }] });

    await getFeed({ sort: "nuevos", q: "()," });

    expect(consultas[0].or).toBeUndefined();
  });

  it("pide el total junto con la pagina", async () => {
    const { consultas } = db({ reads: [{ data: [{ id: "p1" }], count: 87 }] });

    const { total } = await getFeed({ sort: "nuevos" });

    expect(consultas[0].options).toEqual({ count: "exact" });
    expect(total).toBe(87);
  });

  it("si la base falla, devuelve vacio en vez de tumbar la portada", async () => {
    db({ reads: [{ error: { message: "boom" } }] });

    expect(await getFeed({ sort: "nuevos" })).toEqual({ projects: [], total: 0 });
  });

  it("sin Supabase configurado no consulta nada", async () => {
    dobles.configurado = false;
    const { consultas } = db({ reads: [{ data: [{ id: "p1" }], count: 1 }] });

    expect(await getFeed({ sort: "nuevos" })).toEqual({ projects: [], total: 0 });
    expect(consultas).toHaveLength(0);
  });
});

describe("getProject", () => {
  const fila = {
    id: "p1",
    slug: "placas",
    name: "Consulta de Placas",
    links: [{ label: "Docs", url: "https://docs.placas.cr" }],
    owner: null,
    submitter: null,
  };

  it("busca por slug", async () => {
    const { consultas } = db({ singles: [{ data: fila }] });

    await getProject("placas");

    expect(consultas[0]).toMatchObject({ table: "projects", filters: [["slug", "placas"]] });
  });

  it("aplana la relacion que PostgREST devuelve como arreglo", async () => {
    const owner = { id: "u1", handle: "alejandra" };
    db({ singles: [{ data: { ...fila, owner: [owner], submitter: [] } }] });

    const project = await getProject("placas");

    expect(project?.owner).toEqual(owner);
    // Un arreglo vacio es "no hay", no un arreglo.
    expect(project?.submitter).toBeNull();
  });

  it("deja pasar la relacion cuando ya viene como objeto", async () => {
    const owner = { id: "u1", handle: "alejandra" };
    db({ singles: [{ data: { ...fila, owner } }] });

    expect((await getProject("placas"))?.owner).toEqual(owner);
  });

  it("limpia los enlaces guardados antes de mostrarlos", async () => {
    db({
      singles: [
        {
          data: {
            ...fila,
            links: [
              { label: "Docs", url: "https://docs.placas.cr" },
              { label: "Malo", url: "javascript:alert(1)" },
              { label: "", url: "https://sin-etiqueta.cr" },
            ],
          },
        },
      ],
    });

    // El JSON de la base no lo garantiza nadie: se vuelve a sanear al leer.
    expect((await getProject("placas"))?.links).toEqual([
      { label: "Docs", url: "https://docs.placas.cr" },
    ]);
  });

  it("devuelve null si no existe y si la consulta falla", async () => {
    db({ singles: [{ data: null }] });
    expect(await getProject("placas")).toBeNull();

    db({ singles: [{ data: null, error: { message: "boom" } }] });
    expect(await getProject("placas")).toBeNull();
  });
});

describe("getVotedIds", () => {
  it("sin ids no consulta nada", async () => {
    const { consultas } = db({ user: { id: "u1" } });

    expect(await getVotedIds([])).toEqual(new Set());
    expect(consultas).toHaveLength(0);
  });

  it("sin sesion devuelve vacio", async () => {
    db({ user: null });

    expect(await getVotedIds(["p1"])).toEqual(new Set());
  });

  it("pregunta solo por los votos de esa persona y esos proyectos", async () => {
    const { consultas } = db({
      user: { id: "u1" },
      reads: [{ data: [{ project_id: "p1" }, { project_id: "p3" }] }],
    });

    const votados = await getVotedIds(["p1", "p2", "p3"]);

    expect(votados).toEqual(new Set(["p1", "p3"]));
    expect(consultas[0].filters).toEqual([["user_id", "u1"]]);
    expect(consultas[0].in).toEqual(["project_id", ["p1", "p2", "p3"]]);
  });
});

describe("getMyClaimStatus", () => {
  it("sin sesion no hay reclamo que mirar", async () => {
    const { consultas } = db({ user: null });

    expect(await getMyClaimStatus("p1")).toBeNull();
    expect(consultas).toHaveLength(0);
  });

  it("devuelve el estado del reclamo de esa persona en ese proyecto", async () => {
    const { consultas } = db({ user: { id: "u1" }, singles: [{ data: { status: "pending" } }] });

    expect(await getMyClaimStatus("p1")).toBe("pending");
    expect(consultas[0].filters).toEqual([
      ["project_id", "p1"],
      ["user_id", "u1"],
    ]);
  });

  it("sin reclamo devuelve null, no undefined", async () => {
    db({ user: { id: "u1" }, singles: [{ data: null }] });

    expect(await getMyClaimStatus("p1")).toBeNull();
  });
});

describe("isCurrentUserAdmin", () => {
  it("sin sesion, no", async () => {
    const { consultas } = db({ user: null });

    expect(await isCurrentUserAdmin()).toBe(false);
    expect(consultas).toHaveLength(0);
  });

  it("lee el rol de la base, no del token", async () => {
    const { consultas } = db({ user: { id: "u1" }, singles: [{ data: { is_admin: true } }] });

    expect(await isCurrentUserAdmin()).toBe(true);
    expect(consultas[0]).toMatchObject({ table: "profiles", filters: [["id", "u1"]] });
  });

  it("un perfil sin el campo no es admin", async () => {
    db({ user: { id: "u1" }, singles: [{ data: {} }] });
    expect(await isCurrentUserAdmin()).toBe(false);

    db({ user: { id: "u1" }, singles: [{ data: null }] });
    expect(await isCurrentUserAdmin()).toBe(false);
  });
});

describe("getPendingClaims", () => {
  it("pide los pendientes, los mas viejos primero", async () => {
    const { consultas } = db({ reads: [{ data: [] }] });

    await getPendingClaims();

    expect(consultas[0].filters).toEqual([["status", "pending"]]);
    // Ascendente: la cola se atiende por antiguedad.
    expect(consultas[0].order).toEqual([{ column: "created_at", ascending: true }]);
  });

  it("aplana proyecto y persona", async () => {
    const project = { slug: "placas", name: "Placas", url: "https://placas.cr" };
    const user = { id: "u1", handle: "alejandra" };
    db({ reads: [{ data: [{ id: "c1", project: [project], user: [user] }] }] });

    const [claim] = await getPendingClaims();

    expect(claim.project).toEqual(project);
    expect(claim.user).toEqual(user);
  });

  it("si falla, la cola sale vacia y no revienta", async () => {
    db({ reads: [{ error: { message: "boom" } }] });

    expect(await getPendingClaims()).toEqual([]);
  });
});

describe("getProfileByHandle", () => {
  it("busca por handle", async () => {
    const { consultas } = db({ singles: [{ data: { id: "u1", handle: "alejandra" } }] });

    await getProfileByHandle("alejandra");

    expect(consultas[0].filters).toEqual([["handle", "alejandra"]]);
  });

  it("trae tambien los privados: quien decide que mostrar es la pagina", async () => {
    db({ singles: [{ data: { id: "u1", handle: "alejandra", public_profile: false } }] });

    // Si filtrara aca, el perfil privado no cargaria ni para su propio dueno.
    const profile = await getProfileByHandle("alejandra");

    expect(profile).toMatchObject({ public_profile: false });
  });

  it("sin perfil devuelve null", async () => {
    db({ singles: [{ data: null }] });

    expect(await getProfileByHandle("nadie")).toBeNull();
  });
});

describe("getProjectsByOwner", () => {
  it("pide los de esa persona, los mas votados primero", async () => {
    const { consultas } = db({ reads: [{ data: [] }] });

    await getProjectsByOwner("u1");

    expect(consultas[0]).toMatchObject({
      table: "project_feed",
      filters: [["owner_id", "u1"]],
      order: [{ column: "vote_count", ascending: false }],
    });
  });

  it("si falla, devuelve vacio", async () => {
    db({ reads: [{ error: { message: "boom" } }] });

    expect(await getProjectsByOwner("u1")).toEqual([]);
  });
});

describe("getMessages", () => {
  it("pone los sin atender arriba y los nuevos primero, con tope", async () => {
    const { consultas } = db({ reads: [{ data: [] }] });

    await getMessages();

    expect(consultas[0].order).toEqual([
      { column: "handled", ascending: true },
      { column: "created_at", ascending: false },
    ]);
    expect(consultas[0].limit).toBe(200);
  });

  it("si falla, devuelve vacio", async () => {
    db({ reads: [{ error: { message: "boom" } }] });

    expect(await getMessages()).toEqual([]);
  });
});

describe("getSitemapEntries", () => {
  it("filtra publicadas y perfiles publicos de forma explicita", async () => {
    const { consultas } = db({
      reads: [
        { data: [{ slug: "placas", updated_at: "2026-09-01T00:00:00Z" }] },
        { data: [{ handle: "alejandra" }] },
      ],
    });

    await getSitemapEntries();

    const [proyectos, perfiles] = consultas;
    expect(proyectos.filters).toEqual([["status", "published"]]);
    // La RLS no filtra public_profile: eso lo respeta la aplicacion.
    expect(perfiles.filters).toEqual([["public_profile", true]]);
    expect(perfiles.not).toEqual(["handle", "is", null]);
  });

  it("descarta los perfiles sin handle todavia", async () => {
    db({
      reads: [{ data: [] }, { data: [{ handle: "alejandra" }, { handle: null }] }],
    });

    expect((await getSitemapEntries()).handles).toEqual(["alejandra"]);
  });

  it("si una de las dos falla, la otra igual sale", async () => {
    db({
      reads: [{ error: { message: "boom" } }, { data: [{ handle: "alejandra" }] }],
    });

    const { projects, handles } = await getSitemapEntries();

    expect(projects).toEqual([]);
    expect(handles).toEqual(["alejandra"]);
  });

  it("no se pasa del tope de URL", async () => {
    const { consultas } = db({ reads: [{ data: [] }, { data: [] }] });

    await getSitemapEntries();

    expect(consultas[0].limit).toBe(5000);
    expect(consultas[1].limit).toBe(5000);
  });
});
