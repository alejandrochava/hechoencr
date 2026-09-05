"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useAuthModal } from "@/components/auth/auth-modal";
import { EMPTY_DRAFT, ProjectFields, type ProjectDraft } from "@/components/project-fields";
import { Button } from "@/components/ui/button";
import { submitProject } from "@/lib/actions";
import type { ActionState } from "@/lib/types";

const DRAFT_KEY = "borrador-proyecto";

/** Lo del proyecto, mas lo que solo existe al publicar. */
type Draft = ProjectDraft & { is_mine: boolean };

const EMPTY: Draft = { ...EMPTY_DRAFT, is_mine: true };

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

  function patch(changes: Partial<ProjectDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
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
      <ProjectFields draft={draft} errors={errors} onChange={patch} />

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
