import type { Metadata } from "next";

import { PasswordForm } from "@/components/auth/password-form";

export const metadata: Metadata = { title: "Tu contrasena" };

/** El guardia de sesion vive en src/proxy.ts: aca ya hay usuario. */
export default function ClavePage() {
  return (
    <>
      {/* Sin titulo: la pestana de arriba ya dice en cual estamos. */}
      <p className="max-w-lg text-sm leading-relaxed text-muted">
        No hace falta tener una: siempre podes entrar con el enlace que te mandamos al correo.
        Ponerle contrasena solo hace mas rapido volver.
      </p>

      <PasswordForm />
    </>
  );
}
