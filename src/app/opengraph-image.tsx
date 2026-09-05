import { ImageResponse } from "next/og";

import { site } from "@/lib/site";

/**
 * La tarjeta que sale cuando alguien pega el enlace en WhatsApp, Telegram,
 * Slack o X.
 *
 * Va en la raiz a proposito: las rutas de abajo la heredan si no declaran la
 * suya, asi que Privacidad, Terminos y una ficha sin captura quedan cubiertas
 * con esto solo. Cuando un proyecto si tiene vista previa, su generateMetadata
 * declara esa imagen y pisa a esta.
 *
 * Se dibuja aca en vez de guardar un PNG para que el nombre y la bajada salgan
 * de src/lib/site.ts, igual que en el resto del sitio: cambiar la marca en un
 * lado la cambia en todos.
 */

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#111110",
          color: "#fafaf9",
          fontFamily: "sans-serif",
        }}
      >
        {/* El bloque de texto se centra y el resto lo ocupa la banda, que va
            a sangre: con el padding en el contenedor de afuera, la banda
            quedaba con margen a los lados y cortada abajo. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
            padding: "0 80px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#8f9aae",
            }}
          >
            {new URL(site.url).host}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 28,
              fontSize: 104,
              fontWeight: 700,
              letterSpacing: -3,
              lineHeight: 1.05,
            }}
          >
            {site.name}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 42,
              lineHeight: 1.3,
              color: "#b6b6b3",
              maxWidth: 900,
            }}
          >
            {site.tagline}
          </div>
        </div>

        {/* Los colores de la bandera, sin dibujar la bandera. */}
        <div style={{ display: "flex", height: 28, width: "100%", flexShrink: 0 }}>
          <div style={{ display: "flex", flex: 1, background: "#002b7f" }} />
          <div style={{ display: "flex", flex: 1, background: "#fafaf9" }} />
          <div style={{ display: "flex", flex: 2, background: "#ce1126" }} />
          <div style={{ display: "flex", flex: 1, background: "#fafaf9" }} />
          <div style={{ display: "flex", flex: 1, background: "#002b7f" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
