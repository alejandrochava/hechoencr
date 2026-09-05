import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { EditForm } from "@/components/edit-form";
import { Container } from "@/components/ui/primitives";
import { getProject, isCurrentUserAdmin } from "@/lib/queries";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Editar proyecto",
  // Es una pantalla con sesion: no tiene nada que hacer en un indice.
  robots: { index: false, follow: false },
};

export default async function EditarProyectoPage({ params }: PageProps<"/p/[slug]/editar">) {
  const { slug } = await params;

  const [project, user] = await Promise.all([getProject(slug), getCurrentUser()]);
  if (!project) notFound();

  // /entrar es el atajo que el proxy convierte en el modal sobre `next`.
  if (!user) redirect(`/entrar?next=/p/${slug}/editar`);

  // De vuelta a la ficha, no un 403: quien llego aca sin ser el dueno casi
  // siempre es alguien que abrio un enlace viejo, no alguien colandose.
  const isOwner = project.owner?.id === user.id;
  if (!isOwner && !(await isCurrentUserAdmin())) redirect(`/p/${slug}`);

  return (
    <Container width="narrow" className="animate-fade py-16">
      <p className="eyebrow">{project.name}</p>
      <h1 className="display mt-3 text-[clamp(2rem,6vw,3rem)]">Editar la ficha</h1>
      <p className="mt-4 leading-relaxed text-muted">
        Los cambios se ven de una vez en el directorio. El enlace y el repositorio se vuelven a
        comprobar al guardar, igual que al publicar.
      </p>

      <EditForm
        slug={project.slug}
        initial={{
          name: project.name,
          tagline: project.tagline,
          url: project.url,
          repo_url: project.repo_url ?? "",
          description: project.description ?? "",
          tags: [...project.tags],
          links: [...project.links],
        }}
      />
    </Container>
  );
}
