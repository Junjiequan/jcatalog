import { useEffect, useState } from "react";
import { Link2, Lock, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Overlay";
import { api } from "@/api";
import { toast } from "@/store/toasts";
import { Dataset } from "@/types";

export function ShareDialog({ d, open, onOpenChange, onChange }: { d: Dataset; open: boolean; onOpenChange: (o: boolean) => void; onChange: (d: Dataset) => void }) {
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
      <label className="label" htmlFor="share-with">Add a group or person</label>
      <div className="flex gap-2">
        <input id="share-with" className="field" value={text} placeholder="e.g. kovacs-lab or name@institute.org" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} autoFocus />
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
