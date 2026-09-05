/**
 * Lee una variable tratando el vacio como ausente.
 *
 * `??` solo cubre undefined: si el entorno define la variable en blanco (pasa
 * seguido cuando un secret no existe en CI), el valor vacio se cuela y rompe
 * mas adelante. Aca un string en blanco vale lo mismo que no estar.
 */
function env(name: string, fallback: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

/** Configuracion de marca. Cambiar el nombre aqui lo cambia en todo el sitio. */
export const site = {
  name: "Hecho en CR",
  short: "hechoencr",
  tagline: "El directorio de proyectos hechos en Costa Rica",
  description:
    "Descubri las herramientas, apps y proyectos que se estan construyendo en Costa Rica. Publica el tuyo y vota los que te sirvan.",
  url: env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),
};

/**
 * Categorias fijas. El `value` es lo que se guarda en la base (estable, en
 * minuscula, sirve de slug en la URL); el `label` es lo unico que se muestra.
 */
export const TAGS = [
  { value: "gobierno abierto", label: "Gobierno abierto" },
  { value: "datos", label: "Datos" },
  { value: "utilidades", label: "Utilidades" },
  { value: "dev tools", label: "Dev tools" },
  { value: "open source", label: "Open source" },
  { value: "api", label: "APIs" },
  { value: "saas", label: "SaaS" },
  { value: "finanzas", label: "Finanzas" },
  { value: "movilidad", label: "Movilidad" },
  { value: "mapas", label: "Mapas" },
  { value: "comunidad", label: "Comunidad" },
  { value: "educacion", label: "Educacion" },
  { value: "salud", label: "Salud" },
  { value: "turismo", label: "Turismo" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "ia", label: "IA" },
  { value: "juegos", label: "Juegos" },
] as const;

export const TAG_VALUES = TAGS.map((tag) => tag.value) as readonly string[];

/** Nombre visible de una categoria. Si viene una desconocida, la capitaliza. */
export function tagLabel(value: string) {
  const known = TAGS.find((tag) => tag.value === value);
  if (known) return known.label;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Como se traduce un topic de GitHub a una categoria del directorio.
 *
 * Solo lo que se puede afirmar: un repo con el topic "openapi" es una API, uno
 * con "machine-learning" es IA. Lo que no calza no se fuerza —un "typescript"
 * no dice de que es el proyecto— y quien publica elige a mano.
 */
const TOPIC_ALIASES: Record<string, string> = {
  "open-source": "open source",
  opensource: "open source",
  oss: "open source",
  "developer-tools": "dev tools",
  devtools: "dev tools",
  cli: "dev tools",
  "rest-api": "api",
  openapi: "api",
  graphql: "api",
  "machine-learning": "ia",
  ml: "ia",
  ai: "ia",
  llm: "ia",
  "open-data": "datos",
  data: "datos",
  dataset: "datos",
  "data-visualization": "datos",
  "open-government": "gobierno abierto",
  govtech: "gobierno abierto",
  civictech: "gobierno abierto",
  maps: "mapas",
  gis: "mapas",
  mapping: "mapas",
  fintech: "finanzas",
  finance: "finanzas",
  payments: "finanzas",
  transport: "movilidad",
  transit: "movilidad",
  mobility: "movilidad",
  education: "educacion",
  learning: "educacion",
  health: "salud",
  healthcare: "salud",
  tourism: "turismo",
  travel: "turismo",
  ecommerce: "ecommerce",
  "e-commerce": "ecommerce",
  shop: "ecommerce",
  game: "juegos",
  games: "juegos",
  gamedev: "juegos",
  community: "comunidad",
  utility: "utilidades",
  utilities: "utilidades",
  tools: "utilidades",
  saas: "saas",
};

/** Categorias que se pueden deducir de los topics, sin repetir y hasta tres. */
export function tagsFromTopics(topics: readonly string[]): string[] {
  const encontradas: string[] = [];

  for (const topic of topics) {
    const limpio = topic.trim().toLowerCase();
    const candidata = TOPIC_ALIASES[limpio] ?? limpio;

    if (!TAG_VALUES.includes(candidata)) continue;
    if (encontradas.includes(candidata)) continue;

    encontradas.push(candidata);
    if (encontradas.length === 3) break;
  }

  return encontradas;
}

export const SORTS = {
  destacados: {
    label: "Destacados",
    hint: "Votos con peso por antiguedad",
    column: "hot_score",
  },
  nuevos: {
    label: "Nuevos",
    hint: "Lo ultimo que se publico",
    column: "created_at",
  },
  tendencia: {
    label: "Tendencia",
    hint: "Votos de los ultimos 7 dias",
    column: "recent_votes",
  },
  vistos: {
    label: "Mas vistos",
    hint: "Por visitas acumuladas",
    column: "view_count",
  },
} as const;

export type SortKey = keyof typeof SORTS;

export function isSortKey(value: string | undefined): value is SortKey {
  return !!value && value in SORTS;
}
