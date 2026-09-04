import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { Container } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { SORTS, TAGS, tagLabel, type SortKey } from "@/lib/site";

export type ViewMode = "grid" | "lista";

export function buildHref(params: { sort?: string; tag?: string; q?: string; view?: string }) {
  const search = new URLSearchParams();
  if (params.sort && params.sort !== "destacados") search.set("sort", params.sort);
  if (params.tag) search.set("tag", params.tag);
  if (params.q) search.set("q", params.q);
  if (params.view && params.view !== "grid") search.set("view", params.view);
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

const VIEW_ICONS = {
  grid: (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <rect x="1" y="1" width="6" height="6" rx="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" />
    </svg>
  ),
  lista: (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden="true">
      <rect x="1" y="2" width="14" height="2.5" rx="1.25" />
      <rect x="1" y="6.75" width="14" height="2.5" rx="1.25" />
      <rect x="1" y="11.5" width="14" height="2.5" rx="1.25" />
    </svg>
  ),
} as const;

/**
 * Todos los controles de esta barra salen del mismo set de tamanos, asi que
 * miden lo mismo sin ajustes a mano.
 */
export function FilterBar({
  sort,
  tag,
  q,
  view,
  total,
}: {
  sort: SortKey;
  tag?: string;
  q?: string;
  view: ViewMode;
  total: number;
}) {
  return (
    <div className="sticky top-16 z-30 border-b border-border/70 bg-bg/85 backdrop-blur-xl">
      <Container className="flex flex-wrap items-center gap-2 py-3">
        <Segmented
          label="Ordenar proyectos"
          value={sort}
          options={(Object.keys(SORTS) as SortKey[]).map((key) => ({
            value: key,
            label: SORTS[key].label,
            title: SORTS[key].hint,
            href: buildHref({ sort: key, tag, q, view }),
          }))}
        />

        <Dropdown
          label="Categoria"
          value={tag ? tagLabel(tag) : undefined}
          emptyHref={buildHref({ sort, q, view })}
          items={TAGS.map((item) => ({
            value: item.value,
            label: item.label,
            href: buildHref({ sort, tag: item.value === tag ? undefined : item.value, q, view }),
            active: item.value === tag,
          }))}
        />

        <form action="/" className="min-w-40 flex-1 sm:max-w-md">
          {sort !== "destacados" ? <input type="hidden" name="sort" value={sort} /> : null}
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          {view !== "grid" ? <input type="hidden" name="view" value={view} /> : null}
          <SearchInput
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar"
            aria-label="Buscar proyecto"
            className="w-full"
          />
        </form>

        {tag || q ? (
          <ButtonLink href={buildHref({ sort, view })} variant="ghost">
            Limpiar
          </ButtonLink>
        ) : null}

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted sm:inline">
            <span className="font-medium text-text">{total}</span> proyectos
          </span>
          <Segmented
            label="Modo de vista"
            value={view}
            options={(["grid", "lista"] as ViewMode[]).map((mode) => ({
              value: mode,
              label: VIEW_ICONS[mode],
              srLabel: mode === "grid" ? "Ver en cuadricula" : "Ver en lista",
              href: buildHref({ sort, tag, q, view: mode }),
            }))}
          />
        </div>
      </Container>
    </div>
  );
}
