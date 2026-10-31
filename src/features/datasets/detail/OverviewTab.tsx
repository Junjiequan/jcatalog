import { useState } from "react";
import { Globe, Lock, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tip } from "@/components/ui/Overlay";
import { CopyButton } from "@/components/ui/Primitives";
import { api } from "@/api";
import { fmtBytes, fmtDate, humanizeKey, plural } from "@/lib/format";
import { toast } from "@/store/toasts";
import { Dataset, techniqueNames } from "@/types";
import { fmtMeta, highlights } from "../PeekPanel";
import { Card } from "./Card";
import type { Tab } from "./tabs";

export function OverviewTab({ d, canEdit, onUpdate, goTab }: { d: Dataset; canEdit: boolean; onUpdate: (d: Dataset) => void; goTab: (t: Tab) => void }) {
  const [editDesc, setEditDesc] = useState(false);
  const [desc, setDesc] = useState(d.description);
  const [busy, setBusy] = useState(false);

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
