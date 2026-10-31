import { type ReactNode, useMemo, useState } from "react";
import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { InstrumentFull, InstrumentThumb } from "@/components/Thumb";
import { TECH_HUE, TECH_INFO } from "@/components/ui/Primitives";
import { Explain } from "@/components/ui/Overlay";
import { api } from "@/api";
import { P, toggleIn } from "./shared";
import { Section } from "./Section";

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

export function TechniqueTiles({ query, update, entry }: P) {
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

export function InstrumentTiles({ query, update, entry }: P) {
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
