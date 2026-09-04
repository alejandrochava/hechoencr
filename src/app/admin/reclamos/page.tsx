import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { resolveClaim } from "@/lib/actions";
import { getPendingClaims, isCurrentUserAdmin } from "@/lib/queries";

export const metadata: Metadata = { title: "Reclamos pendientes" };

const dateFormat = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" });

export default async function ReclamosPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  const claims = await getPendingClaims();

  return (
    <Container width="narrow" className="animate-fade py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="display text-[clamp(1.75rem,6vw,2.75rem)]">Reclamos pendientes</h1>
        <ButtonLink href="/admin/mensajes" variant="ghost" size="sm">
          Ver mensajes
        </ButtonLink>
      </div>
      <p className="mt-4 text-sm text-muted">
        Aprobar le da al usuario la propiedad del proyecto y permiso para editarlo.
      </p>

      {claims.length === 0 ? (
        <p className="mt-14 text-center text-muted">No hay reclamos por revisar.</p>
      ) : (
        <ul className="mt-10">
          {claims.map((claim) => (
            <li key={claim.id} className="border-t border-border/70 py-6">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{claim.project?.name}</span>
                <a
                  href={claim.project?.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="font-mono text-xs text-muted underline-offset-2 hover:underline"
                >
                  {claim.project?.url}
                </a>
                <span className="ml-auto text-xs text-faint">
                  {dateFormat.format(new Date(claim.created_at))}
                </span>
              </div>

              <p className="mt-2 text-sm">
                <span className="text-muted">Lo pide: </span>
                {claim.user?.display_name ?? claim.user?.handle ?? "sin nombre"}
                {claim.contact ? <span className="text-muted"> · {claim.contact}</span> : null}
              </p>

              <p className="mt-3 whitespace-pre-line rounded-card bg-surface-2 p-4 text-sm leading-relaxed">
                {claim.evidence}
              </p>

              <div className="mt-4 flex gap-2">
                <form
                  action={async () => {
                    "use server";
                    await resolveClaim(claim.id, true);
                  }}
                >
                  <Button type="submit" variant="primary">
                    Aprobar
                  </Button>
                </form>
                <form
                  action={async () => {
                    "use server";
                    await resolveClaim(claim.id, false);
                  }}
                >
                  <Button type="submit" variant="secondary">
                    Rechazar
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
