import { Link, useNavigate } from "react-router";
import { ArrowRight, Check, Clock, Database, FileText, FlaskConical, HardDrive, Plus } from "lucide-react";
import { InstrumentChips } from "@/components/InstrumentChips";
import { PeekFact, PeekFooter, PeekState } from "@/components/PeekSheet";
import { Badge, CopyButton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Thumb } from "@/components/Thumb";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { datasetLink, proposalLink } from "@/lib/query";
import { sampleItem } from "@/store/selection";
import { useSelection } from "@/store/selection";

// A sample at a glance: what it is, how much data it has, where it is used. "Open details" leads to its page.
export function SamplePeek({ id }: { id: string }) {
  const nav = useNavigate();
  const { data, error, reload } = useResource(["sample", id], () => api.samples.get(id));
  const picked = useSelection((s) => !!s.items[`sample:${id}`]);
  if (!data) return <PeekState error={error} onRetry={reload} />;
  const { sample: s, datasetCount, size, proposals, instruments, recent } = data;
  return (
    <>
      <div className="space-y-4 p-4 animate-fade-in">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FlaskConical className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              <Badge>Sample</Badge>
              {s.isPublished && <Badge tone="success">Published</Badge>}
            </div>
            <h2 className="mt-1.5 text-base font-semibold leading-snug [overflow-wrap:anywhere]">{s.sampleName}</h2>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              {s.formula && <span className="truncate font-mono" title={s.formula}>{s.formula}</span>}
              <CopyButton text={s.sampleId} label="Copy sample id" />
            </div>
          </div>
        </div>
        {instruments.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <InstrumentChips ids={instruments.map((i) => i.pid)} size="sm" max={3} />
          </div>
        )}
        <p className="line-clamp-4 text-sm text-muted">{s.description}</p>
        <ul className="space-y-1.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
          <PeekFact icon={Database} label="Datasets"><span className="tnum">{plural(datasetCount, "dataset")}</span></PeekFact>
          <PeekFact icon={HardDrive} label="Size"><span className="tnum">{fmtBytes(size)}</span></PeekFact>
          <PeekFact icon={FileText} label="Proposals">
            {proposals.length === 0 ? "In no proposal" : <>{proposals.slice(0, 2).map((p, i) => <span key={p.proposalId}>{i > 0 && ", "}<Link to={proposalLink(p.proposalId)} className="text-accent hover:underline" title={p.title}>{p.proposalId}</Link></span>)}{proposals.length > 2 && <span className="text-muted"> +{proposals.length - 2}</span>}</>}
          </PeekFact>
          <PeekFact icon={Clock} label="Created">{fmtDate(s.createdAt)}<span className="text-muted"> · {s.owner}</span></PeekFact>
        </ul>
        {Object.keys(s.sampleCharacteristics).length > 0 && (
          <div>
            <div className="section-title mb-2">Characteristics</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(s.sampleCharacteristics).slice(0, 6).map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-lg bg-surface-2 px-3 py-2">
                  <div className="truncate text-[11px] text-subtle" title={k}>{k}</div>
                  <div className="truncate text-sm font-semibold" title={v}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {recent.length > 0 && (
          <div>
            <div className="section-title mb-2">Latest datasets</div>
            <ul className="space-y-1.5">
              {recent.slice(0, 3).map((d) => (
                <li key={d.pid}>
                  <Link to={datasetLink(d.pid)} className="group flex items-center gap-2.5 rounded-lg border border-line p-2 transition-colors hover:border-accent">
                    <Thumb d={d} className="h-9 w-14 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium group-hover:text-accent" title={d.datasetName}>{d.datasetName}</span><span className="block truncate text-xs text-muted">{fmtDate(d.creationTime)} · {d.instrumentName}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
            {datasetCount > 3 && <Link to={`/datasets?scope=all&q=${encodeURIComponent(s.sampleName)}`} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">Browse all {fmtNum(datasetCount)} <ArrowRight className="h-3.5 w-3.5" /></Link>}
          </div>
        )}
      </div>
      <PeekFooter>
        <Button variant="primary" className="flex-1" onClick={() => nav(`/samples/${encodeURIComponent(id)}`)}>Open details <ArrowRight className="h-4 w-4" /></Button>
        <Button onClick={() => useSelection.getState().toggleItem(sampleItem(s))} className={picked ? "border-accent bg-accent-soft text-accent" : ""}>
          {picked ? <><Check className="h-4 w-4" />Selected</> : <><Plus className="h-4 w-4" />Select</>}
        </Button>
      </PeekFooter>
    </>
  );
}
