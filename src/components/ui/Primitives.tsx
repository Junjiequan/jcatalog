import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import clsx from "clsx";
import { Tag, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Columns3, Copy, Info, LayoutGrid, Rows3, SearchX, ShieldCheck, type LucideIcon } from "lucide-react";
import { fmtCount, fmtNum } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/query";
import { useElementWidth } from "@/hooks/hooks";
import { useUI, type Density, type ListView } from "@/store/ui";
import { useSelection } from "@/store/selection";
import { Button } from "./Button";
import { Explain, Menu, MenuCheck, MenuLabel, MenuRadio, MenuSep, MoreChip, Tip } from "./Overlay";

// Every "Back" in the app looks like this: blue text with an arrow, no box (a button, so it is obviously an action)
export function BackButton({ onClick, className, disabled, label = "Back" }: { onClick: () => void; className?: string; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={clsx("-ml-2 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-accent transition-colors hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-40", className)}>
      <ArrowLeft className="h-4 w-4" />{label}
    </button>
  );
}

// Back, then the pages above this one as underlined links, then the page you are on as plain text
export function Breadcrumb({ back, trail, current }: { back: () => void; trail: { label: string; to: string }[]; current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-[13px] text-muted">
      <BackButton onClick={back} className="mr-1" />
      {trail.map((t) => (
        <span key={t.to} className="flex items-center gap-1.5">
          <Link to={t.to} className="font-medium text-fg underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-accent">{t.label}</Link>
          <ChevronRight className="h-3.5 w-3.5 text-subtle" />
        </span>
      ))}
      <span className="min-w-0 truncate font-semibold text-muted" aria-current="page">{current}</span>
    </nav>
  );
}

type Tone = "neutral" | "accent" | "teal" | "success" | "warn" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted",
  accent: "bg-accent-soft text-accent",
  teal: "bg-teal/12 text-teal",
  success: "bg-success/10 text-success",
  warn: "bg-warn/10 text-warn",
  danger: "bg-danger/10 text-danger",
};

export function Badge({ tone = "neutral", icon: Icon, children, className, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title ?? (typeof children === "string" ? children : undefined)} className={clsx("inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", TONES[tone], className)}>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

// Each technique keeps its own hue everywhere it appears (badges, tiles, and the instruments' generated art), so a glance tells SANS from imaging.
export const TECH_HUE: Record<string, [string, string]> = {
  SANS: ["124 58 237", "167 139 250"], Reflectometry: ["13 148 136", "45 212 191"], Diffraction: ["234 88 12", "251 146 60"], "Single-crystal": ["192 38 211", "232 121 249"],
  MX: ["22 163 74", "74 222 128"], Engineering: ["202 138 4", "250 204 21"], Imaging: ["219 39 119", "244 114 182"], Spectroscopy: ["37 99 235", "96 165 250"],
  Backscattering: ["101 163 13", "163 230 53"], Vibrational: ["225 29 72", "251 113 133"],
};
// What each technique measures, in one sentence; the real catalogue would serve this from the instrument record.
export const TECH_INFO: Record<string, { name: string; text: string }> = {
  SANS: { name: "Small-angle neutron scattering", text: "Structure on the 1–100 nm scale in solution or solids; deuterium contrast lets you highlight one component of a complex." },
  Reflectometry: { name: "Neutron reflectometry", text: "Depth profiles of thin films, membranes and interfaces, including buried and liquid ones, with nanometre resolution." },
  Diffraction: { name: "Neutron powder diffraction", text: "Crystal and magnetic structures from powders, sensitive to light elements and to magnetic moments." },
  "Single-crystal": { name: "Single-crystal neutron diffraction", text: "Magnetic and nuclear structures of single crystals, often polarised and under field, pressure or low temperature." },
  MX: { name: "Macromolecular neutron crystallography", text: "Locates hydrogen atoms and protonation states in protein crystals, which X-rays cannot see." },
  Engineering: { name: "Engineering neutron diffraction", text: "Residual stress, strain and phase mapping deep inside engineering components, in situ under load or heat." },
  Imaging: { name: "Neutron imaging", text: "Radiography and tomography that see hydrogen, lithium and water inside metal; energy-selective modes map crystal phases." },
  Spectroscopy: { name: "Inelastic neutron scattering", text: "Excitations such as phonons, magnons and crystal-field levels, from the energy neutrons gain or lose." },
  Backscattering: { name: "Quasielastic neutron backscattering", text: "Slow dynamics at µeV resolution: diffusion, rotation and relaxation in polymers, proteins and ionic conductors." },
  Vibrational: { name: "Vibrational neutron spectroscopy", text: "Molecular vibrations over the whole energy range, especially of hydrogen, with no optical selection rules." },
};

export function TechBadge({ name, className, clickable }: { name: string; className?: string; clickable?: boolean }) {
  const [light, dark] = TECH_HUE[name] ?? ["100 116 139", "148 163 184"];
  const info = TECH_INFO[name];
  return (
    <Explain title={info?.name ?? name} text={info?.text ?? "No description for this technique yet. One can be added to the instrument record."}>
      <span
        style={{ "--t": light, "--td": dark } as React.CSSProperties}
        className={clsx("inline-flex max-w-[200px] items-center gap-1 whitespace-nowrap rounded-md bg-surface-3/70 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-muted", clickable ? "cursor-pointer" : "cursor-help", className)}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--t))] dark:bg-[rgb(var(--td))]" />
        <span className="min-w-0 truncate">{name}</span>
      </span>
    </Explain>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface-2 px-1 font-sans text-[10px] font-medium text-muted">{children}</kbd>
);

export const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => <div style={style} className={clsx("animate-pulse rounded-md bg-surface-3", className)} />;

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  const ini = name.replace(/^(Dr\.|Prof\.)\s*/, "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${hue} 65% 52%), hsl(${(hue + 40) % 360} 65% 42%))` }}
    >
      {ini}
    </span>
  );
}

// Who is signed in, said the same way everywhere: an administrator is unmistakable, a user is plain
export function RoleBadge({ role, className }: { role: "admin" | "user"; className?: string }) {
  return role === "admin" ? <Badge tone="accent" icon={ShieldCheck} className={className}>Administrator</Badge> : <Badge className={className}>User</Badge>;
}
// the avatar, with a small shield on it for an administrator
export function AccountAvatar({ name, role, size = 32 }: { name: string; role: "admin" | "user"; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Avatar name={name} size={size} />
      {role === "admin" && <span className="absolute -bottom-1 -right-1 flex h-[40%] min-h-4 w-[40%] min-w-4 items-center justify-center rounded-full bg-accent text-accent-fg ring-2 ring-canvas" title="Administrator"><ShieldCheck className="h-2.5 w-2.5" strokeWidth={2.6} /></span>}
    </span>
  );
}

// The tabs of a detail page: sticky under the header, scrolling sideways when they do not fit and never up or down
export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mt-5 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
      <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden overscroll-y-none">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={clsx("relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13.5px] font-medium transition-colors", value === t.id ? "text-accent" : "text-muted hover:text-fg")}>
            {t.label}
            {t.count !== undefined && <span className="tnum rounded-full bg-surface-3 px-1.5 text-[11px] text-muted">{fmtNum(t.count)}</span>}
            {value === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = "md", className, stretch }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label?: ReactNode; icon?: LucideIcon; count?: number; title?: string }[];
  size?: "sm" | "md";
  className?: string;
  // fill the row on phones, one equal share per option
  stretch?: boolean;
}) {
  return (
    <div className={clsx("inline-flex max-w-full overflow-x-auto overflow-y-hidden rounded-lg bg-surface-3 p-0.5", stretch && "max-sm:flex max-sm:w-full", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        const btn = (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-all",
              stretch && "max-sm:flex-1 max-sm:justify-center max-sm:px-1",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active ? "bg-accent-soft text-accent shadow-card ring-1 ring-accent/35" : "text-muted hover:text-fg",
            )}
          >
            {o.icon && <o.icon className="h-4 w-4" />}
            {o.label}
            {o.count !== undefined && (
              <span title={o.count.toLocaleString("en-US")} className={clsx("tnum text-[11px]", active ? "text-accent" : "text-subtle")}>
                {fmtCount(o.count)}
              </span>
            )}
          </button>
        );
        return o.title ? <Tip key={o.value} label={o.title}>{btn}</Tip> : btn;
      })}
    </div>
  );
}

export function CopyButton({ text, className, label = "Copy" }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Tip label={done ? "Copied!" : label}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }}
        className={clsx("inline-flex h-6 w-6 items-center justify-center rounded-md text-subtle transition-colors hover:bg-surface-3 hover:text-fg", className)}
      >
        {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </Tip>
  );
}

export function ProgressBar({ value, tone = "accent", className }: { value: number; tone?: "accent" | "success" | "danger"; className?: string }) {
  const color = { accent: "bg-accent", success: "bg-success", danger: "bg-danger" }[tone];
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={clsx("h-full rounded-full transition-all duration-300", color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, children, className }: { icon: LucideIcon; title: string; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="h-7 w-7" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

/** What every list shows when a search matches nothing. */
export function NoMatches({ query, noun, onClear }: { query: string; noun: string; onClear: () => void }) {
  return (
    <EmptyState icon={SearchX} title={`No ${noun} match “${query.trim()}”`} description="Check the spelling or try fewer words.">
      <Button onClick={onClear}>Clear search</Button>
    </EmptyState>
  );
}

/** The row under a page header that holds the search box and any list controls. */
// One footer for every list: range, page size, and prev/next. `totalPages` is left out when the total is only a lower bound.
export function Pager({ from, to, totalLabel, page, totalPages, hasMore, pageSize, onPage, onPageSize, className }: {
  from: number;
  to: number;
  totalLabel?: ReactNode;
  page: number;
  totalPages?: number;
  hasMore: boolean;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  className?: string;
}) {
  return (
    <div data-band className={clsx("flex flex-wrap items-center justify-between gap-2 text-[13px]", className)}>
      <span className="tnum text-muted">{fmtCount(from)}–{fmtCount(to)}{totalLabel && <> of {totalLabel}</>}</span>
      <div className="flex items-center gap-3">
        <label className="hidden items-center gap-2 text-muted sm:flex">
          Per page
          <span className="relative">
            <select className="field h-8 w-auto appearance-none py-0 pl-2.5 pr-8 text-[13px]" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}>
              {PAGE_SIZES.map((n) => <option key={n}>{n}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          </span>
        </label>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="tnum min-w-[76px] text-center text-muted">Page {page}{totalPages ? ` / ${totalPages}` : ""}</span>
          <Button size="icon" variant="outline" disabled={!hasMore} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}

// Pinned to the bottom of the scrolling page, so the pager is in reach without scrolling to the end.
export const STICKY_PAGER = "sticky bottom-0 z-10 -mb-6 border-t border-line bg-surface px-4 py-3 sm:px-6";

export const ViewSwitch = ({ value, onChange, className }: { value: ListView; onChange: (v: ListView) => void; className?: string }) => (
  <Segmented className={className} value={value} onChange={onChange} options={[{ value: "table", icon: Rows3, title: "List" }, { value: "cards", icon: LayoutGrid, title: "Cards" }]} />
);

export interface Column<T> {
  key: string;
  label: string;
  right?: boolean;
  center?: boolean;
  className?: string;
  // a header the user can sort by (the key handed to `sort.onSort`)
  sort?: string;
  // a column with no visible title (a thumbnail), and one that hugs its content
  hideLabel?: boolean;
  narrow?: boolean;
  // `active` is true for the row currently open in a side panel
  render: (row: T, active: boolean) => ReactNode;
}

// An explanatory note: an icon, an optional title, and a sentence or two. Use it wherever a screen needs to
// say what can and cannot be done here, instead of a loose paragraph.
export function Callout({ tone = "info", icon: Icon, title, children, className }: { tone?: "info" | "neutral" | "warn"; icon?: LucideIcon; title?: ReactNode; children: ReactNode; className?: string }) {
  const I = Icon ?? (tone === "warn" ? AlertTriangle : Info);
  return (
    <div
      role="note"
      className={clsx(
        // with a title the icon sits on the first line; a single sentence gets it centred
        "flex gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed",
        title ? "items-start" : "items-center",
        tone === "info" && "border-accent/25 bg-accent-soft/50 text-fg/90",
        tone === "neutral" && "border-line bg-surface-2 text-muted",
        tone === "warn" && "border-warn/40 bg-warn/10 text-fg/90",
        className,
      )}
    >
      <I className={clsx("h-4 w-4 shrink-0", title && "mt-0.5", tone === "info" ? "text-accent" : tone === "warn" ? "text-warn" : "text-subtle")} strokeWidth={1.8} />
      <div className="min-w-0">
        {title && <div className="font-semibold text-fg">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}

// a stable empty list: a selector that returned a fresh [] each render would re-render forever
const NO_COLUMNS: string[] = [];

// Which of a page's columns to show: everything the user has not hidden; the first column always stays
export function useShownColumns(page: string) {
  const hidden = useUI((s) => s.hiddenColumns[page] ?? NO_COLUMNS);
  return <T,>(cols: Column<T>[]) => cols.filter((c, i) => i === 0 || !hidden.includes(c.key));
}

// The view-options menu every list page shares: table density, and which columns to show
export function ViewOptions<T>({ page, columns, className }: { page: string; columns?: Column<T>[]; className?: string }) {
  const density = useUI((s) => s.density);
  const hidden = useUI((s) => s.hiddenColumns[page] ?? NO_COLUMNS);
  const set = useUI((s) => s.set);
  const toggle = (key: string) => set({ hiddenColumns: { ...useUI.getState().hiddenColumns, [page]: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key] } });
  return (
    <Menu tip="View options: density and columns" trigger={<Button size="icon" aria-label="View options" className={className}><Columns3 className="h-4 w-4" /></Button>}>
      <MenuLabel>Density</MenuLabel>
      <MenuRadio value={density} onValueChange={(v) => set({ density: v as Density })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
      {columns && columns.length > 1 && (
        <>
          <MenuSep />
          <MenuLabel>Columns</MenuLabel>
          {columns.slice(1).map((c) => <MenuCheck key={c.key} checked={!hidden.includes(c.key)} onCheckedChange={() => toggle(c.key)}>{c.label}</MenuCheck>)}
        </>
      )}
    </Menu>
  );
}

// The one card grid every page shares. Columns follow the results area's width (dense: 2 / 3 / 5, wide: 1 / 2 / 3);
// page sizes are multiples of 5, so a dense grid's rows are full on wide screens. When the last row is short and
// another page exists, a "more on the next page" card fills the gap so a short row never reads as the end.
export function CardGrid({ children, count, hasMore, onNext, wide, className }: { children: ReactNode; count: number; hasMore?: boolean; onNext?: () => void; wide?: boolean; className?: string }) {
  // dense (dataset thumbnails): 2 / 3 / 5 across by width. wide (text cards): as many as fit at the width the content needs.
  const [ref, w] = useElementWidth<HTMLDivElement>();
  const GAP = 16;
  const MIN = 320;
  const cols = !w ? (wide ? 1 : 2) : wide ? Math.max(1, Math.floor((w + GAP) / (MIN + GAP))) : w >= 900 ? 5 : w >= 640 ? 3 : 2;
  const short = count % cols !== 0;
  return (
    <div ref={ref} className={clsx("mb-4", className)}>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
        {hasMore && onNext && short && (
          <button
            onClick={onNext}
            className="group/next flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong text-sm font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 transition-colors group-hover/next:bg-accent group-hover/next:text-accent-fg"><ChevronRight className="h-5 w-5" /></span>
            More on the next page
          </button>
        )}
      </div>
    </div>
  );
}

// Keywords are how people find an experiment, so they get their own labelled, tinted row (and a tap filters the list by that word)
export function KeywordChips({ words, onPick, size = "md", max, nowrap }: { words: string[]; onPick?: (w: string) => void; size?: "sm" | "md"; max?: number; nowrap?: boolean }) {
  if (!words.length) return null;
  const shown = max ? words.slice(0, max) : words;
  return (
    <span className={clsx("inline-flex items-center gap-1.5", nowrap ? "flex-nowrap whitespace-nowrap" : "flex-wrap")}>
      {shown.map((w) => {
        const cls = clsx("inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft font-medium text-accent", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs");
        return onPick ? (
          <button key={w} onClick={(e) => (e.stopPropagation(), onPick(w))} title={`Show everything tagged “${w}”`} className={clsx(cls, "hover:border-accent hover:bg-accent hover:text-accent-fg")}><Tag className="h-3 w-3" />{w}</button>
        ) : (
          <span key={w} className={cls}><Tag className="h-3 w-3" />{w}</span>
        );
      })}
      {max !== undefined && words.length > max && <MoreChip count={words.length - max} title="All keywords"><KeywordChips words={words} onPick={onPick} size={size} /></MoreChip>}
    </span>
  );
}

// Row selection for a Table: which rows are ticked, and how to flip one or the whole page
export interface TableSelection<T> {
  isSelected: (row: T) => boolean;
  toggle: (row: T) => void;
  togglePage: (rows: T[], allSelected: boolean) => void;
}

// The card shell every grid shares (Datasets included): lifts on hover, and tints when selected
export const cardCls = (selected: boolean, extra?: string) => clsx("group relative card transition-all hover:-translate-y-0.5 hover:shadow-pop", selected && "border-accent/50 bg-accent-soft/30", extra);

// The selection checkbox on a card corner: hidden until the card is hovered, kept visible once anything is selected
// (and always on touch screens), exactly like the dataset cards
export function CardCheck({ checked, onChange, label, className }: { checked: boolean; onChange: () => void; label: string; className?: string }) {
  const any = useSelection((s) => Object.keys(s.items).length > 0);
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        "absolute z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-line bg-surface/90 shadow-xs backdrop-blur-sm transition-opacity pointer-coarse:opacity-100",
        checked || any ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
        className,
      )}
    >
      <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} />
    </label>
  );
}

// A checkbox for cards and rows that sit inside a clickable area
export function SelectCheck({ checked, onChange, label, className }: { checked: boolean; onChange: () => void; label: string; className?: string }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className={clsx("h-4 w-4 shrink-0 cursor-pointer", className)}
    />
  );
}

// The one table every page shares, Datasets included: flat, white, edge to edge. Optional: a selection column,
// sortable headers, an "active" row (open in a side panel) and a trailing affordance. On phones rows stack into
// label/value lines unless `phoneStack` is turned off.
export function Table<T>({ columns, rows, rowKey, onRow, onRowDoubleClick, density = "comfortable", stickyHeader, className, selection, sort, active, trailing, phoneStack = true, phoneSummary, rowAttrs }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRow?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  density?: "comfortable" | "compact";
  stickyHeader?: boolean;
  className?: string;
  selection?: TableSelection<T>;
  sort?: { key: string; dir: "asc" | "desc"; onSort: (key: string) => void };
  active?: (row: T) => boolean;
  trailing?: (row: T, active: boolean) => ReactNode;
  phoneStack?: boolean;
  // on a phone: only the first column plus this summary (chips and one muted line), the way the dataset list reads
  phoneSummary?: (row: T) => ReactNode;
  rowAttrs?: (row: T) => Record<string, string>;
}) {
  const pad = density === "compact" ? "px-3 py-1.5" : "px-3 py-3";
  const padY = density === "compact" ? "py-1.5" : "py-3";
  const allSelected = !!selection && rows.length > 0 && rows.every((r) => selection.isSelected(r));
  const someSelected = !!selection && rows.some((r) => selection.isSelected(r));
  const stick = stickyHeader && "sticky top-0 z-10";
  const SortHead = ({ c }: { c: Column<T> }) => {
    if (!c.sort || !sort) return <span className={clsx(c.hideLabel && "sr-only")}>{c.label}</span>;
    const on = sort.key === c.sort;
    const Icon = !on ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button onClick={() => sort.onSort(c.sort!)} className={clsx("group inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-fg", c.right && "flex-row-reverse", on && "text-fg")}>
        {c.label}
        <Icon className={clsx("h-3 w-3", !on && "opacity-0 group-hover:opacity-60")} />
      </button>
    );
  };
  return (
    <div data-band className={clsx(!stickyHeader && "overflow-x-auto", "bg-surface", className)}>
      <table className={clsx("w-full border-separate border-spacing-0 text-[13px]", phoneStack && "max-sm:block")}>
        <thead className={clsx(phoneStack && !phoneSummary && "max-sm:hidden", phoneStack && phoneSummary && "max-sm:block")}>
          <tr className={clsx("text-left text-[11px] font-semibold uppercase tracking-wider text-subtle", phoneStack && phoneSummary && "max-sm:flex max-sm:items-center max-sm:gap-2 max-sm:px-4 max-sm:py-2.5")}>
            {selection && (
              <th className={clsx("w-10 border-b border-line bg-surface py-2.5 pl-4", stick, phoneStack && phoneSummary && "max-sm:w-7 max-sm:border-0 max-sm:p-0")}>
                <input type="checkbox" aria-label="Select all on this page" checked={allSelected} ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }} onChange={() => selection.togglePage(rows, allSelected)} />
              </th>
            )}
            {columns.map((c, i) => (
              <th key={c.key} className={clsx("whitespace-nowrap border-b border-line bg-surface last:pr-4 sm:last:pr-6", c.narrow ? "w-0 py-2.5 pl-2 pr-1" : "px-3 py-2.5", stick, c.right && "text-right", c.center && "text-center", c.className, phoneStack && phoneSummary && (i > 0 ? "max-sm:hidden!" : "max-sm:border-0 max-sm:p-0"))}>
                <SortHead c={c} />
              </th>
            ))}
            {trailing && <th className={clsx("w-8 border-b border-line bg-surface", stick)} />}
          </tr>
        </thead>
        {/* compact: one line per row — secondary lines (class "sub") are hidden */}
        <tbody className={clsx(phoneStack && "max-sm:block", density === "compact" && "[&_.sub]:hidden")}>
          {rows.map((r) => {
            const on = !!active?.(r);
            const picked = !!selection?.isSelected(r);
            return (
              <tr
                key={rowKey(r)}
                {...rowAttrs?.(r)}
                onClick={onRow && (() => onRow(r))}
                onDoubleClick={onRowDoubleClick && (() => onRowDoubleClick(r))}
                className={clsx(
                  "group transition-colors",
                  phoneStack && "max-sm:block max-sm:border-b max-sm:border-line max-sm:px-4 max-sm:py-3 max-sm:last:border-b-0",
                  phoneStack && phoneSummary && "max-sm:grid! max-sm:grid-cols-[1.75rem_minmax(0,1fr)] max-sm:gap-x-2",
                  onRow && "cursor-pointer select-none",
                  picked ? "bg-accent-soft/50" : on ? "bg-surface-2" : onRow && "hover:bg-surface-2",
                )}
              >
                {selection && (
                  <td className={clsx("border-b border-line pl-4 align-middle group-last:border-b-0", padY, on && "shadow-[inset_3px_0_0_rgb(var(--accent))]", phoneStack && (phoneSummary ? "max-sm:row-span-2 max-sm:self-start max-sm:border-0 max-sm:p-0 max-sm:pt-0.5" : "max-sm:float-right max-sm:border-0 max-sm:p-0"))} onClick={(e) => e.stopPropagation()}>
                    <SelectCheck checked={picked} onChange={() => selection.toggle(r)} label={`Select ${rowKey(r)}`} />
                  </td>
                )}
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    data-label={c.label}
                    className={clsx(
                      "border-b border-line align-middle group-last:border-b-0 last:pr-4 sm:last:pr-6",
                      c.narrow ? clsx("pl-2 pr-1", padY) : pad,
                      c.right && "text-right",
                      c.center && "text-center",
                      !selection && i === 0 && on && "shadow-[inset_3px_0_0_rgb(var(--accent))]",
                      c.className,
                      phoneStack && "max-sm:border-0 max-sm:px-0 max-sm:py-0.5",
                      phoneStack && phoneSummary && (i > 0 ? "max-sm:hidden!" : "max-sm:col-start-2"),
                      phoneStack && (i === 0
                        ? "max-sm:block max-sm:pb-1.5 max-sm:text-left"
                        : "max-sm:flex max-sm:items-baseline max-sm:justify-between max-sm:gap-4 max-sm:text-right max-sm:before:shrink-0 max-sm:before:text-[11px] max-sm:before:font-medium max-sm:before:uppercase max-sm:before:tracking-wider max-sm:before:text-subtle max-sm:before:content-[attr(data-label)]"),
                    )}
                  >
                    {c.render(r, on)}
                  </td>
                ))}
                {phoneSummary && <td className="hidden max-sm:col-start-2 max-sm:block max-sm:border-0 max-sm:p-0">{phoneSummary(r)}</td>}
                {trailing && <td className={clsx("border-b border-line pr-3 text-subtle group-last:border-b-0", padY, phoneStack && "max-sm:hidden")}>{trailing(r, on)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const ListToolbar = ({ children }: { children: ReactNode }) => <div data-band className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 pb-3 pt-3 sm:px-6">{children}</div>;

export function ErrorState({ title = "We couldn't load this", message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="h-7 w-7" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && <Button className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// the title band, exactly like the Datasets page: title only, no description (the `subtitle` prop is accepted and ignored)
export function PageHeader({ title, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div data-band className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 pt-4 sm:px-6 [&:not(:has(+[data-band]))]:border-b [&:not(:has(+[data-band]))]:border-line [&:not(:has(+[data-band]))]:pb-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Every page follows the Datasets pattern: a white band at the top holding the title and the toolbar, then the
// content with the same side padding. Bands (PageHeader, ListToolbar) run edge to edge; everything else is inset.
export const Page = ({ children }: { children: ReactNode; wide?: boolean }) => (
  <div className="flex min-h-full w-full flex-col bg-surface pb-6 animate-fade-in [&>*:not([data-band])]:mx-4 sm:[&>*:not([data-band])]:mx-6 [&>[data-band]+*:not([data-band])]:mt-4">{children}</div>
);

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}
