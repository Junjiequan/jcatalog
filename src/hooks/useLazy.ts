import { useEffect, useRef, useState } from "react";
import { bus } from "@/lib/bus";

const cache = new Map<string, { data: unknown; at: number }>();
const TTL = 60_000;

// counts change when data changes, so drop everything
bus.addEventListener("data-changed", () => cache.clear());
bus.addEventListener("job-done", () => cache.clear());

// each count scans the catalog; cap parallel requests so one page view can't stampede the database
const MAX_PARALLEL = 3;
let active = 0;
const queue: Array<{ start: () => void; priority: number }> = [];

let drainScheduled = false;

function drain() {
  drainScheduled = false;
  while (active < MAX_PARALLEL && queue.length) queue.shift()!.start();
}

// Lower priority number goes first: what people look at first (totals) before what's further down (facets).
// Everything requested in the same tick is queued first and started together, so priority really decides.
function acquire(signal: AbortSignal, priority: number): Promise<() => void> {
  return new Promise((resolve, reject) => {
    const release = () => {
      active--;
      drain();
    };
    const entry = {
      priority,
      start: () => {
        active++;
        resolve(release);
      },
    };
    const at = queue.findIndex((e) => e.priority > priority);
    queue.splice(at === -1 ? queue.length : at, 0, entry);
    signal.addEventListener("abort", () => {
      const i = queue.indexOf(entry);
      if (i >= 0) {
        queue.splice(i, 1);
        reject(new DOMException("Aborted", "AbortError"));
      }
    });
    if (!drainScheduled) {
      drainScheduled = true;
      setTimeout(drain, 0);
    }
  });
}

/**
 * For slow, non-critical data (facet counts). Cached per key, debounced, queued, cancelled when the key
 * changes, and stale-while-revalidate: the previous value stays on screen while the new one loads.
 */
export function useLazy<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>, enabled = true, priority = 5) {
  const last = useRef<T | undefined>(undefined);
  const [state, setState] = useState<{ data?: T; loading: boolean; error?: boolean }>({ loading: enabled });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    bus.addEventListener("data-changed", on);
    bus.addEventListener("job-done", on);
    return () => {
      bus.removeEventListener("data-changed", on);
      bus.removeEventListener("job-done", on);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL) {
      last.current = hit.data as T;
      setState({ data: hit.data as T, loading: false });
      return;
    }
    setState((s) => ({ data: s.data ?? last.current, loading: true }));
    const ctrl = new AbortController();
    // wait for the user to settle on a filter before asking the server to count again
    const timer = setTimeout(
      async () => {
        let release: (() => void) | undefined;
        try {
          release = await acquire(ctrl.signal, priority);
          const data = await fetcher(ctrl.signal);
          if (ctrl.signal.aborted) return;
          cache.set(key, { data, at: Date.now() });
          last.current = data;
          setState({ data, loading: false });
        } catch (e) {
          if ((e as Error)?.name !== "AbortError") setState((s) => ({ data: s.data, loading: false, error: true }));
        } finally {
          release?.();
        }
      },
      last.current ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tick]);

  return { data: state.data, loading: state.loading, error: !!state.error, retry: () => setTick((t) => t + 1) };
}
