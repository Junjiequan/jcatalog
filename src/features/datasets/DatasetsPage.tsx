import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canCreateDatasets, useRole } from "@/lib/permissions";
import { useNavigate, useSearchParams } from "react-router";
import clsx from "clsx";
import { Bookmark, ChevronDown, ChevronsLeft, ChevronsRight, Columns3, LayoutGrid, Plus, Rows3, SlidersHorizontal, SearchX, Sparkles, X, ArrowUpDown, Database } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Menu, MenuCheck, MenuLabel, MenuRadio, MenuSep, Pop, Sheet, Tip } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, Kbd, Pager, Segmented, TECH_HUE } from "@/components/ui/Primitives";
import { SearchInput } from "@/components/ui/SearchInput";
import { InstrumentThumb } from "@/components/Thumb";
import { api } from "@/api";
import { bus } from "@/lib/bus";
import { useDebounced, useElementWidth, useHotkeys, useMediaQuery } from "@/hooks/hooks";
import { useResource } from "@/api/hooks";
import { useLazy } from "@/hooks/useLazy";
import { fmtNum } from "@/lib/format";
import { DEFAULT_QUERY, activeFilterCount, datasetLink, filterKey, parseQuery, serializeQuery } from "@/lib/query";
import { useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";
import { useUI, type ColumnKey } from "@/store/ui";
import { type DatasetQuery, type FilterGroup, type Scope, type SortKey } from "@/types";
import { DatasetGrid, DatasetTable, GridSkeleton, TableSkeleton } from "./DatasetViews";
import { FilterPanel } from "./FilterPanel";
import { PeekContent } from "./PeekPanel";
import { GROUP_ICON, buildChips, summarize } from "./chips";

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

// which filter section edits each applied group
const SECTION_OF: Record<FilterGroup, string> = { types: "data", storage: "data", date: "created", conds: "measurements", instruments: "instruments", techniques: "techniques", proposals: "proposals", keywords: "keywords" };

// One applied value: technique pills carry their hue, instrument pills a thumbnail, the rest the accent
function Pill({ group, id, label, onRemove, onEdit }: { group: FilterGroup; id: string; label: string; onRemove: () => void; onEdit: () => void }) {
  const hue = group === "techniques" ? TECH_HUE[id] : undefined;
  const inst = group === "instruments" ? api.options.instruments().find((i) => i.pid === id) : undefined;
  return (
    <span
      style={hue ? ({ "--t": hue[0], "--td": hue[1] } as React.CSSProperties) : undefined}
      className="inline-flex h-6 max-w-[260px] items-center rounded-full border border-line bg-surface-2 pr-0.5 text-xs font-medium text-fg"
      title={label}
    >
      <Tip label="Edit in the filter panel">
        <button onClick={onEdit} className={clsx("inline-flex h-full min-w-0 items-center gap-1 rounded-l-full", inst ? "pl-0.5" : "pl-2")}>
          {hue && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--t))] dark:bg-[rgb(var(--td))]" />}
          {inst && <InstrumentThumb i={inst} className="h-5 w-8 shrink-0 rounded-sm" />}
          <span className="truncate">{label}</span>
        </button>
      </Tip>
      <button onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-full p-0.5 text-subtle hover:bg-fg/10 hover:text-fg"><X className="h-3 w-3" /></button>
    </span>
  );
}

// A clickable and/or between two pills or two groups; `strong` is the between-group one
function Connector({ op, onFlip, strong }: { op: "or" | "and"; onFlip: () => void; strong?: boolean }) {
  return (
    <Tip label={`Click for "${op === "or" ? "and" : "or"}"`}>
      <button
        onClick={onFlip}
        aria-label={`${op}, click to switch`}
        className={clsx(
          // accent-tinted so the switch reads as a control, not as another grey tag
          "shrink-0 whitespace-nowrap font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-fg",
          op === "and" ? "border-accent/50 bg-surface" : "border-accent/50 bg-accent-soft",
          strong ? "h-7 w-[3.25rem] rounded-md border text-[11px] uppercase tracking-wider shadow-xs" : "h-5 rounded-md border px-1.5 text-[10px] uppercase tracking-wider shadow-xs",
        )}
      >
        {op}
      </button>
    </Tip>
  );
}

function SaveSearch({ qs }: { qs: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  // "new", or the id of a saved search to overwrite with the current query
  const [target, setTarget] = useState("new");
  const saved = useUI((s) => s.savedSearches);
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
  const filtersWidth = useUI((s) => s.filtersWidth);
  const tipsDismissed = useUI((s) => s.tipsDismissed);
  const mobileFilters = useUI((s) => s.mobileFiltersOpen);
  const set = useUI((s) => s.set);
  const selCount = useSelection((s) => Object.keys(s.items).length);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isXL = useMediaQuery("(min-width: 1280px)");
  const is2XL = useMediaQuery("(min-width: 1536px)");
  const inlinePeek = isXL && (!filtersOpen || is2XL);
  const [resultsRef, resultsWidth] = useElementWidth<HTMLDivElement>();

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
    (pid: string | null) =>
      setSp((prev) => {
        const n = new URLSearchParams(prev);
        if (pid) n.set("peek", pid);
        else n.delete("peek");
        return n;
      }, { replace: true }),
    [setSp],
  );

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
    f: () => (isDesktop ? set({ filtersOpen: !filtersOpen }) : set({ mobileFiltersOpen: true })),
  });

  const chips = useMemo(() => buildChips(query, update), [query, update]);
  const builderOpen = useUI((s) => s.builderOpen);
  const setBuilderOpen = (v: boolean) => useUI.getState().set({ builderOpen: v });
  // the expression in words, for the collapsed bar
  const summary = summarize(chips, query.orBefore);
  // a keyword chip anywhere in the results adds that keyword as a filter
  const onInstrument = (id: string) => update({ instruments: query.instruments.includes(id) ? query.instruments : [...query.instruments, id] });
  const onTechnique = (t: string) => update({ techniques: query.techniques.includes(t) ? query.techniques : [...query.techniques, t] });
  const onKeyword = (k: string) => update({ keywords: query.keywords.includes(k) ? query.keywords : [...query.keywords, k] });
  const nFilters = activeFilterCount(query) - (query.q ? 1 : 0);
  // open the panel (or the sheet on a phone) and bring the section that edits this group into view
  // on a desktop the toggle sits at the very start of the toolbar, against the panel it opens and closes
  const filtersOn = isDesktop && filtersOpen;
  const filtersBtn = (
    <Tip label={filtersOn ? "Hide filters" : "Show filters"} kbd="F">
      <button
        aria-pressed={filtersOn}
        onClick={() => (isDesktop ? set({ filtersOpen: !filtersOpen }) : set({ mobileFiltersOpen: true }))}
        // open: a solid blue tab docked onto the panel's edge, so it reads as part of the panel (click to fold it away);
        // closed: a grey pill with an arrow pointing out (click to open it)
        className={clsx(
          "inline-flex h-9 shrink-0 items-center gap-2 text-sm font-medium transition-all",
          filtersOn ? "-ml-4 rounded-l-none rounded-r-xl bg-accent pl-4 pr-3 text-accent-fg shadow-[0_2px_8px_-2px_rgb(var(--accent)/0.5)] hover:bg-accent-deep sm:-ml-6 sm:pl-6" : "rounded-lg bg-surface-3/70 px-3 text-fg hover:bg-surface-3",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={2.2} />
        <span className="hidden sm:inline">Filters</span>
        {nFilters > 0 && <span className={clsx("grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold leading-none", filtersOn ? "bg-white/25 text-accent-fg" : "bg-accent text-accent-fg")}>{nFilters}</span>}
        {isDesktop && (filtersOn ? <ChevronsLeft className="-mr-0.5 h-4 w-4 opacity-90" /> : <ChevronsRight className="-mr-0.5 h-4 w-4 opacity-60" />)}
      </button>
    </Tip>
  );
  const focusGroup = (g: FilterGroup) => set(isDesktop ? { filtersOpen: true, focusSection: SECTION_OF[g] } : { mobileFiltersOpen: true, focusSection: SECTION_OF[g] });
  const hasFilters = activeFilterCount(query) > 0;
  const hasChips = chips.length > 0;
  const clearAll = () => update({ q: "", types: [], instruments: [], techniques: [], proposals: [], keywords: [], storage: [], from: undefined, to: undefined, conds: [], and: {}, orBefore: [] });
  const onSort = (k: SortKey) => update(query.sort === k ? { dir: query.dir === "asc" ? "desc" : "asc" } : { sort: k, dir: k === "name" || k === "instrumentName" ? "asc" : "desc" });
  const applySaved = (qs: string) => setSp(new URLSearchParams(qs), { replace: true });

  const filterPanel = <FilterPanel query={query} update={update} onApplySaved={applySaved} />;
  const from = items.length ? (query.page - 1) * query.pageSize + 1 : 0;
  const to = from + items.length - 1;

  return (
    <div className="flex h-full min-h-0 overflow-x-clip">
      {isDesktop && filtersOpen && (
        <aside className="relative shrink-0 border-r border-line-strong bg-surface shadow-[inset_0_3px_0_rgb(var(--accent))]" style={{ width: filtersWidth }}>
          <div className="h-full overflow-y-auto">
            <FilterPanel query={query} update={update} onApplySaved={applySaved} onHide={() => set({ filtersOpen: false })} />
          </div>
          {/* drag the edge to make the panel wider or narrower */}
          <div tabIndex={0}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize filters"
            onPointerDown={(e) => {
              e.preventDefault();
              const start = e.clientX;
              const base = filtersWidth;
              // no text selection while the pointer sweeps across the page
              document.body.style.userSelect = "none";
              document.body.style.cursor = "col-resize";
              const move = (ev: PointerEvent) => set({ filtersWidth: Math.max(240, Math.min(520, base + ev.clientX - start)) });
              const up = () => {
                document.body.style.userSelect = "";
                document.body.style.cursor = "";
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            onDoubleClick={() => set({ filtersWidth: 296 })}
            className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize hover:bg-accent/30 active:bg-accent/40"
          />
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 space-y-3 border-b border-line bg-surface px-4 pb-3 pt-4 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight">Datasets</h1>

          <div className="flex flex-wrap items-center gap-3">
            {isDesktop && filtersBtn}
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
            <div className="ml-auto flex items-center gap-1.5">
              {!isDesktop && filtersBtn}
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

          {hasChips && (
            <div className="rounded-lg border border-line bg-surface-2/50">
              {/* one line by default: the whole expression in words, with save and clear beside it; unfold to edit */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 pl-1.5 pr-2.5">
                <button onClick={() => setBuilderOpen(!builderOpen)} aria-expanded={builderOpen} className="flex h-7 min-w-[220px] flex-1 items-center gap-1.5 rounded-md px-1 text-left hover:bg-surface-2">
                  <ChevronDown className={clsx("h-4 w-4 shrink-0 text-subtle transition-transform", !builderOpen && "-rotate-90")} />
                  <span className="truncate text-xs text-fg" title={summary}>{summary}</span>
                </button>
                <span className="ml-auto flex items-center gap-2">
                  <SaveSearch qs={serializeQuery({ ...query, page: 1 }).toString()} />
                  <button onClick={clearAll} className="shrink-0 text-xs font-medium text-muted hover:text-fg">Clear all</button>
                </span>
              </div>
              {builderOpen && (
                <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-stretch gap-x-2 gap-y-1.5 border-t border-line px-2.5 py-2.5 animate-fade-in">
                  {chips.map((c, i) => (
                    <Fragment key={c.id}>
                      <div className="flex min-h-8 items-center justify-end self-stretch">
                        {i === 0 && <span className="w-[3.25rem] text-center text-[11px] font-medium uppercase tracking-wider text-subtle">Search</span>}
                        {i > 0 && (
                          <Connector
                            op={query.orBefore.includes(c.id) ? "or" : "and"}
                            strong
                            onFlip={() => update({ orBefore: query.orBefore.includes(c.id) ? query.orBefore.filter((g) => g !== c.id) : [...query.orBefore, c.id] })}
                          />
                        )}
                      </div>
                      <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1 gap-y-1 self-start rounded-lg border border-line bg-surface py-0.5 pl-2 pr-1">
                        <Tip label={`Edit in the filter panel`}>
                          <button
                            onClick={() => focusGroup(c.id)}
                            className="mr-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium text-muted"
                          >
                            {(() => { const I = GROUP_ICON[c.id]; return <I className="h-3.5 w-3.5 text-subtle" strokeWidth={1.8} />; })()}{c.group}
                          </button>
                        </Tip>
                        {c.values.map((v, j) => (
                          <span key={v.id} className="inline-flex items-center gap-1">
                            {j > 0 &&
                              (c.flipAt ? (
                                <Connector op={c.opAt!(j)} onFlip={() => c.flipAt!(j)} />
                              ) : (
                                <Tip label="Fixed, can't be changed">
                                  <span className="shrink-0 cursor-help whitespace-nowrap text-[11px] text-subtle">{c.id === "conds" ? "and" : "or"}</span>
                                </Tip>
                              ))}
                            <Pill group={c.id} id={v.id} label={v.label} onRemove={v.remove} onEdit={() => focusGroup(c.id)} />
                          </span>
                        ))}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
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
                <DatasetTable onKeyword={onKeyword} onInstrument={onInstrument} onTechnique={onTechnique} items={items} peek={peek} onPeek={setPeek} onOpen={(pid) => nav(datasetLink(pid))} density={density} columns={columns} sort={query.sort} dir={query.dir} onSort={onSort} width={resultsWidth} />
              ) : (
                <DatasetGrid onKeyword={onKeyword} onInstrument={onInstrument} onTechnique={onTechnique} items={items} peek={peek} onPeek={setPeek} onOpen={(pid) => nav(datasetLink(pid))} hasMore={hasMore} onNext={() => update({ page: query.page + 1 })} />
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
        <aside className="w-[400px] shrink-0 border-l border-line bg-surface animate-slide-in-right">
          <PeekContent key={peek} pid={peek} onKeyword={onKeyword} onInstrument={onInstrument} onTechnique={onTechnique} onClose={() => setPeek(null)} onPrev={() => move(-1)} onNext={() => move(1)} />
        </aside>
      )}
      {!inlinePeek && (
        <Sheet open={!!peek} onOpenChange={(o) => !o && setPeek(null)} title="Preview" width="sm:w-[420px]">
          {peek && <PeekContent pid={peek} onKeyword={(k) => pickAndClose({ keywords: query.keywords.includes(k) ? query.keywords : [...query.keywords, k] })} onInstrument={(i) => pickAndClose({ instruments: query.instruments.includes(i) ? query.instruments : [...query.instruments, i] })} onTechnique={(t) => pickAndClose({ techniques: query.techniques.includes(t) ? query.techniques : [...query.techniques, t] })} onClose={() => setPeek(null)} embedded />}
        </Sheet>
      )}
      {!isDesktop && (
        <Sheet
          open={mobileFilters}
          onOpenChange={(o) => set({ mobileFiltersOpen: o })}
          side="left"
          title="Filters"
          footer={<Button variant="primary" className="w-full" onClick={() => set({ mobileFiltersOpen: false })}>{totalLabel ? `Show ${totalLabel} results` : "Show results"}</Button>}
        >
          {filterPanel}
        </Sheet>
      )}
    </div>
  );
}

export { DEFAULT_QUERY };
