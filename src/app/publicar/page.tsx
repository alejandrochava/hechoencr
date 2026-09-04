import type { Metadata } from "next";

import { SubmitForm } from "@/components/submit-form";
import { Container } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Publicar proyecto",
  description: "Sumá tu proyecto al directorio.",
};

/**
 * La pagina es publica a proposito: se puede llenar el formulario sin cuenta y
 * el login aparece recien al publicar, con el borrador ya guardado.
 */
export default async function PublicarPage() {
  const user = isSupabaseConfigured ? await getCurrentUser() : null;

  return (
    <Container width="narrow" className="animate-fade py-16">
      <h1 className="display text-[clamp(2rem,7vw,3.5rem)]">Publicar un proyecto</h1>
      <p className="mt-4 leading-relaxed text-muted">
        Puede ser tuyo o de alguien mas. Si es de otra persona, queda &quot;sin reclamar&quot; hasta
        que su autor lo reclame.
      </p>

      <SubmitForm authenticated={Boolean(user)} />
    </Container>
  );
}
