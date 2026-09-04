import Link from "next/link";

import { FilterBar, buildHref, type ViewMode } from "@/components/filter-bar";
import { ProjectCard } from "@/components/project-card";
import { ProjectRow } from "@/components/project-row";
import { SetupNotice } from "@/components/setup-notice";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { PAGE_SIZE, getFeed, getVotedIds } from "@/lib/queries";
import { isSortKey } from "@/lib/site";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function Home({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const sortParam = typeof params.sort === "string" ? params.sort : undefined;
  const sort = isSortKey(sortParam) ? sortParam : "destacados";
  const tag = typeof params.tag === "string" ? params.tag : undefined;
  const q = typeof params.q === "string" ? params.q : undefined;
  const view: ViewMode = params.view === "lista" ? "lista" : "grid";
  const page = Math.max(1, Number(params.page) || 1);

  const { projects, total } = await getFeed({ sort, tag, q, page });
  const voted = await getVotedIds(projects.map((project) => project.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Container className="animate-fade py-14 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-7">
          <div className="max-w-2xl">
            <p className="eyebrow">Directorio de proyectos ticos</p>
            <h1 className="display mt-4 text-[clamp(2rem,4.6vw,3.5rem)]">
              Lo que se construye
              <br />
              en Costa Rica
            </h1>
          </div>

          <div className="flex flex-1 flex-col items-start gap-5 sm:items-end">
            <p className="max-w-sm text-base leading-relaxed text-muted sm:text-right">
              Herramientas, apps y proyectos hechos aca. Publica el tuyo, vota los que te sirvan.
            </p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/publicar" variant="primary" size="lg">
                Publicar un proyecto
              </ButtonLink>
              <ButtonLink href="/?sort=nuevos" variant="secondary" size="lg">
                Ver lo mas nuevo
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>

      <FilterBar sort={sort} tag={tag} q={q} view={view} total={total} />

      <Container className="py-10">
        {!isSupabaseConfigured ? <SetupNotice /> : null}

        {projects.length > 0 ? (
          view === "grid" ? (
            <ul className="grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project, index) => (
                <li key={project.id}>
                  <ProjectCard project={project} voted={voted.has(project.id)} index={index} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="border-t border-border/70">
              {projects.map((project, index) => (
                <li key={project.id}>
                  <ProjectRow project={project} voted={voted.has(project.id)} index={index} />
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="animate-fade py-24 text-center">
            <p className="font-medium">
              {isSupabaseConfigured ? "Todavia no hay nada aqui." : "Aqui van los proyectos."}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {!isSupabaseConfigured
                ? "Conecta Supabase y corre el seed para ver el listado con contenido."
                : q || tag
                  ? "Proba con otra busqueda o quita el filtro."
                  : "Se el primero en publicar un proyecto."}
            </p>
          </div>
        )}

        {pages > 1 ? (
          <nav className="mt-14 flex items-center justify-center gap-1.5" aria-label="Paginacion">
            {Array.from({ length: pages }, (_, i) => i + 1).map((number) => {
              const base = buildHref({ sort, tag, q, view });
              const href =
                number === 1 ? base : `${base}${base.includes("?") ? "&" : "?"}page=${number}`;
              return (
                <Link
                  key={number}
                  href={href}
                  aria-current={number === page ? "page" : undefined}
                  className={`grid h-control-md aspect-square place-items-center rounded-control text-sm transition-colors duration-200 ease-brand ${
                    number === page
                      ? "bg-ink text-ink-contrast"
                      : "text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  {number}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </Container>
    </>
  );
}
