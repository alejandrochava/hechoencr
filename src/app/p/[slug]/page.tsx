import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ClaimForm } from "@/components/claim-form";
import { PersonLine } from "@/components/person-line";
import { ProjectPreview } from "@/components/project-preview";
import { ToastOnParam } from "@/components/toast-on-param";
import { ButtonAnchor } from "@/components/ui/button";
import { Container, DataRow, Tag } from "@/components/ui/primitives";
import { VoteButton } from "@/components/vote-button";
import { getMyClaimStatus, getProject, getVotedIds } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { tagLabel } from "@/lib/site";
import { hostOf } from "@/lib/url";

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return { title: "Proyecto no encontrado" };

  return {
    title: project.name,
    description: project.tagline,
    openGraph: {
      title: project.name,
      description: project.tagline,
      images: project.image_url ? [project.image_url] : undefined,
    },
  };
}

const dateFormat = new Intl.DateTimeFormat("es-CR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function ProjectPage({ params }: PageProps<"/p/[slug]">) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  const [voted, claimStatus] = await Promise.all([
    getVotedIds([project.id]),
    getMyClaimStatus(project.id),
  ]);

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.rpc("register_view", { p_slug: slug });
  }

  return (
    <Container width="content" className="animate-fade py-8">
      <Suspense fallback={null}>
        <ToastOnParam param="publicado" message="Proyecto publicado." />
      </Suspense>


      <Link
        href="/"
        className="eyebrow inline-block transition-colors duration-200 ease-brand hover:text-text"
      >
        ← Directorio
      </Link>

      <div className="group relative mt-6 aspect-[16/9] overflow-hidden rounded-card bg-surface-2 ring-1 ring-border/60">
        <ProjectPreview
          name={project.name}
          slug={project.slug}
          imageUrl={project.image_url}
          priority
        />
        <div className="absolute right-4 top-4">
          <VoteButton
            projectId={project.id}
            slug={project.slug}
            count={project.vote_count}
            voted={voted.has(project.id)}
            size="sm"
            variant="overlay"
          />
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_18rem]">
        <div>
          <h1 className="display text-[clamp(2rem,6vw,3.75rem)]">{project.name}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{project.tagline}</p>

          {project.description ? (
            <div className="mt-8 max-w-xl whitespace-pre-line leading-relaxed">
              {project.description}
            </div>
          ) : null}

          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonAnchor
              href={project.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              variant="primary"
              size="lg"
            >
              Abrir {hostOf(project.url)} ↗
            </ButtonAnchor>
            {project.repo_url ? (
              <ButtonAnchor
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                variant="secondary"
                size="lg"
              >
                Codigo ↗
              </ButtonAnchor>
            ) : null}
          </div>

          {project.links.length > 0 ? (
            <div className="mt-8 border-t border-border/70 pt-6">
              <p className="eyebrow">Mas del proyecto</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {project.links.map((link) => (
                  <li key={link.url}>
                    <ButtonAnchor
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      size="sm"
                    >
                      {link.label} ↗
                    </ButtonAnchor>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <aside>
          <dl>
            <DataRow label="Sitio">
              <span className="font-mono">{hostOf(project.url)}</span>
            </DataRow>
            <DataRow label="Votos">
              <span className="font-mono tabular-nums">{project.vote_count}</span>
            </DataRow>
            <DataRow label="Visitas">
              <span className="font-mono tabular-nums">{project.view_count}</span>
            </DataRow>
            <DataRow label="Publicado">{dateFormat.format(new Date(project.created_at))}</DataRow>
            <DataRow label="Estado">{project.owner ? "Reclamado" : "Sin reclamar"}</DataRow>
            {project.tags.length > 0 ? (
              <DataRow label="Categoria">
                <span className="flex flex-wrap justify-end gap-1.5">
                  {project.tags.map((tag) => (
                    <Link key={tag} href={`/?tag=${encodeURIComponent(tag)}`}>
                      <Tag className="transition-colors duration-200 ease-brand hover:text-accent">
                        {tagLabel(tag)}
                      </Tag>
                    </Link>
                  ))}
                </span>
              </DataRow>
            ) : null}
          </dl>

          <div className="mt-8 space-y-5 border-t border-border/70 pt-6">
            {project.owner ? (
              <PersonLine person={project.owner} role="Autor verificado" />
            ) : (
              <ClaimForm
                projectId={project.id}
                slug={project.slug}
                status={claimStatus}
                repoUrl={project.repo_url}
              />
            )}

            {/* Quien lo trajo al directorio, cuando no es su autor. */}
            {project.submitter && project.submitter.id !== project.owner?.id ? (
              <PersonLine person={project.submitter} role="Lo publico en el directorio" />
            ) : null}
          </div>
        </aside>
      </div>
    </Container>
  );
}
