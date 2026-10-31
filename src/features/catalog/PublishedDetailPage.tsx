import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Check, Clock, Database, Download, ExternalLink, Eye, FileCode, Globe, Link2, MoreHorizontal, Plus, Quote, Users } from "lucide-react";
import { InstrumentChips, TechniqueChips, techniquesOf } from "@/components/InstrumentChips";
import { Thumb } from "@/components/Thumb";
import { TagScopeProvider } from "@/components/tagScope";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem } from "@/components/ui/Overlay";
import { Badge, Breadcrumb, CopyButton, ErrorState, Fact, Skeleton, TabBar } from "@/components/ui/Primitives";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { downloadBlob, fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { datasetLink } from "@/lib/query";
import { publishedItem, useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";

type Tab = "overview" | "datasets";

// A publication's page, laid out like a sample's and a proposal's: breadcrumb, a card with what it is, tabs, then the tab
export default function PublishedDetailPage() {
  // a tag clicked here finds more publications
  return <TagScopeProvider value="published"><PublishedDetail /></TagScopeProvider>;
}

function PublishedDetail() {
  const { id = "" } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const { data, error, reload } = useResource(["published", id], () => api.published.get(id));
  const picked = useSelection((s) => !!s.items[`doi:${data?.published.doi}`]);

  const back = () => (loc.key !== "default" ? nav(-1) : nav("/published"));
  if (error) return <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8"><ErrorState title="Not found" message={error.message} onRetry={reload} /></div>;
  if (!data) return <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-8"><Skeleton className="mb-4 h-8 w-64" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  const { published: p, datasets } = data;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "datasets", label: "Datasets", count: p.datasetPids.length },
  ];
  const tab = (tabs.some((t) => t.id === sp.get("tab")) ? sp.get("tab") : "overview") as Tab;
  const setTab = (t: Tab) => setSp(t === "overview" ? {} : { tab: t }, { replace: true });
  const authors = p.metadata.creators.map((c) => c.name).join(", ");
  const citation = `${authors} (${p.metadata.publicationYear}). ${p.title}. ${p.metadata.publisher.name}. https://doi.org/${p.doi}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 animate-fade-in sm:px-8">
      <Breadcrumb back={back} trail={[{ label: "Published data", to: "/published" }]} current={p.title} />

      <div className="card overflow-hidden">
        <div className="flex flex-col p-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge icon={Globe} tone="accent">Publication</Badge>
            <Badge tone="success">Published</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{p.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
            <span className="flex items-center gap-1">
              <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer" className="font-mono text-accent hover:underline">{p.doi}</a>
              <CopyButton text={p.doi} label="Copy DOI" />
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><InstrumentChips ids={p.instrumentIds} /><TechniqueChips names={techniquesOf(p.instrumentIds)} /></div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /><span className="max-w-[40ch] truncate" title={authors}>{authors}</span></span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Published {fmtDate(p.registeredTime)}</span>
            <span className="tnum flex items-center gap-1.5"><Database className="h-4 w-4" />{plural(p.datasetPids.length, "dataset")} · {fmtBytes(p.sizeOfArchive)}</span>
            <span className="tnum flex items-center gap-1.5"><Download className="h-4 w-4" />{fmtNum(p.downloads)}</span>
            <span className="tnum flex items-center gap-1.5"><Eye className="h-4 w-4" />{fmtNum(p.views)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-5">
            <Button variant="primary" onClick={() => setTab("datasets")}><Database className="h-4 w-4" />Browse datasets</Button>
            <Button onClick={() => (navigator.clipboard?.writeText(citation), toast.success("Citation copied", { description: "Paste it straight into your reference list." }))}><Quote className="h-4 w-4" />Cite</Button>
            <Button onClick={() => useSelection.getState().toggleItem(publishedItem(p))} className={picked ? "border-accent bg-accent-soft text-accent" : ""}>
              {picked ? <><Check className="h-4 w-4" />In selection</> : <><Plus className="h-4 w-4" />Add to selection</>}
            </Button>
            <Menu tip="More actions" trigger={<Button size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>}>
              <MenuItem icon={Link2} onSelect={() => (navigator.clipboard?.writeText(location.href), toast.success("Link copied"))}>Copy link</MenuItem>
              <MenuItem icon={ExternalLink} onSelect={() => window.open(`https://doi.org/${p.doi}`, "_blank", "noreferrer")}>Open the DOI</MenuItem>
              <MenuItem icon={FileCode} onSelect={() => downloadBlob(`${p.pid.replace(/\W+/g, "_")}.json`, JSON.stringify(p, null, 2))}>Export record (JSON)</MenuItem>
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
                <h3 className="mb-2 text-sm font-semibold">Abstract</h3>
                <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-fg/85">{p.abstract || "No abstract."}</p>
              </div>
              <div className="card p-5">
                <h3 className="mb-2 text-sm font-semibold">Cite as</h3>
                <p className="text-sm leading-relaxed text-fg/85 [overflow-wrap:anywhere]">{citation}</p>
              </div>
              <div className="card p-5">
                <h3 className="mb-1 text-sm font-semibold">Authors</h3>
                <dl>{p.metadata.creators.map((c) => <Fact key={c.name} label={c.name}>{c.affiliation}</Fact>)}</dl>
              </div>
            </div>
            <div className="space-y-5">
              <div className="card p-5">
                <h3 className="mb-1 text-sm font-semibold">Details</h3>
                <dl>
                  <Fact label="DOI"><span className="font-mono text-xs [overflow-wrap:anywhere]">{p.doi}</span></Fact>
                  <Fact label="Publisher">{p.metadata.publisher.name}</Fact>
                  <Fact label="Year"><span className="tnum">{p.metadata.publicationYear}</span></Fact>
                  <Fact label="Type">{p.metadata.resourceType}</Fact>
                  <Fact label="License">{p.metadata.license}</Fact>
                  <Fact label="Status">{p.status}</Fact>
                  <Fact label="Datasets"><span className="tnum">{fmtNum(p.datasetPids.length)}</span></Fact>
                  <Fact label="Files"><span className="tnum">{fmtNum(p.numberOfFiles)}</span></Fact>
                  <Fact label="Size"><span className="tnum">{fmtBytes(p.sizeOfArchive)}</span></Fact>
                  <Fact label="Registered">{fmtDate(p.registeredTime)}</Fact>
                </dl>
              </div>
            </div>
          </div>
        )}

        {tab === "datasets" && (
          <div className="card divide-y divide-line">
            {datasets.map((d) => (
              <Link key={d.pid} to={datasetLink(d.pid)} className="group flex items-center gap-3 p-3 transition-colors hover:bg-surface-2">
                <Thumb d={d} className="h-12 w-20 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium group-hover:text-accent" title={d.datasetName}>{d.datasetName}</span>
                  <span className="tnum block truncate text-xs text-muted">{fmtDate(d.creationTime)} · {d.instrumentName} · {fmtBytes(d.size)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
