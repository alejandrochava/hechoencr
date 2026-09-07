"use client";

import { usePathname } from "next/navigation";

import { Segmented } from "@/components/ui/segmented";

/**
 * Las secciones de un area del sitio, con la actual marcada.
 *
 * Se reusa el control del filtro del feed a proposito: la administracion y la
 * cuenta no son otra aplicacion, son el mismo sitio, y conviene que se muevan
 * igual. Cada opcion es un enlace, asi que sigue funcionando sin JavaScript.
 *
 * Va aparte del layout porque saber en cual estamos necesita la ruta, y eso
 * solo lo sabe el navegador.
 */

export type Seccion = {
  href: string;
  label: string;
  /** Se pinta al lado del nombre. Cero no se muestra: no hay nada que atender. */
  cuenta?: number;
};

export function SectionNav({ secciones, label }: { secciones: Seccion[]; label: string }) {
  const pathname = usePathname();
  const actual = secciones.find((seccion) => pathname.startsWith(seccion.href)) ?? secciones[0];

  return (
    <Segmented
      label={label}
      value={actual.href}
      size="sm"
      options={secciones.map((seccion) => ({
        value: seccion.href,
        href: seccion.href,
        label: (
          <span className="flex items-center gap-2">
            {seccion.label}
            {seccion.cuenta ? (
              <span className="rounded-full bg-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold leading-none text-accent-contrast tabular-nums">
                {seccion.cuenta}
              </span>
            ) : null}
          </span>
        ),
      }))}
    />
  );
}
