import type { Metadata } from "next";

import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Segundo factor" };

/** El guardia de sesion vive en src/proxy.ts: aca ya hay usuario. */
export default function DosFactoresPage() {
  return (
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,6vw,3rem)]">Segundo factor</h1>
      <p className="mt-4 max-w-lg leading-relaxed text-muted">
        Un codigo de seis numeros que cambia cada rato, sacado de una app en tu telefono. La
        administracion lo pide: con la cuenta sola no alcanza para entrar ahi.
      </p>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        Si perdes el telefono perdes el acceso a la administracion, y volver pasa por el panel de
        Supabase. Guarda el codigo de respaldo en algun lado antes de salir de esta pagina.
      </p>
      <TwoFactorForm />
    </Container>
  );
}
