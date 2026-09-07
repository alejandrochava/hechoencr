import type { Metadata } from "next";

import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Confirma que sos vos" };

/**
 * Aca rebota el proxy a quien va a la administracion con sesion pero sin haber
 * probado el segundo factor.
 *
 * La pantalla no lleva titulo ni nada alrededor: el encabezado vive dentro de
 * la tarjeta. Es un paso intermedio de medio segundo, no una pagina para
 * quedarse.
 */
export default async function VerificarPage({ searchParams }: PageProps<"/cuenta/verificar">) {
  const params = await searchParams;

  /*
   * El destino viene de la URL, asi que solo se acepta una ruta de este sitio:
   * sin esto, un enlace preparado podria mandar a alguien afuera despues de
   * escribir su codigo.
   */
  const crudo = typeof params.next === "string" ? params.next : "";
  const next = crudo.startsWith("/") && !crudo.startsWith("//") ? crudo : "/admin/reclamos";

  return (
    <Container width="narrow" className="animate-fade flex min-h-[70vh] items-center py-16">
      <TwoFactorChallenge next={next} />
    </Container>
  );
}
