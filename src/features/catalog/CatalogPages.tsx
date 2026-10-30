import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import clsx from "clsx";
import { Archive, ArrowRight, BookOpen, Download, Eye, FlaskConical, Globe, ListChecks, Quote, RotateCcw, Send } from "lucide-react";
import { InstrumentThumb } from "@/components/Thumb";
import { InstrumentChips, TechniqueChips, techniquesOf } from "@/components/InstrumentChips";
import { ClipRow } from "@/components/ui/Overlay";
import { INSTRUMENTS } from "@/data/db";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ErrorState, ListToolbar, NoMatches, Page, PageHeader, Pager, ProgressBar, STICKY_PAGER, CardCheck, CardGrid, Segmented, Skeleton, Table, TechBadge, ViewOptions, cardCls, ViewSwitch, useShownColumns, type Column, type TableSelection } from "@/components/ui/Primitives";
import { useSelection, type SelItem } from "@/store/selection";
import { useUI } from "@/store/ui";
import { SearchInput } from "@/components/ui/SearchInput";
import { Explain } from "@/components/ui/Overlay";
import { api } from "@/api";
import { useListView, usePaging } from "@/hooks/hooks";
import { useResource } from "@/api/hooks";
import { matchesSearch } from "@/lib/search";
import { bus } from "@/lib/bus";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { toast } from "@/store/toasts";
import type { Job, JobStatus } from "@/types";
import { classifyStatus, humanizeStatus, isActiveJob, isFailedJob, type JobKindOfStatus } from "@/lib/jobs";

const CardSkeletons = () => <CardGrid wide count={0}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}</CardGrid>;


// Row selection over this page's items, shared by the table and the cards
function useRowSelection<T>(toItem: (row: T) => SelItem): TableSelection<T> & { checked: (row: T) => boolean } {
  const items = useSelection((s) => s.items);
  const checked = (row: T) => !!items[toItem(row).id];
  return {
    checked,
    isSelected: checked,
    toggle: (row) => useSelection.getState().toggleItem(toItem(row)),
    togglePage: (rows, all) => (all ? useSelection.getState().removeMany(rows.map((r) => toItem(r).id)) : useSelection.getState().addItems(rows.map(toItem))),
  };
}

export function SamplesPage() {
  const { data, error, reload } = useResource(["samples"], () => api.samples.list());
  const [q, setQ] = useState("");
  const list = useMemo(() => (data ?? []).filter((s) => matchesSearch(q, s.sampleName, s.formula, s.description, Object.values(s.sampleCharacteristics))), [data, q]);
  const pg = usePaging(list, q);
  const [view, setView] = useListView("samples", "cards");
  const show = useShownColumns("samples");
  const density = useUI((s) => s.density);
  const sel = useRowSelection<(typeof list)[number]>((x) => ({ kind: "sample", id: `sample:${x.sampleId}`, name: x.sampleName, sub: x.formula || x.sampleId, link: `/datasets?scope=all&q=${encodeURIComponent(x.sampleName)}` }));
  const nav = useNavigate();
  const cols: Column<(typeof list)[number]>[] = [
              { key: "name", label: "Sample", className: "max-w-[280px]", render: (s) => <><div className="truncate font-medium group-hover:text-accent" title={s.sampleName}>{s.sampleName}</div>{s.formula && <div className="sub font-mono text-xs text-muted">{s.formula}</div>}</> },
              { key: "desc", label: "Description", className: "max-w-[360px]", render: (s) => <span className="line-clamp-1 text-muted">{s.description}</span> },
              { key: "chars", label: "Characteristics", className: "max-w-[320px]", render: (s) => <span className="line-clamp-1 text-xs text-muted">{Object.entries(s.sampleCharacteristics).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span> },
              { key: "owner", label: "Group", className: "whitespace-nowrap", render: (s) => s.owner },
              { key: "n", label: "Datasets", center: true, render: (s) => <span className="tnum font-semibold">{fmtNum(s.datasetCount)}</span> },
  ];
  return (
    <Page>
      <PageHeader title="Samples" subtitle="The materials behind your measurements." />
      <ListToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search samples by name, formula or property…" />
        <ViewOptions page="samples" columns={cols} className="ml-auto" />
        <ViewSwitch value={view} onChange={setView} />
      </ListToolbar>
      {error ? <ErrorState onRetry={reload} /> : !data ? <CardSkeletons /> : list.length === 0 ? <NoMatches query={q} noun="samples" onClear={() => setQ("")} /> : (
        <>
        {view === "cards" ? (
        <CardGrid wide count={pg.items.length} hasMore={pg.hasMore} onNext={() => pg.setPage(pg.page + 1)}>
          {pg.items.map((s) => (
            <div key={s.sampleId} className={cardCls(sel.checked(s), "flex flex-col p-5")}>
              <CardCheck checked={sel.checked(s)} onChange={() => sel.toggle(s)} label={`Select ${s.sampleName}`} className="-right-2 -top-2" />
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><FlaskConical className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-snug">{s.sampleName}</h3>
                  {s.formula && <div className="mt-0.5 font-mono text-xs text-muted">{s.formula}</div>}
                </div>
              </div>
              <p className="mt-3 text-[13px] text-muted">{s.description}</p>
              <dl className="mt-3 mb-4 space-y-1 text-[13px]">
                {Object.entries(s.sampleCharacteristics).map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-subtle">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
              </dl>
              <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                <span className="tnum text-[13px] text-muted">{plural(s.datasetCount, "dataset")}</span>
                <Link to={`/datasets?scope=all&q=${encodeURIComponent(s.sampleName)}`} className="flex items-center gap-1 text-[13px] font-medium text-accent hover:underline">Browse data <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            </div>
          ))}
        </CardGrid>
        ) : (
          <Table
            rows={pg.items}
            density={density}
            rowKey={(s) => s.sampleId}
            selection={sel}
            onRow={(s) => nav(`/datasets?scope=all&q=${encodeURIComponent(s.sampleName)}`)}
            columns={show(cols)}
            phoneSummary={(s) => <ClipRow className="tnum mt-1 text-xs text-muted" title="Details">{[s.description, s.owner, plural(s.datasetCount, "dataset")].filter(Boolean).join(" · ")}</ClipRow>}
          />
        )}
        <Pager className={STICKY_PAGER} from={pg.from} to={pg.to} totalLabel={list.length} page={pg.page} totalPages={pg.totalPages} hasMore={pg.hasMore} pageSize={pg.pageSize} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
    </Page>
  );
}

const STATUS = {
  online: { tone: "success", label: "Online", dot: "bg-success", help: "Taking beamtime and producing data as scheduled." },
  maintenance: { tone: "warn", label: "Maintenance", dot: "bg-warn", help: "Temporarily down for planned maintenance or upgrades. Existing data stays available." },
  offline: { tone: "danger", label: "Offline", dot: "bg-danger", help: "Not operating at the moment and not scheduling beamtime. Existing data stays available." },
} as const;

const StatusBadge = ({ status }: { status: keyof typeof STATUS }) => {
  const st = STATUS[status];
  return (
    <Explain title={`Instrument ${st.label.toLowerCase()}`} text={st.help}>
      <span className="inline-flex cursor-help"><Badge tone={st.tone}><span className={clsx("h-1.5 w-1.5 rounded-full", st.dot)} />{st.label}</Badge></span>
    </Explain>
  );
};

// What each class of status looks like and means; the raw status code is always shown in the tooltip
const STATUS_LOOK: Record<JobKindOfStatus, { label?: string; tone: "neutral" | "accent" | "success" | "warn" | "danger"; help: string }> = {
  waiting: { label: "Waiting", tone: "neutral", help: "Recorded, and waiting for the archive or download service to pick it up." },
  running: { label: "In progress", tone: "accent", help: "Running right now. The progress bar updates as the service reports back." },
  success: { label: "Finished", tone: "success", help: "Completed successfully. Downloads stay available for 7 days; retrievals leave the data on disk." },
  partial: { label: "Finished with errors", tone: "warn", help: "Completed, but one or more datasets could not be processed. The message lists what was skipped." },
  failed: { label: "Failed", tone: "danger", help: "Stopped before completing. The message says why; most failures are safe to retry." },
  cancelled: { label: "Cancelled", tone: "neutral", help: "Stopped on request before it completed. Nothing was changed." },
  other: { tone: "neutral", help: "A status this catalogue does not group; shown exactly as the service reported it." },
};
const JobStatusBadge = ({ status }: { status: JobStatus }) => {
  const st = STATUS_LOOK[classifyStatus(status)];
  const label = st.label ?? humanizeStatus(status);
  return (
    <Explain title={label} text={<>{st.help} <span className="mt-1 block font-mono text-[11px] text-subtle">statusCode: {status}</span></>}>
      <span className="inline-flex cursor-help"><Badge tone={st.tone}>{label}</Badge></span>
    </Explain>
  );
};
const isActive = isActiveJob;
const isFailed = isFailedJob;

export function InstrumentsPage() {
  const { data, error, reload } = useResource(["instruments"], () => api.instruments.list());
  const [q, setQ] = useState("");
  const list = useMemo(() => (data ?? []).filter((i) => matchesSearch(q, i.name, i.title, i.kind, i.location, i.description, i.techniques, STATUS[i.status].label)), [data, q]);
  const [view, setView] = useListView("instruments", "cards");
  const show = useShownColumns("instruments");
  const density = useUI((s) => s.density);
  const cols: Column<(typeof list)[number]>[] = [
            { key: "name", label: "Instrument", className: "max-w-[280px]", render: (i) => <><div className="truncate font-medium group-hover:text-accent">{i.name}</div><div className="sub truncate text-xs text-muted" title={i.title}>{i.title}</div></> },
            { key: "kind", label: "Kind", className: "whitespace-nowrap", render: (i) => i.kind },
            { key: "loc", label: "Location", className: "whitespace-nowrap", render: (i) => i.location },
            { key: "tech", label: "Techniques", render: (i) => <span className="flex flex-wrap gap-1">{i.techniques.map((t) => <TechBadge key={t} name={t} />)}</span> },
            { key: "status", label: "Status", render: (i) => <StatusBadge status={i.status} /> },
            { key: "last", label: "Last run", className: "whitespace-nowrap", render: (i) => (i.lastRun ? fmtDate(i.lastRun) : "—") },
            { key: "n", label: "Datasets", center: true, render: (i) => <span className="tnum font-semibold">{fmtNum(i.datasetCount)}</span> },
  ];
  const sel = useRowSelection<(typeof list)[number]>((x) => ({ kind: "instrument", id: `instrument:${x.pid}`, name: x.name, sub: x.title, link: `/datasets?scope=all&inst=${x.pid}` }));
  const nav = useNavigate();
  const pg = usePaging(list, q);
  return (
    <Page wide>
      <PageHeader title="Instruments" subtitle="The ESS neutron instrument suite — and what each has produced." />
      <ListToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search instruments by name, technique or status…" />
        <ViewOptions page="instruments" columns={cols} className="ml-auto" />
        <ViewSwitch value={view} onChange={setView} />
      </ListToolbar>
      {error ? <ErrorState onRetry={reload} /> : !data ? <CardSkeletons /> : list.length === 0 ? <NoMatches query={q} noun="instruments" onClear={() => setQ("")} /> : (
        <>
        {view === "cards" ? (
        <CardGrid wide count={pg.items.length} hasMore={pg.hasMore} onNext={() => pg.setPage(pg.page + 1)}>
          {pg.items.map((i) => {
            const st = STATUS[i.status];
            return (
              <div key={i.pid} className={cardCls(sel.checked(i), "flex flex-col")}>
                <CardCheck checked={sel.checked(i)} onChange={() => sel.toggle(i)} label={`Select ${i.name}`} className="-right-2 -top-2" />
                <div className="relative overflow-hidden rounded-t-xl">
                  <InstrumentThumb i={i} wide whole />
                  <span className="absolute left-3 top-3"><StatusBadge status={i.status} /></span>
                  
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="text-xs text-muted">{i.kind} · {i.location}</div>
                  <h3 className="mt-0.5 text-[15px] font-semibold">{i.name} <span className="font-normal text-muted">— {i.title}</span></h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-[13px] text-muted">{i.description}</p>
                  <div className="mt-3 mb-4 flex flex-wrap gap-1.5">{i.techniques.map((t) => <TechBadge key={t} name={t} />)}</div>
                  <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-[13px]">
                    <span className="tnum text-muted">{fmtNum(i.datasetCount)} datasets{i.lastRun && <> · last run {fmtDate(i.lastRun)}</>}</span>
                    <Link to={`/datasets?scope=all&inst=${i.pid}`} className="flex shrink-0 items-center gap-1 whitespace-nowrap font-medium text-accent hover:underline">Browse <ArrowRight className="h-3.5 w-3.5" /></Link>
                  </div>
                </div>
              </div>
            );
          })}
        </CardGrid>
      ) : (
        <Table
          rows={pg.items}
            density={density}
          rowKey={(i) => i.pid}
          selection={sel}
          onRow={(i) => nav(`/datasets?scope=all&inst=${i.pid}`)}
          columns={show(cols)}
          phoneSummary={(i) => (
            <>
              <ClipRow className="mt-1" title="Status and techniques" full={<><StatusBadge status={i.status} /><TechniqueChips names={i.techniques} /></>}><span className="inline-flex items-center gap-1.5"><StatusBadge status={i.status} /><TechniqueChips names={i.techniques} nowrap /></span></ClipRow>
              <ClipRow className="tnum mt-1 text-xs text-muted" title="Details">{[i.kind, i.location, plural(i.datasetCount, "dataset")].join(" · ")}</ClipRow>
            </>
          )}
        />
        )}
        <Pager className={STICKY_PAGER} from={pg.from} to={pg.to} totalLabel={list.length} page={pg.page} totalPages={pg.totalPages} hasMore={pg.hasMore} pageSize={pg.pageSize} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
    </Page>
  );
}

export function PublishedPage() {
  const { data, error, reload } = useResource(["published"], () => api.published.list());
  const [q, setQ] = useState("");
  const list = useMemo(() => (data ?? []).filter((p) => matchesSearch(q, p.title, p.doi, p.metadata.creators.map((c) => c.name), p.abstract, p.metadata.publicationYear, p.instrumentIds.map((id) => INSTRUMENTS.find((x) => x.pid === id)?.name ?? id))), [data, q]);
  const pg = usePaging(list, q);
  const [view, setView] = useListView("published", "cards");
  const show = useShownColumns("published");
  const density = useUI((s) => s.density);
  const cols: Column<(typeof list)[number]>[] = [
              { key: "title", label: "Title", className: "max-w-[420px]", render: (p) => <><div className="line-clamp-1 font-medium group-hover:text-accent">{p.title}</div><div className="sub line-clamp-1 text-xs text-muted">{p.metadata.creators.map((c) => c.name).join(", ")}</div></> },
              { key: "instruments", label: "Instruments", className: "whitespace-nowrap", render: (p) => <InstrumentChips ids={p.instrumentIds} max={2} nowrap size="sm" /> },
              { key: "techniques", label: "Techniques", className: "whitespace-nowrap", render: (p) => <TechniqueChips names={techniquesOf(p.instrumentIds)} nowrap /> },
              { key: "year", label: "Year", render: (p) => p.metadata.publicationYear },
              { key: "doi", label: "DOI", className: "whitespace-nowrap font-mono text-xs", render: (p) => <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-accent hover:underline">{p.doi}</a> },
              { key: "n", label: "Datasets", center: true, render: (p) => <span className="tnum">{p.datasetPids.length}</span> },
              { key: "size", label: "Size", right: true, className: "whitespace-nowrap", render: (p) => <span className="tnum">{fmtBytes(p.sizeOfArchive)}</span> },
              { key: "dl", label: "Downloads", right: true, render: (p) => <span className="tnum">{fmtNum(p.downloads)}</span> },
              { key: "views", label: "Views", right: true, render: (p) => <span className="tnum">{fmtNum(p.views)}</span> },
  ];
  const sel = useRowSelection<(typeof list)[number]>((x) => ({ kind: "published", id: `doi:${x.doi}`, name: x.title, sub: x.doi, link: `/datasets?scope=public&prop=${x.doi.split(".").pop()}` }));
  const nav = useNavigate();
  return (
    <Page>
      <PageHeader title="Published data" subtitle="Openly available datasets with permanent, citable DOIs." />
      <ListToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search published data by title, author or DOI…" />
        <ViewOptions page="published" columns={cols} className="ml-auto" />
        <ViewSwitch value={view} onChange={setView} />
      </ListToolbar>
      {error ? <ErrorState onRetry={reload} /> : !data ? <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}</div> : data.length === 0 ? (
        <EmptyState icon={Globe} title="Nothing published yet" description="Publish a dataset from its detail page to give it a DOI." />
      ) : list.length === 0 ? (
        <NoMatches query={q} noun="published data" onClear={() => setQ("")} />
      ) : (
        <>
        {view === "cards" ? (
        <CardGrid wide count={pg.items.length} hasMore={pg.hasMore} onNext={() => pg.setPage(pg.page + 1)}>
          {pg.items.map((p) => {
            const citation = `${p.metadata.creators.map((c) => c.name).join(", ")} (${p.metadata.publicationYear}). ${p.title}. ${p.metadata.publisher.name}. https://doi.org/${p.doi}`;
            return (
              <article key={p.doi} className={cardCls(sel.checked(p), "flex flex-col p-6")}>
                <CardCheck checked={sel.checked(p)} onChange={() => sel.toggle(p)} label={`Select ${p.title}`} className="-right-2 -top-2" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted"><Explain title="Open access" text="Published under a permanent DOI. Anyone can find, cite and download these datasets, no account needed." icon={Globe}><span className="inline-flex cursor-help"><Badge tone="success" icon={Globe}>Open access</Badge></span></Explain><span>{p.metadata.publicationYear}</span><span>·</span><a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">{p.doi}</a></div>
                <h3 className="mt-2 line-clamp-2 min-h-[3.1rem] text-lg font-semibold leading-snug" title={p.title}>{p.title}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><InstrumentChips ids={p.instrumentIds} /><TechniqueChips names={techniquesOf(p.instrumentIds)} /></div>
                <p className="mt-2 text-[13px] text-muted">{p.metadata.creators.map((c) => c.name).join(" · ")}</p>
                <p className="mb-4 mt-3 line-clamp-2 max-w-3xl text-sm text-fg/85">{p.abstract}</p>
                <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4 text-[13px] text-muted">
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="tnum flex items-center gap-1.5"><BookOpen className="h-4 w-4" />{plural(p.datasetPids.length, "dataset")} · {fmtBytes(p.sizeOfArchive)}</span>
                    <span className="tnum flex items-center gap-1.5"><Download className="h-4 w-4" />{fmtNum(p.downloads)}</span>
                    <span className="tnum flex items-center gap-1.5"><Eye className="h-4 w-4" />{fmtNum(p.views)}</span>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => (navigator.clipboard?.writeText(citation), toast.success("Citation copied", { description: "Paste it straight into your reference list." }))}><Quote className="h-3.5 w-3.5" />Cite</Button>
                    <Link to={`/datasets?scope=public&prop=${p.doi.split(".").pop()}`}><Button size="sm" variant="primary">Browse datasets</Button></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </CardGrid>
        ) : (
          <Table
            rows={pg.items}
            density={density}
            rowKey={(p) => p.doi}
            selection={sel}
            onRow={(p) => nav(`/datasets?scope=public&prop=${p.doi.split(".").pop()}`)}
            columns={show(cols)}
            phoneSummary={(p) => (
              <>
                <ClipRow className="mt-1" title="Instruments and techniques" full={<><InstrumentChips ids={p.instrumentIds} size="sm" /><TechniqueChips names={techniquesOf(p.instrumentIds)} /></>}><span className="inline-flex items-center gap-1.5"><InstrumentChips ids={p.instrumentIds} size="sm" nowrap /><TechniqueChips names={techniquesOf(p.instrumentIds)} nowrap /></span></ClipRow>
                <ClipRow className="tnum mt-1 text-xs text-muted" title="Details">{[p.metadata.publicationYear, plural(p.datasetPids.length, "dataset"), fmtBytes(p.sizeOfArchive)].join(" · ")}</ClipRow>
              </>
            )}
          />
        )}
        <Pager className={STICKY_PAGER} from={pg.from} to={pg.to} totalLabel={list.length} page={pg.page} totalPages={pg.totalPages} hasMore={pg.hasMore} pageSize={pg.pageSize} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
    </Page>
  );
}

const KIND = { retrieve: { icon: Archive, label: "Retrieve from tape" }, download: { icon: Download, label: "Download" }, archive: { icon: Archive, label: "Archive" }, publish: { icon: Send, label: "Publish" } };

function JobRow({ j, onRetry }: { j: Job; onRetry: () => void }) {
  const K = KIND[j.type];
  const active = isActive(j);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
      <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", isFailed(j) ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent")}><K.icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex items-center gap-2 text-sm font-medium">{K.label}<span className="tnum text-xs font-normal text-subtle">{j.id}</span></div>
        <div className="truncate text-[13px] text-muted">{j.datasetNames[0]}{j.datasetNames.length > 1 && ` +${j.datasetNames.length - 1} more`} · {fmtBytes(j.bytes)}</div>
      </div>
      <div className="w-48 shrink-0">
        {active ? (
          <><ProgressBar value={j.progress} /><div className="tnum mt-1 text-xs text-muted">{j.statusMessage} · {Math.round(j.progress)}%</div></>
        ) : (
          <div className="text-[13px]">
            <JobStatusBadge status={j.statusCode} />
            <div className="mt-1 text-xs text-muted">{j.statusMessage}</div>
          </div>
        )}
      </div>
      <div className="w-28 text-right text-xs text-muted">{fmtDate(j.createdAt)}</div>
      <div className="w-20 text-right">{isFailed(j) && <Button size="sm" onClick={onRetry}><RotateCcw className="h-3.5 w-3.5" />Retry</Button>}</div>
    </li>
  );
}

export function JobsPage() {
  const { data, error, reload } = useResource(["jobs"], () => api.jobs.list());
  const [f, setF] = useState<"all" | "active" | "done" | "failed" | "cancelled">("all");
  const anyActive = data?.some(isActive);
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(reload, 1000);
    return () => clearInterval(t);
  }, [anyActive, reload]);
  useEffect(() => {
    bus.addEventListener("job-done", reload);
    return () => bus.removeEventListener("job-done", reload);
  }, [reload]);
  const [q, setQ] = useState("");
  const list = (data ?? []).filter(
    (j) =>
      (f === "all" || (f === "active" ? isActive(j) : f === "done" ? classifyStatus(j.statusCode) === "success" : f === "failed" ? isFailed(j) : classifyStatus(j.statusCode) === "cancelled")) &&
      matchesSearch(q, j.id, KIND[j.type].label, j.datasetNames, j.statusMessage, j.statusCode),
  );
  const pg = usePaging(list, `${f}|${q}`);
  const [view, setView] = useListView("jobs", "table");
  const sel = useRowSelection<(typeof list)[number]>((x) => ({ kind: "job", id: `job:${x.id}`, name: `${KIND[x.type].label} · ${x.datasetNames[0] ?? ""}`, sub: x.id, link: "/jobs" }));
  const retry = async (j: Job) => {
    await api.jobs.retry(j.id);
    toast.info("Retrying job", { description: j.id });
    reload();
  };
  return (
    <Page>
      <PageHeader title="Jobs" subtitle="Downloads, tape retrievals and publications running on your behalf." />
      <ListToolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search jobs by dataset, type or number…" />
        <Segmented
          stretch
          value={f}
          onChange={setF}
          options={[
            { value: "all", label: "All" },
            { value: "active", label: "Active", count: (data ?? []).filter(isActive).length },
            { value: "done", label: "Finished" },
            { value: "failed", label: "Failed", count: (data ?? []).filter(isFailed).length },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
        <ViewSwitch value={view} onChange={setView} />
      </ListToolbar>
      {error ? <ErrorState onRetry={reload} /> : !data ? <Skeleton className="h-72 rounded-xl" /> : list.length === 0 ? (
        q.trim() ? (
          <NoMatches query={q} noun="jobs" onClear={() => setQ("")} />
        ) : (
          <EmptyState icon={ListChecks} title={f === "all" ? "No jobs yet" : f === "active" ? "Nothing running right now" : f === "done" ? "No finished jobs" : f === "failed" ? "No failed jobs" : "No cancelled jobs"} description="Start a download or request a retrieval from any dataset — progress shows up here, and we'll notify you when it's done." />
        )
      ) : (
        <>
        {view === "table" ? (
          <ul data-band className="divide-y divide-line bg-surface">
            {pg.items.map((j) => <JobRow key={j.id} j={j} onRetry={() => retry(j)} />)}
          </ul>
        ) : (
          <CardGrid wide count={pg.items.length} hasMore={pg.hasMore} onNext={() => pg.setPage(pg.page + 1)}>
            {pg.items.map((j) => {
              const K = KIND[j.type];
              const active = isActive(j);
              return (
                <div key={j.id} className={cardCls(sel.checked(j), "flex flex-col gap-3 p-5")}>
                  <CardCheck checked={sel.checked(j)} onChange={() => sel.toggle(j)} label={`Select job ${j.id}`} className="-right-2 -top-2" />
                  <div className="flex items-center gap-3">
                    <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", isFailed(j) ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent")}><K.icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{K.label}</div>
                      <div className="tnum text-xs text-subtle">{j.id} · {fmtDate(j.createdAt)}</div>
                    </div>
                    {!active && <JobStatusBadge status={j.statusCode} />}
                  </div>
                  <div className="truncate text-[13px] text-muted">{j.datasetNames[0]}{j.datasetNames.length > 1 && ` +${j.datasetNames.length - 1} more`} · {fmtBytes(j.bytes)}</div>
                  <div className="mt-auto flex flex-col gap-3">
                    {active ? <><ProgressBar value={j.progress} /><div className="tnum text-xs text-muted">{j.statusMessage} · {Math.round(j.progress)}%</div></> : <div className="text-xs text-muted">{j.statusMessage}</div>}
                    {isFailed(j) && <Button size="sm" className="self-start" onClick={() => retry(j)}><RotateCcw className="h-3.5 w-3.5" />Retry</Button>}
                  </div>
                </div>
              );
            })}
          </CardGrid>
        )}
        <Pager className={STICKY_PAGER} from={pg.from} to={pg.to} totalLabel={list.length} page={pg.page} totalPages={pg.totalPages} hasMore={pg.hasMore} pageSize={pg.pageSize} onPage={pg.setPage} onPageSize={pg.setPageSize} />
        </>
      )}
      <p className="mt-3 text-center text-xs text-subtle">Finished downloads stay available for 7 days. Created {fmtDate(new Date().toISOString())}.</p>
    </Page>
  );
}
