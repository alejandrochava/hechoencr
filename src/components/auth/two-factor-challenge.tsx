"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/client";

/**
 * Pide el codigo del segundo factor para subir la sesion a aal2.
 *
 * Aca llega quien tiene sesion pero todavia no probo el segundo factor. Si no
 * tiene ninguno dado de alta, esto no puede pedirle nada: lo manda a activarlo,
 * que es el unico camino que le queda.
 */

const CODE_LENGTH = 6;

type Estado = { paso: "cargando" } | { paso: "sin-factor" } | { paso: "pide"; factorId: string };

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

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (estado.paso !== "pide") return;

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

    if (fallo) {
      setOcupado(false);
      setError("Ese codigo no es. Fijate que la hora del telefono este al dia y proba con el nuevo.");
      return;
    }

    /*
     * El token nuevo ya dice aal2, pero el servidor todavia sirve lo que
     * renderizo con el viejo: sin refresh, el destino volveria a rebotar.
     */
    router.replace(next);
    router.refresh();
  }

  if (estado.paso === "cargando") {
    return (
      <div className="mt-10 max-w-sm space-y-3" aria-busy="true">
        <span className="sr-only">Cargando</span>
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  if (estado.paso === "sin-factor") {
    return (
      <div className="mt-10 max-w-lg space-y-4">
        <p className="text-sm leading-relaxed">
          Todavia no tenes un segundo factor. La administracion lo pide, asi que hay que activarlo
          antes de entrar.
        </p>
        <ButtonLink href="/cuenta/2fa" variant="primary" size="lg">
          Activar el segundo factor
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-10 max-w-sm space-y-6">
      <Field
        label="Codigo de tu app"
        htmlFor="codigo-2fa"
        error={error}
        support={`${CODE_LENGTH} numeros.`}
      >
        <Input
          id="codigo-2fa"
          value={codigo}
          onChange={(event) =>
            setCodigo(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
          }
          invalid={Boolean(error)}
          inputMode="numeric"
          autoComplete="one-time-code"
        />
      </Field>

      <Button type="submit" variant="primary" size="lg" disabled={ocupado}>
        {ocupado ? "Comprobando..." : "Entrar"}
      </Button>
    </form>
  );
}
