"use client";

import { useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { Size, Variant } from "@/components/ui/styles";

/**
 * Boton para una accion del servidor que no deja rastro en pantalla.
 *
 * Publicar y editar avisan con un parametro en la URL, porque despues navegan
 * a la ficha. Aprobar un reclamo o marcar un mensaje no navegan a ningun lado:
 * ahi el parametro se quedaria pegado y el segundo clic no volveria a avisar,
 * que es justo lo que pasa en una lista donde se hace lo mismo varias veces.
 *
 * El aviso se muestra al volver la accion, y sale igual aunque la fila ya no
 * exista, porque quien lo pinta es el proveedor que esta mas arriba.
 */
export function ActionButton({
  action,
  done,
  children,
  variant,
  size,
}: {
  action: () => Promise<void>;
  /** Lo que se avisa cuando termina bien. */
  done: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
}) {
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await action();
            show(done);
          } catch {
            // Sin esto la accion falla en silencio y la fila se queda igual,
            // que se lee como si no hubiera pasado nada.
            show("No se pudo. Proba de nuevo.", "error");
          }
        })
      }
    >
      {children}
    </Button>
  );
}
