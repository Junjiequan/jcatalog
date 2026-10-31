import { useState } from "react";
import { useNavigate } from "react-router";
import { Download, Eye, FileArchive, FileBox, FileCode, FileImage, FileText, Folder, Search } from "lucide-react";
import { Thumb } from "@/components/Thumb";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/Primitives";
import { api } from "@/api";
import { useResource } from "@/api/hooks";
import { fmtBytes, fmtDate, fmtNum, plural } from "@/lib/format";
import { toast } from "@/store/toasts";
import { Dataset, FileEntry, storageOf } from "@/types";
import { RetrievalBanner } from "../PeekPanel";
import { Card } from "./Card";

const KIND_ICON = { image: FileImage, data: FileBox, text: FileText, archive: FileArchive, code: FileCode, other: FileText };

export function FilesTab({ d }: { d: Dataset }) {
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
