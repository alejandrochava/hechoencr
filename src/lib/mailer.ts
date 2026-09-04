import "server-only";

/**
 * Aviso por correo de los mensajes que entran por el formulario.
 *
 * Dos caminos, segun lo que este configurado:
 *
 *   - Resend (HTTP), para produccion. En serverless la mayoria de proveedores
 *     bloquea el SMTP saliente, asi que una API sobre HTTPS es lo que funciona.
 *   - SMTP, para desarrollo: apunta a Mailpit y el correo se ve en el navegador
 *     sin mandar nada afuera.
 *
 * La direccion de destino vive solo en variables del servidor: nunca llega al
 * navegador ni al repositorio, que es publico. Si no hay nada configurado, el
 * mensaje igual queda guardado y visible en el panel de admin; el correo es un
 * aviso, no el canal principal.
 */

const to = process.env.CONTACT_EMAIL;
const from = process.env.MAIL_FROM ?? "Hecho en CR <onboarding@resend.dev>";
const resendKey = process.env.RESEND_API_KEY;
const smtpHost = process.env.SMTP_HOST;

export const mailerConfigured = Boolean(to && (resendKey || smtpHost));

/** Evita que el asunto o el remitente puedan inyectar cabeceras. */
function singleLine(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
}

export type OutgoingMessage = {
  kind: string;
  name: string;
  email: string;
  body: string;
};

export async function notifyNewMessage(message: OutgoingMessage): Promise<boolean> {
  if (!to) return false;

  const subject = `[${singleLine(message.kind)}] ${singleLine(message.name)}`;
  const replyTo = `${singleLine(message.name)} <${singleLine(message.email)}>`;
  const text = `${message.name} <${message.email}>\nTipo: ${message.kind}\n\n${message.body}`;

  try {
    if (resendKey) return await sendWithResend({ subject, replyTo, text });
    if (smtpHost) return await sendWithSmtp({ subject, replyTo, text });
    return false;
  } catch (error) {
    // Un fallo de correo no puede tumbar el formulario: el mensaje ya se guardo.
    console.error("notifyNewMessage:", error instanceof Error ? error.message : error);
    return false;
  }
}

type Payload = { subject: string; replyTo: string; text: string };

async function sendWithResend({ subject, replyTo, text }: Payload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${resendKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text, reply_to: replyTo }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    console.error("resend:", response.status, await response.text().catch(() => ""));
    return false;
  }
  return true;
}

async function sendWithSmtp({ subject, replyTo, text }: Payload) {
  // Import perezoso: nodemailer solo se carga si de verdad se usa SMTP, asi no
  // pesa en el paquete que sube a produccion.
  const nodemailer = (await import("nodemailer")).default;

  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transport.sendMail({ from, to, subject, text, replyTo });
  return true;
}
