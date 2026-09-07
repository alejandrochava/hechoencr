import { Suspense } from "react";
import Link from "next/link";

import { LoginTrigger } from "@/components/auth/login-trigger";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { signOut } from "@/lib/actions";
import { getViewer } from "@/lib/queries";

/**
 * El encabezado del sitio.
 *
 * Quien esta mirando sale de una consulta a `profiles`, y esa consulta no tiene
 * por que retrasar el resto de la pagina: lo que depende de ella va en su
 * propio Suspense, asi el marco sale de una y los dos huecos se llenan cuando
 * la fila llega. Leen la misma fila cacheada, o sea que llegan juntos.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-3">
        <Logo />

        <div className="flex-1" />

        {/* Solo existen para admin: para el resto no hay hueco que reservar. */}
        <Suspense fallback={null}>
          <AdminLinks />
        </Suspense>

        <ThemeToggle />

        <ButtonLink href="/publicar" variant="secondary" className="hidden sm:inline-flex">
          Publicar proyecto
        </ButtonLink>

        {/* El hueco se reserva para que el resto del encabezado no se corra. */}
        <Suspense fallback={<div className="h-9 w-[4.5rem]" aria-hidden="true" />}>
          <ViewerControls />
        </Suspense>
      </Container>
    </header>
  );
}

async function AdminLinks() {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) return null;

  return (
    <>
      <ButtonLink href="/admin/reclamos" variant="ghost" size="sm" className="hidden md:inline-flex">
        Reclamos
      </ButtonLink>
      <ButtonLink href="/admin/mensajes" variant="ghost" size="sm" className="hidden md:inline-flex">
        Mensajes
      </ButtonLink>
    </>
  );
}

async function ViewerControls() {
  const viewer = await getViewer();

  if (!viewer) return <LoginTrigger>Entrar</LoginTrigger>;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={viewer.handle ? `/u/${viewer.handle}` : "/"}
        title={`Perfil de ${viewer.name}`}
        className="transition-opacity duration-200 ease-brand hover:opacity-80"
      >
        {viewer.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={viewer.avatar}
            alt={viewer.name}
            className="size-9 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-surface-2 text-xs font-semibold uppercase text-muted">
            {viewer.name.slice(0, 2)}
          </span>
        )}
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          Salir
        </Button>
      </form>
    </div>
  );
}
