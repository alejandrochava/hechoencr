import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { ActionButton } from "@/components/action-button";
import { Empty } from "@/components/ui/primitives";
import { resolveClaim } from "@/lib/actions";
import { getPendingClaims, isCurrentUserAdmin } from "@/lib/queries";

export const metadata: Metadata = { title: "Reclamos pendientes" };

const dateFormat = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" });

export default async function ReclamosPage() {
  if (!(await isCurrentUserAdmin())) notFound();

  const claims = await getPendingClaims();

  if (claims.length === 0) {
    return (
      <Empty title="No hay reclamos por revisar.">
        Cuando alguien diga que un proyecto del directorio es suyo, va a aparecer aca con lo que
        cuente para probarlo.
      </Empty>
    );
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-muted">
        Aprobar le da a esa persona la propiedad del proyecto y permiso para editarlo.
      </p>

      <ul className="mt-6 space-y-4">
        {claims.map((claim) => (
          <li key={claim.id} className="rounded-card border border-border p-5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
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

            <p className="mt-4 whitespace-pre-line rounded-media bg-surface-2 p-4 text-sm leading-relaxed">
              {claim.evidence}
            </p>

            <div className="mt-4 flex gap-2">
              <ActionButton
                variant="primary"
                size="sm"
                done="Reclamo aprobado. El proyecto quedo a nombre de quien lo pidio."
                action={async () => {
                  "use server";
                  await resolveClaim(claim.id, true);
                }}
              >
                Aprobar
              </ActionButton>
              <ActionButton
                variant="secondary"
                size="sm"
                done="Reclamo rechazado."
                action={async () => {
                  "use server";
                  await resolveClaim(claim.id, false);
                }}
              >
                Rechazar
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
