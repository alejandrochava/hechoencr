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
