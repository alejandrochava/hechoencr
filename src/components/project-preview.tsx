"use client";

import { useState } from "react";

/** Hash estable del slug: el mismo proyecto siempre recibe el mismo tono. */
function hueFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  return hash;
}

const CONNECTORS = new Set(["de", "del", "la", "el", "los", "las", "y", "en", "al", "a", "para"]);

function initials(name: string) {
  const words = name
    .replace(/^demo:\s*/i, "")
    .split(/\s+/)
    .filter((word) => word && !CONNECTORS.has(word.toLowerCase()));

  return (words.length ? words : name.split(/\s+/))
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/**
 * Vista previa del proyecto. Si no hay imagen, o si la que hay no carga
 * (el sitio se cayo, el screenshot todavia no existe), dibuja un monograma
 * en vez de dejar un hueco gris.
 */
export function ProjectPreview({
  name,
  slug,
  imageUrl,
  priority = false,
}: {
  name: string;
  slug: string;
  imageUrl: string | null;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`Vista previa de ${name}`}
        onError={() => setFailed(true)}
        loading={priority ? "eager" : "lazy"}
        className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
    );
  }

  // Casi monocromo: el tono solo distingue una tarjeta de otra, no grita.
  const hue = hueFor(slug);

  return (
    <div
      aria-hidden="true"
      className="grid size-full place-items-center"
      style={{
        background: `linear-gradient(150deg, oklch(0.36 0.025 ${hue}), oklch(0.19 0.018 ${(hue + 45) % 360}))`,
      }}
    >
      <span className="display text-[clamp(2.5rem,7vw,4.5rem)] text-white/85">
        {initials(name)}
      </span>
    </div>
  );
}
