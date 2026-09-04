"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { LoginPanel } from "@/components/auth/login-panel";
import { RegisterPanel } from "@/components/auth/register-panel";
import { Modal } from "@/components/ui/modal";

type AuthModalContext = {
  /** `next` es a donde vuelve la persona despues de entrar. */
  openLogin: (next?: string) => void;
  closeLogin: () => void;
  /** Lo resuelve el servidor una sola vez y lo consumen los controles. */
  authenticated: boolean;
};

const Context = createContext<AuthModalContext | null>(null);

export function useAuthModal() {
  const context = useContext(Context);
  if (!context) throw new Error("useAuthModal necesita <AuthModalProvider>");
  return context;
}

export function AuthModalProvider({
  children,
  authenticated,
}: {
  children: ReactNode;
  authenticated: boolean;
}) {
  /*
   * El `id` sube en cada apertura. Sin el, pedir el login dos veces con el
   * mismo destino no cambiaria el estado, React no re-renderizaria y el modal
   * no volveria a abrirse si el <dialog> quedo cerrado por su cuenta (Escape,
   * un close() del navegador). Con el contador, abrir siempre es una peticion
   * nueva y el estado de React manda sobre el del DOM.
   */
  const [request, setRequest] = useState<{ next: string; id: number } | null>(null);
  const [mode, setMode] = useState<"entrar" | "registro">("entrar");

  const openLogin = useCallback((target?: string) => {
    setRequest((current) => ({
      next: target ?? (typeof window === "undefined" ? "/" : window.location.pathname),
      id: (current?.id ?? 0) + 1,
    }));
  }, []);

  const closeLogin = useCallback(() => setRequest(null), []);

  const value = useMemo(
    () => ({ openLogin, closeLogin, authenticated }),
    [openLogin, closeLogin, authenticated],
  );

  return (
    <Context.Provider value={value}>
      {children}
      <Modal
        key={request?.id}
        open={request !== null}
        onClose={closeLogin}
        title={mode === "entrar" ? "Entrar a Hecho en CR" : "Crear tu cuenta"}
        description={
          mode === "entrar"
            ? "Necesitas cuenta para votar, publicar y reclamar proyectos. Un voto por persona."
            : "Con correo y telefono. Una persona, una cuenta, un voto por proyecto."
        }
      >
        {mode === "entrar" ? (
          <LoginPanel next={request?.next ?? "/"} onRegister={() => setMode("registro")} />
        ) : (
          <RegisterPanel next={request?.next ?? "/"} onHaveAccount={() => setMode("entrar")} />
        )}
      </Modal>
    </Context.Provider>
  );
}
