"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

import { CONTROL_BASE, CONTROL_SIZE, CONTROL_VARIANT, type Size } from "./styles";

export type DropdownItem = {
  value: string;
  label: string;
  href: string;
  active?: boolean;
};

/**
 * Menu de una sola eleccion. El disparador usa exactamente las mismas recetas
 * que Button, asi que mide igual que el resto de la barra.
 */
export function Dropdown({
  label,
  items,
  value,
  size = "md",
  emptyLabel = "Todas",
  emptyHref,
}: {
  label: string;
  items: DropdownItem[];
  value?: string;
  size?: Size;
  emptyLabel?: string;
  emptyHref: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          CONTROL_BASE,
          CONTROL_SIZE[size],
          CONTROL_VARIANT.secondary,
          value && "border-accent text-accent-strong",
        )}
      >
        {value ?? label}
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cn("size-3.5 transition-transform duration-200 ease-brand", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="no-scrollbar animate-fade absolute left-0 top-[calc(100%+0.375rem)] z-40 max-h-80 w-60 overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-lg shadow-black/5"
        >
          <MenuItem href={emptyHref} active={!value} onSelect={() => setOpen(false)}>
            {emptyLabel}
          </MenuItem>
          {items.map((item) => (
            <MenuItem
              key={item.value}
              href={item.href}
              active={Boolean(item.active)}
              onSelect={() => setOpen(false)}
            >
              {item.label}
            </MenuItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  active,
  onSelect,
  children,
}: {
  href: string;
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className={cn(
        "block rounded-[calc(var(--radius-card)-0.375rem)] px-3 py-2 text-sm transition-colors duration-150 ease-brand hover:bg-surface-2",
        active && "font-medium text-accent-strong",
      )}
    >
      {children}
    </Link>
  );
}
