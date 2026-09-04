import type { Metadata } from "next";

import { Button, ButtonLink } from "@/components/ui/button";
import { Container, Tag } from "@/components/ui/primitives";
import { markMessageHandled } from "@/lib/actions";
import { getMessages } from "@/lib/queries";

export const metadata: Metadata = { title: "Mensajes" };

const dateFormat = new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" });

const KIND_LABEL = {
  ayuda: "Ayuda",
  sugerencia: "Sugerencia",
  contacto: "Contacto",
} as const;

/** El guardia de admin vive en src/proxy.ts: aca ya se sabe quien entra. */
export default async function MensajesPage() {
  const messages = await getMessages();
  const pending = messages.filter((message) => !message.handled);

  return (
    <Container width="narrow" className="animate-fade py-16">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="display text-[clamp(1.75rem,6vw,2.75rem)]">Mensajes</h1>
        <ButtonLink href="/admin/reclamos" variant="ghost" size="sm">
          Ver reclamos
        </ButtonLink>
      </div>
      <p className="mt-4 text-sm text-muted">
        {pending.length} sin atender de {messages.length} en total.
      </p>

      {messages.length === 0 ? (
        <p className="mt-14 text-center text-muted">Todavia no llego ningun mensaje.</p>
      ) : (
        <ul className="mt-10">
          {messages.map((message) => (
            <li
              key={message.id}
              className={message.handled ? "border-t border-border/70 py-6 opacity-55" : "border-t border-border/70 py-6"}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <Tag tone={message.handled ? "neutral" : "accent"}>
                  {KIND_LABEL[message.kind]}
                </Tag>
                <span className="font-semibold">{message.name}</span>
                <a
                  href={`mailto:${message.email}`}
                  className="font-mono text-xs text-muted underline-offset-2 hover:underline"
                >
                  {message.email}
                </a>
                <span className="ml-auto text-xs text-faint">
                  {dateFormat.format(new Date(message.created_at))}
                </span>
              </div>

              <p className="mt-3 whitespace-pre-line rounded-card bg-surface-2 p-4 text-sm leading-relaxed">
                {message.body}
              </p>

              <form
                className="mt-4"
                action={async () => {
                  "use server";
                  await markMessageHandled(message.id, !message.handled);
                }}
              >
                <Button type="submit" variant={message.handled ? "ghost" : "secondary"} size="sm">
                  {message.handled ? "Marcar como pendiente" : "Marcar como atendido"}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
