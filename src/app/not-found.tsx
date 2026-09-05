import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "No encontramos esta pagina",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <Container width="narrow" className="animate-fade py-24 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="display mt-3 text-[clamp(2rem,6vw,3rem)]">Aca no hay nada</h1>
      <p className="mx-auto mt-4 max-w-md leading-relaxed text-muted">
        La pagina que buscas no existe, o el proyecto que estaba aca se quito del directorio.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/" variant="primary" size="lg">
          Volver al directorio
        </ButtonLink>
        <ButtonLink href="/publicar" size="lg">
          Publicar un proyecto
        </ButtonLink>
      </div>
    </Container>
  );
}
