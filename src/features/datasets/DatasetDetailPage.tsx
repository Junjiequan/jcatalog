import { datasetLink, proposalLink } from "@/lib/query";
import { canManage, useRole } from "@/lib/permissions";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Check, Clock, FileCode, FileText, GitBranch, HardDrive, Link2, MoreHorizontal, Pencil, Plus, Share2, Sparkles, Trash2 } from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { InstrumentChips, TechniqueChips } from "@/components/InstrumentChips";
import { Button } from "@/components/ui/Button";
import { Menu, MenuItem, MenuSep, Tip } from "@/components/ui/Overlay";
import { BackButton, Badge, Breadcrumb, CopyButton, ErrorState, KeywordChips, Skeleton, TabBar } from "@/components/ui/Primitives";
import { TagInput } from "@/components/ui/TagInput";
import { api } from "@/api";
import { bus } from "@/lib/bus";
import { useResource } from "@/api/hooks";
import { downloadBlob, fmtBytes, fmtDate, fmtNum } from "@/lib/format";
import { confirm } from "@/store/confirm";
import { useSelection } from "@/store/selection";
import { toast } from "@/store/toasts";
import { useRecordRecent } from "@/hooks/hooks";
import { storageOf, techniqueNames } from "@/types";
import { RetrievalBanner } from "./PeekPanel";
import { PublishedBadge, StorageBadge, TypeBadge } from "./shared";
import { ShareDialog } from "./detail/ShareDialog";
import { OverviewTab } from "./detail/OverviewTab";
import { MetadataTab } from "./detail/MetadataTab";
import { FilesTab } from "./detail/FilesTab";
import { RelatedTab } from "./detail/RelatedTab";
import { HistoryTab } from "./detail/HistoryTab";
import { AttachmentsTab } from "./detail/AttachmentsTab";
import type { Tab } from "./detail/tabs";

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
              <Button onClick={() => toggleSel(d)} className={selected ? "border-selection bg-selection-soft text-selection" : ""}>
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

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      <div className="mt-5" key={tab}>
        {tab === "overview" && <OverviewTab d={d} canEdit={canEdit} onUpdate={(n) => mutate(() => n)} goTab={setTab} />}
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
