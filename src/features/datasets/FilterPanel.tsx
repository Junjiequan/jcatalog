import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import clsx from "clsx";
import { Atom, Bookmark, BookmarkCheck, CalendarDays, Check, ChevronDown, Eye, FilterX, FlaskConical, FoldVertical, Info, Layers, Microscope, Pencil, Plus, Search, Tag, UnfoldVertical, X, FileText, type LucideIcon } from "lucide-react";
import { InstrumentFull, InstrumentThumb } from "@/components/Thumb";
import { Callout, TECH_HUE, TECH_INFO } from "@/components/ui/Primitives";
import { Explain, Modal, Tip } from "@/components/ui/Overlay";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { activeFilterCount } from "@/lib/query";
import { toISODate } from "@/lib/format";
import { useUI } from "@/store/ui";
import type { DatasetQuery, FacetOption, MetaCond, MetaKeyInfo } from "@/types";
import type { FilterEntry } from "@/lib/filterConfig";
import { useFilterConfig } from "@/hooks/useFilterConfig";
import { QueryPreview } from "./QueryPreview";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Primitives";

type Update = (patch: Partial<DatasetQuery>) => void;
interface P {
  query: DatasetQuery;
  update: Update;
  entry: FilterEntry;
}
const toggleIn = (selected: string[], v: string) => (selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
const EMPTY: Partial<DatasetQuery> = { q: "", types: [], instruments: [], techniques: [], proposals: [], keywords: [], storage: [], from: undefined, to: undefined, conds: [], and: {}, orBefore: [] };

// the icon each section wears in its title, by section key
const SECTION_ICON: Record<string, LucideIcon> = { "Saved searches": Bookmark, techniques: Atom, instruments: Microscope, measurements: FlaskConical, proposals: FileText, created: CalendarDays, data: Layers, keywords: Tag };

// Closed unless the user opened it (remembered), it is one of the few open by default, or it holds a selection.
function Section({ sid, title, icon, info, badge, defaultOpen = false, onToggle, onClear, children }: { sid?: string; title: string; icon?: ReactNode; info?: ReactNode; badge?: number; defaultOpen?: boolean; onToggle?: (open: boolean) => void; onClear?: () => void; children: ReactNode }) {
  const sections = useUI((s) => s.filterSections);
  const set = useUI((s) => s.set);
  const key = sid ?? title;
  const open = sections[key] ?? (defaultOpen || !!badge);
  const flip = () => (set({ filterSections: { ...sections, [key]: !open } }), onToggle?.(!open));
  const focus = useUI((s) => s.focusSection);
  const [flash, setFlash] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // asked for from the applied-filter bar: open, bring into view, flash once
  useEffect(() => {
    if (focus !== key) return;
    set({ filterSections: { ...useUI.getState().filterSections, [key]: true } });
    // a beat later, so a panel that is just sliding open has its layout; the flag is cleared only then,
    // or the dependency change would cancel this timer before it fires
    const id = setTimeout(() => {
      box.current?.scrollIntoView({ block: "start" });
      setFlash(true);
      set({ focusSection: undefined });
      setTimeout(() => setFlash(false), 1600);
    }, 250);
    return () => clearTimeout(id);
  }, [focus, key, set]);
  return (
    // no row chrome: a small label over its options, separated by space and a faint rule; the chevron folds it
    <div ref={box} className={clsx("scroll-mt-11 border-t border-line/60 px-4 py-3 transition-colors duration-700 ease-out first:border-t-0 [.panel-head+&]:border-t-0 [.panel-head+&]:pt-2", flash && "bg-accent-soft/80")}>
      <div className="flex items-center gap-1">
        <button onClick={flip} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle hover:text-fg">
          {icon}
          <span className="truncate">{title}</span>
          {!!badge && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold normal-case leading-4 tracking-normal text-accent-fg">{badge}</span>}
          <ChevronDown className={clsx("h-3 w-3 shrink-0 opacity-60 transition-transform group-hover:opacity-100", !open && "-rotate-90")} />
        </button>
        {!!badge && onClear && (
          <Tip label={`Clear ${title.toLowerCase()} (${badge})`}>
            <button onClick={onClear} aria-label={`Clear ${title}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-3 hover:text-fg"><FilterX className="h-3.5 w-3.5" /></button>
          </Tip>
        )}
        {info && (
          <Explain title={title} text={info}>
            <button aria-label={`About ${title}`} className="flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-fg"><Info className="h-3.5 w-3.5" /></button>
          </Explain>
        )}
      </div>
      {open && <div className="mt-3 animate-fade-in">{children}</div>}
    </div>
  );
}

// ---------- tiles: a tappable grid, each in its technique's hue; a "+N more" tile unfolds the rest

function Tile({ on, hue, onClick, children, className, ...rest }: { on: boolean; hue?: [string, string]; onClick: () => void; children: ReactNode; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const style = hue ? ({ "--t": hue[0], "--td": hue[1] } as React.CSSProperties) : undefined;
  return (
    <button
      {...rest}
      onClick={onClick}
      aria-pressed={on}
      style={style}
      className={clsx(
        "group relative flex min-h-9 items-center pointer-coarse:min-h-11 gap-2 rounded-lg border px-2.5 text-left text-[13px] font-medium transition-colors",
        on ? "border-accent/40 bg-accent-soft text-accent" : "border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2",
        className,
      )}
    >
      {children}
      {on && <Check className="ml-auto h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />}
    </button>
  );
}

function FoldLink({ onClick, children, className }: { onClick: () => void; children: ReactNode; className?: string }) {
  return <button onClick={onClick} className={clsx("h-8 w-full rounded-md text-center text-xs font-medium text-accent hover:underline", className)}>{children}</button>;
}

function MoreTile({ hidden, open, onClick }: { hidden: number; open: boolean; onClick: () => void }) {
  if (open) return <FoldLink onClick={onClick} className="col-span-full">Show fewer</FoldLink>;
  return (
    <button onClick={onClick} className="flex min-h-9 items-center justify-center rounded-lg border border-dashed pointer-coarse:min-h-11 border-line-strong px-2 text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent">
      {`+${hidden} more`}
    </button>
  );
}

const TILE_HEAD = { lg: 7, sm: 5 };

function TechniqueTiles({ query, update, entry }: P) {
  const all = useMemo(() => api.options.facetValues("techniques"), []);
  const [open, setOpen] = useState(false);
  const selected = query.techniques;
  const limit = entry.limit ?? TILE_HEAD.lg;
  const head = open ? all : all.slice(0, limit);
  // a selected technique past the fold stays visible
  const shown = [...head, ...all.filter((o) => selected.includes(o.value) && !head.includes(o))];
  return (
    <Section sid="techniques" title={entry.label} badge={selected.length} defaultOpen={entry.open} onClear={() => update({ techniques: [] })}>
      <div className="grid grid-cols-1 gap-1 @[252px]:grid-cols-2">
        {shown.map((o) => (
          <Explain key={o.value} title={TECH_INFO[o.value]?.name ?? o.label} text={TECH_INFO[o.value]?.text ?? "No description for this technique yet."}>
          <Tile on={selected.includes(o.value)} hue={TECH_HUE[o.value]} onClick={() => update({ techniques: toggleIn(selected, o.value) })}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[rgb(var(--t))] dark:bg-[rgb(var(--td))]" style={{ "--t": (TECH_HUE[o.value] ?? ["100 116 139", "148 163 184"])[0], "--td": (TECH_HUE[o.value] ?? ["100 116 139", "148 163 184"])[1] } as React.CSSProperties} />
            <span className="min-w-0 truncate">{o.label}</span>
          </Tile>
          </Explain>
        ))}
        {all.length > limit && <MoreTile hidden={all.length - shown.length} open={open} onClick={() => setOpen(!open)} />}
      </div>
    </Section>
  );
}

function InstrumentTiles({ query, update, entry }: P) {
  const all = useMemo(() => api.options.instruments(), []);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const selected = query.instruments;
  const t = text.trim().toLowerCase();
  const limit = entry.limit ?? TILE_HEAD.sm;
  const pool = t ? all.filter((i) => `${i.name} ${i.title} ${i.techniques.join(" ")}`.toLowerCase().includes(t)) : all;
  const head = open || t ? pool : pool.slice(0, limit);
  const shown = [...head, ...all.filter((i) => selected.includes(i.pid) && !head.includes(i))];
  return (
    <Section sid="instruments" title={entry.label} badge={selected.length} defaultOpen={entry.open} onClear={() => update({ instruments: [] })}>
      {(open || t) && all.length > 8 && (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-subtle" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={`Find among ${all.length}…`} className="field h-8 pl-8 text-xs" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-1 @[252px]:grid-cols-2">
        {shown.map((i) => (
          <Explain
            key={i.pid}
            image={<InstrumentFull i={i} />}
            title={`${i.name} — ${i.title}`}
            text={[...i.techniques, i.image ? "Image: ESS" : "Generated illustration"].join(" · ")}
          >
            <Tile on={selected.includes(i.pid)} hue={TECH_HUE[i.techniques[0]]} onClick={() => update({ instruments: toggleIn(selected, i.pid) })} className="pl-1.5">
              <InstrumentThumb i={i} preview={false} className="h-6 w-9 shrink-0 rounded" />
              <span className="min-w-0 truncate">{i.name}</span>
            </Tile>
          </Explain>
        ))}
        {!t && all.length > limit && <MoreTile hidden={all.length - shown.length} open={open} onClick={() => (setOpen(!open), setText(""))} />}
        {t && !pool.length && <p className="col-span-2 py-1 text-xs text-subtle">Nothing matches “{text}”.</p>}
      </div>
    </Section>
  );
}

// ---------- plain rows for proposals (newest first, number and date under the title)

function OptionRow({ checked, onChange, label, hint }: { checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 text-[13px] hover:bg-surface" title={label}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-[3px] h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="tnum block truncate text-[11px] text-subtle">{hint}</span>}
      </span>
    </label>
  );
}

// A search box: click or type and a dropdown lists the newest entries, or the ones matching the text.
// Ticks stay in the open dropdown so several can be picked in one go; once it closes they sit under the box.
function RowsFacet({ query, update, entry }: P) {
  const field = entry.field as "techniques" | "instruments" | "proposals" | "keywords";
  const all = useMemo(() => api.options.facetValues(field), [field]);
  const selected = query[field];
  const limit = entry.limit ?? 8;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [cursor, setCursor] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const t = text.trim().toLowerCase();
  const picked = all.filter((o) => selected.includes(o.value));
  const rest = (t ? all.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(t)) : all).filter((o) => !selected.includes(o.value)).slice(0, limit);
  const rows = [...picked, ...rest];
  const toggle = (v: string) => update({ [field]: toggleIn(selected, v) } as Partial<DatasetQuery>);
  const close = () => (setOpen(false), setText(""));
  const one = entry.label.toLowerCase();
  const Row = ({ o, i }: { o: FacetOption; i: number }) => {
    const on = selected.includes(o.value);
    return (
      <button
        role="option"
        aria-selected={on}
        onMouseEnter={() => setCursor(i)}
        onClick={() => toggle(o.value)}
        className={clsx("flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px]", i === cursor && "bg-surface-2")}
      >
        <span className={clsx("flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border", on ? "border-accent bg-accent text-accent-fg" : "border-line-strong")}>
          {on && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{o.label}</span>
          {o.hint && <span className="tnum block truncate text-[11px] text-subtle">{o.hint}</span>}
        </span>
      </button>
    );
  };
  return (
    <Section sid={entry.field} title={entry.label} badge={selected.length} defaultOpen={entry.open} onToggle={(o) => !o && close()} onClear={() => update({ [field]: [] } as Partial<DatasetQuery>)}>
      <Popover.Root open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} modal={false}>
        <Popover.Anchor asChild>
          <div ref={box} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-subtle" />
            <input
              value={text}
              onChange={(e) => (setText(e.target.value), setCursor(picked.length), setOpen(true))}
              onClick={() => setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), setOpen(true), setCursor((c) => Math.min(c + 1, rows.length - 1)));
                else if (e.key === "ArrowUp") (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
                else if (e.key === "Enter" && rows[cursor]) (e.preventDefault(), toggle(rows[cursor].value));
                else if (e.key === "Escape") close();
              }}
              role="combobox"
              aria-expanded={open}
              aria-label={`Find a ${one}`}
              placeholder={`Find a ${one}…`}
              className="field h-8 pl-8 text-xs"
            />
          </div>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            side="bottom"
            avoidCollisions={false}
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => box.current?.contains(e.target as Node) && e.preventDefault()}
            className="z-[80] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-lg border border-line bg-surface shadow-pop outline-hidden data-[state=open]:animate-fade-in"
            role="listbox"
          >
            <div className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-3rem))] overflow-y-auto overscroll-contain p-1">
              {picked.map((o, i) => <Row key={o.value} o={o} i={i} />)}
              {picked.length > 0 && rest.length > 0 && <div className="my-1 border-t border-line" />}
              {rest.map((o, i) => <Row key={o.value} o={o} i={picked.length + i} />)}
              {!rows.length && <p className="px-2 py-2 text-xs text-subtle">Nothing matches “{text}”.</p>}
            </div>
            <div className="flex items-center justify-between border-t border-line px-2 py-1">
              <span className="text-[11px] text-subtle">{t ? "Matches" : "Newest first. Type to find the rest."}</span>
              <button onClick={close} className="rounded-md px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">Done{selected.length ? ` (${selected.length})` : ""}</button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {!open && picked.length > 0 && (
        <div className="-mx-1.5 mt-1.5">
          {picked.map((o) => <OptionRow key={o.value} checked onChange={() => toggle(o.value)} label={o.label} hint={o.hint} />)}
        </div>
      )}
    </Section>
  );
}

// ---------- the timeline: drag two handles across the last three years, or tap a preset

const MONTHS = 36;
const monthStart = (i: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (MONTHS - i), 1);
};
const monthLabel = (i: number) => monthStart(i).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
const indexOf = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  const m0 = monthStart(0);
  const i = (d.getFullYear() - m0.getFullYear()) * 12 + (d.getMonth() - m0.getMonth()) + (d.getDate() > 15 ? 1 : 0);
  return Math.max(0, Math.min(MONTHS, i));
};
const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "3 months", days: 90 },
  { label: "12 months", days: 365 },
];
const daysAgo = (n: number) => toISODate(new Date(Date.now() - n * 86400000));

function RangeSlider({ min, max, step = 1, value: [a, b], onChange }: { min: number; max: number; step?: number; value: [number, number]; onChange: (v: [number, number]) => void }) {
  const pct = (v: number) => ((v - min) / (max - min || 1)) * 100;
  return (
    <div className="relative h-8">
      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
      <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand" style={{ left: `${pct(a)}%`, right: `${100 - pct(b)}%` }} />
      <input type="range" min={min} max={max} step={step} value={a} onChange={(e) => onChange([Math.min(Number(e.target.value), b), b])} aria-label="From" className="range-thumb" />
      <input type="range" min={min} max={max} step={step} value={b} onChange={(e) => onChange([a, Math.max(Number(e.target.value), a)])} aria-label="To" className="range-thumb" />
    </div>
  );
}

function Timeline({ query, update, entry }: P) {
  const a = indexOf(query.from) ?? 0;
  const b = indexOf(query.to) ?? MONTHS;
  const [exact, setExact] = useState(false);
  const preset = PRESETS.find((p) => query.from === daysAgo(p.days) && !query.to);
  const setRange = ([x, y]: [number, number]) =>
    update({ from: x > 0 ? toISODate(monthStart(x)) : undefined, to: y < MONTHS ? toISODate(new Date(monthStart(y).getTime() - 86400000)) : undefined });
  const label = !query.from && !query.to ? "Any time" : preset ? `Last ${preset.label}` : `${query.from ? monthLabel(a) : "…"} – ${query.to ? monthLabel(b) : "now"}`;
  return (
    <Section sid="created" title={entry.label} badge={query.from || query.to ? 1 : 0} defaultOpen={entry.open} onClear={() => update({ from: undefined, to: undefined })}>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        {(query.from || query.to) && <button onClick={() => update({ from: undefined, to: undefined })} className="text-accent hover:underline">Any time</button>}
      </div>
      <RangeSlider min={0} max={MONTHS} value={[a, b]} onChange={setRange} />
      <div className="flex justify-between text-[10px] text-subtle"><span>{monthLabel(0)}</span><span>{monthLabel(MONTHS / 2)}</span><span>now</span></div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => update(preset?.days === p.days ? { from: undefined, to: undefined } : { from: daysAgo(p.days), to: undefined })}
            className={clsx("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", preset?.days === p.days ? "border-accent bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg")}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* typing dates is a different kind of control from the quick ranges above, so it is an accent link, not another pill */}
      <button onClick={() => setExact(!exact)} aria-expanded={exact} className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
        <CalendarDays className="h-3.5 w-3.5" />
        {exact ? "Hide exact dates" : "Set exact dates"}
      </button>
      {exact && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wider text-subtle">From<input type="date" className="field mt-1 h-8 w-full px-2 text-xs normal-case tracking-normal text-fg" value={query.from ?? ""} max={query.to} onChange={(e) => update({ from: e.target.value || undefined })} /></label>
          <label className="text-[11px] font-medium uppercase tracking-wider text-subtle">To<input type="date" className="field mt-1 h-8 w-full px-2 text-xs normal-case tracking-normal text-fg" value={query.to ?? ""} min={query.from} onChange={(e) => update({ to: e.target.value || undefined })} /></label>
        </div>
      )}
    </Section>
  );
}

// ---------- toggles for the two-value facets, on one row each

function Toggles({ label, options, selected, onChange }: { label: string; options: FacetOption[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-muted">{label}</span>
      <div className="flex flex-1 gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(toggleIn(selected, o.value))}
            aria-pressed={selected.includes(o.value)}
            className={clsx("flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors", selected.includes(o.value) ? "border-accent/50 bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:border-line-strong hover:text-fg")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DataToggles({ query, update, entry }: P) {
  // datasets have no availability field to filter on, so only the type switch is shown
  const fields = ["types"];
  return (
    <Section sid="data" title={entry.label} badge={query.types.length} defaultOpen={entry.open} onClear={() => update({ types: [] })}>
      <div className="space-y-2">
        {fields.includes("types") && <Toggles label="Type" options={api.options.facetValues("types")} selected={query.types} onChange={(v) => update({ types: v as DatasetQuery["types"] })} />}
      </div>
    </Section>
  );
}

// ---------- keywords: the most used as tappable chips, the rest found by typing

function KeywordChips({ query, update, entry }: P) {
  const selected = query.keywords;
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ items: FacetOption[] }>();
  useEffect(() => {
    let live = true;
    api.options.searchKeywords(text, text ? 12 : entry.limit ?? 8).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [text]);
  const found = (res?.items ?? []).filter((o) => !selected.includes(o.value));
  return (
    <Section sid="keywords" title={entry.label} badge={selected.length} defaultOpen={entry.open} onClear={() => update({ keywords: [] })}>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-subtle" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setText("")} placeholder="Find a keyword…" className="field h-8 pl-8 text-xs" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((k) => (
          <button key={k} onClick={() => update({ keywords: selected.filter((x) => x !== k) })} className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
            {k}<X className="h-3 w-3" />
          </button>
        ))}
        {found.map((o) => (
          <button key={o.value} onClick={() => (update({ keywords: [...selected, o.value] }), setText(""))} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-fg">
            {o.label}
          </button>
        ))}
        {text && res && !found.length && <p className="py-1 text-xs text-subtle">Nothing matches “{text}”.</p>}
      </div>
      {!text && res && <p className="mt-1.5 text-[11px] text-subtle">Most used shown; type to find the rest.</p>}
    </Section>
  );
}

// ---------- measurements: one slider per property, in the unit you pick

// plain digits only: these strings go back into Number() and the URL
const fmtNum = (n: number) => (Math.abs(n) >= 1000 ? String(Math.round(n)) : String(+n.toPrecision(4)));

const OPS: { op: MetaCond["op"]; label: string }[] = [
  { op: "eq", label: "equals" },
  { op: "gt", label: "is above" },
  { op: "lt", label: "is below" },
  { op: "between", label: "is between" },
];

// The dictionary stores no unit or range, so the unit is typed (and may stay empty) and nothing is pre-filled
function MeasurementCond({ cond, onChange, onRemove }: { cond: MetaCond; onChange: (c: MetaCond) => void; onRemove: () => void }) {
  const num = cond.op !== "eq";
  const input = "field h-8 min-w-0 flex-1 px-2 text-xs";
  return (
    <div className="rounded-lg border border-line bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium" title={cond.key}>{cond.key.replace(/_/g, " ")}</span>
        <button onClick={onRemove} aria-label={`Remove ${cond.key}`} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-fg"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="mt-2 flex gap-2">
        <span className="relative min-w-0 flex-1">
        <select
          value={cond.op}
          onChange={(e) => onChange({ ...cond, op: e.target.value as MetaCond["op"], value2: e.target.value === "between" ? cond.value2 ?? "" : undefined })}
          aria-label="Condition"
          className="field h-8 w-full appearance-none py-0 pl-2 pr-8 text-xs"
        >
          {OPS.map((o) => <option key={o.op} value={o.op}>{o.label}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
        </span>
        <input value={cond.unit ?? ""} onChange={(e) => onChange({ ...cond, unit: e.target.value || undefined })} placeholder="Unit (optional)" aria-label="Unit, optional" className="field h-8 w-28 shrink-0 px-2 text-xs" />
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input value={cond.value} onChange={(e) => onChange({ ...cond, value: e.target.value })} inputMode={num ? "decimal" : "text"} placeholder={cond.op === "eq" ? "Value, or leave empty for any" : "Value"} aria-label="Value" className={input} />
        {cond.op === "between" && (
          <>
            <span className="text-xs text-subtle">and</span>
            <input value={cond.value2 ?? ""} onChange={(e) => onChange({ ...cond, value2: e.target.value })} inputMode="decimal" placeholder="Value" aria-label="Upper value" className={input} />
          </>
        )}
      </div>
    </div>
  );
}

// A button that opens a search dialog over the measurement dictionary: a catalogue can hold 500k+ keys, so only a short page is ever listed
function MeasurementPicker({ taken, allowed, onPick }: { taken: string[]; allowed?: string[]; onPick: (k: MetaKeyInfo) => void }) {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setQ(text), 200);
    return () => clearTimeout(id);
  }, [text]);
  const { data } = useResource(["metaKeys", q, taken.join("|")], () => api.datasets.metaKeys({ text: q, limit: 10, exclude: taken }), { enabled: open });
  const items = (data?.items ?? []).filter((k) => !allowed || allowed.includes(k.key));
  const close = (o: boolean) => (setOpen(o), !o && (setText(""), setQ(""), setCursor(0)));
  const pick = (k: MetaKeyInfo) => (onPick(k), close(false));
  return (
    <>
      <button onClick={() => close(true)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-xs font-medium text-muted transition-colors hover:border-accent hover:text-accent">
        <Plus className="h-3.5 w-3.5" />Add a measured property
      </button>
      <Modal open={open} onOpenChange={close} title="Add a measured property" description="Pick what was measured, then set the value to look for." size="lg">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-subtle" />
          <input
            autoFocus
            value={text}
            onChange={(e) => (setText(e.target.value), setCursor(0))}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") (e.preventDefault(), setCursor((c) => Math.min(c + 1, items.length - 1)));
              else if (e.key === "ArrowUp") (e.preventDefault(), setCursor((c) => Math.max(c - 1, 0)));
              else if (e.key === "Enter" && items[cursor]) (e.preventDefault(), pick(items[cursor]));
            }}
            role="combobox"
            aria-expanded
            aria-label="Search measured properties"
            placeholder="Search measured properties…"
            className="field h-10 pl-9"
          />
        </div>
        <div className="mt-2 h-[min(24rem,55dvh)] divide-y divide-line overflow-y-auto overscroll-contain" role="listbox">
          {!data && <p className="px-2 py-2 text-xs text-subtle">Searching…</p>}
          {data && !items.length && <p className="px-2 py-2 text-xs text-subtle">{q ? `No measured property matches "${q}".` : "No measured properties yet."}</p>}
          {items.map((k, i) => (
            <button
              key={k.key}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(k)}
              className={clsx("flex min-h-11 w-full items-center gap-2 px-2 text-left text-sm", i === cursor && "bg-surface-2")}
            >
              <span className="min-w-0 flex-1 truncate" title={k.key}>{k.humanReadableName || k.key.replace(/_/g, " ")}</span>
              <span className="shrink-0 text-xs text-subtle">{k.usageCount.toLocaleString()} datasets</span>
            </button>
          ))}
        </div>
        <p className="mt-2 h-4 text-xs text-subtle">
          {data && data.total > items.length && (
            <>{q ? "Showing the best matches. Keep typing to narrow." : "Most used first. Type to search the rest."}</>
          )}
        </p>
      </Modal>
    </>
  );
}

function Measurements({ query, update, entry }: P) {
  const conds = query.conds;
  const add = (info: MetaKeyInfo) => update({ conds: [...conds, { key: info.key, op: "eq", value: "" }] });
  return (
    <Section sid="measurements" title={entry.label} badge={conds.length} defaultOpen={entry.open} onClear={() => update({ conds: [] })} info="Narrow by what was measured, e.g. sample temperature between 80 and 120. The unit is optional.">
      <div className="space-y-2">
        {conds.map((c, i) => (
          <MeasurementCond
            key={c.key + i}
            cond={c}
            onChange={(n) => update({ conds: conds.map((x, j) => (j === i ? n : x)) })}
            onRemove={() => update({ conds: conds.filter((_, j) => j !== i) })}
          />
        ))}
        <MeasurementPicker taken={conds.map((c) => c.key)} allowed={entry.properties} onPick={add} />
      </div>
    </Section>
  );
}

// ---------- the panel

// One configured entry becomes the widget its field and widget name select
function FilterEntryView(p: P) {
  const { field, widget } = p.entry;
  if (field === "techniques") return widget === "rows" ? <RowsFacet {...p} /> : <TechniqueTiles {...p} />;
  if (field === "instruments") return widget === "rows" ? <RowsFacet {...p} /> : <InstrumentTiles {...p} />;
  if (field === "proposals") return <RowsFacet {...p} />;
  if (field === "keywords") return widget === "rows" ? <RowsFacet {...p} /> : <KeywordChips {...p} />;
  if (field === "created") return <Timeline {...p} />;
  if (field === "data") return <DataToggles {...p} />;
  return <Measurements {...p} />;
}

// A saved search as a tappable tile (like the technique tiles); eye previews, × deletes
function SavedTile({ s, onApply, onDelete }: { s: { id: string; name: string; qs: string }; onApply: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(s.name);
  const rename = useUI((x) => x.updateSearch);
  // takes the field's own value, so a blur right after typing never commits a stale state
  const commit = (value: string) => {
    const n = value.trim();
    if (n && n !== s.name) rename(s.id, { name: n });
    else setName(s.name);
  };
  return (
    <div className="group relative">
      <button onClick={onApply} title={s.name} className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pl-2.5 pr-2 text-left text-[13px] font-medium transition-[padding,background-color,border-color] hover:border-line-strong hover:bg-surface-2 group-hover:pr-14 group-focus-within:pr-14 pointer-coarse:min-h-11 pointer-coarse:pr-14">
        <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">{s.name}</span>
      </button>
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
        <Tip label="Preview this search">
          <button onClick={() => setOpen(true)} aria-label={`Preview ${s.name}`} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-fg"><Eye className="h-3.5 w-3.5" /></button>
        </Tip>
        <Tip label="Delete">
          <button onClick={onDelete} aria-label={`Delete ${s.name}`} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-danger"><X className="h-3.5 w-3.5" /></button>
        </Tip>
      </span>
      <Modal open={open} onOpenChange={(o) => (setOpen(o), o && setName(s.name))} title={s.name} bare size="xl" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button><Button variant="primary" onClick={() => (setOpen(false), onApply())}>Apply this search</Button></>}>
        {/* the name is editable right here; the filters below are read-only (apply, adjust, save again to change them) */}
        <div className="border-b border-line px-5 pb-4 pt-5">
          <label className="label">Name</label>
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => commit(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Saved search name" className="field h-9 max-w-md text-sm font-semibold" />
            <Pencil className="h-4 w-4 shrink-0 text-subtle" />
          </div>
          <Callout className="mt-3">Only the name can be changed here — to change the filters, apply the search, adjust them and save it again.</Callout>
        </div>
        <div className="px-5 py-4"><QueryPreview qs={s.qs} /></div>
      </Modal>
    </div>
  );
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
