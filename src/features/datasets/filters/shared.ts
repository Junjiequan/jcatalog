import { type DatasetQuery } from "@/types";
import { type FilterEntry } from "@/lib/filterConfig";

export type Update = (patch: Partial<DatasetQuery>) => void;

export interface P {
  query: DatasetQuery;
  update: Update;
  entry: FilterEntry;
}

export const toggleIn = (selected: string[], v: string) => (selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

export const EMPTY: Partial<DatasetQuery> = { q: "", types: [], instruments: [], techniques: [], proposals: [], keywords: [], storage: [], from: undefined, to: undefined, conds: [], and: {}, orBefore: [] };
