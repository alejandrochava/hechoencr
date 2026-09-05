"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/**
 * Enlaza GitHub a la cuenta existente. Es lo que despues permite verificar un
 * repositorio sin revision manual.
 */
export function GithubLink() {
  const [error, setError] = useState("");

  async function link() {
    const supabase = createClient();
    const { error: linkError } = await supabase.auth.linkIdentity({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${window.location.pathname}` },
    });
    // El mensaje de Supabase viene en ingles y habla de su API, no de lo que
    // la persona intento hacer. El detalle queda en la consola.
    if (linkError) {
      console.error("linkIdentity:", linkError.message);
      setError("No pudimos conectar tu cuenta de GitHub. Proba de nuevo en un rato.");
    }
  }

  return (
    <div>
      <Button onClick={link}>
        <svg viewBox="0 0 16 16" className="size-[18px]" fill="currentColor" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.4 7.4 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
        </svg>
        Conectar GitHub
      </Button>
      {error ? <p className="mt-2 text-sm text-flag">{error}</p> : null}
    </div>
  );
}
