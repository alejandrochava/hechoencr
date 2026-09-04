/**
 * Recetas compartidas por todos los controles.
 *
 * Los valores no viven aca: `h-control-md`, `rounded-control` y `ease-brand`
 * salen de los tokens de src/styles/theme.css. Este archivo solo decide que
 * token le toca a cada tamano y a cada variante, para que un boton md, un
 * input md y un dropdown md midan exactamente lo mismo.
 */

export type Size = "sm" | "md" | "lg";
export type Variant = "primary" | "secondary" | "ghost" | "accent" | "overlay";

export const CONTROL_BASE =
  "inline-flex items-center justify-center whitespace-nowrap rounded-control font-medium " +
  "transition-[color,background-color,border-color,transform,opacity] duration-200 ease-brand " +
  "disabled:pointer-events-none disabled:opacity-55";

export const CONTROL_SIZE: Record<Size, string> = {
  sm: "h-control-sm gap-1.5 px-3 text-[13px]",
  md: "h-control-md gap-2 px-4 text-sm",
  lg: "h-control-lg gap-2 px-6 text-[15px]",
};

/** Mismo alto que el control, pero cuadrado: iconos y toggles. */
export const CONTROL_SQUARE: Record<Size, string> = {
  sm: "h-control-sm aspect-square gap-0 px-0",
  md: "h-control-md aspect-square gap-0 px-0",
  lg: "h-control-lg aspect-square gap-0 px-0",
};

export const CONTROL_VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-ink-contrast hover:bg-accent hover:text-accent-contrast active:scale-[0.98]",
  secondary:
    "border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2 active:scale-[0.98]",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  accent: "bg-accent text-accent-contrast hover:bg-accent-strong active:scale-[0.98]",
  overlay:
    "border border-white/20 bg-overlay text-white backdrop-blur-md hover:border-white/40 active:scale-[0.98]",
};

/**
 * Un grupo (tabs, toggle de vista) envuelve items un tamano mas chico y suma
 * su propio padding, de modo que el alto total coincide con el control suelto.
 */
export const GROUP_SHELL: Record<Size, string> = {
  sm: "h-control-sm rounded-control border border-border bg-surface p-[3px]",
  md: "h-control-md rounded-control border border-border bg-surface p-1",
  lg: "h-control-lg rounded-control border border-border bg-surface p-1.5",
};

export const GROUP_ITEM: Record<Size, string> = {
  sm: "h-full rounded-[calc(var(--radius-control)-3px)] px-2.5 text-xs",
  md: "h-full rounded-[calc(var(--radius-control)-4px)] px-3.5 text-sm",
  lg: "h-full rounded-[calc(var(--radius-control)-6px)] px-4 text-[15px]",
};
