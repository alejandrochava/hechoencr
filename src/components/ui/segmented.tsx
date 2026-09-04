import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CONTROL_BASE, GROUP_ITEM, GROUP_SHELL, type Size } from "./styles";

export type SegmentedOption = {
  value: string;
  label: ReactNode;
  href: string;
  title?: string;
  /** Para opciones que son solo icono. */
  srLabel?: string;
};

/**
 * Grupo de opciones excluyentes, navegables (cada una es un enlace, asi
 * funciona sin JavaScript y se puede compartir la URL).
 */
export function Segmented({
  options,
  value,
  size = "md",
  label,
  className,
}: {
  options: SegmentedOption[];
  value: string;
  size?: Size;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-scrollbar flex overflow-x-auto", GROUP_SHELL[size], className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Link
            key={option.value}
            href={option.href}
            title={option.title}
            aria-label={option.srLabel}
            aria-current={active ? "page" : undefined}
            className={cn(
              CONTROL_BASE,
              GROUP_ITEM[size],
              active ? "bg-ink text-ink-contrast" : "text-muted hover:text-text",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
