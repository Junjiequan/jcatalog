import { Search } from "lucide-react";
import { parseQuery } from "@/lib/query";
import { GROUP_ICON, buildChips } from "./chips";

const SCOPE_LABEL: Record<string, string> = { mine: "My data", shared: "Shared with me", public: "Public", all: "All" };

// A read-only rendering of a query, laid out like the applied-filter builder: one row per group, connectors in front
export function QueryPreview({ qs }: { qs: string }) {
  const q = parseQuery(new URLSearchParams(qs));
  const chips = buildChips(q, () => {});
  const rows = [
    ...(q.q ? [{ key: "q", connector: "Search", icon: Search, group: "Text", values: [`“${q.q}”`], ops: [] as string[] }] : []),
    ...chips.map((c, i) => ({
      key: c.id,
      connector: i === 0 && !q.q ? "Search" : q.orBefore.includes(c.id) ? "OR" : "AND",
      icon: GROUP_ICON[c.id],
      group: c.group,
      values: c.values.map((v) => v.label),
      ops: c.values.map((_, j) => (j === 0 ? "" : c.flipAt ? c.opAt!(j) : c.id === "conds" ? "and" : "or")),
    })),
  ];
  return (
    <div className="space-y-2 text-xs">
      <div className="text-subtle">Scope: {SCOPE_LABEL[q.scope] ?? q.scope}</div>
      {!rows.length && <div className="text-muted">No filters — only the scope above.</div>}
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-stretch gap-1.5">
          <span className={r.connector === "Search" ? "self-center text-[11px] font-semibold uppercase tracking-wider text-subtle" : "flex items-center justify-center rounded-lg border border-line bg-surface-2 text-[11px] font-semibold text-muted"}>{r.connector}</span>
          <span className="inline-flex min-w-0 flex-wrap items-center gap-1 rounded-lg border border-line bg-surface px-2 py-1">
            <span className="mr-1 inline-flex items-center gap-1 font-medium text-muted"><r.icon className="h-3.5 w-3.5 text-subtle" strokeWidth={1.8} />{r.group}</span>
            {r.values.map((v, j) => (
              <span key={j} className="inline-flex items-center gap-1">
                {j > 0 && <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted">{r.ops[j]}</span>}
                <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-medium">{v}</span>
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
