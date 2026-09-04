import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CONTROL_BASE, CONTROL_SIZE, type Size } from "./styles";

const FIELD_BASE =
  "w-full border bg-surface text-text placeholder:text-faint " +
  "outline-none transition-[border-color,box-shadow,width] duration-200 ease-brand";

const FIELD_TONE = {
  normal: "border-border hover:border-border-strong focus:border-accent",
  invalid: "border-flag focus:border-flag",
} as const;

type FieldTone = { invalid?: boolean };

function toneFor(invalid?: boolean) {
  return invalid ? FIELD_TONE.invalid : FIELD_TONE.normal;
}

/** Input de una linea. Mismo alto exacto que un Button del mismo tamano. */
export function Input({
  size = "md",
  invalid,
  className,
  ...props
}: { size?: Size } & FieldTone & Omit<ComponentProps<"input">, "size">) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        CONTROL_SIZE[size],
        FIELD_BASE,
        toneFor(invalid),
        "justify-start",
        className,
      )}
    />
  );
}

/** Input con icono adentro; el icono no roba el click. */
export function SearchInput({
  size = "md",
  invalid,
  className,
  ...props
}: { size?: Size } & FieldTone & Omit<ComponentProps<"input">, "size">) {
  return (
    <span className="relative block">
      <input
        type="search"
        {...props}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          CONTROL_SIZE[size],
          FIELD_BASE,
          toneFor(invalid),
          "justify-start pl-9",
          className,
        )}
      />
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="9" cy="9" r="6" />
        <path d="M13.5 13.5L17 17" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Area de texto: hereda borde y foco, no el alto fijo. */
export function Textarea({
  invalid,
  className,
  ...props
}: FieldTone & ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        FIELD_BASE,
        toneFor(invalid),
        "resize-y rounded-control px-4 py-2.5 text-sm",
        className,
      )}
    />
  );
}

/** Select nativo con el mismo alto y borde que el resto de los controles. */
export function Select({
  size = "md",
  invalid,
  className,
  children,
  ...props
}: { size?: Size } & FieldTone & Omit<ComponentProps<"select">, "size">) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL_BASE,
        CONTROL_SIZE[size],
        FIELD_BASE,
        toneFor(invalid),
        "cursor-pointer appearance-none justify-start pr-9",
        className,
      )}
    >
      {children}
    </select>
  );
}

/**
 * Envoltorio de cualquier campo: etiqueta, texto de apoyo y error.
 *
 * El texto de apoyo y el de error ocupan el mismo lugar y se anuncian por
 * `aria-describedby`, asi no hace falta el globo nativo del navegador (ese
 * "Please fill out this field" que ademas sale siempre en ingles).
 */
export function Field({
  label,
  support,
  error,
  optional,
  htmlFor,
  children,
}: {
  label: string;
  support?: ReactNode;
  error?: string;
  optional?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  const describedBy = htmlFor ? `${htmlFor}-support` : undefined;

  return (
    <div className="block">
      <label htmlFor={htmlFor} className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        {optional ? <span className="text-xs text-faint">opcional</span> : null}
      </label>

      <div className="mt-1.5" aria-describedby={describedBy}>
        {children}
      </div>

      {error || support ? (
        <p
          id={describedBy}
          role={error ? "alert" : undefined}
          className={cn(
            "mt-1.5 text-xs leading-relaxed",
            error ? "text-flag" : "text-muted",
          )}
        >
          {error ?? support}
        </p>
      ) : null}
    </div>
  );
}
