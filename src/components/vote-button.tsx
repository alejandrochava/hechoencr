"use client";

import { useOptimistic, useTransition } from "react";

import { useAuthModal } from "@/components/auth/auth-modal";
import { CONTROL_BASE, CONTROL_SIZE, CONTROL_VARIANT, type Size } from "@/components/ui/styles";
import { toggleVote } from "@/lib/actions";
import { cn } from "@/lib/cn";

type Props = {
  projectId: string;
  slug: string;
  count: number;
  voted: boolean;
  size?: Size;
  /** overlay: sobre la imagen. default: sobre el fondo de la pagina. */
  variant?: "default" | "overlay";
};

export function VoteButton({
  projectId,
  slug,
  count,
  voted,
  size = "md",
  variant = "default",
}: Props) {
  const { authenticated, openLogin } = useAuthModal();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useOptimistic(
    { count, voted },
    (_prev, next: { count: number; voted: boolean }) => next,
  );

  function onClick() {
    // Sin sesion no se pierde el contexto: se abre el login sobre la pagina.
    if (!authenticated) {
      openLogin();
      return;
    }

    startTransition(async () => {
      setState({ count: state.voted ? state.count - 1 : state.count + 1, voted: !state.voted });
      await toggleVote(projectId, slug);
    });
  }

  const tone = state.voted
    ? "bg-accent text-accent-contrast border border-accent"
    : variant === "overlay"
      ? CONTROL_VARIANT.overlay
      : CONTROL_VARIANT.secondary;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={state.voted}
      aria-label={state.voted ? "Quitar voto" : "Votar por este proyecto"}
      className={cn(CONTROL_BASE, CONTROL_SIZE[size], "px-3", tone, pending && "opacity-70")}
    >
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className={cn(
          "size-[18px] transition-transform duration-300 ease-brand",
          state.voted && "-translate-y-px",
        )}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 15V5M10 5l-5 5M10 5l5 5" />
      </svg>
      <span className="font-semibold tabular-nums">{state.count}</span>
    </button>
  );
}
