import { proposalLink } from "@/lib/query";
import { canManage, useRole } from "@/lib/permissions";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import clsx from "clsx";
import {
  ArrowLeft, Check, ChevronRight, Clock, Download, FileArchive, FileCode, FileImage, FileText, Folder, Globe, HardDrive, Link2, Lock, Maximize2, MoreHorizontal, Pencil, Plus, Search, Share2, Trash2, Users, X, Database, FlaskConical, Microscope, FileBox, GitBranch, Sparkles, Eye,
} from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { HistoryTimeline } from "@/components/HistoryTimeline";
import { InstrumentChips, TechniqueChips } from "@/components/InstrumentChips";
import { Button } from "@/components/ui/Button";
import { AttachmentsTab } from "./AttachmentsTab";
// the graph library is big and only the Related tab needs it
const LineageGraph = lazy(() => import("./LineageGraph"));
import { Menu, MenuItem, MenuSep, Modal, Tip } from "@/components/ui/Overlay";
import { Badge, CopyButton, EmptyState, ErrorState, Skeleton, KeywordChips, BackButton, Breadcrumb } from "@/components/ui/Primitives";
import { TagInput } from "@/components/ui/TagInput";
import { currentUser } from "@/lib/session";
import { api } from "@/api";
import { bus } from "@/lib/bus";
import { useResource } from "@/api/hooks";
import { downloadBlob, fmtBytes, fmtDate, fmtNum, humanizeKey, plural } from "@/lib/format";
import { datasetLink } from "@/lib/query";
import { confirm } from "@/store/confirm";
import { useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";
import { useUI } from "@/store/ui";
import { useRecordRecent } from "@/hooks/hooks";
import {Dataset, FileEntry, HistoryEvent, storageOf, techniqueNames} from "@/types";
import { RetrievalBanner, fmtMeta, highlights } from "./PeekPanel";
import { PublishedBadge, StorageBadge, TypeBadge } from "./shared";

type Tab = "overview" | "metadata" | "files" | "attachments" | "related" | "history";

function ShareDialog({ d, open, onOpenChange, onChange }: { d: Dataset; open: boolean; onOpenChange: (o: boolean) => void; onChange: (d: Dataset) => void }) {
  const [list, setList] = useState(d.sharedWith);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setList(d.sharedWith);
  }, [open, d.sharedWith]);
  const add = () => {
    const v = text.trim();
    if (v && !list.includes(v)) setList([...list, v]);
    setText("");
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Share dataset"
      description="People in these groups will be able to view and download this dataset."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              const next = await api.datasets.update(d.pid, { sharedWith: list }, `Sharing changed: ${list.join(", ") || "no one"}`);
              onChange({ ...next });
              setBusy(false);
              onOpenChange(false);
              toast.success("Sharing updated", { description: list.length ? `Shared with ${list.join(", ")}.` : "This dataset is now private to your group." });
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <label className="label">Add a group or person</label>
      <div className="flex gap-2">
        <input className="field" value={text} placeholder="e.g. kovacs-lab or name@institute.org" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} autoFocus />
        <Button onClick={add} disabled={!text.trim()}>Add</Button>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="flex items-center gap-2"><Lock className="h-4 w-4 text-subtle" />{d.ownerGroup} <span className="text-muted">(owner)</span></span>
          <span className="text-xs text-muted">Full access</span>
        </div>
        {list.map((g) => (
          <div key={g} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm animate-fade-in">
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-subtle" />{g}</span>
            <button onClick={() => setList(list.filter((x) => x !== g))} className="text-muted hover:text-danger" aria-label={`Remove ${g}`}><X className="h-4 w-4" /></button>
          </div>
        ))}
        {!list.length && <p className="px-1 pt-1 text-xs text-subtle">Not shared with anyone else yet.</p>}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg border border-dashed border-line px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 text-muted"><Link2 className="h-4 w-4" />Link works for people with access</span>
        <Button size="sm" onClick={() => (navigator.clipboard?.writeText(location.href), toast.success("Link copied"))}>Copy link</Button>
      </div>
    </Modal>
  );
}

function Card({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("card p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Overview({ d, canEdit, onUpdate, goTab }: { d: Dataset; canEdit: boolean; onUpdate: (d: Dataset) => void; goTab: (t: Tab) => void }) {
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState(d.description);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  const save = async (patch: Partial<Dataset>, prev: Partial<Dataset>, note: string) => {
    setBusy(true);
    try {
      const next = await api.datasets.update(d.pid, patch, note);
      onUpdate({ ...next });
      toast.success("Saved", {
        action: { label: "Undo", onClick: async () => onUpdate({ ...(await api.datasets.update(d.pid, prev, `Reverted: ${note}`)) }) },
        duration: 7000,
      });
    } catch {
      toast.error("Couldn't save your changes", { description: "Your edit is still on screen — check your connection and try again." });
      return false;
    } finally {
      setBusy(false);
    }
    return true;
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <Card
          title="Description"
          action={canEdit && !editDesc && <Tip label="Edit description"><Button size="icon-sm" variant="ghost" onClick={() => (setDesc(d.description), setEditDesc(true))} aria-label="Edit description"><Pencil className="h-3.5 w-3.5" /></Button></Tip>}
        >
          {editDesc ? (
            <div className="space-y-3">
              <textarea autoFocus rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} className="field h-auto resize-y py-2 leading-relaxed" onKeyDown={(e) => e.key === "Escape" && setEditDesc(false)} />
              <div className="flex items-center justify-end gap-2">
                <span className="mr-auto text-xs text-subtle">Esc to cancel</span>
                <Button size="sm" variant="ghost" onClick={() => setEditDesc(false)}>Cancel</Button>
                <Button size="sm" variant="primary" loading={busy} disabled={!desc.trim() || desc === d.description} onClick={async () => (await save({ description: desc.trim() }, { description: d.description }, "Edited description")) && setEditDesc(false)}>Save</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-fg/90">{d.description}</p>
          )}
        </Card>


        <Card title="Key measurements" action={<button onClick={() => goTab("metadata")} className="text-xs font-medium text-accent hover:underline">All {Object.keys(d.scientificMetadata).length} properties →</button>}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {highlights(d, 6).map(([k, m]) => (
              <div key={k} className="rounded-xl bg-surface-2 px-3.5 py-3">
                <div className="truncate text-xs text-muted">{humanizeKey(k)}</div>
                <div className="tnum mt-0.5 text-lg font-semibold tracking-tight">{fmtMeta(m.value)} <span className="text-sm font-normal text-muted">{m.unit}</span></div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Details">
          <dl className="space-y-3 text-[13px]">
            {[
              ["Instrument", d.instrumentName],
              ["Technique", techniqueNames(d).join(", ")],
              ["Sample", d.sampleName],
              ["Created", fmtDate(d.creationTime, true)],
              ["Run number", d.runNumber],
              ["Size", `${fmtBytes(d.size)} · ${plural(d.numberOfFiles, "file")}`],
              ["Owner", d.owner],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
            <div className="border-t border-line pt-3">
              <dt className="mb-1 text-muted">Source folder</dt>
              <dd className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs"><span className="min-w-0 flex-1 truncate" title={d.sourceFolder}>{d.sourceFolder}</span><CopyButton text={d.sourceFolder} label="Copy path" /></dd>
            </div>
          </dl>
        </Card>
        <Card title="Access">
          <div className="space-y-2 text-[13px]">
            <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-subtle" /><span className="font-medium">{d.ownerGroup}</span><span className="text-muted">owns this</span></div>
            {d.sharedWith.map((g) => <div key={g} className="flex items-center gap-2"><Users className="h-4 w-4 text-subtle" /><span className="font-medium">{g}</span><span className="text-muted">can view</span></div>)}
            {d.isPublished && (
              <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-success" /><span className="font-medium">Public</span><span className="text-muted">· DOI</span><a className="truncate text-accent hover:underline" href={`https://doi.org/${d.doi}`} target="_blank" rel="noreferrer">{d.doi}</a><CopyButton text={d.doi ?? ""} /></div>
            )}
            {!d.sharedWith.length && !d.isPublished && <p className="text-xs text-subtle">Private to your group.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetadataTab({ d }: { d: Dataset }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g = new Map<string, [string, Dataset["scientificMetadata"][string]][]>();
    // every word of the filter must appear in the name (as written or as shown), the value (raw or as shown) or the unit,
    // so text copied from a row, like "14 Hz" or "proton charge", finds that row
    const words = q.toLowerCase().replace(/_/g, " ").split(/\s+/).filter(Boolean);
    for (const e of Object.entries(d.scientificMetadata)) {
      const hay = `${e[0]} ${humanizeKey(e[0])} ${e[1].value} ${fmtMeta(e[1].value)} ${e[1].unit ?? ""}`.toLowerCase().replace(/_/g, " ");
      if (!words.every((w) => hay.includes(w))) continue;
      const k = e[1].group ?? "Other";
      g.set(k, [...(g.get(k) ?? []), e]);
    }
    return [...g];
  }, [d, q]);
  const exportJson = () => JSON.stringify(d.scientificMetadata, null, 2);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input className="field pl-9" placeholder="Filter by name, value or unit…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => (navigator.clipboard?.writeText(exportJson()), toast.success("Measurements copied as JSON"))}>Copy JSON</Button>
        <Button onClick={() => downloadBlob(`${d.datasetName}.metadata.json`, exportJson())}><Download className="h-4 w-4" />Download</Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={Search} title="No properties match" description={`Nothing contains “${q}”.`} />
      ) : (
        groups.map(([name, rows]) => (
          <Card key={name} className="p-0">
            <div className="border-b border-line px-5 py-3"><span className="section-title">{name}</span></div>
            <div className="divide-y divide-line">
              {rows.map(([k, m]) => (
                <div key={k} className="group flex items-center gap-4 px-5 py-2.5 text-[13px] hover:bg-surface-2/60">
                  <div className="w-1/3 min-w-[120px] text-muted" title={k}>{humanizeKey(k)}</div>
                  <div className="tnum min-w-0 flex-1 font-medium">{fmtMeta(m.value)}</div>
                  <div className="w-20 text-muted">{m.unit}</div>
                  <CopyButton text={`${m.value}${m.unit ? " " + m.unit : ""}`} className="opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

const KIND_ICON = { image: FileImage, data: FileBox, text: FileText, archive: FileArchive, code: FileCode, other: FileText };

function FilesTab({ d }: { d: Dataset }) {
  const { data, error, reload } = useResource(["dataset-files", d.pid], () => api.datasets.files(d.pid));
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<FileEntry | null>(null);
  const nav = useNavigate();
  if (error) return <ErrorState message="The file listing isn't available right now." onRetry={reload} />;
  if (!data) return <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}</div>;
  const files = data.files.filter((f) => f.path.toLowerCase().includes(q.toLowerCase()));
  const groups = new Map<string, FileEntry[]>();
  files.forEach((f) => {
    const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
    groups.set(dir, [...(groups.get(dir) ?? []), f]);
  });
  const toggle = (p: string) => setSel((s) => (s.has(p) ? new Set([...s].filter((x) => x !== p)) : new Set(s).add(p)));
  const selBytes = data.files.filter((f) => sel.has(f.path)).reduce((a, f) => a + f.size, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input className="field pl-9" placeholder="Filter files…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="tnum text-[13px] text-muted">Showing {files.length} of {fmtNum(data.total)} files</span>
        <Button
          variant="primary"
          className="ml-auto"
          disabled={storageOf(d) !== "online" || (sel.size === 0 && false)}
          onClick={async () => {
            await api.datasets.requestDownload([d.pid]);
            toast.success("Preparing your download", { description: sel.size ? `${plural(sel.size, "file")} · ${fmtBytes(selBytes)}` : `All files · ${fmtBytes(d.size)}`, action: { label: "View jobs", onClick: () => nav("/jobs") } });
          }}
        >
          <Download className="h-4 w-4" />
          {sel.size ? `Download ${sel.size} selected` : "Download all"}
        </Button>
      </div>
      {storageOf(d) !== "online" && <RetrievalBanner d={d} />}
      <Card className="p-0">
        {[...groups].map(([dir, list]) => (
          <div key={dir || "root"}>
            <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-5 py-2 text-xs font-medium text-muted">
              <Folder className="h-3.5 w-3.5" />{dir || "/"}
            </div>
            {list.map((f) => {
              const Icon = KIND_ICON[f.kind];
              const name = f.path.split("/").pop()!;
              return (
                <div key={f.path} className="group flex items-center gap-3 border-b border-line px-5 py-2 text-[13px] last:border-0 hover:bg-surface-2/60">
                  <input type="checkbox" checked={sel.has(f.path)} onChange={() => toggle(f.path)} aria-label={`Select ${name}`} />
                  <Icon className="h-4 w-4 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1 truncate font-medium" title={f.path}>{name}</span>
                  {f.kind === "image" && <button onClick={() => setPreview(f)} className="flex items-center gap-1 text-xs font-medium text-accent opacity-0 group-hover:opacity-100"><Eye className="h-3.5 w-3.5" />Preview</button>}
                  <span className="tnum hidden w-24 text-right text-muted sm:block">{fmtDate(f.modified)}</span>
                  <span className="tnum w-20 text-right text-muted">{fmtBytes(f.size)}</span>
                </div>
              );
            })}
          </div>
        ))}
        {!files.length && <EmptyState icon={Search} title="No files match" description={`Nothing contains “${q}”.`} />}
        {data.total > data.files.length && !q && <div className="px-5 py-3 text-center text-xs text-subtle">…and {fmtNum(data.total - data.files.length)} more files. Download the full dataset to get everything.</div>}
      </Card>
      <Modal open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title={preview?.path.split("/").pop() ?? ""} description={preview ? fmtBytes(preview.size) : ""} size="lg">
        <Thumb d={d} className="aspect-[16/10] w-full rounded-xl" />
      </Modal>
    </div>
  );
}

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

function RelatedTab({ d }: { d: Dataset }) {
  const { data, error, reload } = useResource(["dataset-related", d.pid], () => api.datasets.related(d.pid));
  const [big, setBig] = useState(false);
  if (error) return <ErrorState onRetry={reload} />;
  const Section = ({ title, items, empty }: { title: string; items?: Dataset[]; empty: string }) => (
    <Card title={title}>
      {!items ? <Skeleton className="h-14 w-full" /> : items.length ? <div className="grid gap-2.5 sm:grid-cols-2">{items.map((x) => <MiniCard key={x.pid} d={x} />)}</div> : <p className="text-sm text-subtle">{empty}</p>}
    </Card>
  );
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
      <Section title="Derived from" items={data?.sources} empty="This is original (raw) data — it wasn't derived from another dataset." />
      <Section title="Derived datasets" items={data?.derived} empty="No datasets have been derived from this one yet." />
    </div>
  );
}

function HistoryTab({ d }: { d: Dataset }) {
  return <HistoryTimeline events={d.history} />;
}

export default function DatasetDetailPage() {
  const { pid = "" } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") ?? "overview") as Tab;
  const { data: d, error, reload, mutate } = useResource(["dataset", pid], () => api.datasets.get(pid));
  const selected = useSelection((s) => !!s.items[pid]);
  const toggleSel = useSelection((s) => s.toggle);
  const [shareOpen, setShareOpen] = useState(false);
  const [editKw, setEditKw] = useState(false);
  const [kw, setKw] = useState<string[]>([]);
  const [savingKw, setSavingKw] = useState(false);
  const [publishing, setPublishing] = useState(false);
  useRole();
  const attachmentList = useResource(["attachments", pid], () => api.attachments.list(pid));
  // the same query the Related tab makes, so the tab's count costs nothing extra
  const related = useResource(["dataset-related", pid], () => api.datasets.related(pid), { enabled: !!d });
  const [editName, setEditName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  useRecordRecent(d && { kind: "dataset", pid: d.pid, name: d.datasetName });
  useEffect(() => {
    if (d) {
      document.title = `${d.datasetName} · Metadata Catalog`;
    }
    return () => void (document.title = "Metadata Catalog");
  }, [d?.pid, d?.datasetName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const on = () => reload();
    bus.addEventListener("job-done", on);
    return () => bus.removeEventListener("job-done", on);
  }, [reload]);

  const setTab = (t: Tab) => setSp(t === "overview" ? {} : { tab: t }, { replace: true });
  const back = () => (loc.key !== "default" ? nav(-1) : nav("/datasets"));

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <BackButton onClick={back} className="mb-3" />
        <ErrorState title="We can't show this dataset" message={error.message} onRetry={reload} />
      </div>
    );
  }
  if (!d) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-8">
        <Skeleton className="h-5 w-48" />
        <div className="card flex gap-6 p-5"><Skeleton className="hidden aspect-[16/10] w-64 sm:block" /><div className="flex-1 space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-16 w-full" /></div></div>
      </div>
    );
  }

  const canEdit = canManage(d.ownerGroup);
  const metaCount = Object.keys(d.scientificMetadata).length;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "metadata", label: "Measurements", count: metaCount },
    { id: "files", label: "Files", count: d.numberOfFiles },
    { id: "attachments", label: "Attachments", count: attachmentList.data?.length },
    { id: "related", label: "Related", count: related.data && related.data.sources.length + related.data.derived.length },
    { id: "history", label: "History", count: d.history.length },
  ];

  const remove = async () => {
    const ok = await confirm({ title: "Delete this dataset?", description: `“${d.datasetName}” will be removed from the catalog. Files on disk are not touched.`, confirmLabel: "Delete dataset", tone: "danger" });
    if (!ok) return;
    const gone = await api.datasets.remove(d.pid);
    nav("/datasets", { replace: true });
    toast.success("Dataset deleted", { description: gone.datasetName, duration: 8000, action: { label: "Undo", onClick: async () => (await api.datasets.restore(gone), nav(datasetLink(gone.pid)), toast.info("Dataset restored")) } });
  };

  const publish = async () => {
    const ok = await confirm({
      title: "Publish this dataset?",
      description: "Publishing makes the dataset and its measurements visible to everyone and registers a permanent DOI.",
      confirmLabel: "Publish dataset",
      bullets: ["Anyone — including people outside your institute — will be able to find and download it.", "The DOI can't be removed once registered.", "You can still edit keywords and the description afterwards."],
    });
    if (!ok) return;
    setPublishing(true);
    try {
      const next = await api.datasets.publish(d.pid);
      mutate(() => ({ ...next }));
      toast.success("Dataset published", { description: `DOI ${next.doi} is now registered.` });
    } catch {
      toast.error("Publishing failed", { description: "Nothing was changed. Please try again." });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-5 animate-fade-in sm:px-8">
      <Breadcrumb back={back} trail={[{ label: "Datasets", to: "/datasets" }]} current={d.datasetName} />

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row">
          <Thumb d={d} className="aspect-[16/10] w-full shrink-0 rounded-xl sm:w-72" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={d.type} />
              <StorageBadge storage={storageOf(d)} />
              {d.isPublished && <PublishedBadge />}
              {d.inputDatasets.length > 0 && <Badge icon={GitBranch}>Derived from {d.inputDatasets.length}</Badge>}
            </div>
            {editName ? (
              <form
                className="mt-2 flex flex-wrap items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const next = nameDraft.trim();
                  if (!next || next === d.datasetName) return setEditName(false);
                  setSavingName(true);
                  try {
                    const prev = d.datasetName;
                    const saved = await api.datasets.update(d.pid, { datasetName: next }, `Renamed dataset to “${next}”`);
                    mutate(() => ({ ...saved }));
                    setEditName(false);
                    toast.success("Dataset renamed", { action: { label: "Undo", onClick: async () => { const back = await api.datasets.update(d.pid, { datasetName: prev }, `Reverted: renamed to “${prev}”`); mutate(() => ({ ...back })); } }, duration: 7000 });
                  } catch {
                    toast.error("Couldn't rename the dataset", { description: "Your edit is still on screen — try again." });
                  } finally {
                    setSavingName(false);
                  }
                }}
              >
                <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setEditName(false)} aria-label="Dataset name" className="field h-11 min-w-0 flex-1 text-xl font-semibold" />
                <Button type="submit" size="sm" variant="primary" loading={savingName} disabled={!nameDraft.trim()}>Save</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditName(false)}>Cancel</Button>
              </form>
            ) : (
              <div className="group/name mt-2 flex items-start gap-2">
                <h1 className="text-2xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">{d.datasetName}</h1>
                {canEdit && (
                  <Tip label="Rename dataset">
                    <Button size="icon-sm" variant="ghost" aria-label="Rename dataset" className="mt-0.5 shrink-0 text-subtle" onClick={() => (setNameDraft(d.datasetName), setEditName(true))}><Pencil className="h-4 w-4" /></Button>
                  </Tip>
                )}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1 text-[13px] text-muted">
              <span className="tnum">{d.pid}</span><CopyButton text={d.pid} label="Copy PID" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><InstrumentChips ids={d.instrumentIds} /><TechniqueChips names={techniqueNames(d)} /></div>
            {(d.keywords.length > 0 || canEdit) && (
              editKw ? (
                <div className="mt-3 space-y-2">
                  <TagInput value={kw} onChange={setKw} placeholder="Type a keyword and press Enter" autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" loading={savingKw} onClick={async () => {
                      setSavingKw(true);
                      try {
                        const prev = d.keywords;
                        const next = await api.datasets.update(d.pid, { keywords: kw }, "Edited keywords");
                        mutate(() => ({ ...next }));
                        setEditKw(false);
                        toast.success("Saved", { action: { label: "Undo", onClick: async () => { const back = await api.datasets.update(d.pid, { keywords: prev }, "Reverted: Edited keywords"); mutate(() => ({ ...back })); } }, duration: 7000 });
                      } catch {
                        toast.error("Couldn't save the keywords", { description: "Your edit is still on screen — try again." });
                      } finally {
                        setSavingKw(false);
                      }
                    }}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditKw(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <KeywordChips words={d.keywords} onPick={(k) => nav(`/datasets?scope=all&kw=${encodeURIComponent(k)}`)} />
                  {canEdit && <Tip label={d.keywords.length ? "Edit keywords" : "Add keywords"}><Button size="icon-sm" variant="ghost" aria-label="Edit keywords" onClick={() => (setKw(d.keywords), setEditKw(true))}><Pencil className="h-3.5 w-3.5" /></Button></Tip>}
                </div>
              )
            )}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
              <Link to={proposalLink(d.proposalId)} className="flex items-center gap-1.5 hover:text-accent"><FileText className="h-4 w-4" />{d.proposalId}</Link>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{fmtDate(d.creationTime)}</span>
              <span className="tnum flex items-center gap-1.5"><HardDrive className="h-4 w-4" />{fmtBytes(d.size)} · {fmtNum(d.numberOfFiles)} files</span>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
              {canEdit && !d.isPublished && <Button variant="primary" onClick={publish} loading={publishing}><Sparkles className="h-4 w-4" />Publish</Button>}
              <Button onClick={() => toggleSel(d)} className={selected ? "border-accent bg-accent-soft text-accent" : ""}>
                {selected ? <><Check className="h-4 w-4" />In selection</> : <><Plus className="h-4 w-4" />Add to selection</>}
              </Button>
              {canEdit && <Button onClick={() => setShareOpen(true)}><Share2 className="h-4 w-4" />Share</Button>}
              <Menu trigger={<Button size="icon" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>}>
                <MenuItem icon={Link2} onSelect={() => (navigator.clipboard?.writeText(location.href), toast.success("Link copied"))}>Copy link</MenuItem>
                <MenuItem icon={FileCode} onSelect={() => downloadBlob(`${d.pid}.json`, JSON.stringify(d, null, 2))}>Export record (JSON)</MenuItem>
                {canEdit && <><MenuSep /><MenuItem icon={Trash2} danger onSelect={remove}>Delete dataset…</MenuItem></>}
              </Menu>
            </div>
          </div>
        </div>
      </div>

      {storageOf(d) !== "online" && tab !== "files" && <div className="mt-4"><RetrievalBanner d={d} onRequested={reload} /></div>}

      <div className="sticky top-0 z-10 -mx-4 mt-5 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm sm:-mx-8 sm:px-8">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={clsx("relative flex items-center gap-1.5 whitespace-nowrap px-3 py-3 text-[13.5px] font-medium transition-colors", tab === t.id ? "text-accent" : "text-muted hover:text-fg")}>
              {t.label}
              {t.count !== undefined && <span className="tnum rounded-full bg-surface-3 px-1.5 text-[11px] text-muted">{fmtNum(t.count)}</span>}
              {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5" key={tab}>
        {tab === "overview" && <Overview d={d} canEdit={canEdit} onUpdate={(n) => mutate(() => n)} goTab={setTab} />}
        {tab === "metadata" && <MetadataTab d={d} />}
        {tab === "files" && <FilesTab d={d} />}
        {tab === "attachments" && <AttachmentsTab d={d} canEdit={canEdit} onDataset={(n) => mutate(() => n)} />}
        {tab === "related" && <RelatedTab d={d} />}
        {tab === "history" && <HistoryTab d={d} />}
      </div>

      <ShareDialog d={d} open={shareOpen} onOpenChange={setShareOpen} onChange={(n) => mutate(() => n)} />
    </div>
  );
}
