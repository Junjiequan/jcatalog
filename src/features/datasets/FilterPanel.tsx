import clsx from "clsx";
import { FilterX, FoldVertical, UnfoldVertical } from "lucide-react";
import { Tip } from "@/components/ui/Overlay";
import { activeFilterCount } from "@/lib/query";
import { useUI } from "@/store/ui";
import type { DatasetQuery } from "@/types";
import { useFilterConfig } from "@/hooks/useFilterConfig";
import { Skeleton } from "@/components/ui/Primitives";
import { EMPTY, type P, type Update } from "./filters/shared";
import { Section } from "./filters/Section";
import { InstrumentTiles, TechniqueTiles } from "./filters/Tiles";
import { KeywordFacet } from "./filters/KeywordFacet";
import { RowsFacet } from "./filters/RowsFacet";
import { Timeline } from "./filters/Timeline";
import { DataToggles } from "./filters/Toggles";
import { Measurements } from "./filters/Measurements";
import { SavedTile } from "./filters/SavedTile";

// One configured entry becomes the widget its field and widget name select
function FilterEntryView(p: P) {
  const { field, widget } = p.entry;
  if (field === "techniques") return widget === "rows" ? <RowsFacet {...p} /> : <TechniqueTiles {...p} />;
  if (field === "instruments") return widget === "rows" ? <RowsFacet {...p} /> : <InstrumentTiles {...p} />;
  if (field === "proposals") return <RowsFacet {...p} />;
  if (field === "keywords") return widget === "rows" ? <RowsFacet {...p} /> : <KeywordFacet {...p} />;
  if (field === "created") return <Timeline {...p} />;
  if (field === "data") return <DataToggles {...p} />;
  return <Measurements {...p} />;
}

export function FilterPanel({ query, update, onApplySaved, onHide }: { query: DatasetQuery; update: Update; onApplySaved: (qs: string) => void; onHide?: () => void }) {
  const saved = useUI((s) => s.savedSearches);
  const del = useUI((s) => s.deleteSearch);
  const n = activeFilterCount(query);
  const config = useFilterConfig();
  const sections = useUI((s) => s.filterSections);
  const set = useUI((s) => s.set);
  // every section key, so one click can open or fold them all; "all folded" means each is explicitly closed
  const keys = [...(saved.length ? ["Saved searches"] : []), ...(config?.filters.map((f) => f.field) ?? [])];
  const allFolded = keys.length > 0 && keys.every((k) => sections[k] === false);
  const foldAll = (open: boolean) => set({ filterSections: { ...sections, ...Object.fromEntries(keys.map((k) => [k, open])) } });
  return (
    <div className="@container pb-40">
      <div className={clsx("panel-head sticky top-0 z-10 flex h-10 items-center border-b border-line-strong/50 bg-surface/95 px-4 backdrop-blur-sm", onHide ? "justify-between" : "justify-end")}>
        {onHide && <h2 className="text-sm font-semibold">Filters</h2>}
        <div className="flex items-center gap-2">
          {n > 0 && (
            <Tip label={`Clear all filters (${n})`}>
              <button onClick={() => update(EMPTY)} aria-label={`Clear all ${n} filters`} className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg">
                <FilterX className="h-4 w-4" />
              </button>
            </Tip>
          )}
          <Tip label={allFolded ? "Expand all" : "Collapse all"}>
            <button onClick={() => foldAll(allFolded)} aria-label={allFolded ? "Expand all sections" : "Collapse all sections"} className="rounded-md p-1 text-subtle hover:bg-surface-2 hover:text-fg">
              {allFolded ? <UnfoldVertical className="h-4 w-4" /> : <FoldVertical className="h-4 w-4" />}
            </button>
          </Tip>
        </div>
      </div>
      {saved.length > 0 && (
        <Section title="Saved searches" defaultOpen>
          <div className="grid grid-cols-1 gap-1 @[252px]:grid-cols-2">
            {saved.map((s) => <SavedTile key={s.id} s={s} onApply={() => onApplySaved(s.qs)} onDelete={() => del(s.id)} />)}
          </div>
        </Section>
      )}
      {config ? (
        config.filters.map((entry) => <FilterEntryView key={entry.field} entry={entry} query={query} update={update} />)
      ) : (
        <div className="space-y-3 px-4 py-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div>
      )}
    </div>
  );
}
