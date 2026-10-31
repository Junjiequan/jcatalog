import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/api";
import { type FacetOption } from "@/types";
import { P } from "./shared";
import { Section } from "./Section";

export function KeywordFacet({ query, update, entry }: P) {
  const selected = query.keywords;
  const [text, setText] = useState("");
  const [res, setRes] = useState<{ items: FacetOption[] }>();
  const limit = entry.limit ?? 8;
  useEffect(() => {
    let live = true;
    api.options.searchKeywords(text, text ? 12 : limit).then((r) => live && setRes(r));
    return () => {
      live = false;
    };
  }, [text, limit]);
  const found = (res?.items ?? []).filter((o) => !selected.includes(o.value));
  return (
    <Section sid="keywords" title={entry.label} badge={selected.length} defaultOpen={entry.open} onClear={() => update({ keywords: [] })}>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-subtle" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setText("")} placeholder="Find a keyword…" className="field h-8 pl-8 text-xs" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((k) => (
          <button key={k} aria-pressed onClick={() => update({ keywords: selected.filter((x) => x !== k) })} className="inline-flex items-center gap-1 rounded-full border border-accent/50 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
            {k}<X className="h-3 w-3" />
          </button>
        ))}
        {found.map((o) => (
          <button key={o.value} aria-pressed={false} onClick={() => (update({ keywords: [...selected, o.value] }), setText(""))} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-line-strong hover:text-fg">
            {o.label}
          </button>
        ))}
        {text && res && !found.length && <p className="py-1 text-xs text-subtle">Nothing matches “{text}”.</p>}
      </div>
      {!text && res && <p className="mt-1.5 text-[11px] text-subtle">Most used shown; type to find the rest.</p>}
    </Section>
  );
}
