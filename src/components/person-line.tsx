import Link from "next/link";

import type { ProjectOwner } from "@/lib/types";

/**
 * Muestra a una persona respetando su decision de aparecer o no.
 *
 * Si tiene el perfil en privado, se reconoce el aporte sin dar su nombre ni
 * enlazar: el credito existe, la exposicion es opcional.
 */
export function PersonLine({
  person,
  role,
  anonymousLabel = "Alguien de la comunidad",
}: {
  person: ProjectOwner | null;
  role: string;
  anonymousLabel?: string;
}) {
  if (!person) return null;

  const name = person.display_name ?? person.handle ?? anonymousLabel;
  const visible = person.public_profile && person.handle;

  return (
    <div className="flex items-center gap-3">
      {visible && person.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar_url} alt="" className="size-10 rounded-full ring-1 ring-border" />
      ) : (
        <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-sm font-semibold uppercase text-muted">
          {visible ? name.slice(0, 2) : "·"}
        </span>
      )}

      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {visible ? (
            <Link
              href={`/u/${person.handle}`}
              className="transition-colors duration-200 ease-brand hover:text-accent-strong"
            >
              {name}
            </Link>
          ) : (
            anonymousLabel
          )}
        </p>
        <p className="text-xs text-muted">{role}</p>
      </div>
    </div>
  );
}
