import { Link, useNavigate } from "react-router";
import { ArrowRight, Calendar, Check, Database, FlaskConical, Plus, Users } from "lucide-react";
import { InstrumentChips } from "@/components/InstrumentChips";
import { PeekFact, PeekFooter, PeekState } from "@/components/PeekSheet";
import { Avatar, Badge, CopyButton, KeywordChips } from "@/components/ui/Primitives";
import { Button } from "@/components/ui/Button";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { proposalLink } from "@/lib/query";
import { proposalItem, useSelection } from "@/store/selection";
import { proposalKind } from "@/types";
import { KindBadge, ProposalStatus } from "./badges";

// A proposal or an experiment at a glance. "Open details" leads to its page.
export function ProposalPeek({ id }: { id: string }) {
  const nav = useNavigate();
  const { data, error, reload } = useResource(["proposal", id], () => api.proposals.get(id));
  const picked = useSelection((s) => !!s.items[`proposal:${id}`]);
  if (!data) return <PeekState error={error} onRetry={reload} />;
  const { proposal: p, parent, experiments, instruments, samples, datasetCount, size } = data;
  const experiment = proposalKind(p) === "experiment";
  return (
    <>
      <div className="space-y-4 p-4 animate-fade-in">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge p={p} />
            <ProposalStatus p={p} />
            {p.isPublished && <Badge tone="success">Published</Badge>}
          </div>
          <h2 className="mt-1.5 text-base font-semibold leading-snug [overflow-wrap:anywhere]">{p.title}</h2>
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <span className="tnum truncate font-mono" title={p.proposalId}>{p.proposalId}</span>
            <CopyButton text={p.proposalId} label="Copy number" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <InstrumentChips ids={p.instrumentIds} size="sm" max={3} />
        </div>
        {p.keywords.length > 0 && <KeywordChips words={p.keywords} size="sm" max={4} />}
        <p className="line-clamp-4 whitespace-pre-line text-sm text-muted">{p.abstract.replace(/^Experiment [^\n]*\n/, "")}</p>
        <ul className="space-y-1.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
          {parent && <PeekFact icon={Database} label="Belongs to proposal"><Link to={proposalLink(parent.proposalId)} className="text-accent hover:underline" title={parent.title}>{parent.proposalId}</Link></PeekFact>}
          <PeekFact icon={Users} label="Principal investigator"><span className="inline-flex items-center gap-1.5 align-middle"><Avatar name={p.pi} size={16} />{p.pi}</span></PeekFact>
          <PeekFact icon={Calendar} label="Period">{fmtDate(p.startTime)} – {fmtDate(p.endTime)}</PeekFact>
          <PeekFact icon={Database} label="Datasets"><span className="tnum">{plural(datasetCount, "dataset")} · {fmtBytes(size)}</span></PeekFact>
          <PeekFact icon={FlaskConical} label="Samples">{samples.length ? samples.map((s) => s.sampleName).join(", ") : "No sample"}</PeekFact>
        </ul>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[["Beam time", p.MeasurementPeriodList.length], ["Team", p.team.length], experiment ? ["Instruments", instruments.length] : ["Experiments", experiments.length]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-2 px-2 py-2"><div className="tnum text-base font-semibold">{fmtNum(Number(v))}</div><div className="text-[11px] text-subtle">{k}</div></div>
          ))}
        </div>
      </div>
      <PeekFooter>
        <Button variant="primary" className="flex-1" onClick={() => nav(proposalLink(id))}>Open details <ArrowRight className="h-4 w-4" /></Button>
        <Button onClick={() => useSelection.getState().toggleItem(proposalItem(p))} className={picked ? "border-accent bg-accent-soft text-accent" : ""}>
          {picked ? <><Check className="h-4 w-4" />Selected</> : <><Plus className="h-4 w-4" />Select</>}
        </Button>
      </PeekFooter>
    </>
  );
}
