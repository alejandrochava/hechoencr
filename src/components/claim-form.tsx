"use client";

import { useActionState, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { claimProject, claimWithGithub } from "@/lib/actions";
import type { ActionState } from "@/lib/types";

type Props = {
  projectId: string;
  slug: string;
  status: "pending" | "approved" | "rejected" | null;
  /** Si el proyecto declara repo de GitHub, se puede verificar solo. */
  repoUrl: string | null;
};

export function ClaimForm({ projectId, slug, status, repoUrl }: Props) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(claimProject, null);
  const [autoState, setAutoState] = useState<ActionState>(null);
  const [verifying, startVerify] = useTransition();

  if (status === "pending" || state?.ok) {
    return (
      <p className="animate-fade text-sm text-muted">
        Tu reclamo esta en revision. Te escribimos apenas lo verifiquemos.
      </p>
    );
  }

  const isGithubRepo = Boolean(repoUrl && /^https?:\/\/(www\.)?github\.com\//i.test(repoUrl));

  return (
    <div className="space-y-5">
      {isGithubRepo ? (
        <div>
          <p className="text-sm font-medium">Verificacion instantanea</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Si el repositorio esta en tu cuenta de GitHub, el proyecto queda a tu nombre al toque.
          </p>
          <Button
            className="mt-3"
            disabled={verifying}
            onClick={() =>
              startVerify(async () => setAutoState(await claimWithGithub(projectId, slug)))
            }
          >
            <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {verifying ? "Verificando..." : "Verificar con GitHub"}
          </Button>
          {autoState?.error ? (
            <p className="mt-2 text-sm leading-relaxed text-flag">{autoState.error}</p>
          ) : null}
          {autoState?.ok ? (
            <p className="mt-2 text-sm text-accent-strong">{autoState.ok}</p>
          ) : null}
        </div>
      ) : null}

      <details className="group">
        <summary className="cursor-pointer list-none">
          <span className="font-medium">Este es mi proyecto</span>
          <span className="mt-1 block text-sm leading-relaxed text-muted">
            {isGithubRepo
              ? "O mandanos el reclamo y lo revisamos a mano."
              : "Reclamalo para editarlo y aparecer como su autor."}
          </span>
          <span className="mt-3 inline-flex h-control-md items-center rounded-control border border-border px-4 text-sm font-medium transition-colors duration-200 ease-brand hover:border-border-strong group-open:hidden">
            Reclamar
          </span>
        </summary>

        <form action={formAction} noValidate className="animate-fade mt-5 space-y-5">
          <input type="hidden" name="project_id" value={projectId} />
          <input type="hidden" name="slug" value={slug} />

          <Field
            label="Como verificamos que es tuyo"
            htmlFor="evidence"
            support="Un correo del dominio, tu usuario de GitHub del repo, o donde aparecés como autor."
          >
            <Textarea
              id="evidence"
              name="evidence"
              required
              minLength={10}
              rows={3}
              className="w-full"
              placeholder="Soy el autor, mi GitHub es @usuario y el repo esta en mi cuenta."
            />
          </Field>

          <Field
            label="Contacto"
            htmlFor="contact"
            optional
            support="Correo o usuario donde te podemos escribir."
          >
            <Input id="contact" name="contact" type="text" placeholder="vos@tudominio.cr" />
          </Field>

          {state?.error ? <p className="text-sm text-flag">{state.error}</p> : null}

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Enviando..." : "Enviar reclamo"}
          </Button>
        </form>
      </details>
    </div>
  );
}
