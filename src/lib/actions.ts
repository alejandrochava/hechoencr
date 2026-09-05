"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { checkRepo, checkSite } from "@/lib/link-check";
import { findPreviewImage } from "@/lib/preview";
import { TAG_VALUES } from "@/lib/site";
import { domainAcceptsMail } from "@/lib/email";
import { notifyNewMessage } from "@/lib/mailer";
import {
  REPO_FORGES,
  isDisposableEmail,
  isValidCRMobile,
  isValidEmailSyntax,
  isValidHttpUrl,
  normalizeEmail,
  normalizePhoneCR,
  normalizeUrl,
  sanitizeProjectLinks,
  slugify,
} from "@/lib/text";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/types";

/** Vota o quita el voto. Un solo boton, un solo voto por persona. */
export async function toggleVote(projectId: string, slug?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const { data: existing } = await supabase
    .from("votes")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("votes").delete().eq("project_id", projectId).eq("user_id", user.id)
    : await supabase.from("votes").insert({ project_id: projectId, user_id: user.id });

  if (error) console.error("toggleVote:", error.code, error.message, error.details);

  revalidatePath("/");
  if (slug) revalidatePath(`/p/${slug}`);
}

export async function submitProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "necesita-sesion" };

  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  const repoUrl = normalizeUrl(String(formData.get("repo_url") ?? ""));
  const isMine = formData.get("is_mine") === "on";

  // Los enlaces extra viajan como JSON en un campo oculto; la forma la
  // garantiza sanitizeProjectLinks, no el navegador.
  let links: ReturnType<typeof sanitizeProjectLinks> = [];
  try {
    links = sanitizeProjectLinks(JSON.parse(String(formData.get("links") ?? "[]")));
  } catch {
    links = [];
  }

  const tags = formData
    .getAll("tags")
    .map(String)
    .filter((tag) => TAG_VALUES.includes(tag))
    .slice(0, 3);

  // Validamos aca y devolvemos el error por campo: el formulario va con
  // noValidate, asi que no aparece el globo del navegador y el mensaje sale
  // en espanol, debajo del campo que corresponde.
  const fields: Record<string, string> = {};
  if (name.length < 2) fields.name = "Escribi al menos dos caracteres.";
  if (name.length > 60) fields.name = "Maximo 60 caracteres.";
  if (tagline.length < 10) fields.tagline = "Contanos en una linea que hace, minimo 10 caracteres.";
  if (tagline.length > 140) fields.tagline = "Maximo 140 caracteres.";
  if (!isValidHttpUrl(url)) fields.url = "Revisa el enlace: tiene que ser una direccion web valida.";
  if (description.length > 4000) fields.description = "Maximo 4000 caracteres.";
  if (tags.length === 0) fields.tags = "Elegi al menos una categoria.";

  if (Object.keys(fields).length > 0) {
    return { error: "Revisa los campos marcados.", fields };
  }

  /*
   * Recien aca se toca la red: primero lo que se resuelve gratis, y solo si
   * eso pasa se le pregunta al sitio y a la forja. Las dos consultas van en
   * paralelo porque no dependen entre si.
   */
  const [site, repo] = await Promise.all([
    checkSite(url),
    repoUrl ? checkRepo(repoUrl) : Promise.resolve(null),
  ]);

  // Los dos errores se devuelven juntos: si no, se arregla uno, se reenvia y
  // aparece el otro.
  if (!site.ok || repo?.ok === false) {
    if (!site.ok) {
      fields.url = {
        invalida: "Revisa el enlace: tiene que ser una direccion web valida.",
        privada: "Ese enlace no apunta a un sitio publico.",
        "no-existe":
          "No encontramos nada en ese enlace. Revisa que este bien escrito y que el sitio este arriba.",
        "sin-https":
          "Ese sitio no carga por https. Para entrar al directorio necesita conexion segura.",
      }[site.reason];
    }

    if (repo?.ok === false) {
      fields.repo_url =
        repo.reason === "no-es-forja"
          ? `El repositorio tiene que estar en ${REPO_FORGES.map((forge) => forge.label).join(", ")}.`
          : "Ese repositorio no existe o es privado.";
    }

    return { error: "Revisa los campos marcados.", fields };
  }

  // Se guarda lo comprobado: la URL con https resuelto y el repo canonico, sin
  // .git ni la subruta que venia pegada de la barra de direcciones.
  const finalUrl = site.url;
  const finalRepoUrl = repo?.ok ? repo.ref.url : null;

  const base = slugify(name) || "proyecto";
  let slug = base;
  for (let i = 2; i < 40; i++) {
    const { data: taken } = await supabase.from("projects").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  // La vista previa se busca antes de insertar para que la tarjeta ya nazca
  // con imagen; si el sitio no responde, findPreviewImage devuelve el fallback.
  const imageUrl = await findPreviewImage(finalUrl);

  const { error } = await supabase.from("projects").insert({
    slug,
    name,
    tagline,
    description: description || null,
    url: finalUrl,
    repo_url: finalRepoUrl,
    image_url: imageUrl,
    links,
    tags,
    submitted_by: user.id,
    // Si lo publica su propio autor queda reclamado de una vez.
    owner_id: isMine ? user.id : null,
  });

  if (error) {
    console.error("submitProject:", error.message);
    return { error: "No se pudo guardar el proyecto. Intenta de nuevo." };
  }

  revalidatePath("/");
  redirect(`/p/${slug}?publicado=1`);
}

/**
 * Guarda el usuario de GitHub que trae la identidad de OAuth. No lo escribe la
 * persona a mano: es lo unico que hace confiable la verificacion por repo.
 */
export async function syncGithubHandle() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const github = user.identities?.find((identity) => identity.provider === "github");
  const handle =
    (github?.identity_data?.user_name as string | undefined) ??
    (github?.identity_data?.preferred_username as string | undefined);

  if (!handle) return null;

  await supabase.from("profiles").update({ github_handle: handle }).eq("id", user.id);
  return handle;
}

/** Reclamo instantaneo cuando el repo del proyecto es de tu cuenta de GitHub. */
export async function claimWithGithub(projectId: string, slug: string): Promise<ActionState> {
  const supabase = await createClient();
  await syncGithubHandle();

  const { data, error } = await supabase.rpc("claim_with_github", { p_project_id: projectId });

  if (error) {
    console.error("claimWithGithub:", error.message);
    return { error: "No se pudo verificar el repositorio." };
  }
  if (!data) {
    return {
      error:
        "El repositorio no esta en tu cuenta de GitHub enlazada. Mandanos el reclamo y lo revisamos.",
    };
  }

  revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  return { ok: "Listo, el proyecto quedo a tu nombre." };
}

export async function claimProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Entra con tu cuenta para reclamar el proyecto." };

  const projectId = String(formData.get("project_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const evidence = String(formData.get("evidence") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();

  if (evidence.length < 10) {
    return { error: "Conta como podemos verificar que el proyecto es tuyo." };
  }

  const { error } = await supabase.from("claims").insert({
    project_id: projectId,
    user_id: user.id,
    evidence,
    contact: contact || null,
  });

  if (error) {
    if (error.code === "23505") return { error: "Ya enviaste un reclamo para este proyecto." };
    console.error("claimProject:", error.message);
    return { error: "No se pudo enviar el reclamo." };
  }

  revalidatePath(`/p/${slug}`);
  return { ok: "Reclamo enviado. Lo revisamos y te avisamos." };
}

export async function resolveClaim(claimId: string, approve: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_claim", {
    p_claim_id: claimId,
    p_approve: approve,
  });

  if (error) console.error("resolveClaim:", error.message);
  revalidatePath("/admin/reclamos");
}

/**
 * Revisa correo y telefono antes de mandar el enlace de acceso.
 *
 * Una identidad, una cuenta: el correo ya es unico en Supabase Auth y el
 * telefono lo protege un indice unico. Aca damos el aviso temprano, con el
 * mensaje debajo del campo, en vez de dejar que falle al final.
 */
export async function checkRegistration(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const phoneRaw = String(formData.get("phone") ?? "");
  const phone = normalizePhoneCR(phoneRaw);

  const fields: Record<string, string> = {};

  if (!isValidEmailSyntax(email)) {
    fields.email = "Ese correo no parece valido.";
  } else if (isDisposableEmail(email)) {
    fields.email = "No aceptamos correos temporales: la cuenta es tu identidad aca.";
  } else if (!(await domainAcceptsMail(email))) {
    fields.email = "Ese dominio no recibe correo. Revisa si hay un error de dedo.";
  }

  if (!isValidCRMobile(phoneRaw)) {
    fields.phone = "Escribi un movil de Costa Rica de 8 digitos (empieza en 6, 7 u 8).";
  }

  if (Object.keys(fields).length > 0) return { error: "Revisa los campos marcados.", fields };

  // El telefono se consulta con una funcion que solo responde si o no: nunca
  // dice de quien es.
  const supabase = await createClient();
  const { data: taken } = await supabase.rpc("phone_taken", { p_phone: phone });

  if (taken) {
    return {
      error: "Revisa los campos marcados.",
      fields: { phone: "Ese numero ya tiene una cuenta. Entra con ella." },
    };
  }

  return { ok: phone ?? "" };
}

const MESSAGE_KINDS = ["contacto", "ayuda", "sugerencia"] as const;

/** Contacto, ayuda y sugerencias. Funciona con o sin sesion. */
export async function sendMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const kindRaw = String(formData.get("kind") ?? "contacto");
  const kind = (MESSAGE_KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "contacto";
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const body = String(formData.get("body") ?? "").trim();

  const fields: Record<string, string> = {};
  if (name.length < 2) fields.name = "Decinos como te llamas.";
  if (name.length > 80) fields.name = "Maximo 80 caracteres.";
  if (!isValidEmailSyntax(email)) fields.email = "Ese correo no parece valido.";
  else if (!(await domainAcceptsMail(email))) fields.email = "Ese dominio no recibe correo.";
  if (body.length < 10) fields.body = "Contanos un poco mas, minimo 10 caracteres.";
  if (body.length > 4000) fields.body = "Maximo 4000 caracteres.";

  if (Object.keys(fields).length > 0) {
    return { error: "Revisa los campos marcados.", fields };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("messages")
    .insert({ kind, name, email, body, user_id: user?.id ?? null });

  if (error) {
    console.error("sendMessage:", error.message);
    return { error: "No se pudo enviar el mensaje. Intenta de nuevo." };
  }

  // El correo es un aviso extra: si falla, el mensaje ya quedo en el panel.
  await notifyNewMessage({ kind, name, email, body });

  return { ok: "Mensaje enviado. Te respondemos apenas podamos." };
}

/** El autor decide si su nombre aparece o no junto a sus proyectos. */
export async function setProfileVisibility(visible: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.from("profiles").update({ public_profile: visible }).eq("id", user.id);

  if (profile?.handle) revalidatePath(`/u/${profile.handle}`);
  revalidatePath("/");
}

export async function markMessageHandled(messageId: string, handled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("messages").update({ handled }).eq("id", messageId);
  if (error) console.error("markMessageHandled:", error.message);
  revalidatePath("/admin/mensajes");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/");
  redirect("/");
}
