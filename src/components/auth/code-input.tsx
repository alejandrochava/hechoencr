"use client";

import { Input } from "@/components/ui/field";

/** Los codigos de una app de autenticacion son siempre de seis digitos. */
export const CODE_LENGTH = 6;

/**
 * El campo para el codigo del segundo factor.
 *
 * Se ve como lo que se espera que entre: seis digitos separados, centrados y en
 * monoespaciada. Un campo de texto normal y ancho invita a escribir cualquier
 * cosa, y despues hay que explicar que no.
 *
 * El `indent` compensa el espaciado entre letras, que se aplica tambien despues
 * del ultimo digito y correria todo a la izquierda.
 */
export function CodeInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Input
      id={id}
      size="lg"
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
      invalid={invalid}
      inputMode="numeric"
      autoComplete="one-time-code"
      // El teclado del telefono se abre solo, que es donde esta el codigo.
      autoFocus={autoFocus}
      placeholder="000000"
      className="text-center indent-[0.35em] font-mono text-xl tracking-[0.35em]"
    />
  );
}
