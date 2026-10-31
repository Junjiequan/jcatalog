import { api } from "@/api";
import type { Dataset } from "@/types";

// The chain a dataset sits in: what it was made from (upstream) and what was made from it (downstream), walked a few
// steps each way through related(). Only ancestors and descendants: a dataset that merely shares a source with this
// one, or feeds into one of its descendants, is not part of its lineage.
export type LineageRole = "current" | "source" | "derived";
export interface LineageNode {
  d: Dataset;
  role: LineageRole;
  // 0 for the dataset itself, negative upstream, positive downstream
  depth: number;
}
export interface LineageEdge {
  from: string;
  to: string;
  // how the target was produced from the source (the first entry of usedSoftware)
  software?: string;
}
export interface Lineage {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

// "https://github.com/scipp/esssans v24.12.0" -> "esssans v24.12.0"
export function softwareLabel(s?: string) {
  if (!s) return undefined;
  const [url, ...rest] = s.trim().split(/\s+/);
  return [url.replace(/\/+$/, "").split("/").pop() || url, ...rest].join(" ");
}

const STEPS = 2;
const MAX_NODES = 40;

export async function loadLineage(d: Dataset): Promise<Lineage> {
  const nodes = new Map<string, LineageNode>([[d.pid, { d, role: "current", depth: 0 }]]);
  const edges = new Map<string, LineageEdge>();
  const link = (from: Dataset, to: Dataset) => edges.set(`${from.pid}>${to.pid}`, { from: from.pid, to: to.pid, software: to.usedSoftware[0] });
  // a dataset already in the picture keeps its place; the result says whether this call added it
  const add = (x: Dataset, role: LineageRole, depth: number): LineageNode | undefined => {
    if (nodes.has(x.pid) || nodes.size >= MAX_NODES) return undefined;
    const n = { d: x, role, depth };
    nodes.set(x.pid, n);
    return n;
  };
  // breadth first; upstream datasets only look further upstream, downstream ones further downstream
  let frontier: LineageNode[] = [nodes.get(d.pid)!];
  for (let step = 0; step < STEPS && frontier.length; step++) {
    const rels = await Promise.all(frontier.map((n) => api.datasets.related(n.d.pid)));
    const next: LineageNode[] = [];
    rels.forEach((r, i) => {
      const n = frontier[i];
      if (n.depth <= 0) for (const s of r.sources) { link(s, n.d); const m = add(s, "source", n.depth - 1); if (m) next.push(m); }
      if (n.depth >= 0) for (const x of r.derived) { link(n.d, x); const m = add(x, "derived", n.depth + 1); if (m) next.push(m); }
    });
    frontier = next;
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}
