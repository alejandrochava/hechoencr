import type { ReactNode } from "react";

import { SectionNav } from "@/components/section-nav";
import { Container } from "@/components/ui/primitives";

/**
 * El marco de los ajustes de la cuenta.
 *
 * Va en un grupo de rutas y no en /cuenta entero porque la pantalla que pide el
 * codigo del segundo factor cuelga del mismo camino, y ahi unas pestanas serian
 * ruido: en ese momento hay una sola cosa que hacer.
 */
export default function AjustesLayout({ children }: { children: ReactNode }) {
  return (
    <Container width="narrow" className="animate-fade py-14">
      <h1 className="display text-[clamp(1.75rem,6vw,2.75rem)]">Tu cuenta</h1>

      <div className="mt-6">
        <SectionNav
          label="Ajustes de la cuenta"
          secciones={[
            { href: "/cuenta/2fa", label: "Segundo factor" },
            { href: "/cuenta/clave", label: "Contrasena" },
          ]}
        />
      </div>

      <div className="mt-10">{children}</div>
    </Container>
  );
}
