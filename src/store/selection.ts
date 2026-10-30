import { create } from "zustand";
import { persist } from "zustand/middleware";
import {Dataset, storageOf} from "@/types";

export type SelKind = "dataset" | "proposal" | "experiment" | "sample" | "instrument" | "published" | "job";

// One selected thing, of any kind. Datasets carry what their bulk actions need; the rest just know where they live.
export interface SelItem {
  kind: SelKind;
  id: string;
  name: string;
  sub?: string;
  link: string;
  size?: number;
  files?: number;
  archived?: boolean;
}

export const KIND_LABEL: Record<SelKind, [string, string]> = {
  dataset: ["dataset", "datasets"],
  proposal: ["proposal", "proposals"],
  experiment: ["experiment", "experiments"],
  sample: ["sample", "samples"],
  instrument: ["instrument", "instruments"],
  published: ["publication", "publications"],
  job: ["job", "jobs"],
};
export const KIND_ORDER: SelKind[] = ["dataset", "proposal", "experiment", "sample", "instrument", "published", "job"];

export const datasetItem = (d: Dataset): SelItem => ({ kind: "dataset", id: d.pid, name: d.datasetName, sub: d.pid, link: `/datasets/${encodeURIComponent(d.pid)}`, size: d.size, files: d.numberOfFiles, archived: storageOf(d) === "archived" });

interface SelState {
  items: Record<string, SelItem>;
  // datasets keep their shortcuts; anything else goes through toggleItem / addItems
  toggle: (d: Dataset) => void;
  addMany: (ds: Dataset[]) => void;
  toggleItem: (item: SelItem) => void;
  addItems: (items: SelItem[]) => void;
  removeMany: (ids: string[]) => void;
  restore: (items: SelItem[]) => void;
  clear: () => void;
}

export const useSelection = create<SelState>()(
  persist(
    (set) => ({
      items: {},
      toggleItem: (item) =>
        set((s) => {
          const items = { ...s.items };
          if (items[item.id]) delete items[item.id];
          else items[item.id] = item;
          return { items };
        }),
      toggle: (d) =>
        set((s) => {
          const items = { ...s.items };
          if (items[d.pid]) delete items[d.pid];
          else items[d.pid] = datasetItem(d);
          return { items };
        }),
      addMany: (ds) => set((s) => ({ items: { ...s.items, ...Object.fromEntries(ds.map((d) => [d.pid, datasetItem(d)])) } })),
      addItems: (list) => set((s) => ({ items: { ...s.items, ...Object.fromEntries(list.map((i) => [i.id, i])) } })),
      removeMany: (ids) =>
        set((s) => {
          const items = { ...s.items };
          ids.forEach((p) => delete items[p]);
          return { items };
        }),
      restore: (list) => set((s) => ({ items: { ...s.items, ...Object.fromEntries(list.map((i) => [i.id, i])) } })),
      clear: () => set({ items: {} }),
    }),
    // version 2: items gained a kind, so an older stored selection is dropped rather than misread
    { name: "metadatacatalogue.selection", version: 2, migrate: () => ({ items: {} }) as unknown as SelState },
  ),
);

export const selectionList = (items: Record<string, SelItem>) => Object.values(items);
export const byKind = (list: SelItem[]) => KIND_ORDER.map((k) => [k, list.filter((i) => i.kind === k)] as const).filter(([, l]) => l.length);
