import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/query";
import { useUI, type ListView, type RecentItem } from "@/store/ui";

// Every detail page calls this once it has loaded what it shows, so "Recently viewed" covers all of them.
export function useRecordRecent(item: RecentItem | undefined) {
  const push = useUI((s) => s.pushRecent);
  useEffect(() => {
    if (item) push(item);
  }, [item?.kind, item?.pid]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Opening a preview takes the place of a docked selection panel when the two do not fit side by side
export function yieldSelectionTo(id: string | null) {
  if (!id) return;
  // the same sum as useDock: a docked selection panel steps aside when the two would not both fit beside the page
  const needed = (innerWidth >= 1024 ? (useUI.getState().sidebarCollapsed ? 69 : 249) + (useUI.getState().filtersOpen ? useUI.getState().filtersWidth : 0) : 0) + 520 + 2 * 320;
  if (innerWidth >= 640 && innerWidth < needed) useUI.getState().set({ selectionOpen: false });
}

// The text in a list's search box, kept in the URL as ?q=, so a link (or quick access) can open the list already searched.
export function useSearchText(): [string, (v: string) => void] {
  const [sp, setSp] = useSearchParams();
  const set = useCallback(
    (v: string) =>
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set("q", v);
        else next.delete("q");
        next.delete("page");
        return next;
      }, { replace: true }),
    [setSp],
  );
  return [sp.get("q") ?? "", set];
}

// The item a list shows in its preview panel, kept in the URL as ?peek=<id>. Setting the one that is open closes it.
export function usePeekParam(): [string | null, (id: string | null) => void] {
  const [sp, setSp] = useSearchParams();
  const peek = sp.get("peek");
  const set = useCallback(
    (id: string | null) => {
      yieldSelectionTo(id);
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        // the item that is already open, picked again, closes its preview
        if (id && prev.get("peek") !== id) next.set("peek", id);
        else next.delete("peek");
        return next;
      }, { replace: true });
    },
    [setSp],
  );
  return [peek, set];
}

// Table or cards for a list page, remembered per page.
export function useListView(key: string, fallback: ListView): [ListView, (v: ListView) => void] {
  const views = useUI((s) => s.listViews);
  const set = useUI((s) => s.set);
  return [views[key] ?? fallback, (v) => set({ listViews: { ...views, [key]: v } })];
}

// Page and page size live in the URL (?page=&per=), so refresh, back and shared links land on the same page.
// A change of `resetKey` (the search text, a tab) goes back to page 1.
export function usePaging<T>(list: T[], resetKey: string, defaultSize = DEFAULT_PAGE_SIZE) {
  const [sp, setSp] = useSearchParams();
  const size = Number(sp.get("per")) || defaultSize;
  const pageSize = PAGE_SIZES.includes(size) ? size : defaultSize;
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number(sp.get("page")) || 1));
  const patch = useCallback(
    (kv: Record<string, string | undefined>) =>
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(kv)) v === undefined ? next.delete(k) : next.set(k, v);
        return next;
      }, { replace: true }),
    [setSp],
  );
  const seen = useRef(resetKey);
  useEffect(() => {
    if (seen.current === resetKey) return;
    seen.current = resetKey;
    patch({ page: undefined });
  }, [resetKey, patch]);
  const items = list.slice((page - 1) * pageSize, page * pageSize);
  return {
    items,
    page,
    pageSize,
    totalPages,
    from: items.length ? (page - 1) * pageSize + 1 : 0,
    to: (page - 1) * pageSize + items.length,
    hasMore: page < totalPages,
    setPage: (p: number) => patch({ page: p === 1 ? undefined : String(p) }),
    setPageSize: (n: number) => patch({ per: n === defaultSize ? undefined : String(n), page: undefined }),
  };
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

// keys: "mod+k", "/", "?", "j", "Escape"; plain keys are ignored while typing
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = mod ? `mod+${e.key.toLowerCase()}` : e.key;
      const fn = ref.current[key];
      if (!fn) return;
      if (!mod && key !== "Escape" && (isTyping(e.target) || e.altKey)) return;
      fn(e);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}
