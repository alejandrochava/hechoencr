import Link from "next/link";

import { ProjectPreview } from "@/components/project-preview";
import { Tag } from "@/components/ui/primitives";
import { VoteButton } from "@/components/vote-button";
import { tagLabel } from "@/lib/site";
import type { FeedProject } from "@/lib/types";
import { hostOf } from "@/lib/url";

/** Vista de lista: densa pero comoda de leer, separada solo por una linea. */
export function ProjectRow({
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
      className="animate-rise group relative flex items-center gap-5 border-b border-border/70 py-5 transition-colors duration-200 ease-brand hover:border-border-strong sm:gap-6"
      style={{ animationDelay: `${Math.min(index, 11) * 30}ms` }}
    >
      <div className="relative z-20">
        <VoteButton
          projectId={project.id}
          slug={project.slug}
          count={project.vote_count}
          voted={voted}
          size="sm"
        />
      </div>

      <div className="hidden aspect-[16/10] w-40 shrink-0 overflow-hidden rounded-media bg-surface-2 ring-1 ring-border/60 sm:block">
        <ProjectPreview name={project.name} slug={project.slug} imageUrl={project.image_url} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="truncate text-lg font-semibold tracking-tight transition-colors duration-200 ease-brand group-hover:text-accent-strong">
            <Link href={`/p/${project.slug}`} className="after:absolute after:inset-0">
              {project.name}
            </Link>
          </h3>
          {!project.is_claimed ? <Tag tone="outline">Sin reclamar</Tag> : null}
        </div>
        <p className="mt-1.5 line-clamp-2 text-[15px] leading-relaxed text-muted">
          {project.tagline}
        </p>
        <p className="mt-2 font-mono text-xs text-faint sm:hidden">{hostOf(project.url)}</p>
      </div>

      <div className="hidden shrink-0 items-center gap-4 lg:flex">
        {project.tags.slice(0, 2).map((tag) => (
          <Tag key={tag}>{tagLabel(tag)}</Tag>
        ))}
        <span className="w-44 truncate text-right font-mono text-[13px] text-faint">
          {hostOf(project.url)}
        </span>
      </div>
    </article>
  );
}
