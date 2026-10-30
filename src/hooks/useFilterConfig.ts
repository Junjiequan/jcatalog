import { useQuery } from "@tanstack/react-query";
import { loadFilterConfig } from "@/lib/filterConfig";

// undefined while the file is loading, so the panel never flashes the wrong order
export function useFilterConfig() {
  return useQuery({ queryKey: ["filters-config"], queryFn: loadFilterConfig, staleTime: Infinity, retry: false }).data;
}
