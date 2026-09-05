import type { MetadataRoute } from "next";

import { getSitemapEntries } from "@/lib/queries";
import { site } from "@/lib/site";

/**
 * El mapa del sitio. Sin esto un buscador solo encuentra la portada: las fichas
 * no estan enlazadas desde ningun lado estable, aparecen y se van del feed
 * segun como este ordenado.
 *
 * Se rearma cada hora en vez de en cada visita: publicar un proyecto no tiene
 * por que costar dos consultas a la base cada vez que pasa un robot.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects, handles } = await getSitemapEntries();
  const now = new Date();

  const fixed: MetadataRoute.Sitemap = [
    { url: site.url, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${site.url}/publicar`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${site.url}/contacto`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.url}/privacidad`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${site.url}/terminos`, changeFrequency: "yearly", priority: 0.2 },
  ];

  return [
    ...fixed,
    ...projects.map((project) => ({
      url: `${site.url}/p/${project.slug}`,
      lastModified: new Date(project.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...handles.map((handle) => ({
      url: `${site.url}/u/${handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
  ];
}
