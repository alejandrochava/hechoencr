"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

const MIN = 8;

/**
 * Define o cambia la contrasena. Nadie elige una al registrarse: se entra con
 * el enlace del correo y despues, si se quiere, se pone una desde aca.
 */
export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { show } = useToast();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < MIN) {
      setError(`Al menos ${MIN} caracteres.`);
      return;
    }
    if (password !== repeat) {
      setError("Las dos contrasenas no coinciden.");
      return;
    }

    setError("");
    setBusy(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setRepeat("");
    show("Contrasena guardada. Ya podes entrar con ella.");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10 max-w-sm space-y-6">
      <Field
        label="Nueva contrasena"
        htmlFor="clave"
        error={error}
        support={`Minimo ${MIN} caracteres.`}
      >
        <Input
          id="clave"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          invalid={Boolean(error)}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Repetila" htmlFor="clave2">
        <Input
          id="clave2"
          type="password"
          value={repeat}
          onChange={(event) => setRepeat(event.target.value)}
          autoComplete="new-password"
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {busy ? "Guardando..." : "Guardar contrasena"}
      </Button>
    </form>
  );
}
