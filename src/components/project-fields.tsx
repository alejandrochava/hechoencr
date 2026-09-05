"use client";

import { LinkFields } from "@/components/link-fields";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { TAGS } from "@/lib/site";
import type { ProjectLink } from "@/lib/text";

export const MAX_TAGS = 3;

/** Lo que describe a un proyecto y se puede escribir en un formulario. */
export type ProjectDraft = {
  name: string;
  tagline: string;
  url: string;
  repo_url: string;
  description: string;
  tags: string[];
  links: ProjectLink[];
};

export const EMPTY_DRAFT: ProjectDraft = {
  name: "",
  tagline: "",
  url: "",
  repo_url: "",
  description: "",
  tags: [],
  links: [],
};

/**
 * Los campos de un proyecto, sin saber si se esta publicando o editando.
 *
 * Viven aparte porque las dos pantallas piden exactamente lo mismo y el
 * servidor las valida con la misma funcion: si los textos de ayuda o los
 * limites se escribieran dos veces, se irian separando solos.
 *
 * Lo que no esta aca es lo propio de cada flujo: el borrador en el navegador y
 * "este proyecto es mio" solo tienen sentido al publicar.
 */
export function ProjectFields({
  draft,
  errors,
  onChange,
}: {
  draft: ProjectDraft;
  errors: Record<string, string>;
  /** Recibe solo lo que cambio; quien lo use decide como lo mezcla. */
  onChange: (patch: Partial<ProjectDraft>) => void;
}) {
  function toggleTag(tag: string) {
    onChange({
      tags: draft.tags.includes(tag)
        ? draft.tags.filter((item) => item !== tag)
        : draft.tags.length < MAX_TAGS
          ? [...draft.tags, tag]
          : draft.tags,
    });
  }

  return (
    <>
      <Field label="Nombre del proyecto" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          name="name"
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          invalid={Boolean(errors.name)}
          placeholder="Consulta de Placas"
        />
      </Field>

      <Field
        label="En una linea"
        htmlFor="tagline"
        error={errors.tagline}
        support={`${draft.tagline.length}/140 · es lo que se lee en la lista`}
      >
        <Input
          id="tagline"
          name="tagline"
          maxLength={140}
          value={draft.tagline}
          onChange={(event) => onChange({ tagline: event.target.value })}
          invalid={Boolean(errors.tagline)}
          placeholder="Escribis la placa y te devuelve el historial del vehiculo."
        />
      </Field>

      <Field
        label="Enlace"
        htmlFor="url"
        error={errors.url}
        support="El sitio donde la gente lo puede usar. Tiene que estar arriba y cargar por https."
      >
        <Input
          id="url"
          name="url"
          value={draft.url}
          onChange={(event) => onChange({ url: event.target.value })}
          invalid={Boolean(errors.url)}
          placeholder="https://tuproyecto.cr"
        />
      </Field>

      <Field
        label="Repositorio"
        htmlFor="repo_url"
        optional
        error={errors.repo_url}
        support="GitHub, GitLab, Bitbucket, Codeberg o SourceHut. Si el repo esta en tu cuenta de GitHub, podes verificar el proyecto al instante."
      >
        <Input
          id="repo_url"
          name="repo_url"
          value={draft.repo_url}
          onChange={(event) => onChange({ repo_url: event.target.value })}
          invalid={Boolean(errors.repo_url)}
          placeholder="https://github.com/usuario/repo"
        />
      </Field>

      <Field
        label="Descripcion"
        htmlFor="description"
        optional
        error={errors.description}
        support="Que hace, para quien es, que lo hace distinto."
      >
        <Textarea
          id="description"
          name="description"
          rows={5}
          maxLength={4000}
          className="w-full"
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          invalid={Boolean(errors.description)}
        />
      </Field>

      <LinkFields
        links={draft.links}
        onChange={(next) => onChange({ links: next })}
        error={errors.links}
      />

      <fieldset>
        <legend className="text-sm font-medium">Categorias</legend>
        <p className={cn("mt-1 text-xs", errors.tags ? "text-flag" : "text-muted")}>
          {errors.tags ?? `Elegi hasta ${MAX_TAGS}.`}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const active = draft.tags.includes(tag.value);
            return (
              <button
                type="button"
                key={tag.value}
                onClick={() => toggleTag(tag.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors duration-200 ease-brand",
                  active
                    ? "bg-accent-soft text-accent-strong"
                    : "bg-surface-2 text-muted hover:text-text",
                )}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
        {draft.tags.map((tag) => (
          <input key={tag} type="hidden" name="tags" value={tag} />
        ))}
      </fieldset>
    </>
  );
}
