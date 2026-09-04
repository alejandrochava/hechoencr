"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

type Tone = "ok" | "error";
type Toast = { id: number; message: string; tone: Tone };

const Context = createContext<{ show: (message: string, tone?: Tone) => void } | null>(null);

export function useToast() {
  const context = useContext(Context);
  if (!context) throw new Error("useToast necesita <ToastProvider>");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: Tone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <Context.Provider value={value}>
      {children}
      {/* aria-live: quien usa lector de pantalla se entera sin mover el foco. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-5"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "animate-rise pointer-events-auto flex items-center gap-2.5 rounded-control px-4 py-3 text-sm font-medium shadow-lg",
              toast.tone === "ok"
                ? "bg-ink text-ink-contrast"
                : "bg-flag text-white",
            )}
          >
            {toast.tone === "ok" ? (
              <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M4.5 10.5l3.5 3.5 7.5-7.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M10 6v5M10 14h.01" strokeLinecap="round" />
                <circle cx="10" cy="10" r="7.5" />
              </svg>
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </Context.Provider>
  );
}
