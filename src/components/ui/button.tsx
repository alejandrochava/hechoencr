import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

import {
  CONTROL_BASE,
  CONTROL_SIZE,
  CONTROL_SQUARE,
  CONTROL_VARIANT,
  type Size,
  type Variant,
} from "./styles";

type Shared = {
  size?: Size;
  variant?: Variant;
  /** Cuadrado, del mismo alto que el resto de los controles. */
  icon?: boolean;
};

function classesFor({ size = "md", variant = "secondary", icon = false }: Shared, extra?: string) {
  return cn(CONTROL_BASE, icon ? CONTROL_SQUARE[size] : CONTROL_SIZE[size], CONTROL_VARIANT[variant], extra);
}

export function Button({
  size,
  variant,
  icon,
  className,
  ...props
}: Shared & ComponentProps<"button">) {
  return <button {...props} className={classesFor({ size, variant, icon }, className)} />;
}

/** Mismo aspecto que Button, pero navega. */
export function ButtonLink({
  size,
  variant,
  icon,
  className,
  ...props
}: Shared & ComponentProps<typeof Link>) {
  return <Link {...props} className={classesFor({ size, variant, icon }, className)} />;
}

/** Para enlaces externos, que no pasan por el router. */
export function ButtonAnchor({
  size,
  variant,
  icon,
  className,
  ...props
}: Shared & ComponentProps<"a">) {
  return <a {...props} className={classesFor({ size, variant, icon }, className)} />;
}
