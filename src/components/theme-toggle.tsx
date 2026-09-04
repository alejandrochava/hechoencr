"use client";

import { Button } from "@/components/ui/button";

/**
 * Corre antes de pintar para que no haya destello de tema equivocado.
 * Va inline en el <head>: no puede depender de React.
 */
export const themeScript = `
try {
  var stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') document.documentElement.dataset.theme = stored;
} catch (e) {}
`;

function currentIsDark() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "dark") return true;
  if (chosen === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * El componente no guarda el tema en estado: cual icono se ve lo decide el CSS
 * a partir de data-theme. Asi el HTML del servidor y el del navegador son
 * identicos y no hace falta esperar a montar para pintar bien.
 */
export function ThemeToggle() {
  function toggle() {
    const next = currentIsDark() ? "light" : "dark";
    const root = document.documentElement;

    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 400);

    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Almacenamiento bloqueado (incognito): el tema dura la sesion.
    }
  }

  return (
    <Button icon variant="ghost" onClick={toggle} aria-label="Cambiar entre tema claro y oscuro">
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="icon-when-light size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M16.5 11.8A7 7 0 1 1 8.2 3.5a5.6 5.6 0 0 0 8.3 8.3z" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="icon-when-dark size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="10" cy="10" r="3.6" />
        <path
          d="M10 2v1.6M10 16.4V18M18 10h-1.6M3.6 10H2M15.7 4.3l-1.1 1.1M5.4 14.6l-1.1 1.1M15.7 15.7l-1.1-1.1M5.4 5.4L4.3 4.3"
          strokeLinecap="round"
        />
      </svg>
    </Button>
  );
}
