import { useEffect, useId, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Plus, Search, X } from "lucide-react";
import { Modal } from "@/components/ui/Overlay";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { type MetaCond, type MetaKeyInfo } from "@/types";
import { P } from "./shared";
import { Section } from "./Section";

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
  const listId = useId();
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
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, items.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter" && items[cursor]) {
                e.preventDefault();
                pick(items[cursor]);
              }
            }}
            role="combobox"
            aria-controls={listId}
            aria-expanded
            aria-label="Search measured properties"
            placeholder="Search measured properties…"
            className="field h-10 pl-9"
          />
        </div>
        <div className="mt-2 h-[min(24rem,55dvh)] divide-y divide-line overflow-y-auto overscroll-contain" id={listId} role="listbox">
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

export function Measurements({ query, update, entry }: P) {
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
