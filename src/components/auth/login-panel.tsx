"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";

/**
 * Contenido del login. Vive dentro del modal, pero no sabe nada de el:
 * se puede montar en cualquier lado.
 */
export function LoginPanel({ next, onRegister }: { next: string; onRegister?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [withPassword, setWithPassword] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  const redirectTo = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function withProvider(provider: "github" | "google") {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo() },
    });
    if (error) {
      setStatus("error");
      setMessage(`No se pudo entrar con ${provider}: ${error.message}`);
    }
  }

  async function withEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const supabase = createClient();

    if (withPassword) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setStatus("error");
        setMessage("Correo o contrasena incorrectos.");
      } else {
        window.location.href = next;
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo(), shouldCreateUser: false },
    });
    if (error) {
      setStatus("error");
      setMessage(
        error.message.toLowerCase().includes("signups not allowed")
          ? "No encontramos una cuenta con ese correo. Crea una."
          : error.message,
      );
    } else {
      setStatus("sent");
      setMessage("Te mandamos un enlace de acceso al correo.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        <Button size="lg" onClick={() => withProvider("github")} className="w-full">
          <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          Entrar con GitHub
        </Button>
        <p className="px-1 text-xs leading-relaxed text-muted">
          Con GitHub podes verificar tus repos y reclamar tus proyectos al instante.
        </p>

        <Button size="lg" onClick={() => withProvider("google")} className="mt-2 w-full">
          <svg viewBox="0 0 18 18" className="size-[18px]" aria-hidden="true">
            <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.5h4.8a4 4 0 0 1-1.8 2.7v2.2h2.9c1.7-1.5 2.7-3.8 2.7-6.6z" />
            <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
            <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
            <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
          </svg>
          Entrar con Google
        </Button>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />o con tu correo
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={withEmail} className="space-y-3">
        <Input
          type="email"
          required
          size="lg"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vos@correo.com"
        />
        {withPassword ? (
          <Input
            type="password"
            required
            size="lg"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contrasena"
          />
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={status === "sending"}
          className="w-full"
        >
          {status === "sending"
            ? "Entrando..."
            : withPassword
              ? "Entrar"
              : "Mandarme un enlace"}
        </Button>

        <button
          type="button"
          onClick={() => setWithPassword((current) => !current)}
          className="w-full text-center text-sm text-muted underline-offset-2 hover:text-text hover:underline"
        >
          {withPassword ? "Prefiero un enlace por correo" : "Tengo contrasena"}
        </button>
      </form>

      {onRegister ? (
        <p className="text-center text-sm text-muted">
          Primera vez?{" "}
          <button
            type="button"
            onClick={onRegister}
            className="font-medium text-accent-strong underline-offset-2 hover:underline"
          >
            Crear cuenta
          </button>
        </p>
      ) : null}

      {message ? (
        <p className={`animate-fade text-sm ${status === "error" ? "text-flag" : "text-muted"}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
