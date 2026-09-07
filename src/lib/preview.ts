import "server-only";

import { isPublicHttpUrl } from "@/lib/text";

/**
 * Vista previa de un proyecto, en cascada:
 *   1. un screenshot del sitio, que es como se ve la pagina de verdad,
 *   2. la og:image que el sitio declara, si el screenshot no se puede,
 *   3. nada, y la tarjeta dibuja un monograma.
 *
 * La captura va primero a proposito. La og:image suele ser una tarjeta de
 * marca —un logo sobre un color— y no dice como se ve el proyecto, que es lo
 * que alguien mira en un directorio antes de entrar.
 */

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 512 * 1024;

/*
 * El servicio genera la captura en segundo plano: pedirla es lo que la manda a
 * generar. Mientras no esta, contesta un redirect a un GIF de "generando", asi
 * que el primer intento casi siempre dice que no. Se espera un poco, sin
 * pasarse: del otro lado hay alguien esperando a que termine de publicar.
 */
const SHOT_TIMEOUT_MS = 4000;
const SHOT_TRIES = 4;
const SHOT_WAIT_MS = 1200;

const USER_AGENT = "Mozilla/5.0 (compatible; HechoEnCR/1.0; +https://hechoencr.cr)";

function extractMetaImage(html: string) {
  // Buscamos en orden de preferencia; la primera que aparezca gana.
  const properties = ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"];

  for (const property of properties) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`,
      "i",
    );
    const tag = html.match(pattern)?.[0];
    if (!tag) continue;

    const content = tag.match(/content=["']([^"']+)["']/i)?.[1];
    if (content) return content.trim();
  }

  return null;
}

/** Screenshot automatico gratuito, sin llave. Se genera del lado de WordPress. */
export function screenshotUrl(siteUrl: string) {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(siteUrl)}?w=1280&h=800`;
}

const espera = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

/**
 * En que anda la captura.
 *
 * `lista` es una imagen que ya existe. `generando` es que el servicio la esta
 * armando: la URL sirve igual, porque dentro de un rato devuelve la imagen
 * sola. `no` es que el servicio no contesto o nos corto, y ahi si hay que
 * buscar por otro lado.
 */
type Captura = "lista" | "generando" | "no";

async function estadoDeLaCaptura(url: string): Promise<Captura> {
  for (let intento = 0; intento < SHOT_TRIES; intento++) {
    if (intento > 0) await espera(SHOT_WAIT_MS);

    try {
      const response = await fetch(url, {
        method: "HEAD",
        // Sin esto el redirect se sigue solo y el GIF de "generando" llegaria
        // como un 200 con una imagen, indistinguible de la captura de verdad.
        redirect: "manual",
        signal: AbortSignal.timeout(SHOT_TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT },
      });

      if (response.status === 200 && (response.headers.get("content-type") ?? "").startsWith("image/")) {
        return "lista";
      }

      // Un redirect es el GIF de "generando": todavia no, pero va a estar.
      if (response.status >= 300 && response.status < 400) continue;

      // Cualquier otra cosa (nos corto por volumen, se cayo) no mejora
      // esperando: no tiene sentido gastarle mas intentos.
      return "no";
    } catch {
      return "no";
    }
  }

  return "generando";
}

/** La imagen que el sitio declara para cuando lo comparten, si declara alguna. */
async function imagenDeclarada(siteUrl: string): Promise<string | null> {
  try {
    const response = await fetch(siteUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Sin un user agent normal varios sitios devuelven 403.
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return null;

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return null;

    // Solo necesitamos el <head>, no bajamos la pagina entera.
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const found = extractMetaImage(html);
    if (!found) return null;

    const absolute = new URL(found, response.url).toString();
    return isPublicHttpUrl(absolute) ? absolute : null;
  } catch {
    // Sitio caido, lento o que bloquea bots.
    return null;
  }
}

export async function findPreviewImage(siteUrl: string): Promise<string | null> {
  if (!isPublicHttpUrl(siteUrl)) return null;

  const captura = screenshotUrl(siteUrl);
  const estado = await estadoDeLaCaptura(captura);

  /*
   * Que todavia se este generando no es que haya fallado: la misma URL va a
   * devolver la imagen sola en un rato. Se guarda igual, y solo si el servicio
   * no contesta se busca lo que el sitio declara.
   *
   * El costo: quien acaba de publicar puede ver una vez el "generando" y
   * necesita recargar. A cambio, la tarjeta termina mostrando como se ve el
   * sitio y no su logo sobre un color.
   */
  if (estado !== "no") return captura;

  return await imagenDeclarada(siteUrl);
}
