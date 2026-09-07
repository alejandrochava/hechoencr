import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Etiqueta de categoria o estado. Sin caja pesada: solo un tono de fondo. */
export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "outline" | "overlay";
  className?: string;
}) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-soft text-accent-strong",
    outline: "border border-dashed border-border-strong text-muted",
    overlay: "bg-overlay text-white backdrop-blur-md",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Bloque de carga. Respira en vez de parpadear. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-media bg-surface-2", className)} />;
}

/** Fila etiqueta / valor, separada por una linea apenas visible. */
export function DataRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-border/70 py-2.5 last:border-b-0",
        className,
      )}
    >
      <dt className="eyebrow">{label}</dt>
      <dd className="text-right text-[13px]">{children}</dd>
    </div>
  );
}

const CONTAINER_WIDTH = {
  /** Grillas y barras: todo el viewport disponible. */
  full: "max-w-[120rem]",
  /** Lectura comoda: fichas y paginas de contenido. */
  content: "max-w-6xl",
  /** Formularios. */
  narrow: "max-w-2xl",
  /** Un solo campo, como el login. */
  tight: "max-w-sm",
} as const;

/**
 * Ancho y respiro lateral estandar. El ancho es una prop y no una clase
 * suelta, porque dos utilidades max-w-* compitiendo dependen del orden en que
 * Tailwind las emite, no del orden en que se escriben.
 */
export function Container({
  width = "full",
  className,
  ...props
}: { width?: keyof typeof CONTAINER_WIDTH } & ComponentProps<"div">) {
  return (
    <div {...props} className={cn("mx-auto w-full px-5 sm:px-8", CONTAINER_WIDTH[width], className)} />
  );
}

/**
 * Interruptor de si/no, como una fila de ajustes: el texto a la izquierda y el
 * control a la derecha, que es donde se lo busca en una lista de opciones.
 *
 * Encendido va en tinta y no en el color de acento: en una pagina que por lo
 * demas es blanco y negro, el azul se lleva toda la atencion para algo que no
 * es la accion principal.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 p-4">
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block leading-relaxed text-muted">{description}</span>
        ) : null}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ease-brand",
          checked ? "bg-ink" : "bg-surface-3",
          disabled && "opacity-55",
        )}
      >
        {/*
          left-0 no es decorativo: sin el, `absolute` cae en la posicion
          estatica y los <button> centran su contenido, asi que la perilla
          arrancaba desde el medio del riel y con el translate de encendido se
          salia por la derecha. Los dos desplazamientos se miden desde el borde.

          La perilla cambia de color con el riel: en modo oscuro la tinta es
          casi blanca, y una perilla clara encima desapareceria.
        */}
        <span
          className={cn(
            "absolute left-0 top-0.5 size-5 rounded-full shadow transition-transform duration-200 ease-brand",
            checked ? "bg-ink-contrast translate-x-[1.125rem]" : "bg-knob translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

/**
 * Lo que se ve cuando una lista esta vacia.
 *
 * Una linea gris centrada se lee como si la pagina se hubiera roto. Esto dice
 * que no hay nada **y** que va a aparecer ahi cuando lo haya.
 */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-border-strong px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children ? (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{children}</p>
      ) : null}
    </div>
  );
}
