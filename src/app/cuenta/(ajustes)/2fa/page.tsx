import type { Metadata } from "next";

import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata: Metadata = { title: "Segundo factor" };

/** El guardia de sesion vive en src/proxy.ts: aca ya hay usuario. */
export default function DosFactoresPage() {
  return (
    <>
      {/* Sin titulo: la pestana de arriba ya dice en cual estamos. */}
      <p className="max-w-lg text-sm leading-relaxed text-muted">
        Un codigo de seis numeros, sacado de una app en tu telefono, que cambia cada rato. La
        administracion lo pide: con la cuenta sola no se entra ahi.
      </p>

      <TwoFactorForm />
    </>
  );
}
