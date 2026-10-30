import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "system" | "light" | "dark";
export type Density = "comfortable" | "compact";
export type View = "table" | "grid";
export type ListView = "table" | "cards";
export type ColumnKey = "runNumber" | "keywords" | "instrument" | "technique" | "proposal" | "sample" | "type" | "created" | "size" | "files" | "owner";

export interface SavedSearch {
  id: string;
  name: string;
  qs: string;
}
export interface RecentItem {
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
  saveSearch: (name: string, qs: string) => void;
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
      pushRecent: (r) => set((s) => ({ recent: [r, ...s.recent.filter((x) => x.pid !== r.pid)].slice(0, 5) })),
      saveSearch: (name, qs) => set((s) => ({ savedSearches: [...s.savedSearches, { id: crypto.randomUUID(), name, qs }] })),
      deleteSearch: (id) => set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) })),
      updateSearch: (id, patch) => set((s) => ({ savedSearches: s.savedSearches.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    }),
    {
      name: "metadatacatalogue.ui",
      // columns added later still get their default in a browser that stored an older set
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<UIState>), columns: { ...current.columns, ...((persisted as Partial<UIState>).columns ?? {}) } }),
      partialize: (s) => ({
        theme: s.theme, density: s.density, view: s.view, sidebarCollapsed: s.sidebarCollapsed, filtersOpen: s.filtersOpen, filtersWidth: s.filtersWidth,
        columns: s.columns, savedSearches: s.savedSearches, tipsDismissed: s.tipsDismissed, recent: s.recent, filterSections: s.filterSections, builderOpen: s.builderOpen, listViews: s.listViews, hiddenColumns: s.hiddenColumns, trayPos: s.trayPos,
      }),
    },
  ),
);
