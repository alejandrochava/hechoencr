"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { useAuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";
import type { Size, Variant } from "@/components/ui/styles";

/** Boton que abre el modal de login desde cualquier parte del arbol. */
export function LoginTrigger({
  children = "Entrar",
  next,
  size,
  variant = "primary",
  className,
}: {
  children?: React.ReactNode;
  next?: string;
  size?: Size;
  variant?: Variant;
  className?: string;
}) {
  const { openLogin } = useAuthModal();

  return (
    <Button size={size} variant={variant} className={className} onClick={() => openLogin(next)}>
      {children}
    </Button>
  );
}

/**
 * Abre el modal cuando la URL trae ?login=1. Es como el middleware manda a la
 * gente sin sesion de vuelta a la pagina donde estaba, con el login arriba.
 */
export function LoginQueryOpener() {
  const params = useSearchParams();
  const { openLogin } = useAuthModal();
  const requested = params.get("login");
  const next = params.get("next");

  useEffect(() => {
    if (requested) openLogin(next ?? "/");
  }, [requested, next, openLogin]);

  return null;
}
