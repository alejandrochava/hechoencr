import "server-only";

import { promises as dns } from "node:dns";

import { emailDomain } from "@/lib/text";

/**
 * Comprueba, con suavidad, que el dominio del correo reciba mensajes.
 *
 * La sintaxis no distingue "gmail.com" de "gmial.com", ni "a@a.com" de una
 * direccion real: las tres se ven bien. Preguntar por los registros MX si las
 * distingue, y es la validacion mas liviana que sirve de algo:
 *
 *   gmail.com, hotmail.com, ice.co.cr  ->  tienen MX, pasan
 *   un dominio propio de trabajo       ->  tiene MX, pasa
 *   a.com, gmial.com                   ->  sin MX, no pasan
 *
 * No prueba que el buzon exista, y no queremos que lo pruebe: de eso se
 * encarga el enlace que mandamos, que solo puede abrir quien recibe el correo.
 *
 * Si el DNS falla por red (timeout, servidor caido) dejamos pasar. Bloquear a
 * alguien real por un problema nuestro es peor que dejar entrar un dominio
 * dudoso, que igual va a tropezar con el enlace de acceso.
 */

type Entry = { ok: boolean; until: number };

const cache = new Map<string, Entry>();
const TTL_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 3000;

/** El dominio contesto que no tiene correo (no es un problema de red). */
const SIN_CORREO = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = emailDomain(email);
  if (!domain) return false;

  const cached = cache.get(domain);
  if (cached && cached.until > Date.now()) return cached.ok;

  let ok: boolean;
  try {
    const records = await Promise.race([
      dns.resolveMx(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    ok = records.length > 0;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "";
    // Sin MX declarado: no hay a donde entregar. Cualquier otro fallo es
    // nuestro problema de red, no del dominio, y no penaliza a la persona.
    ok = !SIN_CORREO.has(code);
  }

  cache.set(domain, { ok, until: Date.now() + TTL_MS });
  return ok;
}
