import { createContext, useContext, useMemo, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Sheet, Tip } from "@/components/ui/Overlay";
import { Button } from "@/components/ui/Button";
import { TECH_HUE } from "@/components/ui/Primitives";
import { InstrumentThumb } from "@/components/Thumb";
import { FilterPanel } from "@/features/datasets/FilterPanel";
import { EMPTY, type Update } from "@/features/datasets/filters/shared";
import { GROUP_ICON, buildChips, summarize } from "@/features/datasets/chips";
import { ResizeEdge } from "@/components/ResizeEdge";
import { PANEL_MAX } from "@/lib/panelLimits";
import { useTagFilter, type Field } from "@/components/tagScope";
import { useHotkeys, useMediaQuery } from "@/hooks/hooks";
import { activeFilterCount } from "@/lib/query";
import { useUI } from "@/store/ui";
import { api } from "@/api";
import type { DatasetQuery, FilterGroup } from "@/types";

// Which filter panel section edits each applied group
const SECTION_OF: Record<FilterGroup, string> = { types: "", storage: "", date: "created", conds: "measurements", instruments: "instruments", techniques: "techniques", proposals: "proposals", keywords: "keywords" };

// One filter state shared by a page's toolbar button, applied-filter bar and side panel. Each page wraps itself in a
// FilterShell that says what the panel offers (`fields`) and which query it builds (`query`, `update`).
interface Ctx {
  query: DatasetQuery;
  update: Update;
  fields?: string[];
  count: number;
  clearAll: () => void;
  focus: (g: FilterGroup) => void;
}
const FilterCtx = createContext<Ctx | null>(null);
export const useFilterShell = () => useContext(FilterCtx)!;

export function Pill({ group, id, label, onRemove }: { group: FilterGroup; id: string; label: string; onRemove: () => void }) {
  const hue = group === "techniques" ? TECH_HUE[id] : undefined;
  const inst = group === "instruments" ? api.options.instruments().find((i) => i.pid === id) : undefined;
  // plain bold text that is its own remove button: struck through in red when pointed at, no extra mark beside it
  return (
    <span style={hue ? ({ "--t": hue[0], "--td": hue[1] } as React.CSSProperties) : undefined} className="inline-flex max-w-[260px] items-center gap-1.5 py-0.5 text-[13px] font-semibold text-fg">
      {inst && <InstrumentThumb i={inst} className="h-4 w-6 shrink-0 rounded-sm" />}
      {hue && <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--t))] dark:bg-[rgb(var(--td))]" />}
      <Tip label={`Remove ${label}`}>
        <button onClick={onRemove} aria-label={`Remove ${label}`} className="min-w-0 truncate rounded-sm hover:text-danger hover:line-through">{label}</button>
      </Tip>
    </span>
  );
}

// A clickable and/or between two pills or two groups; `strong` is the between-group one
export function Connector({ op, onFlip, strong }: { op: "or" | "and"; onFlip: () => void; strong?: boolean }) {
  return (
    <Tip label={`Click for "${op === "or" ? "and" : "or"}"`}>
      <button
        onClick={onFlip}
        aria-label={`${op}, click to switch`}
        className={clsx(
          // the between-groups switch is accent blue; the small one between values is a quiet white-grey, and and or look alike
          "shrink-0 whitespace-nowrap font-semibold transition-colors hover:bg-accent hover:text-accent-fg",
          strong ? "h-7 w-[3.25rem] rounded-md border border-accent/50 bg-accent-soft text-[11px] uppercase tracking-wider text-accent shadow-xs" : "h-5 rounded-md border border-line bg-surface-2 px-1.5 text-[10px] uppercase tracking-wider text-muted",
        )}
      >
        {op}
      </button>
    </Tip>
  );
}

export function FilterShell({ query, update, fields, onApplySaved, showLabel, scroll, children }: { query: DatasetQuery; update: Update; fields?: string[]; onApplySaved?: (qs: string) => void; showLabel?: string; scroll?: boolean; children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const open = useUI((s) => s.filtersOpen);
  const width = useUI((s) => s.filtersWidth);
  const mobileOpen = useUI((s) => s.mobileFiltersOpen);
  const set = useUI((s) => s.set);
  const ctx = useMemo<Ctx>(
    () => ({
      query,
      update,
      fields,
      // the search text and the type switch live in the toolbar, not the panel, so they are not counted on its button
      count: activeFilterCount(query) - (query.q ? 1 : 0) - query.types.length,
      clearAll: () => update(EMPTY),
      focus: (g) => set(isDesktop ? { filtersOpen: true, focusSection: SECTION_OF[g] } : { mobileFiltersOpen: true, focusSection: SECTION_OF[g] }),
    }),
    [query, update, fields, isDesktop, set],
  );
  useHotkeys({ f: () => (isDesktop ? set({ filtersOpen: !open }) : set({ mobileFiltersOpen: true })) });
  // the panel names its sections after the filter config (measurements), the query after what it holds (conds)
  const panelFields = fields?.map((f) => (f === "conds" ? "measurements" : f));
  const panel = <FilterPanel query={query} update={update} fields={panelFields} onApplySaved={onApplySaved} onHide={() => set({ filtersOpen: false })} />;
  return (
    <FilterCtx.Provider value={ctx}>
      <div className="flex h-full min-h-0 overflow-x-clip">
        {isDesktop && open && (
          <aside className="relative shrink-0 border-r border-line-strong bg-surface shadow-[inset_0_3px_0_rgb(var(--accent))]" style={{ width: Math.min(width, PANEL_MAX) }}>
            <div className="h-full overflow-y-auto">{panel}</div>
            {/* drag the edge to make the panel wider or narrower */}
            <ResizeEdge side="right" grows="right" width={width} min={240} max={PANEL_MAX} initial={296} onChange={(w) => set({ filtersWidth: w })} label="Resize filters" />
          </aside>
        )}
        {scroll ? <div className="min-w-0 flex-1 overflow-y-auto overflow-x-clip">{children}</div> : children}
        {!isDesktop && (
          <Sheet open={mobileOpen} onOpenChange={(o) => set({ mobileFiltersOpen: o })} side="left" title="Filters" footer={<Button variant="primary" className="w-full" onClick={() => set({ mobileFiltersOpen: false })}>{showLabel ?? "Show results"}</Button>}>
            {panel}
          </Sheet>
        )}
      </div>
    </FilterCtx.Provider>
  );
}

// The toolbar button that opens the panel: at the start of the toolbar on a desktop (docked against the panel), at the end on a phone
export function FilterToggle({ place }: { place: "start" | "end" }) {
  const { count } = useFilterShell();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const open = useUI((s) => s.filtersOpen);
  const set = useUI((s) => s.set);
  if ((place === "start") !== isDesktop) return null;
  const on = isDesktop && open;
  return (
    <Tip label={on ? "Hide filters" : "Show filters"} kbd="F">
      <button
        aria-pressed={on}
        onClick={() => (isDesktop ? set({ filtersOpen: !open }) : set({ mobileFiltersOpen: true }))}
        // open: a solid blue tab docked onto the panel's edge, so it reads as part of the panel; closed: a grey pill
        className={clsx(
          "relative inline-flex h-8 shrink-0 items-center gap-2 text-[13px] font-medium transition-all",
          on ? "-ml-4 rounded-l-none rounded-r-xl bg-accent pl-4 pr-3 text-accent-fg shadow-[0_2px_8px_-2px_rgb(var(--accent)/0.5)] hover:bg-accent-deep sm:-ml-6 sm:pl-6" : "rounded-lg bg-surface-3/70 px-3 text-fg hover:bg-surface-3",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
        <span className="hidden sm:inline">Filters</span>
        {/* a small circle on the corner, out of the layout, so the button never changes width */}
        {count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold leading-none text-accent-fg ring-2 ring-surface">{count}</span>}
      </button>
    </Tip>
  );
}

// What is applied, in one line of words with "Clear all"; unfold it to flip each and/or and take values off
export function AppliedFilters({ actions, className }: { actions?: ReactNode; className?: string }) {
  const { query, update, clearAll, focus } = useFilterShell();
  const open = useUI((s) => s.builderOpen);
  const chips = useMemo(() => buildChips(query, update), [query, update]);
  if (!chips.length) return null;
  const summary = summarize(chips, query.orBefore);
  const setOpen = (v: boolean) => useUI.getState().set({ builderOpen: v });
  return (
    <div className={clsx("w-full rounded-lg border border-line bg-surface-2/50", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pl-1.5 pr-2.5">
        <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-7 min-w-[220px] flex-1 items-center gap-1.5 rounded-md px-1 text-left hover:bg-surface-2">
          <ChevronDown className={clsx("h-4 w-4 shrink-0 text-subtle transition-transform", !open && "-rotate-90")} />
          <span className="truncate text-[13px] font-semibold text-fg" title={summary}>{summary}</span>
        </button>
        <span className="ml-auto flex items-center gap-2">
          {actions}
          <button onClick={clearAll} className="shrink-0 text-xs font-medium text-muted hover:text-fg">Clear all</button>
        </span>
      </div>
      {open && (
        // rows share one box; the lines between them stop short of its edges, so they read as parts of one filter
        <div className="border-t border-line px-3 animate-fade-in">
          {chips.map((c, i) => (
            <div key={c.id} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-2 py-1 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line/40">
              <div className="flex items-center justify-end self-stretch">
                {i === 0 && <span className="w-[3.25rem] text-center text-[11px] font-medium uppercase tracking-wider text-subtle">Search</span>}
                {i > 0 && <Connector op={query.orBefore.includes(c.id) ? "or" : "and"} strong onFlip={() => update({ orBefore: query.orBefore.includes(c.id) ? query.orBefore.filter((g) => g !== c.id) : [...query.orBefore, c.id] })} />}
              </div>
              <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-0.5">
                <Tip label="Edit in the filter panel">
                  <button onClick={() => focus(c.id)} className="mr-1 inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-muted hover:text-fg">
                    {(() => { const I = GROUP_ICON[c.id]; return <I className="h-3.5 w-3.5 text-subtle" strokeWidth={1.8} />; })()}{c.group}
                  </button>
                </Tip>
                {c.values.map((v, j) => (
                  <span key={v.id} className="inline-flex items-center gap-2">
                    {j > 0 &&
                      (c.flipAt ? (
                        <Connector op={c.opAt!(j)} onFlip={() => c.flipAt!(j)} />
                      ) : (
                        <Tip label="Fixed, can't be changed"><span className="shrink-0 cursor-help whitespace-nowrap text-[11px] text-subtle">{c.id === "conds" ? "and" : "or"}</span></Tip>
                      ))}
                    <Pill group={c.id} id={v.id} label={v.label} onRemove={v.remove} />
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The wrapper of one list page: it decides which filters the page offers (`fields`) and builds the query from the URL
// for them, then gives the page's list `useListFilter().test` to apply it. Give `fields` a stable (module level) array.
const ListCtx = createContext<ReturnType<typeof useTagFilter> | null>(null);
export const useListFilter = () => useContext(ListCtx)!;
export type Fields = Field[];
export function ListFilters({ fields, children }: { fields: Fields; children: ReactNode }) {
  const filter = useTagFilter(fields);
  return (
    <ListCtx.Provider value={filter}>
      <FilterShell query={filter.query} update={filter.update} fields={fields} scroll>{children}</FilterShell>
    </ListCtx.Provider>
  );
}
