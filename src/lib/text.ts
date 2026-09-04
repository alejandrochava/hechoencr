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
