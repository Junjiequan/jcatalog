import type { ReactNode } from "react";
import clsx from "clsx";
import { CardCheck, CardGrid, KeywordChips, Table, cardCls, type Column as TableColumn } from "@/components/ui/Primitives";
import { ChevronRight } from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { Skeleton } from "@/components/ui/Primitives";
import { InstrumentChips, TechniqueChips } from "@/components/InstrumentChips";
import { ClipRow } from "@/components/ui/Overlay";
import { fmtBytes, fmtDate, fmtNum } from "@/lib/format";
import { useSelection } from "@/store/selection";
import { useMediaQuery } from "@/hooks/hooks";
import type { ColumnKey, Density } from "@/store/ui";
import {Dataset, SortKey, storageOf, techniqueNames} from "@/types";
import { PublishedBadge, TypeBadge } from "./shared";

interface Common {
  items: Dataset[];
  peek: string | null;
  onPeek: (pid: string) => void;
  onOpen: (pid: string) => void;
}

interface Col {
  key: ColumnKey;
  label: string;
  sort?: SortKey;
  right?: boolean;
  cell: (d: Dataset) => ReactNode;
}

const COLS: Col[] = [
  { key: "runNumber", label: "Run", sort: "runNumber", cell: (d) => <span className="tnum font-medium">{d.runNumber}</span> },
  { key: "keywords", label: "Keywords", cell: (d) => <KeywordChips words={d.keywords} max={2} nowrap size="sm" /> },
  { key: "instrument", label: "Instrument", sort: "instrumentName", cell: (d) => <InstrumentChips ids={d.instrumentIds} size="sm" nowrap /> },
  { key: "technique", label: "Technique", cell: (d) => <TechniqueChips names={techniqueNames(d)} nowrap /> },
  { key: "proposal", label: "Proposal", cell: (d) => <span className="tnum text-muted" title={d.proposalTitle}>{d.proposalId}</span> },
  { key: "sample", label: "Sample", cell: (d) => <span className="block max-w-[200px] truncate text-muted" title={d.sampleName}>{d.sampleName}</span> },
  { key: "type", label: "Type", cell: (d) => <TypeBadge type={d.type} /> },
  { key: "created", label: "Created", sort: "creationTime", cell: (d) => <span className="text-muted" title={fmtDate(d.creationTime, true)}>{fmtDate(d.creationTime)}</span> },
  { key: "size", label: "Size", sort: "size", right: true, cell: (d) => <span className="tnum text-muted">{fmtBytes(d.size)}</span> },
  { key: "files", label: "Files", sort: "numberOfFiles", right: true, cell: (d) => <span className="tnum text-muted">{fmtNum(d.numberOfFiles)}</span> },
  { key: "owner", label: "Owner", cell: (d) => <span className="text-muted">{d.owner}</span> },
];

export function TableSkeleton({ density }: { density: Density }) {
  return (
    <div className="divide-y divide-line">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className={clsx("flex items-center gap-4 px-4", density === "compact" ? "py-2" : "py-3.5")}>
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-9 w-14" />
          <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/5" /></div>
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="hidden h-4 w-24 lg:block" />
          <Skeleton className="hidden h-5 w-14 lg:block" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 p-4 sm:p-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
          <Skeleton className="aspect-[16/10] w-full rounded-none" />
          <div className="space-y-2 p-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" /></div>
        </div>
      ))}
    </div>
  );
}

// approximate widths, in the order columns are dropped when space runs out (last = first to go)
const EST: Record<ColumnKey, number> = { runNumber: 70, keywords: 220, instrument: 120, technique: 120, proposal: 110, sample: 190, type: 80, created: 120, size: 90, files: 80, owner: 150 };
const PRIORITY: ColumnKey[] = ["runNumber", "created", "size", "instrument", "technique", "keywords", "type", "sample", "proposal", "files", "owner"];

export function DatasetTable({ items, peek, onPeek, onOpen, density, columns, sort, dir, onSort, width, onKeyword, onInstrument, onTechnique }: Common & {
  onKeyword?: (k: string) => void;
  onInstrument?: (id: string) => void;
  onTechnique?: (name: string) => void;
  density: Density;
  columns: Record<ColumnKey, boolean>;
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  width: number;
}) {
  const toggle = useSelection((s) => s.toggle);
  const selected = useSelection((s) => s.items);
  // columns drop out, least important first, as the results area narrows
  let budget = (width || 1200) - 40 - 36 - 300;
  const visible = new Set<ColumnKey>();
  for (const k of PRIORITY) {
    if (columns[k] && budget >= EST[k]) {
      visible.add(k);
      budget -= EST[k];
    }
  }
  // on a phone the name column carries instrument, age and size itself
  const phone = useMediaQuery("(max-width: 639px)");
  const compact = density === "compact";
  const cols: TableColumn<Dataset>[] = [
    { key: "thumb", label: "Preview", hideLabel: true, narrow: true, className: compact ? "w-14" : "w-[4.25rem]", render: (d) => <Thumb d={d} preview className={clsx("block max-w-none rounded-md", compact ? "h-7 w-11" : "h-9 w-14")} /> },
    {
      key: "name",
      label: "Name",
      sort: "name",
      render: (d, on) => (
        <>
          <div className="flex items-center gap-2">
            <span className={clsx("max-w-[300px] truncate font-medium", on && "text-accent")} title={d.datasetName}>{d.datasetName}</span>
            {d.isPublished && <PublishedBadge />}
          </div>
          <div className="sub tnum max-w-[13rem] truncate text-xs sm:max-w-[300px] text-subtle" title={d.pid}>{d.pid}</div>
          {phone && (
            <>
              <ClipRow className="mt-1" title="Instrument and technique" full={<><InstrumentChips ids={d.instrumentIds} size="sm" onPick={onInstrument} /><TechniqueChips names={techniqueNames(d)} onPick={onTechnique} /></>}><span className="inline-flex items-center gap-1.5"><InstrumentChips ids={d.instrumentIds} size="sm" nowrap onPick={onInstrument} /><TechniqueChips names={techniqueNames(d)} nowrap onPick={onTechnique} /></span></ClipRow>
              <div className="tnum mt-1 truncate text-xs text-muted">Run {d.runNumber} · {fmtDate(d.creationTime)} · {fmtBytes(d.size)}</div>
            </>
          )}
        </>
      ),
    },
    ...(phone ? [] : COLS.filter((c) => visible.has(c.key)).map((c): TableColumn<Dataset> => ({ key: c.key, label: c.label, sort: c.sort, right: c.right, className: "whitespace-nowrap", render: (d) => (c.key === "keywords" ? <KeywordChips words={d.keywords} max={2} nowrap size="sm" onPick={onKeyword} /> : c.key === "instrument" ? <InstrumentChips ids={d.instrumentIds} size="sm" nowrap onPick={onInstrument} /> : c.key === "technique" ? <TechniqueChips names={techniqueNames(d)} nowrap onPick={onTechnique} /> : c.cell(d)) }))),
  ];
  return (
    <Table
      stickyHeader
      phoneStack={false}
      density={density}
      columns={cols}
      rows={items}
      rowKey={(d) => d.pid}
      rowAttrs={(d) => ({ "data-pid": d.pid })}
      onRow={(d) => onPeek(d.pid)}
      onRowDoubleClick={(d) => onOpen(d.pid)}
      active={(d) => peek === d.pid}
      sort={{ key: sort, dir, onSort: (k) => onSort(k as SortKey) }}
      selection={{
        isSelected: (d) => !!selected[d.pid],
        toggle: (d) => toggle(d),
        togglePage: (rows, all) => (all ? useSelection.getState().removeMany(rows.map((d) => d.pid)) : useSelection.getState().addMany(rows)),
      }}
      trailing={phone ? undefined : (_d, on) => <ChevronRight className={clsx("h-4 w-4 transition-all", on ? "translate-x-0.5 text-accent" : "opacity-0 group-hover:opacity-100")} />}
    />
  );
}

export function DatasetGrid({ items, peek, onPeek, onOpen, hasMore, onNext, onKeyword, onInstrument, onTechnique }: Common & { hasMore?: boolean; onNext?: () => void; onKeyword?: (k: string) => void; onInstrument?: (id: string) => void; onTechnique?: (name: string) => void }) {
  const selected = useSelection((s) => s.items);
  const toggle = useSelection((s) => s.toggle);
  return (
    <CardGrid className="p-4 sm:p-6" count={items.length} hasMore={hasMore} onNext={onNext}>
      {items.map((d) => {
        const checked = !!selected[d.pid];
        return (
          // a mouse shortcut (click peeks, double-click opens); the dataset's name inside is the keyboard way to both
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            key={d.pid}
            data-pid={d.pid}
            onClick={() => onPeek(d.pid)}
            onDoubleClick={() => onOpen(d.pid)}
            className={clsx(cardCls(checked && peek !== d.pid), "min-w-0 cursor-pointer select-none", peek === d.pid && "border-accent ring-2 ring-accent/25")}
          >
            <CardCheck checked={checked} onChange={() => toggle(d)} label={`Select ${d.datasetName}`} className="-right-2 -top-2" />
            <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl">
              <Thumb d={d} preview className="h-full w-full transition-transform duration-500 group-hover:scale-[1.05]" />
              <div className="absolute right-3 top-3 flex gap-1">
                {d.isPublished && <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">Published</span>}
                <span className="rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">{d.type === "raw" ? "Raw" : "Derived"}</span>
              </div>
              {storageOf(d) !== "online" && (
                <span className="absolute bottom-2 left-2 rounded-md bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">{storageOf(d) === "archived" ? "Archived" : "Retrieving…"}</span>
              )}
            </div>
            <div className="p-3">
              <div className="truncate text-sm font-medium" title={d.datasetName}>{d.datasetName}</div>
              <div className="mt-1.5 min-w-0 space-y-1.5"><ClipRow title="Instruments" full={<InstrumentChips ids={d.instrumentIds} size="sm" onPick={onInstrument} />}><InstrumentChips ids={d.instrumentIds} size="sm" nowrap onPick={onInstrument} /></ClipRow><ClipRow title="Techniques" full={<TechniqueChips names={techniqueNames(d)} onPick={onTechnique} />}><TechniqueChips names={techniqueNames(d)} nowrap onPick={onTechnique} /></ClipRow></div>
              {d.keywords.length > 0 && <div className="mt-2 max-h-[3.4rem] overflow-hidden"><KeywordChips words={d.keywords.slice(0, 3)} size="sm" onPick={onKeyword} /></div>}
              <div className="tnum mt-2 flex items-center justify-between text-xs text-subtle">
                <span>{fmtBytes(d.size)} · {fmtNum(d.numberOfFiles)} files</span>
                <span title={fmtDate(d.creationTime, true)}>{fmtDate(d.creationTime)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </CardGrid>
  );
}
