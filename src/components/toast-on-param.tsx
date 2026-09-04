"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { useToast } from "@/components/ui/toast";

/**
 * Muestra un toast cuando la URL trae cierto parametro. Sirve para avisar algo
 * despues de un redirect del servidor, cuando el estado del cliente se perdio.
 */
export function ToastOnParam({ param, message }: { param: string; message: string }) {
  const params = useSearchParams();
  const { show } = useToast();
  const shown = useRef(false);
  const present = params.get(param);

  useEffect(() => {
    if (!present || shown.current) return;
    shown.current = true;
    show(message);
  }, [present, message, show]);

  return null;
}
