/**
 * Funciones puras de texto. Viven aparte porque son la frontera con datos que
 * escribe un desconocido: aca es donde se limpian, y aca es donde se prueban.
 */

/** Convierte un nombre en un slug seguro para URL. */
export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

/** Completa el esquema si falta. Devuelve "" si no hay nada que normalizar. */
export function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.includes(".")
    );
  } catch {
    return false;
  }
}

/**
 * Limpia el termino de busqueda con lista blanca.
 *
 * PostgREST arma los filtros con una gramatica de texto: una coma abre otra
 * condicion y los parentesis agrupan. Si eso pasara sin filtrar, alguien
 * podria inyectar condiciones en el `or(...)`. En vez de listar lo prohibido
 * (siempre se escapa algo), solo dejamos pasar lo que sirve para buscar.
 */
export function sanitizeSearch(term: string) {
  return term
    .normalize("NFC")
    .replace(/[^\p{Letter}\p{Number}\s._-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Dueno de un repositorio de GitHub, en minuscula. null si no aplica. */
export function githubOwner(url: string | null | undefined) {
  if (!url) return null;
  const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/?#]+)\/[^/?#]+/i);
  return match ? match[1].toLowerCase() : null;
}

/* ---------------------------------------------------------------------
   Enlaces que apuntan a la red interna
   --------------------------------------------------------------------- */

/**
 * Version de una direccion IP escrita como texto: 4, 6 o 0 si no es una IP.
 *
 * No usa node:net porque este archivo lo importan componentes del navegador.
 * Alcanza de sobra: lo unico que necesitamos es clasificar, y del lado del
 * servidor las direcciones ya vienen normalizadas por el DNS.
 */
export function ipVersionOf(value: string): 0 | 4 | 6 {
  const bare = value.replace(/^\[|\]$/g, "");

  const v4 = bare.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return v4.slice(1).every((part) => Number(part) <= 255) ? 4 : 0;

  if (bare.includes(":") && /^[0-9a-f:.]+$/i.test(bare)) return 6;
  return 0;
}

/**
 * Rangos que nunca son un sitio publico.
 *
 * Se aplica dos veces: al host tal como se escribio, por si es una IP literal,
 * y del lado del servidor a cada direccion que devuelve el DNS. Lo segundo es
 * lo que de verdad protege: un dominio comun puede resolver a 127.0.0.1 y
 * mirando solo el texto no se ve.
 */
export function isPrivateAddress(address: string) {
  const version = ipVersionOf(address);
  if (version === 0) return false;

  const bare = address.replace(/^\[|\]$/g, "").toLowerCase();

  if (version === 4) {
    const [a, b] = bare.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    // Carrier grade NAT: 100.64.0.0/10.
    if (a === 100 && b >= 64 && b <= 127) return true;
    // Multicast y reservados.
    return a >= 224;
  }

  if (bare === "::" || bare === "::1") return true;
  // Enlace local (fe80::/10) y direcciones unicas locales (fc00::/7).
  if (/^fe[89ab]/.test(bare)) return true;
  if (/^f[cd]/.test(bare)) return true;

  /*
   * IPv4 mapeada adentro de una IPv6: se juzga por su parte v4. Viene de dos
   * formas y hay que aceptar las dos: con puntos, como la escribe la gente y
   * como la devuelve el DNS, y en hexadecimal, que es a lo que la normaliza
   * `new URL` (::ffff:127.0.0.1 se guarda como ::ffff:7f00:1).
   */
  const dotted = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateAddress(dotted[1]);

  const hex = bare.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const high = parseInt(hex[1], 16);
    const low = parseInt(hex[2], 16);
    return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }

  return false;
}

/**
 * Primer filtro de un enlace ajeno, solo por texto y sin tocar la red.
 * Descarta esquemas que no son web y todo lo que apunta a la red interna.
 */
export function isPublicHttpUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (!host || host.includes("..")) return false;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
  if (host.endsWith(".internal") || host.endsWith(".home.arpa")) return false;

  return !isPrivateAddress(host);
}

/* ---------------------------------------------------------------------
   Repositorios
   --------------------------------------------------------------------- */

/**
 * Forjas que aceptamos como repositorio.
 *
 * La lista es blanca a proposito: "repositorio" tiene que significar codigo
 * que alguien puede abrir y leer, no cualquier URL. GitHub va primero porque
 * es el unico con verificacion instantanea de reclamos (claim_with_github);
 * las demas sirven igual para mostrar el codigo.
 */
export const REPO_FORGES = [
  { host: "github.com", label: "GitHub" },
  { host: "gitlab.com", label: "GitLab" },
  { host: "bitbucket.org", label: "Bitbucket" },
  { host: "codeberg.org", label: "Codeberg" },
  { host: "git.sr.ht", label: "SourceHut" },
] as const;

export type RepoRef = {
  host: string;
  label: string;
  owner: string;
  repo: string;
  /** La URL canonica: sin .git, sin query, sin la subruta que venia pegada. */
  url: string;
};

/**
 * Segmentos que ya no son parte del nombre del repositorio.
 *
 * La gente copia la barra de direcciones, y ahi viene "/tree/main" o
 * "/issues/12" pegado. Sin cortar, el nombre del repo terminaria siendo "main".
 */
const REPO_SUBPATHS = new Set([
  "-",
  "actions",
  "blob",
  "branch",
  "commit",
  "commits",
  "issues",
  "pull",
  "pulls",
  "releases",
  "settings",
  "src",
  "tags",
  "tree",
  "wiki",
]);

/**
 * Lee una URL de repositorio. Devuelve null si no es de una forja conocida o
 * si no llega a apuntar a un repositorio (le falta el dueno o el nombre).
 */
export function repoRef(value: string | null | undefined): RepoRef | null {
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(normalizeUrl(value));
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const forge = REPO_FORGES.find((candidate) => candidate.host === host);
  if (!forge) return null;

  let segments = parsed.pathname.split("/").filter(Boolean);

  const cut = segments.findIndex((segment) => REPO_SUBPATHS.has(segment.toLowerCase()));
  if (cut !== -1) segments = segments.slice(0, cut);

  // GitLab permite subgrupos (grupo/subgrupo/repo); el resto es dueno/repo.
  if (forge.host !== "gitlab.com") segments = segments.slice(0, 2);
  if (segments.length < 2) return null;

  const repo = segments[segments.length - 1].replace(/\.git$/i, "");
  // SourceHut escribe al dueno como ~usuario.
  const owner = segments[0].replace(/^~/, "");
  if (!owner || !repo) return null;

  const path = [...segments.slice(0, -1), repo].join("/");
  return {
    host: forge.host,
    label: forge.label,
    owner: owner.toLowerCase(),
    repo,
    url: `https://${forge.host}/${path}`,
  };
}

/** Solo rutas internas: evita que un `next` externo secuestre el redirect. */
export function safeNextPath(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback;
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * Telefono movil de Costa Rica.
 *
 * El plan de numeracion son 8 digitos: los moviles (Kolbi, Liberty, Claro)
 * empiezan en 6, 7 u 8; los fijos en 2 y los VoIP en 4. Guardamos siempre los
 * 8 digitos sin prefijo, para que "+506 8123 4567" y "81234567" sean el mismo
 * numero y la restriccion de unicidad funcione.
 */
export function normalizePhoneCR(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("506") ? digits.slice(3) : digits;
  return local.length === 8 ? local : null;
}

export function isValidCRMobile(value: string): boolean {
  const local = normalizePhoneCR(value);
  if (!local) return false;
  // Fijos (2) y VoIP (4) no sirven para identificar a una persona.
  if (!/^[678]/.test(local)) return false;
  // 88888888 y compania: relleno, no un numero asignado.
  if (/^(\d)\1{7}$/.test(local)) return false;
  return true;
}

/** Como se muestra: 8123-4567. */
export function formatPhoneCR(value: string): string {
  const local = normalizePhoneCR(value);
  return local ? `${local.slice(0, 4)}-${local.slice(4)}` : value;
}

/* ---------------------------------------------------------------------
   Correo
   --------------------------------------------------------------------- */

/** Dominios de correo temporal: sirven para saltarse el limite de un voto. */
const DISPOSABLE_DOMAINS = new Set([
  "0-mail.com",
  "10minutemail.com",
  "20minutemail.com",
  "burnermail.io",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.com",
  "guerrillamail.info",
  "inboxbear.com",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "sharklasers.com",
  "spam4.me",
  "temp-mail.io",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "tempmailo.com",
  "throwawaymail.com",
  "trashmail.com",
  "tuta.io",
  "yopmail.com",
  "yopmail.fr",
]);

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function emailDomain(value: string) {
  const at = normalizeEmail(value).lastIndexOf("@");
  return at === -1 ? null : normalizeEmail(value).slice(at + 1);
}

/**
 * Sintaxis. No alcanza para saber si el buzon existe (eso lo prueba el enlace
 * que mandamos), pero descarta lo que nunca podria entregarse.
 */
export function isValidEmailSyntax(value: string) {
  const email = normalizeEmail(value);
  if (email.length < 6 || email.length > 254) return false;
  if (email.includes("..")) return false;

  const parts = email.split("@");
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;

  // El dominio necesita al menos un punto y una extension de dos letras o mas.
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(
    domain,
  );
}

export function isDisposableEmail(value: string) {
  const domain = emailDomain(value);
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/* ---------------------------------------------------------------------
   Enlaces extra de un proyecto
   --------------------------------------------------------------------- */

export type ProjectLink = { label: string; url: string };

export const MAX_PROJECT_LINKS = 6;

/**
 * Limpia la lista de enlaces que manda quien publica.
 *
 * Se guarda como JSON en la base, asi que la forma la garantiza la aplicacion:
 * descarta filas incompletas, normaliza la URL, corta etiquetas largas y pone
 * un tope. Sin esto, el JSON podria crecer sin limite o traer un `javascript:`.
 */
export function sanitizeProjectLinks(raw: unknown): ProjectLink[] {
  if (!Array.isArray(raw)) return [];

  const links: ProjectLink[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const label = String((item as ProjectLink).label ?? "").trim().slice(0, 40);
    const url = normalizeUrl(String((item as ProjectLink).url ?? ""));

    if (!label || !isValidHttpUrl(url)) continue;
    if (links.some((existing) => existing.url === url)) continue;

    links.push({ label, url });
    if (links.length === MAX_PROJECT_LINKS) break;
  }

  return links;
}
