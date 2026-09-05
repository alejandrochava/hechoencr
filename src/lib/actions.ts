"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { listPublicRepos } from "@/lib/github";
import { checkProjectLinks, checkRepo, checkSite } from "@/lib/link-check";
import { findPreviewImage } from "@/lib/preview";
import { isCurrentUserAdmin } from "@/lib/queries";
import { TAG_VALUES, tagsFromTopics } from "@/lib/site";
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
  titleFromSlug,
  type ProjectLink,
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

/** Tope de categorias por proyecto; el formulario muestra el mismo numero. */
const MAX_TAGS = 3;

/** Motivo por el que un enlace extra no pasa, en corto: van todos en una linea. */
const LINK_REASONS = {
  invalida: "no es una direccion valida",
  privada: "no apunta a un sitio publico",
  "no-existe": "no responde",
  "sin-https": "no carga por https",
} as const;

type ProjectValues = {
  name: string;
  tagline: string;
  description: string;
  url: string;
  repoUrl: string | null;
  links: ProjectLink[];
  tags: string[];
};

type ProjectCheck =
  | { ok: false; fields: Record<string, string> }
  | { ok: true; values: ProjectValues };

/**
 * Lee y valida el formulario de un proyecto, para publicar y para editar.
 *
 * Esta junto a proposito: si las dos pantallas validaran por su cuenta, un dia
 * se podria editar un proyecto para dejarle un enlace que al publicarlo no
 * habria pasado.
 *
 * Los errores salen por campo porque el formulario va con noValidate: no
 * aparece el globo del navegador y el mensaje se lee en espanol, debajo del
 * campo que corresponde.
 */
async function checkProjectForm(formData: FormData): Promise<ProjectCheck> {
  const name = String(formData.get("name") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const url = normalizeUrl(String(formData.get("url") ?? ""));
  const repoUrl = normalizeUrl(String(formData.get("repo_url") ?? ""));

  // Los enlaces extra viajan como JSON en un campo oculto; la forma la
  // garantiza sanitizeProjectLinks, no el navegador.
  let links: ProjectLink[] = [];
  try {
    links = sanitizeProjectLinks(JSON.parse(String(formData.get("links") ?? "[]")));
  } catch {
    links = [];
  }

  const tags = formData
    .getAll("tags")
    .map(String)
    .filter((tag) => TAG_VALUES.includes(tag))
    .slice(0, MAX_TAGS);

  const fields: Record<string, string> = {};
  if (name.length < 2) fields.name = "Escribi al menos dos caracteres.";
  if (name.length > 60) fields.name = "Maximo 60 caracteres.";
  if (tagline.length < 10) fields.tagline = "Contanos en una linea que hace, minimo 10 caracteres.";
  if (tagline.length > 140) fields.tagline = "Maximo 140 caracteres.";
  if (!isValidHttpUrl(url)) fields.url = "Revisa el enlace: tiene que ser una direccion web valida.";
  if (description.length > 4000) fields.description = "Maximo 4000 caracteres.";
  if (tags.length === 0) fields.tags = "Elegi al menos una categoria.";

  if (Object.keys(fields).length > 0) return { ok: false, fields };

  /*
   * Recien aca se toca la red: primero lo que se resuelve gratis, y solo si
   * eso pasa se le pregunta al sitio, a la forja y a cada enlace extra. Van en
   * paralelo porque no dependen entre si, asi que el costo es el del mas lento.
   */
  const [site, repo, checkedLinks] = await Promise.all([
    checkSite(url),
    repoUrl ? checkRepo(repoUrl) : Promise.resolve(null),
    checkProjectLinks(links),
  ]);

  // flatMap y no filter: adentro del callback TypeScript si estrecha el union
  // y deja leer el motivo sin un predicado de tipo a mano.
  const brokenLinks = checkedLinks.flatMap((entry) =>
    entry.check.ok ? [] : [{ label: entry.link.label, reason: entry.check.reason }],
  );

  // Los errores vuelven juntos: si no, se arregla uno, se reenvia y aparece el
  // siguiente.
  if (!site.ok || repo?.ok === false || brokenLinks.length > 0) {
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

    if (brokenLinks.length > 0) {
      // Se nombran por su etiqueta, que es como los escribio quien publica, y
      // en una sola linea: son hasta MAX_PROJECT_LINKS y no tienen campo propio.
      const detail = brokenLinks
        .map((broken) => `${broken.label} (${LINK_REASONS[broken.reason]})`)
        .join(", ");
      fields.links = `Revisa estos enlaces: ${detail}.`;
    }

    return { ok: false, fields };
  }

  return {
    ok: true,
    values: {
      name,
      tagline,
      description,
      // Lo comprobado: la URL con https resuelto y el repo canonico, sin .git
      // ni la subruta que venia pegada de la barra de direcciones.
      url: site.url,
      repoUrl: repo?.ok ? repo.ref.url : null,
      links: checkedLinks.map((entry) => ({
        ...entry.link,
        url: entry.check.ok ? entry.check.url : entry.link.url,
      })),
      tags,
    },
  };
}

export async function submitProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "necesita-sesion" };

  const checked = await checkProjectForm(formData);
  if (!checked.ok) return { error: "Revisa los campos marcados.", fields: checked.fields };

  const { name, tagline, description, url, repoUrl, links, tags } = checked.values;
  const isMine = formData.get("is_mine") === "on";

  const base = slugify(name) || "proyecto";
  let slug = base;
  for (let i = 2; i < 40; i++) {
    const { data: taken } = await supabase.from("projects").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    slug = `${base}-${i}`;
  }

  // La vista previa se busca antes de insertar para que la tarjeta ya nazca
  // con imagen; si el sitio no responde, findPreviewImage devuelve el fallback.
  const imageUrl = await findPreviewImage(url);

  const { error } = await supabase.from("projects").insert({
    slug,
    name,
    tagline,
    description: description || null,
    url,
    repo_url: repoUrl,
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
 * Edita un proyecto ya publicado. Solo su dueno, o un admin.
 *
 * El slug no cambia aunque cambie el nombre: la URL es la identidad del
 * proyecto y ya puede estar compartida, en el sitemap o indexada. Renombrar no
 * deberia romper un enlace que alguien mando por WhatsApp hace un mes.
 *
 * La autorizacion de verdad la hace la RLS (politica "solo el duenno edita").
 * La comprobacion de aca es para poder decir que paso: sin ella, un update sin
 * permiso afecta cero filas y Supabase no lo reporta como error, asi que se
 * veria como si se hubiera guardado.
 */
export async function updateProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "necesita-sesion" };

  const slug = String(formData.get("slug") ?? "").trim();
  if (!slug) return { error: "No sabemos que proyecto estas editando." };

  const { data: current, error: readError } = await supabase
    .from("projects")
    .select("id, url, owner_id")
    .eq("slug", slug)
    .maybeSingle();

  if (readError) {
    console.error("updateProject lectura:", readError.message);
    return { error: "No se pudo cargar el proyecto. Intenta de nuevo." };
  }
  if (!current) return { error: "Ese proyecto no existe." };

  if (current.owner_id !== user.id && !(await isCurrentUserAdmin())) {
    return { error: "Este proyecto no esta a tu nombre." };
  }

  const checked = await checkProjectForm(formData);
  if (!checked.ok) return { error: "Revisa los campos marcados.", fields: checked.fields };

  const { name, tagline, description, url, repoUrl, links, tags } = checked.values;

  // La vista previa solo se rehace si cambio el enlace: es una peticion a un
  // sitio ajeno y corregir una coma en la descripcion no la necesita.
  const imageUrl = url === current.url ? undefined : await findPreviewImage(url);

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      tagline,
      description: description || null,
      url,
      repo_url: repoUrl,
      links,
      tags,
      ...(imageUrl === undefined ? {} : { image_url: imageUrl }),
    })
    .eq("id", current.id);

  if (error) {
    console.error("updateProject:", error.message);
    return { error: "No se pudieron guardar los cambios. Intenta de nuevo." };
  }

  revalidatePath(`/p/${slug}`);
  revalidatePath("/");
  redirect(`/p/${slug}?guardado=1`);
}

/**
 * Guarda el usuario de GitHub que trae la identidad de OAuth. No lo escribe la
 * persona a mano: es lo unico que hace confiable la verificacion por repo.
 */
/** Un repositorio listo para llenar el formulario de publicar. */
export type ImportableRepo = {
  name: string;
  fullName: string;
  tagline: string;
  url: string;
  repoUrl: string;
  tags: string[];
  stars: number;
  language: string | null;
  archived: boolean;
  /** Ya esta en el directorio: se muestra, pero no se ofrece publicarlo otra vez. */
  alreadyListed: boolean;
};

export type ReposState =
  | { ok: true; handle: string; repos: ImportableRepo[] }
  | { ok: false; message: string };

/**
 * Los repositorios publicos de quien esta con sesion, listos para publicar.
 *
 * El nombre y la bajada salen del repo pero no son la ultima palabra: el
 * formulario queda editable y la validacion es la misma de siempre. Esto ahorra
 * escribir ocho campos, no se saltea ninguna regla.
 */
export async function listMyGithubRepos(): Promise<ReposState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: "Entra con tu cuenta para traer tus repositorios." };

  /*
   * Se prueba el perfil y, si esta vacio, la identidad de la sesion: alguien
   * que acaba de entrar con GitHub tiene la identidad antes de que
   * syncGithubHandle haya corrido.
   */
  const { data: profile } = await supabase
    .from("profiles")
    .select("github_handle")
    .eq("id", user.id)
    .maybeSingle();

  const handle = (profile?.github_handle as string | null) ?? (await syncGithubHandle());

  if (!handle) {
    return {
      ok: false,
      message: "Conecta tu cuenta de GitHub desde tu perfil y volve a intentar.",
    };
  }

  const resultado = await listPublicRepos(handle);

  if (!resultado.ok) {
    const mensajes = {
      "no-existe": `No encontramos la cuenta @${handle} en GitHub.`,
      limite: "GitHub nos pidio esperar un momento. Proba de nuevo en unos minutos.",
      "sin-respuesta": "No pudimos hablar con GitHub. Proba de nuevo en un rato.",
    };
    return { ok: false, message: mensajes[resultado.reason] };
  }

  // Cuales ya estan publicados, para no ofrecer un duplicado.
  const urls = resultado.repos.map((repo) => repo.htmlUrl);
  const { data: existentes } = urls.length
    ? await supabase.from("projects").select("repo_url").in("repo_url", urls)
    : { data: [] };

  const publicados = new Set(
    ((existentes ?? []) as { repo_url: string | null }[]).flatMap((fila) =>
      fila.repo_url ? [fila.repo_url] : [],
    ),
  );

  return {
    ok: true,
    handle,
    repos: resultado.repos.map((repo) => ({
      name: titleFromSlug(repo.name),
      fullName: repo.fullName,
      // La bajada pide diez caracteres; una descripcion mas corta no ayuda.
      tagline: (repo.description ?? "").length >= 10 ? repo.description!.slice(0, 140) : "",
      url: repo.homepage ?? repo.htmlUrl,
      repoUrl: repo.htmlUrl,
      tags: tagsFromTopics(repo.topics),
      stars: repo.stars,
      language: repo.language,
      archived: repo.archived,
      alreadyListed: publicados.has(repo.htmlUrl),
    })),
  };
}

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
