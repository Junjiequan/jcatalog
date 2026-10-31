import { Link, useNavigate } from "react-router";
import { ArrowRight, Check, Clock, Database, Download, FileText, Plus, Scale, Users } from "lucide-react";
import { InstrumentChips, TechniqueChips, techniquesOf } from "@/components/InstrumentChips";
import { PeekFact, PeekFooter, PeekState } from "@/components/PeekSheet";
import { Badge, CopyButton } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { Thumb } from "@/components/Thumb";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { datasetLink } from "@/lib/query";
import { publishedItem, useSelection } from "@/store/selection";

// A publication at a glance: what it is, who made it, what it holds. "Open details" leads to its page.
export function PublishedPeek({ id }: { id: string }) {
  const nav = useNavigate();
  const { data, error, reload } = useResource(["published", id], () => api.published.get(id));
  const picked = useSelection((s) => !!s.items[`doi:${data?.published.doi}`]);
  if (!data) return <PeekState error={error} onRetry={reload} />;
  const { published: p, datasets } = data;
  return (
    <>
      <div className="space-y-4 p-4 animate-fade-in">
        <div className="flex gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5"><Badge>Publication</Badge><Badge tone="success">Published</Badge></div>
            <h2 className="mt-1.5 text-base font-semibold leading-snug [overflow-wrap:anywhere]">{p.title}</h2>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <span className="min-w-0 truncate font-mono" title={p.doi}>{p.doi}</span>
              <CopyButton text={p.doi} label="Copy DOI" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <InstrumentChips ids={p.instrumentIds} size="sm" max={3} />
          <TechniqueChips names={techniquesOf(p.instrumentIds)} max={3} />
        </div>
        <p className="line-clamp-4 text-sm text-muted">{p.abstract}</p>
        <ul className="space-y-1.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
          <PeekFact icon={Users} label="Authors"><span title={p.metadata.creators.map((c) => c.name).join(", ")}>{p.metadata.creators.map((c) => c.name).join(", ")}</span></PeekFact>
          <PeekFact icon={Clock} label="Published">{fmtDate(p.registeredTime)}</PeekFact>
          <PeekFact icon={Database} label="Datasets"><span className="tnum">{plural(p.datasetPids.length, "dataset")} · {fmtBytes(p.sizeOfArchive)}</span></PeekFact>
          <PeekFact icon={Scale} label="License">{p.metadata.license}</PeekFact>
          <PeekFact icon={Download} label="Downloads and views"><span className="tnum">{fmtNum(p.downloads)} downloads · {fmtNum(p.views)} views</span></PeekFact>
        </ul>
        {datasets.length > 0 && (
          <div>
            <div className="section-title mb-2">Datasets</div>
            <ul className="space-y-1.5">
              {datasets.slice(0, 3).map((d) => (
                <li key={d.pid}>
                  <Link to={datasetLink(d.pid)} className="group flex items-center gap-2.5 rounded-lg border border-line p-2 transition-colors hover:border-accent">
                    <Thumb d={d} className="h-9 w-14 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium group-hover:text-accent" title={d.datasetName}>{d.datasetName}</span><span className="block truncate text-xs text-muted">{fmtDate(d.creationTime)} · {d.instrumentName}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
            {datasets.length > 3 && <p className="mt-2 text-xs text-muted">+{datasets.length - 3} more in the publication</p>}
          </div>
        )}
      </div>
      <PeekFooter>
        <Button variant="primary" className="flex-1" onClick={() => nav(`/published/${encodeURIComponent(p.pid)}`)}>Open details <ArrowRight className="h-4 w-4" /></Button>
        <Button onClick={() => useSelection.getState().toggleItem(publishedItem(p))} className={picked ? "border-accent bg-accent-soft text-accent" : ""}>
          {picked ? <><Check className="h-4 w-4" />Selected</> : <><Plus className="h-4 w-4" />Select</>}
        </Button>
      </PeekFooter>
    </>
  );
}
