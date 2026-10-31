import { useState } from "react";
import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import { toISODate } from "@/lib/format";
import { P } from "./shared";
import { Section } from "./Section";

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

export function Timeline({ query, update, entry }: P) {
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
