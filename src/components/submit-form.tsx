"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useAuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import { LinkFields } from "@/components/link-fields";
import { Field, Input, Textarea } from "@/components/ui/field";
import { submitProject } from "@/lib/actions";
import { cn } from "@/lib/cn";
import { TAGS } from "@/lib/site";
import type { ProjectLink } from "@/lib/text";
import type { ActionState } from "@/lib/types";

const MAX_TAGS = 3;
const DRAFT_KEY = "borrador-proyecto";

type Draft = {
  links: ProjectLink[];
  name: string;
  tagline: string;
  url: string;
  repo_url: string;
  description: string;
  tags: string[];
  is_mine: boolean;
};

const EMPTY: Draft = {
  links: [],
  name: "",
  tagline: "",
  url: "",
  repo_url: "",
  description: "",
  tags: [],
  is_mine: true,
};

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

export function SubmitForm({ authenticated }: { authenticated: boolean }) {
  const { openLogin } = useAuthModal();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(submitProject, null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const form = useRef<HTMLFormElement>(null);

  // El borrador vive en el navegador, asi que no existe al renderizar en el
  // servidor: hay que esperar a la hidratacion para leerlo. Es justo el caso
  // que la regla no contempla (sincronizar con un sistema externo al montar).
  useEffect(() => {
    const saved = readDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setDraft(saved);
  }, []);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleTag(tag: string) {
    update(
      "tags",
      draft.tags.includes(tag)
        ? draft.tags.filter((item) => item !== tag)
        : draft.tags.length < MAX_TAGS
          ? [...draft.tags, tag]
          : draft.tags,
    );
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Sin almacenamiento el borrador se pierde, pero el login igual abre.
    }
  }

  /**
   * Sin sesion no se pierde nada de lo escrito: se guarda el borrador, se abre
   * el login sobre esta misma pagina y al volver el formulario se rellena solo.
   */
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (authenticated) return;

    event.preventDefault();
    saveDraft();
    openLogin("/publicar");
  }

  /**
   * Red de seguridad: si la sesion vencio entre que se cargo la pagina y el
   * envio, el servidor avisa y hacemos lo mismo que si nunca hubiera habido
   * sesion. Sin esto el boton no haria nada visible.
   */
  const needsSession = state?.error === "necesita-sesion";
  useEffect(() => {
    if (!needsSession) return;
    saveDraft();
    openLogin("/publicar");
    // saveDraft depende del borrador vigente; se ejecuta al llegar el aviso.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsSession, openLogin]);

  // Al publicar, el servidor redirige a la ficha: el borrador ya no sirve.
  useEffect(() => {
    if (!authenticated) return;
    return () => {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* nada que limpiar */
      }
    };
  }, [authenticated]);

  const errors = state?.fields ?? {};

  return (
    <form
      ref={form}
      action={formAction}
      onSubmit={onSubmit}
      // La validacion la hace el servidor y se muestra debajo de cada campo.
      noValidate
      className="mt-10 space-y-7"
    >
      <Field label="Nombre del proyecto" htmlFor="name" error={errors.name}>
        <Input
          id="name"
          name="name"
          value={draft.name}
          onChange={(event) => update("name", event.target.value)}
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
          onChange={(event) => update("tagline", event.target.value)}
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
          onChange={(event) => update("url", event.target.value)}
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
          onChange={(event) => update("repo_url", event.target.value)}
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
          onChange={(event) => update("description", event.target.value)}
          invalid={Boolean(errors.description)}
        />
      </Field>

      <LinkFields
        links={draft.links}
        onChange={(next) => update("links", next)}
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

      <label className="flex items-start gap-3 rounded-card border border-border p-4">
        <input
          type="checkbox"
          name="is_mine"
          checked={draft.is_mine}
          onChange={(event) => update("is_mine", event.target.checked)}
          className="mt-0.5 size-4 accent-[var(--color-accent)]"
        />
        <span className="text-sm">
          <span className="font-medium">Este proyecto es mio.</span>
          <span className="mt-0.5 block leading-relaxed text-muted">
            Si lo desmarcas, queda publicado como &quot;sin reclamar&quot; y su autor lo puede
            reclamar despues.
          </span>
        </span>
      </label>

      {state?.error && state.error !== "necesita-sesion" ? (
        <p className="text-sm text-flag">{state.error}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Publicando..." : "Publicar proyecto"}
        </Button>
        {!authenticated ? (
          <p className="text-sm text-muted">
            Al publicar te pedimos entrar. Lo que escribiste se guarda.
          </p>
        ) : null}
      </div>
    </form>
  );
}
