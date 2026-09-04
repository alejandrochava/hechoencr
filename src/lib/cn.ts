/** Une clases ignorando falsos. Lo unico que hacen los componentes con strings. */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
