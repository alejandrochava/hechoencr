"use client";

import { useEffect } from "react";

/**
 * La red de seguridad de mas afuera: si lo que falla es el layout raiz,
 * error.tsx nunca llega a montarse porque vive adentro de el.
 *
 * Por eso este archivo trae su propio <html> y no importa nada del sitio: si
 * el layout no pudo cargar, sus estilos y sus componentes tampoco. Todo va en
 * estilos en linea a proposito.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("error global:", error);
  }, [error]);

  return (
    <html lang="es-CR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111110",
          color: "#fafaf9",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Hecho en CR no pudo cargar</h1>
          <p style={{ margin: "0.75rem 0 1.5rem", lineHeight: 1.6, color: "#a3a3a1" }}>
            Fue de nuestro lado. Proba de nuevo en un momento.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: 0,
              borderRadius: "0.625rem",
              padding: "0.625rem 1.25rem",
              background: "#fafaf9",
              color: "#111110",
              font: "inherit",
              fontWeight: 500,
            }}
          >
            Reintentar
          </button>
          {error.digest ? (
            <p style={{ marginTop: "2rem", fontSize: "0.75rem", color: "#71716f" }}>
              Referencia: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
