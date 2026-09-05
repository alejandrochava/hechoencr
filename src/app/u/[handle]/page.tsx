import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { GithubLink } from "@/components/auth/github-link";
import { ProfileVisibility } from "@/components/profile-visibility";
import { ProjectCard } from "@/components/project-card";
import { Container } from "@/components/ui/primitives";
import { getProfileByHandle, getProjectsByOwner, getVotedIds } from "@/lib/queries";
import { enabledProviders } from "@/lib/supabase/providers";
import { getCurrentUser } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) return { title: "Perfil no encontrado" };

  // Un perfil privado igual carga para su dueno: el titulo no puede decir que
  // no existe. Se le quita el nombre y se pide a los buscadores que no lo
  // indexen.
  if (!profile.public_profile) {
    return { title: "Perfil privado", robots: { index: false, follow: false } };
  }

  return {
    title: profile.display_name ?? profile.handle ?? handle,
    description: `Proyectos de ${profile.display_name ?? handle} en el directorio.`,
  };
}

const joined = new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric" });

export default async function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);
  if (!profile) notFound();

  const [projects, viewer, providers] = await Promise.all([
    getProjectsByOwner(profile.id),
    getCurrentUser(),
    enabledProviders(),
  ]);
  const voted = await getVotedIds(projects.map((project) => project.id));
  const isMe = viewer?.id === profile.id;

  // Un perfil privado solo existe para su dueno.
  if (!profile.public_profile && !isMe) notFound();
  const totalVotes = projects.reduce((sum, project) => sum + project.vote_count, 0);

  return (
    <Container className="animate-fade py-14">
      <header className="flex flex-wrap items-start gap-6 border-b border-border/70 pb-10">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="size-20 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="grid size-20 place-items-center rounded-full bg-surface-2 text-xl font-semibold uppercase text-muted">
            {(profile.display_name ?? profile.handle ?? "?").slice(0, 2)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h1 className="display text-[clamp(1.75rem,5vw,2.75rem)]">
            {profile.display_name ?? profile.handle}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {profile.handle ? `@${profile.handle}` : null}
            {profile.handle ? " · " : null}
            En el directorio desde {joined.format(new Date(profile.created_at))}
          </p>
          {profile.bio ? <p className="mt-3 max-w-xl leading-relaxed">{profile.bio}</p> : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {profile.github_handle ? (
              <a
                href={`https://github.com/${profile.github_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-muted transition-colors duration-200 ease-brand hover:text-text"
              >
                <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                @{profile.github_handle}
              </a>
            ) : isMe && providers.includes("github") ? (
              <GithubLink />
            ) : null}
          </div>

          {isMe ? (
            <div className="mt-6 border-t border-border/70 pt-5">
              <ProfileVisibility initial={profile.public_profile} />
            </div>
          ) : null}
        </div>

        <dl className="flex gap-8">
          <div>
            <dt className="eyebrow">Proyectos</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{projects.length}</dd>
          </div>
          <div>
            <dt className="eyebrow">Votos</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{totalVotes}</dd>
          </div>
        </dl>
      </header>

      {projects.length > 0 ? (
        <ul className="mt-10 grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <li key={project.id}>
              <ProjectCard project={project} voted={voted.has(project.id)} index={index} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-20 text-center text-muted">
          {isMe
            ? "Todavia no reclamaste ningun proyecto."
            : "Esta persona todavia no tiene proyectos verificados."}
        </p>
      )}
    </Container>
  );
}
