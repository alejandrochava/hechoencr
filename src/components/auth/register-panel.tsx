"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { checkRegistration } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";

/**
 * Registro en un paso: correo y telefono. La contrasena no se pide aca; se
 * entra con el enlace que llega al correo y despues, si se quiere, se define
 * una desde la cuenta.
 */
export function RegisterPanel({ next, onHaveAccount }: { next: string; onHaveAccount: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState("");

  /*
   * Dos pasos, a proposito: el servidor valida primero (sintaxis, que el
   * dominio reciba correo, telefono tico y que no este ya tomado) y solo
   * despues el navegador pide el enlace. Asi nunca sale un correo hacia una
   * direccion que no existe.
   */
  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    setBusy(true);
    setFailure("");

    const check = await checkRegistration(null, data);
    if (check?.fields) {
      setErrors(check.fields);
      setBusy(false);
      return;
    }
    setErrors({});

    const email = String(data.get("email") ?? "");
    const name = String(data.get("name") ?? "").trim();

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        // El telefono ya viene normalizado a 8 digitos desde la validacion.
        data: { phone: check?.ok || undefined, full_name: name || undefined },
      },
    });

    setBusy(false);
    if (error) setFailure(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="animate-fade">
        <p className="font-medium">Revisa tu correo.</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Te mandamos un enlace para entrar. Con eso queda lista tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field
        label="Correo"
        htmlFor="reg-email"
        error={errors.email}
        support="Aca te llega el enlace para entrar."
      >
        <Input id="reg-email" name="email" type="email" invalid={Boolean(errors.email)} placeholder="vos@correo.com" />
      </Field>

      <Field
        label="Telefono"
        htmlFor="reg-phone"
        error={errors.phone}
        support="Movil de Costa Rica. Sirve para que una persona sea una cuenta."
      >
        <Input id="reg-phone" name="phone" type="tel" invalid={Boolean(errors.phone)} placeholder="8123-4567" />
      </Field>

      <Field label="Nombre" htmlFor="reg-name" optional support="Como queres aparecer en el sitio.">
        <Input id="reg-name" name="name" placeholder="Tu nombre" />
      </Field>

      {failure ? <p className="text-sm text-flag">{failure}</p> : null}

      <Button type="submit" variant="primary" size="lg" disabled={busy} className="w-full">
        {busy ? "Creando cuenta..." : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted">
        Ya tenes cuenta?{" "}
        <button type="button" onClick={onHaveAccount} className="font-medium text-accent-strong underline-offset-2 hover:underline">
          Entrar
        </button>
      </p>
    </form>
  );
}
