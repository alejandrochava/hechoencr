import { cache } from "react";

import { SORTS, type SortKey } from "@/lib/site";
import { sanitizeProjectLinks, sanitizeSearch } from "@/lib/text";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  ContactMessage,
  FeedProject,
  PendingClaim,
  Profile,
  ProjectDetail,
} from "@/lib/types";

export const PAGE_SIZE = 24;

/** Un sitemap admite 50 000 URL; con este tope entra de sobra y no se desborda. */
const SITEMAP_LIMIT = 5000;

export type FeedParams = {
  sort: SortKey;
  tag?: string;
  q?: string;
  page?: number;
};

export async function getFeed({ sort, tag, q, page = 1 }: FeedParams): Promise<{
  projects: FeedProject[];
  total: number;
}> {
  if (!isSupabaseConfigured) return { projects: [], total: 0 };

  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("project_feed")
    .select("*", { count: "exact" })
    .order(SORTS[sort].column, { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (tag) query = query.contains("tags", [tag]);

  const term = q ? sanitizeSearch(q) : "";
  if (term) {
    query = query.or(`name.ilike.%${term}%,tagline.ilike.%${term}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    console.error("getFeed:", error.message);
    return { projects: [], total: 0 };
  }

  return { projects: (data ?? []) as FeedProject[], total: count ?? 0 };
}

export async function getProject(slug: string): Promise<ProjectDetail | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `id, slug, name, tagline, description, url, repo_url, logo_url, image_url, tags, links,
       vote_count, view_count, created_at, owner_id, submitted_by,
       owner:profiles!projects_owner_id_fkey (id, handle, display_name, avatar_url, public_profile),
       submitter:profiles!projects_submitted_by_fkey (id, handle, display_name, avatar_url, public_profile)`,
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("getProject:", error.message);
    return null;
  }
  if (!data) return null;

  // PostgREST devuelve la relacion como objeto o arreglo segun la inferencia.
  const one = <T,>(value: T | T[] | null) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

  return {
    ...data,
    owner: one(data.owner),
    submitter: one(data.submitter),
    links: sanitizeProjectLinks(data.links),
  } as unknown as ProjectDetail;
}

/** Ids de los proyectos que el usuario actual ya voto, para pintar el boton. */
export async function getVotedIds(projectIds: string[]): Promise<Set<string>> {
  if (!isSupabaseConfigured || projectIds.length === 0) return new Set();

  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) return new Set();

  const { data } = await supabase
    .from("votes")
    .select("project_id")
    .eq("user_id", user.id)
    .in("project_id", projectIds);

  return new Set((data ?? []).map((row) => row.project_id as string));
}

export async function getMyClaimStatus(projectId: string) {
  if (!isSupabaseConfigured) return null;

  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) return null;

  const { data } = await supabase
    .from("claims")
    .select("status")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (data?.status as "pending" | "approved" | "rejected" | undefined) ?? null;
}

/**
 * El perfil de quien esta mirando, con el usuario que lo respalda.
 *
 * Lo piden el encabezado (nombre, avatar, si es admin) y el guardia de las
 * paginas de admin. Es la misma fila: cacheada, se lee una vez por request.
 */
export const getViewer = cache(async () => {
  if (!isSupabaseConfigured) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("handle, display_name, avatar_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as {
    handle: string | null;
    display_name: string | null;
    avatar_url: string | null;
    is_admin: boolean | null;
  } | null;

  return {
    handle: profile?.handle ?? null,
    name: profile?.display_name ?? user.email?.split("@")[0] ?? "vos",
    avatar: profile?.avatar_url ?? null,
    isAdmin: Boolean(profile?.is_admin),
  };
});

export async function isCurrentUserAdmin() {
  return Boolean((await getViewer())?.isAdmin);
}

export async function getPendingClaims(): Promise<PendingClaim[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(
      `id, evidence, contact, created_at,
       project:projects (slug, name, url),
       user:profiles (id, handle, display_name, avatar_url)`,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getPendingClaims:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    ...row,
    project: Array.isArray(row.project) ? (row.project[0] ?? null) : row.project,
    user: Array.isArray(row.user) ? (row.user[0] ?? null) : row.user,
  })) as unknown as PendingClaim[];
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, handle, display_name, avatar_url, github_handle, bio, is_admin, created_at, public_profile",
    )
    .eq("handle", handle)
    .maybeSingle();

  return (data as Profile | null) ?? null;
}

/** Proyectos que esa persona reclamo como suyos. */
export async function getProjectsByOwner(ownerId: string): Promise<FeedProject[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_feed")
    .select("*")
    .eq("owner_id", ownerId)
    .order("vote_count", { ascending: false });

  if (error) {
    console.error("getProjectsByOwner:", error.message);
    return [];
  }
  return (data ?? []) as FeedProject[];
}

export async function getMessages(): Promise<ContactMessage[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, kind, name, email, body, handled, created_at")
    .order("handled", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("getMessages:", error.message);
    return [];
  }
  return (data ?? []) as ContactMessage[];
}

/**
 * Todo lo que va en el sitemap: las fichas publicadas y los perfiles publicos.
 *
 * Los filtros van explicitos aunque la RLS ya los aplique. Aca la consulta sale
 * sin sesion —la hace un buscador—, asi que depender de la politica dejaria el
 * sitemap a merced de un cambio en el schema; y `public_profile` no lo filtra
 * ninguna politica, lo respeta la aplicacion.
 */
export async function getSitemapEntries(): Promise<{
  projects: { slug: string; updated_at: string }[];
  handles: string[];
}> {
  if (!isSupabaseConfigured) return { projects: [], handles: [] };

  const supabase = await createClient();

  const [projects, profiles] = await Promise.all([
    supabase
      .from("projects")
      .select("slug, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(SITEMAP_LIMIT),
    supabase
      .from("profiles")
      .select("handle")
      .eq("public_profile", true)
      .not("handle", "is", null)
      .limit(SITEMAP_LIMIT),
  ]);

  if (projects.error) console.error("getSitemapEntries proyectos:", projects.error.message);
  if (profiles.error) console.error("getSitemapEntries perfiles:", profiles.error.message);

  return {
    projects: (projects.data ?? []) as { slug: string; updated_at: string }[],
    handles: ((profiles.data ?? []) as { handle: string | null }[]).flatMap((row) =>
      row.handle ? [row.handle] : [],
    ),
  };
}
