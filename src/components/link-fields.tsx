"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { MAX_PROJECT_LINKS, type ProjectLink } from "@/lib/text";

/**
 * Enlaces extra del proyecto: docs, demo, changelog, lo que quiera sumar quien
 * publica. Es opcional; se guarda como JSON en la ficha.
 */
export function LinkFields({
  links,
  onChange,
  error,
}: {
  links: ProjectLink[];
  onChange: (next: ProjectLink[]) => void;
  /** Lo que el servidor encontro mal; nombra los enlaces por su etiqueta. */
  error?: string;
}) {
  function update(index: number, patch: Partial<ProjectLink>) {
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium">Enlaces extra</legend>
      <p className="mt-1 text-xs text-muted">
        Opcional. Documentacion, demo, changelog: hasta {MAX_PROJECT_LINKS}.
      </p>

      <div className="mt-3 space-y-2">
        {links.map((link, index) => (
          /*
           * El ancho lo pone la fila, no los inputs.
           *
           * Un Input ya trae w-full en su base, y cn() solo concatena: no
           * resuelve conflictos de Tailwind, asi que un w-1/3 pasado por
           * className no lo pisa —entre dos utilidades del mismo tipo gana el
           * orden del CSS, no el del atributo—. El nombre quedaba al 100% y la
           * direccion, con flex-1 y base 0, aplastada a nada.
           */
          <div key={index} className="flex gap-2">
            <div className="w-1/3">
              <Input
                aria-label={`Nombre del enlace ${index + 1}`}
                value={link.label}
                maxLength={40}
                onChange={(event) => update(index, { label: event.target.value })}
                placeholder="Documentacion"
              />
            </div>
            <div className="flex-1">
              <Input
                aria-label={`Direccion del enlace ${index + 1}`}
                value={link.url}
                onChange={(event) => update(index, { url: event.target.value })}
                placeholder="https://docs.tuproyecto.cr"
              />
            </div>
            <Button
              type="button"
              icon
              variant="ghost"
              aria-label={`Quitar el enlace ${index + 1}`}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </Button>
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs leading-relaxed text-flag">
          {error}
        </p>
      ) : null}

      {links.length < MAX_PROJECT_LINKS ? (
        <Button
          type="button"
          size="sm"
          className="mt-3"
          onClick={() => onChange([...links, { label: "", url: "" }])}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
          </svg>
          Agregar enlace
        </Button>
      ) : null}

      {/* El servidor recibe el JSON y lo vuelve a validar. */}
      <input type="hidden" name="links" value={JSON.stringify(links)} />
    </fieldset>
  );
}
