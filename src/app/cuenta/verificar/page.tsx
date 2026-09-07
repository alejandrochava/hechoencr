import type { Metadata } from "next";

import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Confirma que sos vos" };

/**
 * Aca rebota el proxy a quien va a la administracion con sesion pero sin haber
 * probado el segundo factor.
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
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,6vw,3rem)]">Confirma que sos vos</h1>
      <p className="mt-4 max-w-lg leading-relaxed text-muted">
        Escribi el codigo de tu app de autenticacion.
      </p>
      <TwoFactorChallenge next={next} />
    </Container>
  );
}
