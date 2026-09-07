import type { Metadata } from "next";

import { ActionButton } from "@/components/action-button";
import { Empty, Tag } from "@/components/ui/primitives";
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

  if (messages.length === 0) {
    return (
      <Empty title="Todavia no llego ningun mensaje.">
        Lo que la gente escriba desde la pagina de contacto aparece aca, con su correo para
        responder.
      </Empty>
    );
  }

  return (
    <>
      <p className="text-sm leading-relaxed text-muted">
        {pending.length === 0
          ? `Todo atendido. ${messages.length} en total.`
          : `${pending.length} sin atender, de ${messages.length} en total.`}
      </p>

      <ul className="mt-6 space-y-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className={[
              "rounded-card border p-5 transition-opacity duration-200 ease-brand",
              // Lo atendido no se esconde, pero deja de pedir atencion.
              message.handled ? "border-border/60 opacity-60" : "border-border",
            ].join(" ")}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <Tag tone={message.handled ? "neutral" : "accent"}>{KIND_LABEL[message.kind]}</Tag>
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

            <p className="mt-4 whitespace-pre-line rounded-media bg-surface-2 p-4 text-sm leading-relaxed">
              {message.body}
            </p>

            <div className="mt-4">
              <ActionButton
                variant={message.handled ? "ghost" : "secondary"}
                size="sm"
                done={
                  message.handled ? "Vuelve a estar pendiente." : "Mensaje marcado como atendido."
                }
                action={async () => {
                  "use server";
                  await markMessageHandled(message.id, !message.handled);
                }}
              >
                {message.handled ? "Marcar como pendiente" : "Marcar como atendido"}
              </ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
