"use client";

import { useActionState, useState } from "react";

import { ProjectFields, type ProjectDraft } from "@/components/project-fields";
import { Button, ButtonLink } from "@/components/ui/button";
import { updateProject } from "@/lib/actions";
import type { ActionState } from "@/lib/types";

/**
 * Editar una ficha ya publicada.
 *
 * No guarda borrador en el navegador, a diferencia de publicar: aca lo que hay
 * en pantalla ya esta guardado en la base, asi que un borrador local solo
 * podria confundir mostrando cambios viejos como si fueran los vigentes.
 */
export function EditForm({ slug, initial }: { slug: string; initial: ProjectDraft }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProject, null);
  const [draft, setDraft] = useState<ProjectDraft>(initial);

  const errors = state?.fields ?? {};

  return (
    <form action={formAction} noValidate className="mt-10 space-y-7">
      <input type="hidden" name="slug" value={slug} />

      <ProjectFields
        draft={draft}
        errors={errors}
        onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
      />

      {state?.error && state.error !== "necesita-sesion" ? (
        <p className="text-sm text-flag">{state.error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Guardando..." : "Guardar cambios"}
        </Button>
        <ButtonLink href={`/p/${slug}`} size="lg">
          Cancelar
        </ButtonLink>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        La direccion de la ficha no cambia aunque cambies el nombre: /p/{slug} puede estar
        compartida o indexada, y renombrar no deberia romper un enlace que alguien ya mando.
      </p>
    </form>
  );
}
