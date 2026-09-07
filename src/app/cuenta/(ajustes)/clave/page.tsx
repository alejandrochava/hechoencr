import type { Metadata } from "next";

import { PasswordForm } from "@/components/auth/password-form";

export const metadata: Metadata = { title: "Tu contrasena" };

/** El guardia de sesion vive en src/proxy.ts: aca ya hay usuario. */
export default function ClavePage() {
  return (
    <>
      <h2 className="text-lg font-semibold">Contrasena</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
        No hace falta tener una: siempre podes entrar con el enlace que te mandamos al correo.
        Ponerle contrasena solo hace mas rapido volver.
      </p>

      <PasswordForm />
    </>
  );
}
