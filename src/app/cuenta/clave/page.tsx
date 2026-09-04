import type { Metadata } from "next";

import { PasswordForm } from "@/components/auth/password-form";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Tu contrasena" };

/** El guardia de sesion vive en src/proxy.ts: aca ya hay usuario. */
export default function ClavePage() {
  return (
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,6vw,3rem)]">Tu contrasena</h1>
      <p className="mt-4 max-w-lg leading-relaxed text-muted">
        No hace falta tener una: siempre podes entrar con el enlace que te mandamos al correo.
        Ponerle contrasena solo hace mas rapido volver.
      </p>
      <PasswordForm />
    </Container>
  );
}
