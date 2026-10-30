import { FILTER_GROUPS, type FilterGroup } from "@/types";
import { CURRENT_USER } from "@/data/db";
import type { DatasetQuery, MetaCond, Scope, SortKey, Storage } from "@/types";

// an administrator reaches every dataset, so that is where the list starts; everyone else starts with their own
export const defaultScope = (): Scope => (CURRENT_USER.role === "admin" ? "all" : "mine");

export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

export const DEFAULT_QUERY: DatasetQuery = {
  q: "",
  scope: "mine",
  types: [],
  instruments: [],
  techniques: [],
  proposals: [],
  keywords: [],
  storage: [],
  conds: [],
  and: {},
  orBefore: [],
  sort: "creationTime",
  dir: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const arr = (s: string | null) => (s ? s.split(",").filter(Boolean) : []);
// "a,b+c" reads a or (b and c): commas separate, a plus joins a value to the one before it
const listOf = (s: string | null) => {
  const values: string[] = [];
  const ands: number[] = [];
  for (const clause of arr(s)) clause.split("+").filter(Boolean).forEach((v, i) => (i > 0 && ands.push(values.length), values.push(v)));
  return { values, ands: ands.length ? ands : undefined };
};
const joinList = (values: string[], ands: number[] = []) => values.map((v, i) => (i === 0 ? v : (ands.includes(i) ? "+" : ",") + v)).join("");

// Each group's match, then the groups combined left to right with "and" binding tighter than "or".
export function combine(terms: { group: FilterGroup; ok: boolean }[], orBefore: FilterGroup[]): boolean {
  if (!terms.length) return true;
  let any = false;
  let run = true;
  terms.forEach((t, i) => {
    if (i > 0 && orBefore.includes(t.group)) {
      any ||= run;
      run = true;
    }
    run &&= t.ok;
  });
  return any || run;
}
// Values inside a group: "a or b and c" = a or (b and c)
export function matchValues(values: string[], ands: number[] = [], has: (v: string) => boolean): boolean {
  let any = false;
  let run = true;
  values.forEach((v, i) => {
    if (i > 0 && !ands.includes(i)) {
      any ||= run;
      run = true;
    }
    run &&= has(v);
  });
  return any || run;
}
const SORTS: SortKey[] = ["creationTime", "name", "size", "instrumentName", "numberOfFiles", "runNumber"];
const SCOPES: Scope[] = ["mine", "shared", "public", "all"];

export function parseQuery(sp: URLSearchParams): DatasetQuery {
  const sort = sp.get("sort") as SortKey;
  const scope = sp.get("scope") as Scope;
  const size = Number(sp.get("size"));
  return {
    q: sp.get("q") ?? "",
    scope: SCOPES.includes(scope) ? scope : defaultScope(),
    types: arr(sp.get("type")) as DatasetQuery["types"],
    instruments: listOf(sp.get("inst")).values,
    techniques: listOf(sp.get("tech")).values,
    proposals: listOf(sp.get("prop")).values,
    keywords: listOf(sp.get("kw")).values,
    storage: arr(sp.get("store")) as Storage[],
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    conds: sp.getAll("m").map((s) => {
      const [key, op, value, value2, unit] = s.split("~").map(decodeURIComponent);
      return { key, op: op as MetaCond["op"], value, value2: value2 || undefined, unit: unit || undefined };
    }),
    and: { instruments: listOf(sp.get("inst")).ands, techniques: listOf(sp.get("tech")).ands, proposals: listOf(sp.get("prop")).ands, keywords: listOf(sp.get("kw")).ands },
    orBefore: arr(sp.get("or")).filter((g): g is FilterGroup => (FILTER_GROUPS as string[]).includes(g)),
    sort: SORTS.includes(sort) ? sort : "creationTime",
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(sp.get("page")) || 1),
    pageSize: PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE,
  };
}

export function serializeQuery(q: DatasetQuery): URLSearchParams {
  const sp = new URLSearchParams();
  if (q.q) sp.set("q", q.q);
  if (q.scope !== defaultScope()) sp.set("scope", q.scope);
  if (q.types.length) sp.set("type", q.types.join(","));
  if (q.instruments.length) sp.set("inst", joinList(q.instruments, q.and.instruments));
  if (q.techniques.length) sp.set("tech", joinList(q.techniques, q.and.techniques));
  if (q.proposals.length) sp.set("prop", joinList(q.proposals, q.and.proposals));
  if (q.keywords.length) sp.set("kw", joinList(q.keywords, q.and.keywords));
  if (q.storage.length) sp.set("store", q.storage.join(","));
  if (q.from) sp.set("from", q.from);
  if (q.to) sp.set("to", q.to);
  for (const c of q.conds) {
    sp.append("m", [c.key, c.op, c.value, c.value2 ?? "", c.unit ?? ""].map(encodeURIComponent).join("~"));
  }
  if (q.orBefore.length) sp.set("or", q.orBefore.join(","));
  if (q.sort !== "creationTime") sp.set("sort", q.sort);
  if (q.dir !== "desc") sp.set("dir", q.dir);
  if (q.page > 1) sp.set("page", String(q.page));
  if (q.pageSize !== DEFAULT_PAGE_SIZE) sp.set("size", String(q.pageSize));
  return sp;
}

// cache key for the result count: ignores sorting and paging
export function filterKey(q: DatasetQuery): string {
  return serializeQuery({ ...q, sort: DEFAULT_QUERY.sort, dir: DEFAULT_QUERY.dir, page: 1, pageSize: DEFAULT_QUERY.pageSize }).toString();
}

export function activeFilterCount(q: DatasetQuery): number {
  return (
    (q.q ? 1 : 0) + q.types.length + q.instruments.length + q.techniques.length + q.proposals.length +
    q.keywords.length + q.storage.length + (q.from || q.to ? 1 : 0) + q.conds.length
  );
}

export function describeCond(c: MetaCond): string {
  const u = c.unit ? ` ${c.unit}` : "";
  const k = c.key.replace(/_/g, " ");
  // a half-filled "between" reads as a one-sided bound
  if (c.op === "between" && c.value && !c.value2) return `${k} above ${c.value}${u}`;
  if (c.op === "between" && !c.value && c.value2) return `${k} below ${c.value2}${u}`;
  if (!c.value) return `${k} (any value)`;
  if (c.op === "between") return `${k} between ${c.value} and ${c.value2}${u}`;
  if (c.op === "gt") return `${k} above ${c.value}${u}`;
  if (c.op === "lt") return `${k} below ${c.value}${u}`;
  return `${k} = ${c.value}${u}`;
}

export const datasetLink = (pid: string) => `/datasets/${encodeURIComponent(pid)}`;

// An experiment's number carries its proposal's ("544555-1"), and experiments live on their own pages
export const isExperimentId = (id: string) => /-\d+$/.test(id);
export const proposalLink = (id: string) => `${isExperimentId(id) ? "/experiments" : "/proposals"}/${id}`;
