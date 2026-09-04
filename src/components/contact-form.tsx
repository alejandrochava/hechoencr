"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

import { sendMessage } from "@/lib/actions";
import type { ActionState } from "@/lib/types";

const KINDS = [
  { value: "ayuda", label: "Necesito ayuda" },
  { value: "sugerencia", label: "Tengo una sugerencia" },
  { value: "contacto", label: "Otra cosa" },
] as const;

export function ContactForm({ defaultKind = "ayuda" }: { defaultKind?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(sendMessage, null);
  // "Enviado" se deriva del resultado; el estado propio solo sirve para volver
  // a mostrar el formulario si la persona quiere escribir otra vez.
  const [reopened, setReopened] = useState(false);
  const { show } = useToast();
  const sent = Boolean(state?.ok) && !reopened;

  const ok = state?.ok;
  useEffect(() => {
    if (ok) show(ok);
  }, [ok, show]);

  const errors = state?.fields ?? {};

  if (sent) {
    return (
      <div className="animate-fade mt-10 border-t border-border/70 pt-8">
        <p className="font-medium">Gracias, ya nos llego.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Te respondemos al correo que dejaste apenas podamos.
        </p>
        <Button className="mt-5" onClick={() => setReopened(true)}>
          Escribir otro mensaje
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="mt-10 space-y-7">
      <Field label="De que se trata" htmlFor="kind">
        <div className="relative">
          <Select id="kind" name="kind" defaultValue={defaultKind}>
            {KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </Select>
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </Field>

      <Field label="Tu nombre" htmlFor="name" error={errors.name}>
        <Input id="name" name="name" invalid={Boolean(errors.name)} placeholder="Como te llamas" />
      </Field>

      <Field
        label="Tu correo"
        htmlFor="email"
        error={errors.email}
        support="Solo lo usamos para responderte."
      >
        <Input
          id="email"
          name="email"
          type="email"
          invalid={Boolean(errors.email)}
          placeholder="vos@correo.com"
        />
      </Field>

      <Field label="Mensaje" htmlFor="body" error={errors.body}>
        <Textarea
          id="body"
          name="body"
          rows={6}
          maxLength={4000}
          className="w-full"
          invalid={Boolean(errors.body)}
          placeholder="Contanos que pasa o que se te ocurre."
        />
      </Field>

      {state?.error ? <p className="text-sm text-flag">{state.error}</p> : null}

      <Button type="submit" variant="primary" size="lg" disabled={pending}>
        {pending ? "Enviando..." : "Enviar mensaje"}
      </Button>
    </form>
  );
}
