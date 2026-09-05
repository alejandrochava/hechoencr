import "server-only";

/**
 * Los repositorios publicos de una cuenta de GitHub.
 *
 * Se usa la API publica y no un token de la persona: Supabase devuelve un
 * provider_token justo despues del OAuth pero no lo guarda, y guardarlo seria
 * quedarse con la custodia de una credencial ajena para leer algo que ya es
 * publico. Con el handle que syncGithubHandle dejo en el perfil alcanza, y lo
 * que se ve es exactamente lo que un directorio publico deberia listar.
 *
 * El token de aca es nuestro y opcional: sin el, GitHub da 60 consultas por
 * hora y por IP, y en serverless la IP se comparte entre todos los visitantes.
 * Con un token de solo lectura son 5000. Si no esta, igual funciona; lo que
 * cambia es cuanto aguanta.
 */

const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REPOS = 100;

export type GithubRepo = {
  name: string;
  fullName: string;
  description: string | null;
  homepage: string | null;
  htmlUrl: string;
  topics: string[];
  stars: number;
  language: string | null;
  archived: boolean;
  pushedAt: string;
};

export type ReposResult =
  | { ok: true; repos: GithubRepo[] }
  | { ok: false; reason: "no-existe" | "limite" | "sin-respuesta" };

type Entrada = { resultado: ReposResult; hasta: number };

/*
 * La lista de una cuenta cambia poco y el selector se abre y se cierra varias
 * veces seguidas. Cinco minutos evitan gastar el limite en lo mismo.
 */
const cache = new Map<string, Entrada>();

/** Lo que devuelve la API, de lo que solo se lee lo que se usa. */
type RepoCrudo = {
  name?: unknown;
  full_name?: unknown;
  description?: unknown;
  homepage?: unknown;
  html_url?: unknown;
  topics?: unknown;
  stargazers_count?: unknown;
  language?: unknown;
  archived?: unknown;
  fork?: unknown;
  pushed_at?: unknown;
};

const texto = (valor: unknown) => (typeof valor === "string" && valor.trim() ? valor.trim() : null);

function normalizar(crudo: RepoCrudo): GithubRepo | null {
  const name = texto(crudo.name);
  const htmlUrl = texto(crudo.html_url);
  if (!name || !htmlUrl) return null;

  return {
    name,
    fullName: texto(crudo.full_name) ?? name,
    description: texto(crudo.description),
    homepage: texto(crudo.homepage),
    htmlUrl,
    topics: Array.isArray(crudo.topics)
      ? crudo.topics.filter((topic): topic is string => typeof topic === "string")
      : [],
    stars: typeof crudo.stargazers_count === "number" ? crudo.stargazers_count : 0,
    language: texto(crudo.language),
    archived: crudo.archived === true,
    pushedAt: texto(crudo.pushed_at) ?? "",
  };
}

export async function listPublicRepos(handle: string): Promise<ReposResult> {
  const cuenta = handle.trim().toLowerCase();
  if (!cuenta) return { ok: false, reason: "no-existe" };

  const guardado = cache.get(cuenta);
  if (guardado && guardado.hasta > Date.now()) return guardado.resultado;

  const token = process.env.GITHUB_TOKEN?.trim();
  const url =
    `https://api.github.com/users/${encodeURIComponent(cuenta)}/repos` +
    `?per_page=${MAX_REPOS}&sort=pushed&direction=desc&type=owner`;

  let resultado: ReposResult;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "HechoEnCR/1.0 (+https://hechoencr.cr)",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });

    if (response.status === 404) {
      resultado = { ok: false, reason: "no-existe" };
    } else if (response.status === 403 || response.status === 429) {
      // GitHub usa 403 tanto para el limite como para un token invalido; para
      // quien esta del otro lado el consejo es el mismo: esperar.
      resultado = { ok: false, reason: "limite" };
    } else if (!response.ok) {
      resultado = { ok: false, reason: "sin-respuesta" };
    } else {
      const crudos = (await response.json()) as unknown;
      const repos = (Array.isArray(crudos) ? crudos : [])
        // Se descarta lo que no es un objeto antes de leerlo: una entrada rara
        // no deberia convertir la lista entera en un fallo.
        .filter((crudo): crudo is RepoCrudo => typeof crudo === "object" && crudo !== null)
        // Un fork no es tu proyecto, es el de alguien mas.
        .filter((crudo) => crudo.fork !== true)
        .map(normalizar)
        .filter((repo): repo is GithubRepo => repo !== null);

      resultado = { ok: true, repos };
    }
  } catch {
    resultado = { ok: false, reason: "sin-respuesta" };
  }

  // Un fallo tambien se recuerda, un rato: si estamos contra el limite, seguir
  // preguntando no ayuda.
  cache.set(cuenta, { resultado, hasta: Date.now() + CACHE_TTL_MS });
  return resultado;
}
