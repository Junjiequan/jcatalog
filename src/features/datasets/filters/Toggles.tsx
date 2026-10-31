import clsx from "clsx";
import { api } from "@/api";
import { type DatasetQuery, type FacetOption } from "@/types";
import { P, toggleIn } from "./shared";
import { Section } from "./Section";

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

export function DataToggles({ query, update, entry }: P) {
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
