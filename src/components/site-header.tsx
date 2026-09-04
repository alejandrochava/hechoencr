import Link from "next/link";

import { LoginTrigger } from "@/components/auth/login-trigger";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { signOut } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

async function getViewer() {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle, display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  return {
    handle: (profile?.handle as string | null) ?? null,
    name: (profile?.display_name as string | null) ?? user.email?.split("@")[0] ?? "vos",
    avatar: (profile?.avatar_url as string | null) ?? null,
    isAdmin: Boolean(profile?.is_admin),
  };
}

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center gap-3">
        <Logo />

        <div className="flex-1" />

        {viewer?.isAdmin ? (
          <>
            <ButtonLink href="/admin/reclamos" variant="ghost" size="sm" className="hidden md:inline-flex">
              Reclamos
            </ButtonLink>
            <ButtonLink href="/admin/mensajes" variant="ghost" size="sm" className="hidden md:inline-flex">
              Mensajes
            </ButtonLink>
          </>
        ) : null}

        <ThemeToggle />

        <ButtonLink href="/publicar" variant="secondary" className="hidden sm:inline-flex">
          Publicar proyecto
        </ButtonLink>

        {viewer ? (
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
        ) : (
          <LoginTrigger>Entrar</LoginTrigger>
        )}
      </Container>
    </header>
  );
}
