"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CODE_LENGTH, CodeInput } from "@/components/auth/code-input";
import { Button, ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

/**
 * Pide el codigo del segundo factor para subir la sesion a aal2.
 *
 * Aca llega quien tiene sesion pero todavia no probo el segundo factor. Es una
 * puerta, no una pagina de ajustes: una sola cosa que hacer, sin nada mas
 * alrededor que distraiga o invite a irse por otro lado.
 *
 * Si no tiene ningun factor dado de alta, esto no puede pedirle nada: lo manda
 * a activarlo, que es el unico camino que le queda.
 */

type Estado = { paso: "cargando" } | { paso: "sin-factor" } | { paso: "pide"; factorId: string };

/** El candado del encabezado de la tarjeta. */
function Candado() {
  return (
    <span className="mx-auto grid size-11 place-items-center rounded-full bg-surface-2 text-muted">
      <svg
        viewBox="0 0 20 20"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <rect x="4" y="8.5" width="12" height="8" rx="2" />
        <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function TwoFactorChallenge({ next }: { next: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ paso: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const mirar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.mfa.listFactors();
    const verificado = data?.totp[0];
    setEstado(verificado ? { paso: "pide", factorId: verificado.id } : { paso: "sin-factor" });
  }, []);

  // El estado del factor solo lo sabe Supabase y hay que ir a preguntarlo al
  // montar. Es el caso que la regla no contempla: sincronizar con un sistema
  // externo, no derivar estado de props.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void mirar();
  }, [mirar]);

  const comprobar = useCallback(
    async (factorId: string, code: string) => {
      setError("");
      setOcupado(true);

      const supabase = createClient();
      const { error: fallo } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

      if (fallo) {
        setOcupado(false);
        setCodigo("");
        setError("Ese codigo no es. Fijate que la hora del telefono este al dia y proba con el nuevo.");
        return;
      }

      /*
       * El token nuevo ya dice aal2, pero el servidor todavia sirve lo que
       * renderizo con el viejo: sin refresh, el destino volveria a rebotar.
       */
      router.replace(next);
      router.refresh();
    },
    [next, router],
  );

  /*
   * Al sexto digito se manda solo. El codigo tiene largo fijo y dura menos de
   * un minuto: pedir ademas un clic es hacer perder tiempo contra un reloj.
   */
  function escribir(valor: string, factorId: string) {
    setCodigo(valor);
    if (valor.length === CODE_LENGTH && !ocupado) void comprobar(factorId, valor);
  }

  const marco = "mx-auto w-full max-w-sm rounded-card border border-border bg-surface p-8";

  if (estado.paso === "cargando") {
    return (
      <div className={`${marco} space-y-4`} aria-busy="true">
        <span className="sr-only">Cargando</span>
        <Skeleton className="mx-auto size-11 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (estado.paso === "sin-factor") {
    return (
      <div className={`${marco} text-center`}>
        <Candado />
        <h1 className="mt-4 text-lg font-semibold">Falta tu segundo factor</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          La administracion pide un codigo de tu telefono, ademas de tu cuenta. Todavia no tenes
          ninguno activo.
        </p>
        <ButtonLink href="/cuenta/2fa" variant="primary" size="lg" className="mt-6 w-full">
          Activarlo
        </ButtonLink>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (codigo.length === CODE_LENGTH) void comprobar(estado.factorId, codigo);
      }}
      noValidate
      className={`${marco} text-center`}
    >
      <Candado />
      <h1 className="mt-4 text-lg font-semibold">Confirma que sos vos</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Escribi el codigo que muestra tu app de autenticacion.
      </p>

      <div className="mt-6">
        <label htmlFor="codigo-2fa" className="sr-only">
          Codigo de seis digitos
        </label>
        <CodeInput
          id="codigo-2fa"
          value={codigo}
          onChange={(valor) => escribir(valor, estado.factorId)}
          invalid={Boolean(error)}
          autoFocus
        />
      </div>

      {/* El hueco se reserva: sin esto la tarjeta pega un salto al fallar. */}
      <p role="alert" className="mt-2 min-h-8 text-xs leading-relaxed text-flag">
        {error}
      </p>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={ocupado}>
        {ocupado ? "Comprobando..." : "Entrar"}
      </Button>
    </form>
  );
}
