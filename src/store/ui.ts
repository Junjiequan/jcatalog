import { appConfig } from "@/lib/appConfig";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";
export type View = "table" | "grid";
export type ListView = "table" | "cards";
export type ColumnKey = "runNumber" | "keywords" | "instrument" | "technique" | "proposal" | "sample" | "type" | "created" | "size" | "files" | "owner";

// Searches are saved per kind of list. Datasets are the only kind so far; add a kind here (its tab title and the page that
// applies it) and the Settings tab, and saving from that page, follow.
export type SearchKind = "datasets";
export const SEARCH_KINDS: Record<SearchKind, { label: string; noun: string; path: string }> = { datasets: { label: "Datasets", noun: "dataset", path: "/datasets" } };
export interface SavedSearch {
  id: string;
  name: string;
  qs: string;
  // searches saved before there were kinds have none, and are dataset searches
  kind?: SearchKind;
}
export const kindOf = (s: SavedSearch): SearchKind => s.kind ?? "datasets";
// what was opened; items saved before proposals were recorded have no kind and are datasets
export interface RecentItem {
  kind?: "dataset" | "proposal" | "experiment" | "sample" | "published";
  pid: string;
  name: string;
}

interface UIState {
  theme: Theme;
  density: Density;
  view: View;
  sidebarCollapsed: boolean;
  filtersOpen: boolean;
  filtersWidth: number;
  // the widths of the two panels on the right, each its own (a preview, the selection)
  previewWidth: number;
  selectionWidth: number;
  columns: Record<ColumnKey, boolean>;
  savedSearches: SavedSearch[];
  tipsDismissed: boolean;
  recent: RecentItem[];
  filterSections: Record<string, boolean>;
  builderOpen: boolean;
  listViews: Record<string, ListView>;
  // columns a user hid on each list page (the first column always stays)
  hiddenColumns: Record<string, string[]>;
  // transient
  paletteOpen: boolean;
  createOpen: boolean;
  shortcutsOpen: boolean;
  selectionOpen: boolean;
  // the floating selection tray folded away to a small pill, until the user unfolds it
  trayHidden: boolean;
  // where the user dragged the selection tray to (viewport px); unset = docked bottom centre
  trayPos?: { x: number; y: number };
  mobileFiltersOpen: boolean;
  // a filter section to open, scroll to and flash once (set by the applied-filter bar)
  focusSection?: string;
  set: (patch: Partial<UIState>) => void;
  toggleColumn: (k: ColumnKey) => void;
  pushRecent: (r: RecentItem) => void;
  clearRecent: () => void;
  saveSearch: (name: string, qs: string, kind?: SearchKind) => void;
  deleteSearch: (id: string) => void;
  updateSearch: (id: string, patch: Partial<Pick<SavedSearch, "name" | "qs">>) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      theme: "system",
      density: "comfortable",
      view: "table",
      sidebarCollapsed: false,
      filtersOpen: true,
      filtersWidth: 296,
      previewWidth: 400,
      selectionWidth: 400,
      columns: { runNumber: true, keywords: true, instrument: true, technique: true, proposal: false, sample: true, type: true, created: true, size: true, files: false, owner: false },
      savedSearches: [],
      tipsDismissed: false,
      recent: [],
      filterSections: {},
      builderOpen: true,
      listViews: {},
      hiddenColumns: {},
      paletteOpen: false,
      createOpen: false,
      shortcutsOpen: false,
      selectionOpen: false,
      trayHidden: false,
      mobileFiltersOpen: false,
      set: (patch) => set(patch),
      toggleColumn: (k) => set((s) => ({ columns: { ...s.columns, [k]: !s.columns[k] } })),
      clearRecent: () => set({ recent: [] }),
      pushRecent: (r) => set((s) => ({ recent: [r, ...s.recent.filter((x) => x.pid !== r.pid || (x.kind ?? "dataset") !== (r.kind ?? "dataset"))].slice(0, appConfig().recentlyViewed) })),
      saveSearch: (name, qs, kind = "datasets") => set((s) => ({ savedSearches: [...s.savedSearches, { id: crypto.randomUUID(), name, qs, kind }] })),
      deleteSearch: (id) => set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),
      updateSearch: (id, patch) => set((s) => ({ savedSearches: s.savedSearches.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    }),
    {
      name: "metadatacatalogue.ui",
      // columns added later still get their default in a browser that stored an older set
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<UIState>), columns: { ...current.columns, ...((persisted as Partial<UIState>).columns ?? {}) } }),
      partialize: (s) => ({
        theme: s.theme, density: s.density, view: s.view, sidebarCollapsed: s.sidebarCollapsed, filtersOpen: s.filtersOpen, filtersWidth: s.filtersWidth, previewWidth: s.previewWidth, selectionWidth: s.selectionWidth,
        columns: s.columns, savedSearches: s.savedSearches, tipsDismissed: s.tipsDismissed, recent: s.recent, filterSections: s.filterSections, builderOpen: s.builderOpen, listViews: s.listViews, hiddenColumns: s.hiddenColumns, trayPos: s.trayPos,
      }),
    },
  ),
);
