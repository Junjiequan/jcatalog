import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import clsx from "clsx";
import { Cog, FileText, GitBranch } from "lucide-react";
import { Background, BackgroundVariant, BaseEdge, Controls, EdgeLabelRenderer, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, getBezierPath, type Edge, type EdgeProps, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK, { type ElkExtendedEdge, type ElkNode } from "elkjs/lib/elk.bundled.js";
import { Thumb } from "@/components/Thumb";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { useResource } from "@/api/hooks";
import { useMediaQuery } from "@/hooks/hooks";
import { fmtDate } from "@/lib/format";
import { loadLineage, softwareLabel, type Lineage, type LineageNode, type LineageRole } from "@/lib/lineage";
import { datasetLink, isExperimentId, proposalLink } from "@/lib/query";
import type { Dataset } from "@/types";
import { TypeBadge } from "../shared";

// The lineage graph: React Flow draws it, ELK lays it out. Datasets sit inside their proposal's box; what this
// dataset was made from is to the left (above on a phone), what was made from it to the right (below).

type Dir = "LR" | "TB";
const NODE_W = 240;
const NODE_H = 80;

type DatasetNode = Node<{ d: Dataset; role: LineageRole; dir: Dir }, "dataset">;
type ProposalNode = Node<{ id: string; title: string; current: boolean; count: number }, "proposal">;
type LNode = DatasetNode | ProposalNode;
// an arrow carries the step between two datasets: the software that produced the target from the source
type SoftwareEdge = Edge<{ software?: string; from: string; to: string; dir: Dir; on?: boolean }, "software">;

const elk = new ELK();

async function layout(l: Lineage, dir: Dir, current: string): Promise<{ nodes: LNode[]; edges: SoftwareEdge[] }> {
  // a phone gets narrower cards, top to bottom
  const w = dir === "TB" ? 204 : NODE_W;
  const byPid = new Map(l.nodes.map((n) => [n.d.pid, n]));
  // oldest first within a column, whichever dataset is open, so the same datasets keep the same order from page to page
  const ordered = [...l.nodes].sort((a, b) => a.d.creationTime.localeCompare(b.d.creationTime) || a.d.pid.localeCompare(b.d.pid));
  const groups = new Map<string, LineageNode[]>();
  for (const n of ordered) (groups.get(n.d.proposalId) ?? groups.set(n.d.proposalId, []).get(n.d.proposalId)!).push(n);
  // upstream, this dataset, downstream: columns ELK keeps even where the edges alone would not force them
  const partition = (n: LineageNode) => String(n.depth < 0 ? 0 : n.depth > 0 ? 2 : 1);
  // an edge lives in the box both ends share, else at the top
  const inner = new Map<string, ElkExtendedEdge[]>();
  const outer: ElkExtendedEdge[] = [];
  for (const e of l.edges) {
    if (!byPid.has(e.from) || !byPid.has(e.to)) continue;
    const pa = byPid.get(e.from)!.d.proposalId;
    const ee = { id: `${e.from}>${e.to}`, sources: [e.from], targets: [e.to] };
    if (pa === byPid.get(e.to)!.d.proposalId) (inner.get(pa) ?? inner.set(pa, []).get(pa)!).push(ee);
    else outer.push(ee);
  }
  // Each box is laid out on its own, so it needs the options itself. The order the datasets are listed in is kept
  // within a column. One layout across boxes is only needed when an edge crosses between two proposals, and ELK
  // cannot combine that with keeping the order.
  const layered = {
    "elk.algorithm": "layered",
    "elk.direction": dir === "LR" ? "RIGHT" : "DOWN",
    "elk.layered.spacing.nodeNodeBetweenLayers": dir === "LR" ? "280" : "84",
    "elk.spacing.nodeNode": "20",
    "elk.partitioning.activate": "true",
    ...(outer.length ? {} : { "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES", "elk.layered.crossingMinimization.forceNodeModelOrder": "true" }),
  };
  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": dir === "LR" ? "RIGHT" : "DOWN",
      "elk.spacing.componentComponent": "40",
      ...(outer.length ? { "elk.hierarchyHandling": "INCLUDE_CHILDREN" } : {}),
    },
    children: [...groups].map(([p, members]) => ({
      id: `proposal:${p}`,
      layoutOptions: { ...layered, "elk.padding": "[top=58,left=16,bottom=16,right=16]" },
      children: members.map((n) => ({ id: n.d.pid, width: w, height: NODE_H, layoutOptions: { "elk.partitioning.partition": partition(n) } })),
      edges: inner.get(p) ?? [],
    })),
    edges: outer,
  };
  const out = await elk.layout(graph);
  const nodes: LNode[] = [];
  for (const g of out.children ?? []) {
    const p = g.id.slice("proposal:".length);
    const members = groups.get(p)!;
    nodes.push({
      id: g.id, type: "proposal", position: { x: g.x ?? 0, y: g.y ?? 0 }, width: g.width, height: g.height, style: { width: g.width, height: g.height },
      data: { id: p, title: members[0].d.proposalTitle, current: p === byPid.get(current)!.d.proposalId, count: members.length }, draggable: false, selectable: false, focusable: false,
    });
    for (const c of g.children ?? []) {
      const n = byPid.get(c.id)!;
      nodes.push({ id: c.id, type: "dataset", parentId: g.id, extent: "parent", position: { x: c.x ?? 0, y: c.y ?? 0 }, width: w, height: NODE_H, style: { width: w, height: NODE_H }, data: { d: n.d, role: n.role, dir }, draggable: false, selectable: false });
    }
  }
  const edges: SoftwareEdge[] = l.edges
    .filter((e) => byPid.has(e.from) && byPid.has(e.to))
    .map((e) => ({ id: `${e.from}>${e.to}`, type: "software", source: e.from, target: e.to, data: { software: e.software, from: byPid.get(e.from)!.d.datasetName, to: byPid.get(e.to)!.d.datasetName, dir } }));
  return { nodes, edges };
}

// React Flow puts the arrowhead colour into an element id, so it must be a plain value rather than a CSS variable
function hexOf(cssColor: string) {
  const el = document.createElement("span");
  el.style.color = cssColor;
  document.body.appendChild(el);
  const [r = 0, g = 0, b = 0] = getComputedStyle(el).color.match(/\d+/g)?.map(Number) ?? [];
  el.remove();
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
function useThemeColors() {
  const read = () => ({ line: hexOf("var(--color-line-strong)"), accent: hexOf("var(--color-accent)"), dark: document.documentElement.classList.contains("dark") });
  const [c, setC] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setC(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return c;
}

function SoftwareEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, data }: EdgeProps<SoftwareEdge>) {
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const label = softwareLabel(data?.software);
  // the text sits above a horizontal arrow and beside a vertical one, never on the line
  const beside = data?.dir === "TB";
  const on = !!data?.on;
  return (
    <>
      <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            title={`${data?.to} was produced from ${data?.from} with ${data?.software}`}
            style={{ transform: beside ? `translate(10px, -50%) translate(${x}px, ${y}px)` : `translate(-50%, calc(-100% - 5px)) translate(${x}px, ${y}px)` }}
            className={clsx("nodrag nopan pointer-events-auto absolute text-[11.5px] leading-tight", beside ? "w-max max-w-[150px]" : "flex items-center gap-1 whitespace-nowrap", on ? "text-accent" : "text-fg")}
          >
            <span className={clsx("flex items-center gap-1", !on && "text-muted")}><Cog className="h-3 w-3 shrink-0" />produced with</span>
            <span className={clsx("font-semibold", beside && "block")}>{label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function DatasetNodeView({ data: { d, role, dir } }: NodeProps<DatasetNode>) {
  const current = role === "current";
  return (
    <div
      title={current ? undefined : `Open ${d.datasetName}`}
      className={clsx(
        "relative flex h-full w-full items-center gap-2.5 rounded-xl border bg-surface px-2.5 shadow-sm transition-colors",
        current ? "border-accent ring-2 ring-accent/25" : "cursor-pointer border-line-strong hover:border-accent",
      )}
    >
      <Handle type="target" position={dir === "LR" ? Position.Left : Position.Top} />
      <Handle type="source" position={dir === "LR" ? Position.Right : Position.Bottom} />
      <Thumb d={d} className="h-11 w-16 shrink-0 rounded-md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-semibold">{d.datasetName}</span><TypeBadge type={d.type} /></div>
        <div className="tnum truncate font-mono text-[11px] text-muted" title={d.pid}>{d.pid}</div>
        <div className="truncate text-[11px] text-subtle">{d.instrumentName} · {fmtDate(d.creationTime)}</div>
      </div>
      {current && <span className="absolute -top-2.5 right-2 rounded-full bg-accent px-1.5 py-px text-[10px] font-semibold text-accent-fg">This dataset</span>}
    </div>
  );
}

function ProposalNodeView({ data }: NodeProps<ProposalNode>) {
  const kind = isExperimentId(data.id) ? "Experiment" : "Proposal";
  return (
    <div className={clsx("h-full w-full rounded-2xl border border-dashed", data.current ? "border-accent/50 bg-accent-soft/20" : "border-line-strong bg-surface-2/40")}>
      <Link to={proposalLink(data.id)} className="nodrag nopan group absolute left-3 top-2.5 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-md px-1 py-0.5 hover:bg-surface">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><FileText className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-subtle">{kind} · {data.count} in this chain</span>
          <span className="block truncate text-[12px] font-medium group-hover:text-accent" title={data.title}><span className="tnum font-mono">{data.id}</span> · {data.title}</span>
        </span>
      </Link>
    </div>
  );
}

const nodeTypes = { dataset: DatasetNodeView, proposal: ProposalNodeView };
const edgeTypes = { software: SoftwareEdgeView };
const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

export default function LineageGraph(props: { d: Dataset; className?: string; expanded?: boolean }) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}

function Graph({ d, className, expanded }: { d: Dataset; className?: string; expanded?: boolean }) {
  const dir: Dir = useMediaQuery("(max-width: 639px)") ? "TB" : "LR";
  const { data: lineage, error, reload } = useResource(["dataset-lineage", d.pid], () => loadLineage(d));
  const [laid, setLaid] = useState<{ key: string; nodes: LNode[]; edges: SoftwareEdge[] } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const colors = useThemeColors();
  const nav = useNavigate();

  useEffect(() => {
    if (!lineage) return;
    let live = true;
    layout(lineage, dir, d.pid).then((r) => live && setLaid({ key: `${d.pid}:${dir}`, ...r }));
    return () => void (live = false);
  }, [lineage, dir, d.pid]);

  // the edges of the dataset under the pointer light up
  const edges = useMemo(
    () =>
      (laid?.edges ?? []).map((e): SoftwareEdge => {
        const on = hover !== null && (e.source === hover || e.target === hover);
        const color = on ? colors.accent : colors.line;
        return { ...e, data: { ...e.data!, on }, animated: on, style: { stroke: color, strokeWidth: on ? 2.25 : 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color } };
      }),
    [laid, hover, colors],
  );

  if (error) return <ErrorState onRetry={reload} />;
  if (!laid) return <Skeleton className={clsx("w-full rounded-xl", className)} />;
  if (laid.nodes.filter((n) => n.type === "dataset").length <= 1) return <EmptyState icon={GitBranch} title="No lineage yet" description={d.type === "raw" ? "This is raw data, and nothing has been derived from it so far." : "This dataset has no recorded sources and nothing has been derived from it."} />;
  return (
    <div>
      <div className={clsx("lineage relative overflow-hidden rounded-xl border border-line", className)}>
        <ReactFlow
          key={laid.key}
          nodes={laid.nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          colorMode={colors.dark ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: dir === "TB" ? 0.08 : 0.15 }}
          minZoom={0.3}
          maxZoom={1.75}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          // the page keeps scrolling over the graph; zoom with the buttons, a pinch, or the modifier key and the wheel
          zoomOnScroll={false}
          panOnScroll={false}
          preventScrolling={false}
          zoomOnDoubleClick={false}
          onNodeMouseEnter={(_, n) => n.type === "dataset" && setHover(n.id)}
          onNodeMouseLeave={() => setHover(null)}
          onNodeClick={(_, n) => void (n.type === "dataset" && n.id !== d.pid && nav(`${datasetLink(n.id)}?tab=related`))}
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
          <Controls showInteractive={false} position="bottom-right" />
          {expanded && <MiniMap pannable zoomable position="top-right" nodeStrokeWidth={0} nodeColor={(n) => (n.type === "proposal" ? "transparent" : colors.line)} />}
        </ReactFlow>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><Badge tone="accent">Raw</Badge> as recorded</span>
        <span className="flex items-center gap-1.5"><Badge>Derived</Badge> reduced or analysed</span>
        <span className="flex items-center gap-1.5">
          <svg width="36" height="10" viewBox="0 0 36 10" aria-hidden className="text-line-strong"><line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" strokeWidth="1.5" /><polygon points="27,1 35,5 27,9" fill="currentColor" /></svg>
          made from
        </span>
        <span className="flex items-center gap-1.5"><span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-1.5 py-px text-[10px] font-medium"><Cog className="h-2.5 w-2.5" />software</span> the step that produced it</span>
        <span className="flex items-center gap-1.5"><span className="h-3.5 w-6 rounded border border-dashed border-line-strong" /> proposal</span>
        <span className="ml-auto hidden sm:inline">Drag to pan · {MAC ? "⌘" : "Ctrl"} + scroll or pinch to zoom</span>
      </div>
    </div>
  );
}
