"use client";

import { useEffect } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

/**
 * Cuando algo revienta dentro de una pagina.
 *
 * Lo que se muestra no dice que fallo: el detalle va a la consola del servidor,
 * que es donde sirve, y a quien esta del otro lado se le ofrece lo unico util,
 * que es reintentar. El `digest` si se muestra, porque es lo que permite
 * cruzar el reporte de alguien con la linea del log.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("error de pagina:", error);
  }, [error]);

  return (
    <Container width="narrow" className="animate-fade py-24 text-center">
      <p className="eyebrow">Algo se rompio</p>
      <h1 className="display mt-3 text-[clamp(2rem,6vw,3rem)]">No pudimos cargar esto</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">
        Fue de nuestro lado, no tuyo. Proba de nuevo; si sigue igual, escribinos desde Ayuda y
        contanos que estabas haciendo.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button variant="primary" size="lg" onClick={reset}>
          Reintentar
        </Button>
        <ButtonLink href="/" size="lg">
          Volver al directorio
        </ButtonLink>
        <ButtonLink href="/contacto" size="lg">
          Ayuda
        </ButtonLink>
      </div>

      {error.digest ? (
        <p className="mt-8 font-mono text-xs text-faint">Referencia: {error.digest}</p>
      ) : null}
    </Container>
  );
}
