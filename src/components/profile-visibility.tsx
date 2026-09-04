"use client";

import { useState, useTransition } from "react";

import { Toggle } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { setProfileVisibility } from "@/lib/actions";

/** Solo lo ve el dueno del perfil. */
export function ProfileVisibility({ initial }: { initial: boolean }) {
  const [visible, setVisible] = useState(initial);
  const [saving, startSaving] = useTransition();
  const { show } = useToast();

  return (
    <Toggle
      checked={visible}
      disabled={saving}
      label="Mostrar mi perfil en publico"
      description={
        visible
          ? "Tu nombre aparece junto a los proyectos que publicaste o reclamaste."
          : "Tus proyectos siguen visibles, pero sin tu nombre ni enlace a este perfil."
      }
      onChange={(next) => {
        setVisible(next);
        startSaving(async () => {
          await setProfileVisibility(next);
          show(next ? "Tu perfil es publico." : "Tu perfil quedo privado.");
        });
      }}
    />
  );
}
