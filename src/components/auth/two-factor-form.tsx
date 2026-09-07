"use client";

import { useCallback, useEffect, useState } from "react";

import { CODE_LENGTH, CodeInput } from "@/components/auth/code-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

/**
 * Alta y baja del segundo factor (TOTP).
 *
 * El codigo lo genera una app de autenticacion a partir de un secreto que viaja
 * una sola vez, al escanear. Nosotros no lo guardamos ni lo podemos leer: lo
 * custodia Supabase, y lo unico que vuelve en cada sesion es el nivel (`aal`)
 * dentro del token.
 *
 * Quien manda de verdad es `public.is_admin()` en la base, que exige aal2. Esta
 * pantalla solo consigue ese nivel; no es la que autoriza.
 */

type Estado =
  | { paso: "cargando" }
  | { paso: "sin-factor" }
  | { paso: "enrolando"; factorId: string; qr: string; secreto: string }
  | { paso: "listo"; factorId: string };

export function TwoFactorForm() {
  const [estado, setEstado] = useState<Estado>({ paso: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const { show } = useToast();

  const mirar = useCallback(async () => {
    const supabase = createClient();
    const { data, error: fallo } = await supabase.auth.mfa.listFactors();

    if (fallo || !data) {
      setError(fallo?.message ?? "No pudimos leer el estado de tu segundo factor.");
      setEstado({ paso: "sin-factor" });
      return;
    }

    const verificado = data.totp[0];
    setEstado(verificado ? { paso: "listo", factorId: verificado.id } : { paso: "sin-factor" });
  }, []);

  // El estado del factor solo lo sabe Supabase y hay que ir a preguntarlo al
  // montar. Es el caso que la regla no contempla: sincronizar con un sistema
  // externo, no derivar estado de props.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void mirar();
  }, [mirar]);

  async function activar() {
    setError("");
    setOcupado(true);
    const supabase = createClient();

    /*
     * Un intento abandonado deja un factor a medias, y Supabase no deja enrolar
     * dos con el mismo nombre. Se limpia lo que quedo colgando antes de pedir
     * uno nuevo, o el segundo intento falla sin que se entienda por que.
     */
    const { data: previos } = await supabase.auth.mfa.listFactors();
    for (const factor of previos?.all ?? []) {
      if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error: fallo } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Hecho en CR",
    });
    setOcupado(false);

    if (fallo || !data) {
      setError(fallo?.message ?? "No pudimos empezar el alta.");
      return;
    }

    setCodigo("");
    setEstado({
      paso: "enrolando",
      factorId: data.id,
      qr: data.totp.qr_code,
      secreto: data.totp.secret,
    });
  }

  async function confirmar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (estado.paso !== "enrolando") return;

    if (codigo.trim().length !== CODE_LENGTH) {
      setError(`El codigo son ${CODE_LENGTH} numeros.`);
      return;
    }

    setError("");
    setOcupado(true);
    const supabase = createClient();
    const { error: fallo } = await supabase.auth.mfa.challengeAndVerify({
      factorId: estado.factorId,
      code: codigo.trim(),
    });
    setOcupado(false);

    if (fallo) {
      setError("Ese codigo no es. Fijate que la hora del telefono este al dia y proba con el nuevo.");
      return;
    }

    setCodigo("");
    setEstado({ paso: "listo", factorId: estado.factorId });
    show("Listo, el segundo factor quedo activo.");
  }

  async function quitar() {
    if (estado.paso !== "listo") return;

    setError("");
    setOcupado(true);
    const supabase = createClient();
    const { error: fallo } = await supabase.auth.mfa.unenroll({ factorId: estado.factorId });
    setOcupado(false);
    setQuitando(false);

    if (fallo) {
      setError(fallo.message);
      return;
    }

    setEstado({ paso: "sin-factor" });
    show("El segundo factor quedo desactivado.");
  }

  if (estado.paso === "cargando") {
    return (
      <div className="mt-6 max-w-sm space-y-3" aria-busy="true">
        <span className="sr-only">Cargando</span>
        <Skeleton className="h-11 w-56" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (estado.paso === "listo") {
    return (
      <div className="mt-6 max-w-lg space-y-4">
        <p className="text-sm leading-relaxed">
          <span className="font-medium">Activo.</span> Antes de dejarte pasar a la administracion
          te vamos a pedir el codigo de tu app.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Si perdes el telefono y no guardaste el codigo de respaldo, se recupera dando de baja el
          factor desde el panel de Supabase.
        </p>

        {error ? <p className="text-sm text-flag">{error}</p> : null}

        {quitando ? (
          <div className="rounded-card border border-border p-4">
            <p className="text-sm leading-relaxed">
              Si lo quitas, para entrar a la administracion vuelve a alcanzar con tu cuenta. Seguro?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={quitar} disabled={ocupado}>
                {ocupado ? "Quitando..." : "Si, quitarlo"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setQuitando(false)}
                disabled={ocupado}
              >
                Dejarlo como esta
              </Button>
            </div>
          </div>
        ) : (
          // El relleno del boton lo correria a la derecha del texto de arriba.
          <Button type="button" variant="ghost" size="sm" className="-ml-3" onClick={() => setQuitando(true)}>
            Quitar el segundo factor
          </Button>
        )}
      </div>
    );
  }

  if (estado.paso === "sin-factor") {
    return (
      <div className="mt-10 max-w-lg space-y-4">
        {error ? <p className="text-sm text-flag">{error}</p> : null}
        <Button type="button" variant="primary" size="lg" onClick={activar} disabled={ocupado}>
          {ocupado ? "Preparando..." : "Activar el segundo factor"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} noValidate className="mt-6 max-w-lg space-y-6">
      <div className="rounded-card border border-border p-5">
        <p className="text-sm leading-relaxed">
          Escanea esto con tu app de autenticacion y despues escribi el codigo que muestre.
        </p>

        {/* Viene de Supabase como SVG en el propio src: no hay archivo que optimizar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={estado.qr}
          alt="Codigo QR para tu app de autenticacion"
          className="mt-4 size-48 rounded-media bg-white p-2"
        />

        <p className="mt-4 text-xs leading-relaxed text-muted">
          Si no podes escanear, escribi este codigo a mano:
        </p>
        <code className="mt-1 block break-all font-mono text-xs text-muted">{estado.secreto}</code>

        {/*
          El aviso va aca y no arriba de todo: recien ahora hay algo concreto
          que guardar, y decirlo antes de empezar solo asusta.
        */}
        <p className="mt-4 border-t border-border/70 pt-4 text-xs leading-relaxed text-muted">
          Guarda ese codigo en algun lado. Si perdes el telefono es lo unico que te devuelve el
          acceso; si no, hay que dar de baja el factor desde el panel de Supabase.
        </p>
      </div>

      <Field
        label="Codigo de tu app"
        htmlFor="codigo-2fa"
        error={error}
        support={`${CODE_LENGTH} numeros.`}
      >
        <CodeInput
          id="codigo-2fa"
          value={codigo}
          onChange={setCodigo}
          invalid={Boolean(error)}
          autoFocus
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" size="lg" disabled={ocupado}>
          {ocupado ? "Comprobando..." : "Confirmar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          onClick={() => {
            setError("");
            setEstado({ paso: "sin-factor" });
          }}
          disabled={ocupado}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
