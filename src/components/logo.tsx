import Link from "next/link";

import { site } from "@/lib/site";

/**
 * Marca: tres barras que suben (lo votado, lo que destaca) y el nombre.
 * Sin cajita ni iniciales encerradas.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${site.name}, inicio`}
      className={`group inline-flex items-baseline gap-2.5 ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 22 18"
        aria-hidden="true"
        className="h-[15px] w-[18px] shrink-0 translate-y-[1px] overflow-visible"
      >
        <rect x="0" y="10" width="5" height="8" rx="1.4" className="fill-faint" />
        <rect
          x="7.5"
          y="5"
          width="5"
          height="13"
          rx="1.4"
          className="fill-border-strong transition-colors duration-300 ease-brand group-hover:fill-muted"
        />
        <rect
          x="15"
          y="0"
          width="5"
          height="18"
          rx="1.4"
          className="fill-accent transition-transform duration-300 ease-brand group-hover:-translate-y-[2px]"
        />
      </svg>

      <span className="text-[15px] font-semibold tracking-[-0.02em]">
        Hecho en <span className="text-accent">CR</span>
      </span>
    </Link>
  );
}
