import { create } from "zustand";
import { persist } from "zustand/middleware";
import { proposalKind, storageOf, type Dataset, type Proposal, type PublishedData, type Sample } from "@/types";

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
  // when it was picked: a plain object lists number-like ids first, so the order a person chose is kept here
  at?: number;
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

// how a sample or a proposal/experiment goes into the selection, wherever it is picked
export const sampleItem = (s: Sample): SelItem => ({ kind: "sample", id: `sample:${s.sampleId}`, name: s.sampleName, sub: s.formula || s.sampleId, link: `/samples/${encodeURIComponent(s.sampleId)}` });
export const publishedItem = (p: PublishedData): SelItem => ({ kind: "published", id: `doi:${p.doi}`, name: p.title, sub: p.doi, link: `/published/${encodeURIComponent(p.pid)}` });
export const proposalItem = (p: Proposal): SelItem => ({ kind: proposalKind(p), id: `proposal:${p.proposalId}`, name: p.title, sub: p.proposalId, link: `${p.parentProposalId ? "/experiments" : "/proposals"}/${p.proposalId}` });

// a pick order that never repeats, even for two picks in the same millisecond
let clock = Date.now();
const stamp = (i: SelItem): SelItem => (i.at === undefined ? { ...i, at: clock++ } : i);

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
          else items[item.id] = stamp(item);
          return { items };
        }),
      toggle: (d) =>
        set((s) => {
          const items = { ...s.items };
          if (items[d.pid]) delete items[d.pid];
          else items[d.pid] = stamp(datasetItem(d));
          return { items };
        }),
      addMany: (ds) => set((s) => ({ items: { ...s.items, ...Object.fromEntries(ds.filter((d) => !s.items[d.pid]).map((d) => [d.pid, stamp(datasetItem(d))])) } })),
      addItems: (list) => set((s) => ({ items: { ...s.items, ...Object.fromEntries(list.filter((i) => !s.items[i.id]).map((i) => [i.id, stamp(i)])) } })),
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

// in the order they were picked
export const selectionList = (items: Record<string, SelItem>) => Object.values(items).sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
export const byKind = (list: SelItem[]) => KIND_ORDER.map((k) => [k, list.filter((i) => i.kind === k)] as const).filter(([, l]) => l.length);
