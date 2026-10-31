import { useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Check, Clock, Database, FileCode, FlaskConical, HardDrive, Link2, MoreHorizontal, Plus, Users } from "lucide-react";
import { InstrumentChips } from "@/components/InstrumentChips";
import { Thumb } from "@/components/Thumb";
import { TagScopeProvider } from "@/components/tagScope";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem } from "@/components/ui/Overlay";
import { Badge, Breadcrumb, CopyButton, EmptyState, ErrorState, Fact, Skeleton, TabBar } from "@/components/ui/Primitives";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { useRecordRecent } from "@/hooks/hooks";
import { downloadBlob, fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { datasetLink, proposalLink } from "@/lib/query";
import { sampleItem, useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";
import { KindBadge, ProposalStatus } from "../proposals/badges";

type Tab = "overview" | "proposals" | "instruments" | "datasets";

// A sample's page, laid out like a dataset's and a proposal's: breadcrumb, a card with what it is, tabs, then the tab
export default function SampleDetailPage() {
  // a tag clicked here finds more samples, not datasets
  return <TagScopeProvider value="samples"><SampleDetail /></TagScopeProvider>;
}

function SampleDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const { data, error, reload } = useResource(["sample", id], () => api.samples.get(id));
  const picked = useSelection((s) => !!s.items[`sample:${id}`]);
  useRecordRecent(data && { kind: "sample", pid: data.sample.sampleId, name: data.sample.sampleName });
  const [showAllRecent, setShowAllRecent] = useState(false);

  const back = () => (loc.key !== "default" ? nav(-1) : nav("/samples"));
  if (error) return <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8"><ErrorState title="Not found" message={error.message} onRetry={reload} /></div>;
  if (!data) return <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8"><Skeleton className="mb-4 h-8 w-64" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  const { sample: s, datasetCount, size, proposals, instruments, recent } = data;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "proposals", label: "Proposals", count: proposals.length },
    { id: "instruments", label: "Instruments", count: instruments.length },
    { id: "datasets", label: "Datasets", count: datasetCount },
  ];
  const tab = (tabs.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "overview") as Tab;
  const setTab = (t: Tab) => setSp(t === "overview" ? {} : { tab: t }, { replace: true });
  const browse = `/datasets?scope=all&q=${encodeURIComponent(s.sampleName)}`;
  const groups = Object.entries(s.groups ?? {});

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 animate-fade-in sm:px-8">
      <Breadcrumb back={back} trail={[{ label: "Samples", to: "/samples" }]} current={s.sampleName} />

      <div className="card overflow-hidden">
        <div className="flex flex-col p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge icon={FlaskConical} tone="accent">Sample</Badge>
            {s.type && <Badge>{s.type}</Badge>}
            {s.isPublished && <Badge tone="success">Published</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{s.sampleName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
            {s.formula && <span className="font-mono">{s.formula}</span>}
            <span className="flex items-center gap-1"><span className="tnum">{s.sampleId}</span><CopyButton text={s.sampleId} label="Copy sample id" /></span>
          </div>
          {instruments.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><InstrumentChips ids={instruments.map((i) => i.pid)} /></div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{s.owner}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Added {fmtDate(s.createdAt)}</span>
            <span className="tnum flex items-center gap-1.5"><Database className="h-4 w-4" />{plural(datasetCount, "dataset")} · {fmtBytes(size)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-5">
            <Link to={browse}><Button variant="primary"><Database className="h-4 w-4" />Browse datasets</Button></Link>
            <Button onClick={() => useSelection.getState().toggleItem(sampleItem(s))} className={picked ? "border-accent bg-accent-soft text-accent" : ""}>
              {picked ? <><Check className="h-4 w-4" />In selection</> : <><Plus className="h-4 w-4" />Add to selection</>}
            </Button>
            <Menu tip="More actions" trigger={<Button size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>}>
              <MenuItem icon={Link2} onSelect={() => (navigator.clipboard?.writeText(location.href), toast.success("Link copied"))}>Copy link</MenuItem>
              <MenuItem icon={FileCode} onSelect={() => downloadBlob(`${s.sampleId}.json`, JSON.stringify(s, null, 2))}>Export record (JSON)</MenuItem>
            </Menu>
          </div>
        </div>
      </div>

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      <div className="mt-5" key={tab}>
        {tab === "overview" && (
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="card p-5">
                <h3 className="mb-2 text-sm font-semibold">Description</h3>
                <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg/85">{s.description || "No description."}</p>
              </div>
              {Object.keys(s.sampleCharacteristics).length > 0 && (
                <div className="card p-5">
                  <h3 className="mb-1 text-sm font-semibold">Characteristics</h3>
                  <dl>{Object.entries(s.sampleCharacteristics).map(([k, v]) => <Fact key={k} label={k}>{v}</Fact>)}</dl>
                </div>
              )}
              {groups.map(([name, kv]) => (
                <div key={name} className="card p-5">
                  <h3 className="mb-1 text-sm font-semibold">{name}</h3>
                  <dl>{Object.entries(kv).map(([k, v]) => <Fact key={k} label={k}>{v}</Fact>)}</dl>
                </div>
              ))}
            </div>
            <div className="space-y-5">
              <div className="card p-5">
                <h3 className="mb-1 text-sm font-semibold">Details</h3>
                <dl>
                  <Fact label="Sample id"><span className="tnum">{s.sampleId}</span></Fact>
                  <Fact label="Type">{s.type}</Fact>
                  <Fact label="Owner">{s.owner}</Fact>
                  <Fact label="Owner group"><span className="tnum">{s.ownerGroup}</span></Fact>
                  <Fact label="Datasets"><span className="tnum">{fmtNum(datasetCount)}</span></Fact>
                  <Fact label="Total size"><span className="tnum">{fmtBytes(size)}</span></Fact>
                  <Fact label="Published">{s.isPublished ? "Yes" : "No"}</Fact>
                  <Fact label="Created">{`${fmtDate(s.createdAt)} by ${s.createdBy}`}</Fact>
                  <Fact label="Updated">{`${fmtDate(s.updatedAt)} by ${s.updatedBy}`}</Fact>
                </dl>
              </div>
              <div className="card p-5">
                <h3 className="mb-2 text-sm font-semibold">Who can see it</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[s.ownerGroup, ...s.accessGroups.filter((g) => g !== s.ownerGroup)].map((g) => <span key={g} className="tnum inline-flex h-7 max-w-full items-center truncate rounded-md border border-line bg-surface-2 px-2 text-xs" title={g}>{g}</span>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "proposals" && (
          proposals.length === 0 ? (
            <div className="card p-6"><EmptyState icon={FlaskConical} title="In no proposal yet" description="Proposals that use this sample are listed here." /></div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {proposals.map((p) => (
                <Link key={p.proposalId} to={proposalLink(p.proposalId)} className="card group block p-4 transition-colors hover:border-accent">
                  <div className="flex flex-wrap items-center gap-1.5"><KindBadge p={p} /><ProposalStatus p={p} /></div>
                  <div className="mt-1.5 line-clamp-2 text-sm font-medium group-hover:text-accent" title={p.title}>{p.title}</div>
                  <div className="tnum mt-0.5 truncate font-mono text-xs text-muted" title={p.proposalId}>{p.proposalId}</div>
                  <div className="mt-2 text-xs text-muted">{p.pi} · {fmtDate(p.startTime)} – {fmtDate(p.endTime)}</div>
                </Link>
              ))}
            </div>
          )
        )}

        {tab === "instruments" && (
          instruments.length === 0 ? (
            <div className="card p-6"><EmptyState icon={FlaskConical} title="Not measured yet" description="The instruments it has been measured on appear here." /></div>
          ) : (
            <div className="card space-y-4 p-5">
              <div><h3 className="mb-2 text-sm font-semibold">Instruments</h3><InstrumentChips ids={instruments.map((i) => i.pid)} /></div>
              <p className="text-[13px] text-muted">Click one to find other samples measured the same way.</p>
            </div>
          )
        )}

        {tab === "datasets" && (
          datasetCount === 0 ? (
            <div className="card p-6"><EmptyState icon={Database} title="No datasets yet" description="Datasets measured on this sample are listed here." /></div>
          ) : (
            <div className="card p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Latest datasets</h3>
                <Link to={browse} className="text-[13px] font-medium text-accent hover:underline">Browse all {fmtNum(datasetCount)}</Link>
              </div>
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {(showAllRecent ? recent : recent.slice(0, 4)).map((d) => (
                  <li key={d.pid}>
                    <Link to={datasetLink(d.pid)} className="group flex items-center gap-3 rounded-xl border border-line p-2.5 transition-colors hover:border-accent hover:bg-accent-soft/40">
                      <Thumb d={d} className="h-11 w-16 shrink-0 rounded-md" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium group-hover:text-accent" title={d.datasetName}>{d.datasetName}</div>
                        <div className="truncate text-xs text-muted">{d.instrumentName} · {fmtDate(d.creationTime)}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              {recent.length > 4 && !showAllRecent && <Button size="sm" variant="ghost" className="mt-3" onClick={() => setShowAllRecent(true)}>Show {recent.length - 4} more</Button>}
              <p className="mt-3 text-[11px] text-subtle"><HardDrive className="mr-1 inline h-3 w-3" />{fmtBytes(size)} in total</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
