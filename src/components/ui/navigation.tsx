import { type ReactNode } from "react";
import { Link } from "react-router";
import clsx from "clsx";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { fmtCount, fmtNum } from "@/lib/format";
import { PAGE_SIZES } from "@/lib/query";
import { Button } from "./Button";
import { Tip } from "./Overlay";

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

// The tabs of a detail page: sticky under the header, scrolling sideways when they do not fit and never up or down
export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 mt-5 border-b border-line bg-canvas px-4 sm:-mx-8 sm:px-8">
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
              size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-2.5 text-[13px]",
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
