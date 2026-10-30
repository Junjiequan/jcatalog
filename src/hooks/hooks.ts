import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/query";
import { useUI, type ListView } from "@/store/ui";

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
