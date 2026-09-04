import Link from "next/link";

import { Container } from "@/components/ui/primitives";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/70">
      <Container className="flex flex-col gap-3 py-8 text-sm text-muted sm:flex-row sm:items-center">
        <p>{site.name} — hecho en Costa Rica, para lo que se hace en Costa Rica.</p>
        <div className="flex-1" />
        <nav className="flex gap-5">
          <Link href="/publicar" className="transition-colors duration-200 ease-brand hover:text-text">
            Publicar
          </Link>
          <Link href="/?sort=nuevos" className="transition-colors duration-200 ease-brand hover:text-text">
            Nuevos
          </Link>
          <Link href="/contacto" className="transition-colors duration-200 ease-brand hover:text-text">
            Ayuda
          </Link>
          <Link href="/privacidad" className="transition-colors duration-200 ease-brand hover:text-text">
            Privacidad
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
