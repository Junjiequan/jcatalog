import { useCallback, useEffect } from "react";
import { QueryClient, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { bus } from "@/lib/bus";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

// Server data changed (create, edit, delete, job finished): drop every cached read, so screens refetch on their own.
const dataQueries = { predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey[0] !== "filters-config" };
bus.addEventListener("data-changed", () => queryClient.invalidateQueries(dataQueries));
bus.addEventListener("job-done", () => queryClient.invalidateQueries(dataQueries));

// The one read hook. `key` is the cache key (resource name plus the arguments), `fn` the adapter call.
// The result keeps the shape screens were written against: data, error, loading, reload, mutate.
export function useResource<T>(key: QueryKey, fn: () => Promise<T>, opts: { enabled?: boolean } = {}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: key, queryFn: fn, enabled: opts.enabled });
  const { refetch } = q;
  const reload = useCallback(() => void refetch(), [refetch]);
  const mutate = useCallback((updater: (d: T) => T) => qc.setQueryData<T>(key, (d) => (d === undefined ? d : updater(d))), [qc, key]);
  return { data: q.data, error: (q.error as Error | null) ?? undefined, loading: q.isPending, reload, mutate };
}

// Refetch a resource when something else on the page reports a change
export function useRefetchOn(event: string, reload: () => void) {
  useEffect(() => {
    bus.addEventListener(event, reload);
    return () => bus.removeEventListener(event, reload);
  }, [event, reload]);
}
