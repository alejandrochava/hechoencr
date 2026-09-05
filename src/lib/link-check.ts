import "server-only";

import { promises as dns } from "node:dns";

import {
  ipVersionOf,
  isPrivateAddress,
  isPublicHttpUrl,
  repoRef,
  type RepoRef,
} from "@/lib/text";

/**
 * Comprueba que un enlace enviado por alguien apunte a algo real.
 *
 * La sintaxis no distingue "https://miproyecto.cr" de "https://asdasd.cr": las
 * dos se ven bien. Esto pregunta, en este orden y cortando en el primer no:
 *
 *   1. que sea http(s) y no apunte a la red interna,
 *   2. que el dominio exista en el DNS y no resuelva a una direccion privada,
 *   3. que el servidor conteste y sirva la pagina por https.
 *
 * Politica ante fallos: si el que falla es el sitio (dominio inexistente, 404,
 * certificado vencido) se rechaza. Si el que falla somos nosotros (timeout,
 * DNS caido) se deja pasar, igual que domainAcceptsMail. Bloquear a alguien
 * real por un problema de nuestra red es peor que aceptar un enlace dudoso,
 * que ademas queda a la vista de cualquiera en el directorio.
 */

const TIMEOUT_MS = 6000;

/** Sin un user agent normal varios sitios contestan 403. */
const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; HechoEnCR/1.0; +https://hechoencr.cr)",
  accept: "text/html,application/xhtml+xml,*/*",
};

/** El dominio contesto que no existe: no es un problema de red nuestro. */
const NO_EXISTE = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

/** Fallos de TLS: el sitio existe pero no sirve https de forma confiable. */
const TLS_FALLA = new Set([
  "CERT_HAS_EXPIRED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "EPROTO",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

type Resolucion = "publica" | "privada" | "no-existe" | "sin-respuesta";

async function resolveHost(hostname: string): Promise<Resolucion> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (ipVersionOf(bare) !== 0) return isPrivateAddress(bare) ? "privada" : "publica";

  try {
    const addresses = await dns.lookup(bare, { all: true, verbatim: true });
    if (addresses.length === 0) return "no-existe";
    // Una sola direccion privada alcanza para descartarlo.
    return addresses.some((entry) => isPrivateAddress(entry.address)) ? "privada" : "publica";
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    return NO_EXISTE.has(code) ? "no-existe" : "sin-respuesta";
  }
}

type Respuesta =
  | { tipo: "ok"; url: string }
  | { tipo: "no-existe" }
  | { tipo: "tls" }
  | { tipo: "sin-respuesta" };

async function request(url: string): Promise<Respuesta> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: HEADERS,
    });

    // 404 y 410 son el sitio diciendo que esa pagina no existe. Un 403 o un
    // 429, en cambio, suelen ser el sitio bloqueando bots: eso no lo tomamos
    // como que el proyecto no existe.
    if (response.status === 404 || response.status === 410) return { tipo: "no-existe" };

    // El redirect puede terminar en la red interna aunque el origen fuera publico.
    if (!isPublicHttpUrl(response.url || url)) return { tipo: "no-existe" };

    return { tipo: "ok", url: response.url || url };
  } catch (error) {
    const code = String((error as { cause?: NodeJS.ErrnoException }).cause?.code ?? "");
    if (TLS_FALLA.has(code)) return { tipo: "tls" };
    return { tipo: "sin-respuesta" };
  }
}

export type SiteCheck =
  | { ok: true; url: string }
  | { ok: false; reason: "invalida" | "privada" | "no-existe" | "sin-https" };

/**
 * Revisa el enlace principal de un proyecto.
 *
 * Si vino escrito con http, se prueba primero la version https y se guarda esa
 * si contesta: la mayoria de los sitios ya sirven las dos y no tiene sentido
 * guardar la insegura por como se escribio el enlace.
 */
export async function checkSite(raw: string): Promise<SiteCheck> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: "invalida" };
  }

  if (!parsed.hostname.includes(".") || !isPublicHttpUrl(raw)) {
    return { ok: false, reason: parsed.protocol === "https:" || parsed.protocol === "http:" ? "privada" : "invalida" };
  }

  const resolution = await resolveHost(parsed.hostname);
  if (resolution === "no-existe") return { ok: false, reason: "no-existe" };
  if (resolution === "privada") return { ok: false, reason: "privada" };

  const secure = new URL(parsed.toString());
  secure.protocol = "https:";

  const attempt = await request(secure.toString());
  if (attempt.tipo === "ok") return { ok: true, url: attempt.url };
  if (attempt.tipo === "no-existe") return { ok: false, reason: "no-existe" };
  if (attempt.tipo === "tls") return { ok: false, reason: "sin-https" };

  // No contesto por https. Si por http si contesta, el sitio existe pero no
  // tiene https y se rechaza.
  if (parsed.protocol === "http:") {
    const plain = await request(parsed.toString());
    if (plain.tipo === "ok") return { ok: false, reason: "sin-https" };
  }

  /*
   * Nada contesto, ni por https ni por http, pero el dominio existe: el fallo
   * bien puede ser nuestro (timeout, egreso bloqueado) y no se castiga a la
   * persona por eso. Lo que si se respeta es el enlace tal como lo escribio:
   * ascenderlo a https cuando https nunca contesto guardaria una direccion que
   * no carga.
   */
  return { ok: true, url: raw };
}

export type RepoCheck =
  | { ok: true; ref: RepoRef }
  | { ok: false; reason: "no-es-forja" | "no-existe" };

/** Revisa el repositorio: que sea de una forja conocida y que exista. */
export async function checkRepo(raw: string): Promise<RepoCheck> {
  const ref = repoRef(raw);
  if (!ref) return { ok: false, reason: "no-es-forja" };

  const attempt = await request(ref.url);
  if (attempt.tipo === "no-existe") return { ok: false, reason: "no-existe" };

  // Timeout o TLS de la forja es problema nuestro o suyo, no del repositorio.
  return { ok: true, ref };
}
