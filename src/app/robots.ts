import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

/**
 * Lo que puede rastrear un buscador.
 *
 * Se cierran las rutas con sesion: no llevan a ningun lado sin cookie y no
 * aportan nada a un indice. El resto del sitio es publico a proposito.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/cuenta", "/auth", "/entrar"],
      },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
