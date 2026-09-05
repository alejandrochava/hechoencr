import "server-only";

import { isPublicHttpUrl } from "@/lib/text";

/**
 * Vista previa de un proyecto, en cascada:
 *   1. la og:image que el sitio ya declara (la mejor, la eligio su autor),
 *   2. un screenshot automatico del sitio,
 *   3. nada, y la tarjeta dibuja un monograma.
 */

const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 512 * 1024;

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

export async function findPreviewImage(siteUrl: string): Promise<string | null> {
  if (!isPublicHttpUrl(siteUrl)) return null;

  try {
    const response = await fetch(siteUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        // Sin un user agent normal varios sitios devuelven 403.
        "user-agent": "Mozilla/5.0 (compatible; HechoEnCR/1.0; +https://hechoencr.cr)",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return screenshotUrl(siteUrl);

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("html")) return screenshotUrl(siteUrl);

    // Solo necesitamos el <head>, no bajamos la pagina entera.
    const html = (await response.text()).slice(0, MAX_HTML_BYTES);
    const found = extractMetaImage(html);
    if (!found) return screenshotUrl(siteUrl);

    const absolute = new URL(found, response.url).toString();
    return isPublicHttpUrl(absolute) ? absolute : screenshotUrl(siteUrl);
  } catch {
    // Sitio caido, lento o que bloquea bots: igual mostramos algo.
    return screenshotUrl(siteUrl);
  }
}
