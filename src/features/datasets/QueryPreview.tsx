import { Fragment, type ReactNode } from "react";
import { Globe, Layers, Search, type LucideIcon } from "lucide-react";
import { parseQuery } from "@/lib/query";
import { GROUP_ICON, buildChips } from "./chips";

const SCOPE_LABEL: Record<string, string> = { mine: "My data", shared: "Shared with me", public: "Public", all: "All" };

function Row({ icon: Icon, label, lead, children }: { icon: LucideIcon; label: string; lead?: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-x-3 py-1">
      <dt className="flex items-center gap-1.5 text-muted"><Icon className="h-3.5 w-3.5 shrink-0 text-subtle" strokeWidth={1.8} /><span className="truncate">{label}</span></dt>
      <dd className="min-w-0 text-fg">
        {lead && <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-accent">{lead}</span>}
        {children}
      </dd>
    </div>
  );
}

// A read-only account of a query as a plain list: where it looks and what kind, then one line per filter. A word between
// values or lines says how they combine; nothing is boxed, so it reads like a sentence.
export function QueryPreview({ qs }: { qs: string }) {
  const q = parseQuery(new URLSearchParams(qs));
  const chips = buildChips(q, () => {});
  const typed = q.types.length === 1;
  return (
    <dl className="divide-y divide-line text-[13px]">
      <Row icon={Globe} label="Scope">{SCOPE_LABEL[q.scope] ?? q.scope}</Row>
      {typed && <Row icon={Layers} label="Type">{q.types[0] === "raw" ? "Raw" : "Derived"}</Row>}
      {q.q && <Row icon={Search} label="Text"><span className="[overflow-wrap:anywhere]">“{q.q}”</span></Row>}
      {chips.map((c, i) => {
        const I = GROUP_ICON[c.id];
        return (
          <Row key={c.id} icon={I} label={c.group} lead={i === 0 && !q.q ? undefined : q.orBefore.includes(c.id) ? "or" : "and"}>
            {c.values.map((v, j) => (
              <Fragment key={v.id}>
                {j > 0 && <span className="mx-1.5 text-muted">{c.flipAt ? c.opAt!(j) : c.id === "conds" ? "and" : "or"}</span>}
                <span className="font-medium [overflow-wrap:anywhere]">{v.label}</span>
              </Fragment>
            ))}
          </Row>
        );
      })}
      {!typed && !q.q && !chips.length && <p className="py-1.5 text-muted">No filters, only the scope.</p>}
    </dl>
  );
}

// The same query in one line, for lists of saved searches. Colour follows purpose, from strongest to quietest: the scope and
// type (what is searched), then each filter's name, then its values, with the or/and words lightest.
export function SearchSummary({ qs, className }: { qs: string; className?: string }) {
  const q = parseQuery(new URLSearchParams(qs));
  const chips = buildChips(q, () => {});
  const dot = <span className="mx-1.5 text-subtle/60">·</span>;
  return (
    <p className={`h-4 truncate text-xs leading-4 ${className ?? ""}`}>
      <span className="font-medium text-fg/80">{SCOPE_LABEL[q.scope] ?? q.scope}</span>
      {q.types.length === 1 && <>{dot}<span className="font-medium text-fg/80">{q.types[0] === "raw" ? "Raw" : "Derived"}</span></>}
      {q.q && <>{dot}<span className="text-fg/70">“{q.q}”</span></>}
      {chips.map((c) => (
        <span key={c.id}>
          {dot}
          <span className="text-subtle">{c.group} </span>
          {c.values.map((v, j) => (
            <span key={v.id}>
              {j > 0 && <span className="mx-1 text-[10px] uppercase text-subtle/70">{c.flipAt ? c.opAt!(j) : c.id === "conds" ? "and" : "or"}</span>}
              <span className="text-fg/65">{v.label}</span>
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
