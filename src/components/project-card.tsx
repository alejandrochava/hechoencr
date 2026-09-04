import Link from "next/link";

import { ProjectPreview } from "@/components/project-preview";
import { Tag } from "@/components/ui/primitives";
import { tagLabel } from "@/lib/site";
import { VoteButton } from "@/components/vote-button";
import type { FeedProject } from "@/lib/types";
import { hostOf } from "@/lib/url";

/**
 * Sin caja: la imagen es el unico bloque solido y debajo va solo tipografia.
 * El indice escalona la entrada para que la grilla aparezca en cascada.
 */
export function ProjectCard({
  project,
  voted,
  index = 0,
}: {
  project: FeedProject;
  voted: boolean;
  index?: number;
}) {
  return (
    <article
      className="animate-rise group relative"
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` }}
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-media bg-surface-2 ring-1 ring-border/60 transition-shadow duration-300 ease-brand group-hover:ring-border-strong">
        <ProjectPreview name={project.name} slug={project.slug} imageUrl={project.image_url} />

        {!project.is_claimed ? (
          <Tag tone="overlay" className="absolute left-3 top-3">
            Sin reclamar
          </Tag>
        ) : null}

        {/* z-20: por encima del ::after del enlace que cubre la tarjeta. */}
        <div className="absolute right-3 top-3 z-20">
          <VoteButton
            projectId={project.id}
            slug={project.slug}
            count={project.vote_count}
            voted={voted}
            size="sm"
            variant="overlay"
          />
        </div>
      </div>

      <div className="mt-3.5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold tracking-tight transition-colors duration-200 ease-brand group-hover:text-accent-strong">
            <Link href={`/p/${project.slug}`} className="after:absolute after:inset-0">
              {project.name}
            </Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{project.tagline}</p>
        </div>

        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 -translate-x-1 text-faint opacity-0 transition-all duration-300 ease-brand group-hover:translate-x-0 group-hover:text-accent group-hover:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12L12 4M6 4h6v6" />
        </svg>
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 truncate text-xs text-faint">
        <span className="font-mono">{hostOf(project.url)}</span>
        {project.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="before:mr-1.5 before:content-['·']">
            {tagLabel(tag)}
          </span>
        ))}
      </p>
    </article>
  );
}
