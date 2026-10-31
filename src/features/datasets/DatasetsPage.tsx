import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canCreateDatasets, useRole } from "@/lib/permissions";
import { useNavigate, useSearchParams } from "react-router";
import clsx from "clsx";
import { Bookmark, ChevronDown, Layers, Columns3, LayoutGrid, Plus, Rows3, SearchX, Sparkles, ArrowUpDown, Database } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuCheck, MenuLabel, MenuRadio, MenuSep, Pop, Sheet } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, Kbd, Pager, Segmented } from "@/components/ui/Primitives";
import { SearchInput } from "@/components/ui/SearchInput";
import { AppliedFilters, FilterShell, FilterToggle } from "@/components/FilterShell";
import { ResizeEdge } from "@/components/ResizeEdge";
import { useDock, usePanelWidth } from "@/components/SidePanel";
import { api } from "@/api";
import { bus } from "@/lib/bus";
import { useDebounced, useElementWidth, useHotkeys, useMediaQuery, useRowClicks, yieldSelectionTo } from "@/hooks/hooks";
import { useResource } from "@/api/hooks";
import { useLazy } from "@/hooks/useLazy";
import { fmtNum } from "@/lib/format";
import { DEFAULT_QUERY, activeFilterCount, datasetLink, filterKey, parseQuery, serializeQuery } from "@/lib/query";
import { useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";
import { kindOf, useUI, type ColumnKey } from "@/store/ui";
import { type DatasetQuery, type Scope, type SortKey } from "@/types";
import { DatasetGrid, DatasetTable, GridSkeleton, TableSkeleton } from "./DatasetViews";
import { PeekContent } from "./PeekPanel";

// One group per filter, each value its own pill. Every connector is a switch: between values of a multi-valued
// group (technique, keyword) and between groups. "and" binds tighter than "or", as in a or (b and c).
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "creationTime", label: "Date created" },
  { value: "name", label: "Name" },
  { value: "size", label: "Size" },
  { value: "numberOfFiles", label: "Number of files" },
  { value: "runNumber", label: "Run number" },
  { value: "instrumentName", label: "Instrument" },
];
const COLUMN_LABELS: Record<ColumnKey, string> = { runNumber: "Run number", keywords: "Keywords", instrument: "Instrument", technique: "Technique", proposal: "Proposal", sample: "Sample", type: "Type", created: "Created", size: "Size", files: "Files", owner: "Owner" };

function SaveSearch({ qs }: { qs: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // "new", or the id of a saved search to overwrite with the current query
  const [target, setTarget] = useState("new");
  const saved = useUI((s) => s.savedSearches).filter((s) => kindOf(s) === "datasets");
  const save = () => {
    if (!name.trim()) return;
    if (target === "new") useUI.getState().saveSearch(name.trim(), qs);
    else useUI.getState().updateSearch(target, { name: name.trim(), qs });
    toast.success(target === "new" ? "Search saved" : "Saved search updated", { description: "Find it any time at the top of the filter panel, or manage all of them in Settings." });
    setName("");
    setTarget("new");
    setOpen(false);
  };
  return (
    <Pop
      open={open}
      onOpenChange={setOpen}
      className="w-72"
      trigger={
        <button className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-accent/40 bg-accent-soft px-2.5 text-xs font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-accent-fg">
          <Bookmark className="h-3.5 w-3.5" />Save search
        </button>
      }
    >
      {saved.length > 0 && (
        <>
          <label className="label" htmlFor="save-search-target">Save as</label>
          <select id="save-search-target" value={target} onChange={(e) => { setTarget(e.target.value); const cur = saved.find((x) => x.id === e.target.value); if (cur) setName(cur.name); }} className="field mb-3 h-9 text-sm">
            <option value="new">A new saved search</option>
            {saved.map((x) => <option key={x.id} value={x.id}>Update “{x.name}”</option>)}
          </select>
        </>
      )}
      <label className="label" htmlFor="save-search-name">Name this search</label>
      <input id="save-search-name" autoFocus className="field" value={name} placeholder="e.g. Cold lysozyme runs" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      <Button variant="primary" className="mt-3 w-full" disabled={!name.trim()} onClick={save}>Save</Button>
    </Pop>
  );
}

export default function DatasetsPage() {
  useRole();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const query = useMemo(() => parseQuery(sp), [sp]);
  const peek = sp.get("peek");

  const view = useUI((s) => s.view);
  const density = useUI((s) => s.density);
  const columns = useUI((s) => s.columns);
  const filtersOpen = useUI((s) => s.filtersOpen);
  const tipsDismissed = useUI((s) => s.tipsDismissed);
  const set = useUI((s) => s.set);
  const selCount = useSelection((s) => Object.keys(s.items).length);
  const isXL = useMediaQuery("(min-width: 1280px)");
  const is2XL = useMediaQuery("(min-width: 1536px)");
  const selectionOpen = useUI((s) => s.selectionOpen);
  // the selection panel and the preview share the dock unless the screen is wide enough for both
  const covered = useDock(selectionOpen).hidden;
  const inlinePeek = isXL && !covered && (!filtersOpen || is2XL);
  const { width: sidePanelWidth, max: sidePanelMax } = usePanelWidth("previewWidth", inlinePeek && !!peek);
  const [resultsRef] = useElementWidth<HTMLDivElement>();

  const listKey = serializeQuery(query).toString();
  const { data, error, loading, reload } = useResource(["datasets", listKey], () => api.datasets.list(query));
  const items = data?.items ?? [];
  // the count is its own bounded call (stops at a cap), so the rows never wait for it
  const count = useLazy(`total|${filterKey(query)}`, (signal) => api.datasets.total(query, signal), true, 0);
  const total = count.data?.total;
  const hasMore = data?.hasMore ?? false;
  // while a new count is on its way the old one would be wrong, so show nothing rather than a stale number
  const totalLabel = total === undefined || count.loading ? undefined : `${fmtNum(total)}${count.data?.capped ? "+" : ""}`;
  const totalPages = total === undefined || count.data?.capped ? undefined : Math.max(1, Math.ceil(total / query.pageSize));

  const update = useCallback(
    (patch: Partial<DatasetQuery>) =>
      setSp(
        (prev) => {
          const next = serializeQuery({ ...parseQuery(prev), ...patch, page: patch.page ?? 1 });
          const p = prev.get("peek");
          if (p) next.set("peek", p);
          return next;
        },
        { replace: true },
      ),
    [setSp],
  );
  // a pick inside the phone preview sheet: apply the filter and close the sheet in one URL write (two writes would overwrite each other)
  const pickAndClose = useCallback(
    (patch: Partial<DatasetQuery>) => setSp((prev) => serializeQuery({ ...parseQuery(prev), ...patch, page: 1 }), { replace: true }),
    [setSp],
  );
  const setPeek = useCallback(
    (pid: string | null) => {
      yieldSelectionTo(pid);
      setSp((prev) => {
        const n = new URLSearchParams(prev);
        // the item that is already open, picked again, closes its preview
        if (pid && prev.get("peek") !== pid) n.set("peek", pid);
        else n.delete("peek");
        return n;
      }, { replace: true });
    },
    [setSp],
  );
  const clicks = useRowClicks(peek, setPeek, (pid) => nav(datasetLink(pid)));

  // search box: local text, debounced into the URL
  const [text, setText] = useState(query.q);
  const textRef = useRef(text);
  textRef.current = text;
  const qRef = useRef(query.q);
  qRef.current = query.q;
  const updateRef = useRef(update);
  updateRef.current = update;
  const dText = useDebounced(text, 280);
  useEffect(() => {
    if (dText === qRef.current || dText !== textRef.current) return;
    updateRef.current({ q: dText });
  }, [dText]);
  useEffect(() => setText(query.q), [query.q]);

  useEffect(() => {
    const on = () => reload();
    bus.addEventListener("job-done", on);
    bus.addEventListener("data-changed", on);
    return () => {
      bus.removeEventListener("job-done", on);
      bus.removeEventListener("data-changed", on);
    };
  }, [reload]);

  useEffect(() => {
    if (data && !data.items.length && query.page > 1) update({ page: 1 });
  }, [data, query.page, update]);

  useEffect(() => {
    if (peek) document.querySelector(`[data-pid="${peek}"]`)?.scrollIntoView({ block: "nearest" });
  }, [peek]);

  const move = (delta: number) => {
    if (!items.length) return;
    const i = items.findIndex((d) => d.pid === peek);
    const next = items[Math.min(items.length - 1, Math.max(0, i === -1 ? 0 : i + delta))];
    setPeek(next.pid);
  };

  useHotkeys({
    j: () => move(1),
    k: () => move(-1),
    x: () => {
      const d = items.find((i) => i.pid === peek);
      if (d) useSelection.getState().toggle(d);
    },
    Enter: (e) => {
      const tag = (e.target as HTMLElement).tagName;
      if (peek && (tag === "BODY" || tag === "TR")) nav(datasetLink(peek));
    },
    Escape: () => peek && !document.querySelector("[role=dialog]") && setPeek(null),
  });

  // the expression in words, for the collapsed bar
  // a keyword chip anywhere in the results adds that keyword as a filter
  const onInstrument = (id: string) => update({ instruments: query.instruments.includes(id) ? query.instruments : [...query.instruments, id] });
  const onTechnique = (t: string) => update({ techniques: query.techniques.includes(t) ? query.techniques : [...query.techniques, t] });
  const onKeyword = (k: string) => update({ keywords: query.keywords.includes(k) ? query.keywords : [...query.keywords, k] });
  const hasFilters = activeFilterCount(query) > 0;
  const clearAll = () => update({ q: "", types: [], instruments: [], techniques: [], proposals: [], keywords: [], storage: [], from: undefined, to: undefined, conds: [], and: {}, orBefore: [] });
  const onSort = (k: SortKey) => update(query.sort === k ? { dir: query.dir === "asc" ? "desc" : "asc" } : { sort: k, dir: k === "name" || k === "instrumentName" ? "asc" : "desc" });
  const applySaved = (qs: string) => setSp(new URLSearchParams(qs), { replace: true });

  const from = items.length ? (query.page - 1) * query.pageSize + 1 : 0;
  const to = from + items.length - 1;

  return (
    <FilterShell query={query} update={update} onApplySaved={applySaved} showLabel={totalLabel ? `Show ${totalLabel} results` : undefined}>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 space-y-3 border-b border-line bg-surface px-4 pb-3 pt-4 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Datasets</h1>

          <div className="flex flex-wrap items-center gap-3">
            <FilterToggle place="start" />
            <SearchInput value={text} onChange={setText} placeholder="Search by name, PID, sample, proposal or keyword…" />
            <Segmented
              stretch
              value={query.scope}
              onChange={(v: Scope) => update({ scope: v })}
              options={[
                { value: "mine", label: "My data" },
                { value: "shared", label: <><span className="sm:hidden">Shared</span><span className="hidden sm:inline">Shared with me</span></> },
                { value: "public", label: "Public" },
                { value: "all", label: "All" },
              ]}
            />
            {/* raw or derived: a different kind of filter from the scope, so a compact menu, not a second segmented row */}
            <Menu
              tip="Raw or derived data"
              trigger={
                <Button className={query.types.length === 1 ? "border-accent/50 bg-accent-soft text-accent" : ""}>
                  <Layers className="h-4 w-4" />
                  {query.types.length === 1 ? (query.types[0] === "raw" ? "Raw" : "Derived") : "Type"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              }
            >
              <MenuLabel>Type</MenuLabel>
              <MenuRadio
                value={query.types.length === 1 ? query.types[0] : "any"}
                onValueChange={(v) => update({ types: v === "any" ? [] : [v as DatasetQuery["types"][number]] })}
                options={[{ value: "any", label: "Any" }, { value: "raw", label: "Raw" }, { value: "derived", label: "Derived" }]}
              />
            </Menu>
            <div className="ml-auto flex items-center gap-1.5">
              <FilterToggle place="end" />
              <Menu trigger={<Button><ArrowUpDown className="h-4 w-4" /><span className="hidden md:inline">Sort</span></Button>}>
                <MenuLabel>Sort by</MenuLabel>
                <MenuRadio value={query.sort} onValueChange={(v) => update({ sort: v as SortKey })} options={SORT_OPTIONS} />
                <MenuSep />
                <MenuRadio value={query.dir} onValueChange={(v) => update({ dir: v as "asc" | "desc" })} options={[{ value: "desc", label: "Descending" }, { value: "asc", label: "Ascending" }]} />
              </Menu>
              {view === "table" && (
                <Menu tip="View options: density and columns" trigger={<Button size="icon" aria-label="View options"><Columns3 className="h-4 w-4" /></Button>}>
                  <MenuLabel>Row density</MenuLabel>
                  <MenuRadio value={density} onValueChange={(v) => set({ density: v as "comfortable" | "compact" })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
                  <MenuSep />
                  <MenuLabel>Columns</MenuLabel>
                  {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((k) => <MenuCheck key={k} checked={columns[k]} onCheckedChange={() => useUI.getState().toggleColumn(k)}>{COLUMN_LABELS[k]}</MenuCheck>)}
                </Menu>
              )}
              <Segmented value={view} onChange={(v) => set({ view: v })} options={[{ value: "table", icon: Rows3, title: "Table" }, { value: "grid", icon: LayoutGrid, title: "Gallery" }]} />
            </div>
          </div>

          <AppliedFilters actions={<SaveSearch qs={serializeQuery({ ...query, page: 1 }).toString()} />} />
        </div>

        <div ref={resultsRef} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-clip bg-surface">
          {loading && data && <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-accent/15"><div className="h-full w-1/3 animate-bar bg-accent" /></div>}
          {!tipsDismissed && !error && (
            <div className="mx-4 mt-3 hidden items-center gap-3 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-[13px] md:flex sm:mx-6">
              <Sparkles className="h-4 w-4 shrink-0 text-accent" />
              <p className="flex-1 text-fg/80">
                <b className="font-semibold text-fg">Quick tips:</b> click any dataset to preview it without leaving the list · press <Kbd>X</Kbd> to collect datasets · press <Kbd>J</Kbd>/<Kbd>K</Kbd> to move through results · press <Kbd>?</Kbd> (<Kbd>Shift</Kbd> + <Kbd>/</Kbd>) for every shortcut.
              </p>
              <button onClick={() => set({ tipsDismissed: true })} className="shrink-0 self-center text-xs font-semibold text-accent hover:underline">Got it</button>
            </div>
          )}
          {error ? (
            <ErrorState title="Couldn't load datasets" message="The catalog didn't respond. Your filters are safe — try again." onRetry={reload} />
          ) : !data ? (
            view === "table" ? <TableSkeleton density={density} /> : <GridSkeleton />
          ) : items.length === 0 ? (
            hasFilters ? (
              <EmptyState icon={SearchX} title="No datasets match your filters" description={query.scope !== "all" ? "Try removing a filter, or look beyond your own data." : "Try removing a filter or widening the date range."}>
                <Button variant="primary" onClick={clearAll}>Clear all filters</Button>
              </EmptyState>
            ) : (
              <EmptyState icon={Database} title={query.scope === "mine" ? "You don't have any datasets yet" : "Nothing here yet"} description={query.scope === "mine" ? (canCreateDatasets() ? "Create a dataset, or ask a collaborator to share theirs with you." : "Datasets are registered by facility staff. Ask a collaborator to share theirs with you.") : "No datasets are visible in this view."}>
                {canCreateDatasets() && <Button variant="primary" onClick={() => set({ createOpen: true })}><Plus className="h-4 w-4" />Create dataset</Button>}
              </EmptyState>
            )
          ) : (
            <div className={clsx("transition-opacity duration-150", loading && "opacity-60")}>
              {view === "table" ? (
                <DatasetTable onKeyword={onKeyword} onInstrument={onInstrument} onTechnique={onTechnique} items={items} peek={peek} onPeek={clicks.click} onOpen={clicks.dbl} density={density} columns={columns} sort={query.sort} dir={query.dir} onSort={onSort} />
              ) : (
                <DatasetGrid onKeyword={onKeyword} onInstrument={onInstrument} onTechnique={onTechnique} items={items} peek={peek} onPeek={clicks.click} onOpen={clicks.dbl} hasMore={hasMore} onNext={() => update({ page: query.page + 1 })} />
              )}
            </div>
          )}
          {data && items.length > 0 && (
            <Pager
              className="sticky bottom-0 z-10 border-t border-line bg-surface px-4 py-2 sm:px-6"
              from={from}
              to={to}
              totalLabel={totalLabel}
              page={query.page}
              totalPages={totalPages}
              hasMore={hasMore}
              pageSize={query.pageSize}
              onPage={(page) => update({ page })}
              onPageSize={(pageSize) => update({ pageSize })}
            />
          )}
          {selCount > 0 && <div className="h-20" />}
        </div>

      </section>

      {inlinePeek && peek && (
        <aside className="relative shrink-0 border-l border-line bg-surface animate-slide-in-right" style={{ width: sidePanelWidth }}>
          <ResizeEdge side="left" grows="left" width={sidePanelWidth} min={320} max={sidePanelMax} initial={400} onChange={(w) => set({ previewWidth: w })} label="Resize preview" tone="blue" />
          <PeekContent key={peek} pid={peek} onKeyword={onKeyword} onInstrument={onInstrument} onTechnique={onTechnique} onClose={() => setPeek(null)} onPrev={() => move(-1)} onNext={() => move(1)} />
        </aside>
      )}
      {!inlinePeek && !covered && (
        <Sheet open={!!peek} onOpenChange={(o) => !o && setPeek(null)} title="Preview" width="sm:w-[420px]">
          {peek && <PeekContent pid={peek} onKeyword={(k) => pickAndClose({ keywords: query.keywords.includes(k) ? query.keywords : [...query.keywords, k] })} onInstrument={(i) => pickAndClose({ instruments: query.instruments.includes(i) ? query.instruments : [...query.instruments, i] })} onTechnique={(t) => pickAndClose({ techniques: query.techniques.includes(t) ? query.techniques : [...query.techniques, t] })} onClose={() => setPeek(null)} embedded />}
        </Sheet>
      )}
    </FilterShell>
  );
}

export { DEFAULT_QUERY };
