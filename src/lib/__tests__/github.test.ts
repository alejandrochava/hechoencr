import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * La lectura de repositorios publicos de GitHub.
 *
 * fetch va doble: con la API de verdad la prueba diria si una cuenta ajena
 * tiene tal repo hoy, y ademas gastaria el limite. Lo que se afirma es como se
 * traduce cada respuesta, que se descarta de la lista, y que no se pregunte dos
 * veces por lo mismo.
 */

type Fetch = (url: string, opciones?: { headers?: Record<string, string> }) => Promise<unknown>;

function respuesta(cuerpo: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => cuerpo };
}

function conFetch(...respuestas: (ReturnType<typeof respuesta> | Error)[]) {
  const espia = vi.fn<Fetch>(async () => {
    const siguiente = respuestas.shift();
    if (siguiente instanceof Error) throw siguiente;
    return siguiente ?? respuesta([]);
  });

  vi.stubGlobal("fetch", espia);
  return espia;
}

/** La cache vive en el modulo, asi que cada prueba lo carga de nuevo. */
async function cargar() {
  vi.resetModules();
  const { listPublicRepos } = await import("@/lib/github");
  return listPublicRepos;
}

const REPO = {
  name: "consulta-de-placas",
  full_name: "alejandra/consulta-de-placas",
  description: "Historial de un vehiculo por su placa.",
  homepage: "https://placas.cr",
  html_url: "https://github.com/alejandra/consulta-de-placas",
  topics: ["datos", "open-data"],
  stargazers_count: 12,
  language: "TypeScript",
  archived: false,
  fork: false,
  pushed_at: "2026-09-01T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("listPublicRepos", () => {
  it("normaliza lo que devuelve la API a lo que el sitio usa", async () => {
    const listPublicRepos = await cargar();
    conFetch(respuesta([REPO]));

    const resultado = await listPublicRepos("alejandra");

    expect(resultado).toEqual({
      ok: true,
      repos: [
        {
          name: "consulta-de-placas",
          fullName: "alejandra/consulta-de-placas",
          description: "Historial de un vehiculo por su placa.",
          homepage: "https://placas.cr",
          htmlUrl: "https://github.com/alejandra/consulta-de-placas",
          topics: ["datos", "open-data"],
          stars: 12,
          language: "TypeScript",
          archived: false,
          pushedAt: "2026-09-01T00:00:00Z",
        },
      ],
    });
  });

  it("pide los mas movidos primero y solo los propios", async () => {
    const listPublicRepos = await cargar();
    const espia = conFetch(respuesta([]));

    await listPublicRepos("alejandra");

    const url = espia.mock.calls[0][0];
    expect(url).toContain("/users/alejandra/repos");
    expect(url).toContain("sort=pushed");
    expect(url).toContain("direction=desc");
    // type=owner deja afuera los repos donde solo colabora.
    expect(url).toContain("type=owner");
  });

  it("descarta los forks: no son tu proyecto", async () => {
    const listPublicRepos = await cargar();
    conFetch(respuesta([REPO, { ...REPO, name: "ajeno", html_url: "https://github.com/a/ajeno", fork: true }]));

    const resultado = await listPublicRepos("alejandra");

    expect(resultado.ok && resultado.repos.map((repo) => repo.name)).toEqual([
      "consulta-de-placas",
    ]);
  });

  it("descarta lo que viene sin nombre o sin URL, sin caerse", async () => {
    const listPublicRepos = await cargar();
    conFetch(respuesta([REPO, { name: "sin-url" }, { html_url: "https://github.com/a/b" }, null, "x"]));

    const resultado = await listPublicRepos("alejandra");

    expect(resultado.ok && resultado.repos).toHaveLength(1);
  });

  it("tolera campos ausentes o de otro tipo", async () => {
    const listPublicRepos = await cargar();
    conFetch(
      respuesta([
        {
          name: "pelado",
          html_url: "https://github.com/a/pelado",
          description: "   ",
          topics: ["ok", 3, null],
          stargazers_count: "muchas",
        },
      ]),
    );

    const resultado = await listPublicRepos("alejandra");

    expect(resultado.ok && resultado.repos[0]).toMatchObject({
      fullName: "pelado",
      description: null,
      homepage: null,
      topics: ["ok"],
      stars: 0,
      archived: false,
    });
  });

  it("una cuenta que no existe se distingue de un fallo", async () => {
    const listPublicRepos = await cargar();
    conFetch(respuesta({ message: "Not Found" }, 404));

    expect(await listPublicRepos("nadie")).toEqual({ ok: false, reason: "no-existe" });
  });

  it("el limite de la API se distingue tambien", async () => {
    for (const status of [403, 429]) {
      const listPublicRepos = await cargar();
      conFetch(respuesta({ message: "rate limit" }, status));

      expect(await listPublicRepos("alejandra"), String(status)).toEqual({
        ok: false,
        reason: "limite",
      });
    }
  });

  it("un token rechazado no se confunde con un problema de red", async () => {
    const listPublicRepos = await cargar();
    conFetch(respuesta({ message: "Bad credentials" }, 401));

    expect(await listPublicRepos("alejandra")).toEqual({ ok: false, reason: "credencial" });
  });

  it("cualquier otro problema es sin-respuesta", async () => {
    const conError = await cargar();
    conFetch(respuesta({}, 500));
    expect(await conError("alejandra")).toEqual({ ok: false, reason: "sin-respuesta" });

    const conCaida = await cargar();
    conFetch(new TypeError("fetch failed"));
    expect(await conCaida("alejandra")).toEqual({ ok: false, reason: "sin-respuesta" });
  });

  it("un handle vacio no llega a consultarse", async () => {
    const listPublicRepos = await cargar();
    const espia = conFetch(respuesta([]));

    expect(await listPublicRepos("   ")).toEqual({ ok: false, reason: "no-existe" });
    expect(espia).not.toHaveBeenCalled();
  });

  it("manda el token cuando esta definido", async () => {
    const listPublicRepos = await cargar();
    vi.stubEnv("GITHUB_TOKEN", "abc123");
    const espia = conFetch(respuesta([]));

    await listPublicRepos("alejandra");

    expect(espia.mock.calls[0][1]?.headers?.authorization).toBe("Bearer abc123");
  });

  it("sin token igual consulta, solo con menos margen", async () => {
    const listPublicRepos = await cargar();
    vi.stubEnv("GITHUB_TOKEN", "");
    const espia = conFetch(respuesta([]));

    const resultado = await listPublicRepos("alejandra");

    expect(resultado.ok).toBe(true);
    expect(espia.mock.calls[0][1]?.headers).not.toHaveProperty("authorization");
  });

  it("no pregunta dos veces por la misma cuenta", async () => {
    const listPublicRepos = await cargar();
    const espia = conFetch(respuesta([REPO]), respuesta([]));

    await listPublicRepos("alejandra");
    await listPublicRepos("Alejandra");

    // El handle se normaliza, asi que las dos son la misma cuenta.
    expect(espia).toHaveBeenCalledOnce();
  });

  it("tambien recuerda el fallo: contra el limite, insistir no ayuda", async () => {
    const listPublicRepos = await cargar();
    const espia = conFetch(respuesta({}, 403), respuesta([REPO]));

    expect(await listPublicRepos("alejandra")).toEqual({ ok: false, reason: "limite" });
    expect(await listPublicRepos("alejandra")).toEqual({ ok: false, reason: "limite" });
    expect(espia).toHaveBeenCalledOnce();
  });

  it("cuentas distintas se preguntan por separado", async () => {
    const listPublicRepos = await cargar();
    const espia = conFetch(respuesta([]), respuesta([]));

    await listPublicRepos("alejandra");
    await listPublicRepos("otro");

    expect(espia).toHaveBeenCalledTimes(2);
  });
});
