import { datasetLink, proposalLink } from "@/lib/query";
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";
import { Database, FlaskConical, Maximize2, Microscope } from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { ErrorState, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { fmtDate } from "@/lib/format";
import { Dataset } from "@/types";
import { Card } from "./Card";

// the graph library is big and only the Related tab needs it
const LineageGraph = lazy(() => import("./LineageGraph"));

function MiniCard({ d }: { d: Dataset }) {
  return (
    <Link to={datasetLink(d.pid)} className="group flex items-center gap-3 rounded-xl border border-line p-2.5 transition-colors hover:border-accent hover:bg-accent-soft/40">
      <Thumb d={d} preview className="h-11 w-16 shrink-0 rounded-md" />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-medium group-hover:text-accent">{d.datasetName}</div>
        <div className="truncate text-xs text-muted">{d.instrumentName} · {fmtDate(d.creationTime)}</div>
      </div>
    </Link>
  );
}

// a titled list of related datasets, loading until the list arrives
function RelatedSection({ title, items, empty }: { title: string; items?: Dataset[]; empty: string }) {
  return (
  <Card title={title}>
    {!items ? <Skeleton className="h-14 w-full" /> : items.length ? <div className="grid gap-2.5 sm:grid-cols-2">{items.map((x) => <MiniCard key={x.pid} d={x} />)}</div> : <p className="text-sm text-subtle">{empty}</p>}
  </Card>
  );
}

export function RelatedTab({ d }: { d: Dataset }) {
  const { data, error, reload } = useResource(["dataset-related", d.pid], () => api.datasets.related(d.pid));
  const [big, setBig] = useState(false);
  if (error) return <ErrorState onRetry={reload} />;
  return (
    <div className="space-y-5">
      <Card title="Lineage" action={<Button size="sm" variant="ghost" onClick={() => setBig(true)}><Maximize2 className="h-3.5 w-3.5" />Expand</Button>}>
        <p className="mb-3 text-[13px] text-muted">What this dataset was made from and what was made from it; each arrow names the software that produced the next dataset. Click a dataset to open it.</p>
        <Suspense fallback={<Skeleton className="h-[380px] w-full rounded-xl sm:h-[460px]" />}><LineageGraph d={d} className="h-[380px] sm:h-[460px]" /></Suspense>
      </Card>
      <Modal open={big} onOpenChange={setBig} title="Lineage" description={d.datasetName} size="2xl">
        {big && <Suspense fallback={<Skeleton className="h-[70vh] w-full rounded-xl" />}><LineageGraph d={d} className="h-[70vh]" expanded /></Suspense>}
      </Modal>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Database, label: "Proposal", title: d.proposalTitle, sub: d.proposalId, to: proposalLink(d.proposalId) },
          { icon: FlaskConical, label: "Sample", title: d.sampleName, sub: "View all samples", to: "/samples" },
          { icon: Microscope, label: "Instrument", title: d.instrumentName, sub: "View instruments", to: "/instruments" },
        ].map((x) => (
          <Link key={x.label} to={x.to} className="card group flex items-center gap-3 p-4 transition-colors hover:border-accent">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><x.icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="text-xs text-muted">{x.label}</div>
              <div className="truncate text-sm font-medium group-hover:text-accent">{x.title}</div>
              <div className="truncate text-xs text-subtle">{x.sub}</div>
            </div>
          </Link>
        ))}
      </div>
      <RelatedSection title="Derived from" items={data?.sources} empty="This is original (raw) data — it wasn't derived from another dataset." />
      <RelatedSection title="Derived datasets" items={data?.derived} empty="No datasets have been derived from this one yet." />
    </div>
  );
}
