import { proposalLink } from "@/lib/query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Archive, ArrowRight, Check, ChevronDown, ChevronUp, Clock, FileText, FlaskConical, HardDrive, Plus, X } from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { PeekFact } from "@/components/PeekSheet";
import { KeywordChips } from "@/components/ui/Primitives";
import { InstrumentChips, TechniqueChips } from "@/components/InstrumentChips";
import { Button } from "@/components/ui/Button";
import { Tip } from "@/components/ui/Overlay";
import { CopyButton, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { fmtBytes, fmtDate, fmtNum, humanizeKey } from "@/lib/format";
import { datasetLink } from "@/lib/query";
import { useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";
import {Dataset, storageOf, techniqueNames} from "@/types";
import { PublishedBadge, StorageBadge, TypeBadge } from "./shared";

const PRIORITY = ["photon_energy", "wavelength", "sample_temperature", "temperature", "exposure_time", "detector_distance", "accelerating_voltage", "total_dose", "proton_frequency", "resolution_limit", "pixel_size", "energy_resolution"];

export function highlights(d: Dataset, n = 6) {
  const entries = Object.entries(d.scientificMetadata).filter(([, m]) => typeof m.value === "number" || m.unit);
  const rank = (k: string) => (PRIORITY.indexOf(k) === -1 ? 99 : PRIORITY.indexOf(k));
  return entries.sort((a, b) => rank(a[0]) - rank(b[0])).slice(0, n);
}

export const fmtMeta = (v: string | number | boolean) => (typeof v === "number" ? (Math.abs(v) >= 1000 ? fmtNum(v) : String(v)) : String(v));

export function RetrievalBanner({ d, onRequested }: { d: Dataset; onRequested?: () => void }) {
  const [busy, setBusy] = useState(false);
  if (storageOf(d) === "online") return null;
  const retrieving = storageOf(d) === "retrieving";
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/10 p-3 text-sm">
      <Archive className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
      <div className="flex-1">
        <div className="font-medium">{retrieving ? "Retrieving from tape…" : "Stored on tape"}</div>
        <p className="mt-0.5 text-[13px] text-muted">{retrieving ? "This usually takes a few minutes. We'll notify you when it's ready." : `Request retrieval to download it. Typically ready in a few minutes (${fmtBytes(d.size)}).`}</p>
        {!retrieving && (
          <Button
            size="sm"
            className="mt-2"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.datasets.requestRetrieval(d.pid);
                toast.info("Retrieval requested", { description: "We'll notify you as soon as the data is back online." });
                onRequested?.();
              } catch {
                toast.error("Couldn't request retrieval", { description: "The archive service didn't respond. Try again in a moment." });
              } finally {
                setBusy(false);
              }
            }}
          >
            Request retrieval
          </Button>
        )}
      </div>
    </div>
  );
}

export function PeekContent({ pid, onClose, onPrev, onNext, embedded, onKeyword, onInstrument, onTechnique }: { pid: string; onClose: () => void; onPrev?: () => void; onNext?: () => void; embedded?: boolean; onKeyword?: (k: string) => void; onInstrument?: (id: string) => void; onTechnique?: (name: string) => void }) {
  const nav = useNavigate();
  const { data: d, error, reload } = useResource(["dataset", pid], () => api.datasets.get(pid));
  const selected = useSelection((s) => !!s.items[pid]);
  const toggle = useSelection((s) => s.toggle);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!embedded && (
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <span className="section-title">Preview</span>
          <div className="flex items-center gap-0.5">
            <Tip label="Previous" kbd="K"><Button size="icon-sm" variant="ghost" onClick={onPrev} aria-label="Previous"><ChevronUp className="h-4 w-4" /></Button></Tip>
            <Tip label="Next" kbd="J"><Button size="icon-sm" variant="ghost" onClick={onNext} aria-label="Next"><ChevronDown className="h-4 w-4" /></Button></Tip>
            <Tip label="Close" kbd="Esc"><Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close preview"><X className="h-4 w-4" /></Button></Tip>
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error ? (
          <ErrorState title="Can't show this dataset" message={error.message} onRetry={reload} />
        ) : !d ? (
          <div className="space-y-4 p-4">
            <Skeleton className="aspect-[16/10] w-28" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4 p-4 animate-fade-in">
            {/* identity: a small picture beside the badges, name and PID — nothing here is repeated further down */}
            <div className="flex gap-3">
              <Thumb d={d} preview className="aspect-[16/10] w-28 shrink-0 self-start rounded-lg" />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  <TypeBadge type={d.type} />
                  <StorageBadge storage={storageOf(d)} />
                  {d.isPublished && <PublishedBadge />}
                </div>
                <h2 className="mt-1.5 text-base font-semibold leading-snug [overflow-wrap:anywhere]">{d.datasetName}</h2>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <span className="tnum">{d.pid}</span>
                  <CopyButton text={d.pid} label="Copy PID" />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5"><InstrumentChips ids={d.instrumentIds} size="sm" onPick={onInstrument} /><TechniqueChips names={techniqueNames(d)} onPick={onTechnique} /></div>
            {d.keywords.length > 0 && <KeywordChips words={d.keywords} size="sm" onPick={onKeyword} />}
            <RetrievalBanner d={d} onRequested={reload} />
            <p className="line-clamp-3 text-sm text-muted">{d.description}</p>
            {/* one line per fact, an icon instead of a label column; the run number is left out when the name already carries it */}
            <ul className="space-y-1.5 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
              <PeekFact icon={FileText} label="Proposal"><Link to={proposalLink(d.proposalId)} className="text-accent hover:underline" title={d.proposalTitle}>{d.proposalId}</Link></PeekFact>
              <PeekFact icon={FlaskConical} label="Sample"><span title={d.sampleName}>{d.sampleName}</span></PeekFact>
              <PeekFact icon={Clock} label="Created by">{fmtDate(d.creationTime, true)}<span className="text-muted"> · {d.owner}</span></PeekFact>
              <PeekFact icon={HardDrive} label="Size"><span className="tnum">{fmtBytes(d.size)} · {fmtNum(d.numberOfFiles)} files</span></PeekFact>
            </ul>
            <div>
              <div className="section-title mb-2">Key measurements</div>
              <div className="grid grid-cols-2 gap-2">
                {highlights(d).map(([k, m]) => (
                  <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
                    <div className="truncate text-[11px] text-subtle">{humanizeKey(k)}</div>
                    <div className="tnum text-sm font-semibold">{fmtMeta(m.value)} <span className="text-xs font-normal text-muted">{m.unit}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2 border-t border-line p-3">
        <Button variant="primary" className="flex-1" disabled={!d} onClick={() => nav(datasetLink(pid))}>
          Open details <ArrowRight className="h-4 w-4" />
        </Button>
        <Button disabled={!d} onClick={() => d && toggle(d)} className={selected ? "border-selection bg-selection-soft text-selection" : ""}>
          {selected ? <><Check className="h-4 w-4" />Selected</> : <><Plus className="h-4 w-4" />Select</>}
        </Button>
      </div>
    </div>
  );
}
