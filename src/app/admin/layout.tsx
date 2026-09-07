import type { ReactNode } from "react";

import { SectionNav } from "@/components/section-nav";
import { Container } from "@/components/ui/primitives";
import { getMessages, getPendingClaims } from "@/lib/queries";

/**
 * El marco de la administracion: un solo encabezado y las secciones a la vista,
 * con lo que hay pendiente en cada una.
 *
 * Antes eran dos paginas sueltas, cada una con un enlace a la otra al lado del
 * titulo, y para saber si habia un reclamo esperando habia que entrar a mirar.
 *
 * Las dos consultas estan cacheadas, asi que el numerito no cuesta una consulta
 * extra: es la misma que despues usa la lista.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [claims, messages] = await Promise.all([getPendingClaims(), getMessages()]);
  const sinAtender = messages.filter((message) => !message.handled).length;

  return (
    <Container width="narrow" className="animate-fade py-14">
      <h1 className="display text-[clamp(1.75rem,6vw,2.75rem)]">Administracion</h1>

      <div className="mt-6">
        <SectionNav
          label="Secciones de la administracion"
          secciones={[
            { href: "/admin/reclamos", label: "Reclamos", cuenta: claims.length },
            { href: "/admin/mensajes", label: "Mensajes", cuenta: sinAtender },
          ]}
        />
      </div>

      <div className="mt-10">{children}</div>
    </Container>
  );
}
