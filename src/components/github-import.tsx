"use client";

import { useState } from "react";

import type { ProjectDraft } from "@/components/project-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Skeleton, Tag } from "@/components/ui/primitives";
import { listMyGithubRepos, type ImportableRepo } from "@/lib/actions";
import { tagLabel } from "@/lib/site";

/**
 * Trae los repositorios publicos de tu cuenta de GitHub y llena el formulario
 * con el que elijas.
 *
 * Lo que rellena no es la ultima palabra: los campos quedan editables y al
 * enviar se valida igual que siempre. Esto ahorra escribir ocho campos, no
 * saltea ninguna regla.
 */
export function GithubImport({ onPick }: { onPick: (draft: Partial<ProjectDraft>) => void }) {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [repos, setRepos] = useState<ImportableRepo[] | null>(null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  async function abrir() {
    setOpen(true);

    // Ya se trajeron antes: la lista se conserva mientras dure la pagina.
    if (repos) return;

    setCargando(true);
    setError("");

    const estado = await listMyGithubRepos();
    setCargando(false);

    if (!estado.ok) {
      setError(estado.message);
      return;
    }

    setHandle(estado.handle);
    setRepos(estado.repos);
  }

  function elegir(repo: ImportableRepo) {
    onPick({
      name: repo.name,
      tagline: repo.tagline,
      url: repo.url,
      repo_url: repo.repoUrl,
      tags: repo.tags,
    });
    setOpen(false);
    setBusqueda("");
  }

  const termino = busqueda.trim().toLowerCase();
  const visibles = (repos ?? []).filter(
    (repo) =>
      !termino ||
      repo.fullName.toLowerCase().includes(termino) ||
      repo.tagline.toLowerCase().includes(termino),
  );

  return (
    <>
      <Button type="button" onClick={abrir}>
        <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Traer de GitHub
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Tus repositorios"
        description={
          handle
            ? `Publicos de @${handle}, los mas movidos primero. Elegi uno y se llena el formulario.`
            : "Elegi uno y se llena el formulario."
        }
      >
        {cargando ? (
          <div className="space-y-2" aria-busy="true">
            <span className="sr-only">Cargando tus repositorios</span>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm leading-relaxed text-flag">{error}</p>
        ) : repos && repos.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted">
            No encontramos repositorios publicos en esa cuenta. Podes publicar el proyecto a mano.
          </p>
        ) : (
          <div className="space-y-3">
            {(repos?.length ?? 0) > 6 ? (
              <Input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar entre tus repos"
                aria-label="Buscar entre tus repositorios"
              />
            ) : null}

            <ul className="max-h-[22rem] space-y-2 overflow-y-auto">
              {visibles.map((repo) => (
                <li key={repo.repoUrl}>
                  <button
                    type="button"
                    onClick={() => elegir(repo)}
                    disabled={repo.alreadyListed}
                    className={[
                      "w-full rounded-card border border-border p-3 text-left transition-colors duration-200 ease-brand",
                      repo.alreadyListed
                        ? "cursor-not-allowed opacity-55"
                        : "hover:border-border-strong hover:bg-surface-2",
                    ].join(" ")}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{repo.fullName}</span>
                      {repo.alreadyListed ? <Tag>Ya esta publicado</Tag> : null}
                      {repo.archived ? <Tag tone="outline">Archivado</Tag> : null}
                    </span>

                    {repo.tagline ? (
                      <span className="mt-1 block text-sm leading-relaxed text-muted">
                        {repo.tagline}
                      </span>
                    ) : null}

                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-faint">
                      {repo.language ? <span>{repo.language}</span> : null}
                      {repo.stars > 0 ? <span>★ {repo.stars}</span> : null}
                      {repo.tags.map((tag) => (
                        <Tag key={tag} tone="accent">
                          {tagLabel(tag)}
                        </Tag>
                      ))}
                    </span>
                  </button>
                </li>
              ))}

              {repos && visibles.length === 0 ? (
                <li className="py-4 text-sm text-muted">Ninguno calza con esa busqueda.</li>
              ) : null}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
