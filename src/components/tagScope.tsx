import { createContext, useCallback, useContext, useMemo } from "react";
import { activeFilterCount, combine, matchValues, parseQuery, serializeQuery } from "@/lib/query";
import type { DatasetQuery, FilterGroup } from "@/types";
import { useLocation, useNavigate, useSearchParams } from "react-router";

// Which kind of thing a page lists. A tag clicked on a page (an instrument, a technique, a keyword) finds more things of
// that same kind: on the proposals page, other proposals with it; in a dataset, other datasets. So it stays on the page it is on.
export type TagScope = "datasets" | "proposals" | "experiments" | "samples" | "published" | "instruments";

const LIST: Record<TagScope, string> = { datasets: "/datasets?scope=all", proposals: "/proposals", experiments: "/experiments", samples: "/samples", published: "/published", instruments: "/instruments" };
const NOUN: Record<TagScope, string> = { datasets: "datasets", proposals: "proposals", experiments: "experiments", samples: "samples", published: "published data", instruments: "instruments" };

const Scope = createContext<TagScope>("datasets");
export const TagScopeProvider = Scope.Provider;
export const useTagScope = () => useContext(Scope);

type Tag = "inst" | "tech" | "kw";
const link = (scope: TagScope, tag: Tag, value: string) => `${LIST[scope]}${LIST[scope].includes("?") ? "&" : "?"}${tag}=${encodeURIComponent(value)}`;

// what a click on a tag does: open the list of the page's own kind, filtered by it. On that list already, the tag is
// added to the filters that are set, so picking a second tag narrows the list instead of starting over.
export function useTagTarget() {
  const scope = useTagScope();
  const nav = useNavigate();
  const { pathname, search } = useLocation();
  const go = (tag: Tag, value: string) => {
    if (pathname !== LIST[scope].split("?")[0]) return nav(link(scope, tag, value));
    const next = new URLSearchParams(search);
    const have = (next.get(tag) ?? "").split(/[,+]/).filter(Boolean);
    if (!have.some((v) => v.toLowerCase() === value.toLowerCase())) next.set(tag, [...have, value].join(","));
    next.delete("page");
    nav({ pathname, search: `?${next}` });
  };
  return {
    noun: NOUN[scope],
    instrument: (pid: string) => go("inst", pid),
    technique: (name: string) => go("tech", name),
    keyword: (word: string) => go("kw", word),
  };
}

// The filters of a list page that is not the datasets page, kept in the URL the way the datasets page keeps them
// (?inst= ?tech= ?kw= ?m= ?from= ?to=; "a,b" reads a or b, "a+b" reads a and b, ?or= joins kinds with "or"). `fields` is
// what the page offers: only those are read and written, anything else in the URL (peek, tab, view…) is left alone.
export interface Taggable {
  instrumentIds?: string[];
  techniques?: string[];
  keywords?: string[];
}
export type Field = "instruments" | "techniques" | "keywords" | "conds" | "created";
const PARAMS: Record<Field, string[]> = { instruments: ["inst"], techniques: ["tech"], keywords: ["kw"], conds: ["m"], created: ["from", "to"] };
type TagField = "instruments" | "techniques" | "keywords";
const MATCH: Record<TagField, (item: Taggable, v: string) => boolean> = {
  instruments: (i, v) => !!i.instrumentIds?.includes(v),
  techniques: (i, v) => !!i.techniques?.some((x) => x.toLowerCase() === v.toLowerCase()),
  keywords: (i, v) => !!i.keywords?.some((x) => x.toLowerCase() === v.toLowerCase()),
};
const TAGS: TagField[] = ["instruments", "techniques", "keywords"];

export function useTagFilter(fields: Field[]) {
  const [sp, setSp] = useSearchParams();
  const own = fields.flatMap((f) => PARAMS[f]);
  const key = fields.join();
  // just the parts of the URL this page owns, so a change elsewhere in it does not rebuild the query
  const raw = new URLSearchParams([...sp].filter(([k]) => own.includes(k) || (k === "or" && fields.some((f) => TAGS.includes(f as TagField))))).toString();
  const query = useMemo(() => ({ ...parseQuery(new URLSearchParams(raw)), scope: "all" as const }), [raw]);
  // a change to the query is written back for the page's own filters only
  const update = useCallback(
    (patch: Partial<DatasetQuery>) =>
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        const written = serializeQuery({ ...parseQuery(prev), ...patch, page: 1 });
        const mine = fields.flatMap((f) => PARAMS[f]);
        for (const k of mine) {
          next.delete(k);
          written.getAll(k).forEach((v) => next.append(k, v));
        }
        next.delete("or");
        const or = (written.get("or") ?? "").split(",").filter((g) => fields.includes(g as Field));
        if (or.length) next.set("or", or.join(","));
        next.delete("page");
        return next;
      }, { replace: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSp, key],
  );
  // every kind that is set has to hold, unless joined to the one before with "or"; within a kind, see matchValues
  const test = useCallback(
    (item: Taggable) =>
      combine(
        TAGS.filter((f) => fields.includes(f) && query[f].length).map((f) => ({ group: f as FilterGroup, ok: matchValues(query[f], query.and[f], (v) => MATCH[f](item, v)) })),
        query.orBefore,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, key],
  );
  const active = activeFilterCount(query) > 0;
  const clear = useCallback(() => update({ instruments: [], techniques: [], keywords: [], conds: [], from: undefined, to: undefined, and: {}, orBefore: [] }), [update]);
  return useMemo(() => ({ query, update, test, active, clear, key: raw }), [query, update, test, active, clear, raw]);
}
