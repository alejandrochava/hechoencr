import type { ProjectLink } from "@/lib/text";

export type FeedProject = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  url: string;
  repo_url: string | null;
  logo_url: string | null;
  image_url: string | null;
  submitted_by: string | null;
  tags: string[];
  vote_count: number;
  view_count: number;
  created_at: string;
  owner_id: string | null;
  is_claimed: boolean;
  hot_score: number;
  recent_votes: number;
};

export type ProjectOwner = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  /** Si es false, su nombre no se muestra ni se enlaza en publico. */
  public_profile: boolean;
};

export type Profile = ProjectOwner & {
  github_handle: string | null;
  bio: string | null;
  is_admin: boolean;
  created_at: string;
};

export type { ProjectLink } from "@/lib/text";

export type ProjectDetail = Omit<FeedProject, "is_claimed" | "hot_score" | "recent_votes"> & {
  description: string | null;
  links: ProjectLink[];
  owner: ProjectOwner | null;
  /** Quien lo trajo al directorio, sea o no su autor. */
  submitter: ProjectOwner | null;
};

export type PendingClaim = {
  id: string;
  evidence: string;
  contact: string | null;
  created_at: string;
  project: { slug: string; name: string; url: string } | null;
  user: ProjectOwner | null;
};

/** Resultado de un server action: error general, exito, o errores por campo. */
export type ActionState = {
  error?: string;
  ok?: string;
  fields?: Record<string, string>;
} | null;

export type ContactMessage = {
  id: string;
  kind: "contacto" | "ayuda" | "sugerencia";
  name: string;
  email: string;
  body: string;
  handled: boolean;
  created_at: string;
};
