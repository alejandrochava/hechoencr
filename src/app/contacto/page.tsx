import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Ayuda y contacto",
  description: "Escribinos si algo no funciona o si se te ocurre como mejorar el directorio.",
};

export default async function ContactoPage({ searchParams }: PageProps<"/contacto">) {
  const params = await searchParams;
  const kind = typeof params.tipo === "string" ? params.tipo : "ayuda";

  return (
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,7vw,3.5rem)]">Ayuda y contacto</h1>
      <p className="mt-4 max-w-lg leading-relaxed text-muted">
        Si algo no funciona, si te falta algo, o si se te ocurre como mejorar el directorio,
        escribinos. Leemos todo.
      </p>

      <ContactForm defaultKind={kind} />
    </Container>
  );
}
