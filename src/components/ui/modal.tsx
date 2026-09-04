"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Modal generico sobre <dialog>: el navegador ya resuelve la capa superior,
 * el foco atrapado y Escape. Solo agregamos el cierre al clickear afuera.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;

    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-xl" } as const;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(event) => {
        // El click en el backdrop llega al propio <dialog>, no a su contenido.
        if (event.target === dialog.current) onClose();
      }}
      aria-labelledby="modal-title"
      className={cn(
        // m-auto: el preflight de Tailwind borra el margin que centra los
        // <dialog> nativos, asi que hay que devolverlo a mano.
        "m-auto w-[calc(100vw-2rem)] rounded-card border border-border bg-surface p-0 text-text shadow-2xl",
        "backdrop:bg-overlay backdrop:backdrop-blur-sm",
        "open:animate-rise",
        widths[size],
      )}
    >
      <div className="flex items-start gap-4 p-6 pb-0">
        <div className="flex-1">
          <h2 id="modal-title" className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
          ) : null}
        </div>
        <Button icon variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </Button>
      </div>

      <div className="p-6">{children}</div>
    </dialog>
  );
}
