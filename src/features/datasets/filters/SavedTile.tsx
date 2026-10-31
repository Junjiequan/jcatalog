import { useState } from "react";
import { BookmarkCheck, Eye, Pencil, X } from "lucide-react";
import { Callout } from "@/components/ui/Primitives";
import { Modal, Tip } from "@/components/ui/Overlay";
import { useUI } from "@/store/ui";
import { Button } from "@/components/ui/Button";
import { QueryPreview } from "../QueryPreview";

// A saved search as a tappable tile (like the technique tiles); eye previews, × deletes
export function SavedTile({ s, onApply, onDelete }: { s: { id: string; name: string; qs: string }; onApply: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(s.name);
  const rename = useUI((x) => x.updateSearch);
  // takes the field's own value, so a blur right after typing never commits a stale state
  const commit = (value: string) => {
    const n = value.trim();
    if (n && n !== s.name) rename(s.id, { name: n });
    else setName(s.name);
  };
  return (
    <div className="group relative">
      <button onClick={onApply} title={s.name} className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pl-2.5 pr-2 text-left text-[13px] font-medium transition-[padding,background-color,border-color] hover:border-line-strong hover:bg-surface-2 group-hover:pr-14 group-focus-within:pr-14 pointer-coarse:min-h-11 pointer-coarse:pr-14">
        <BookmarkCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
        <span className="truncate">{s.name}</span>
      </button>
      <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
        <Tip label="Preview this search">
          <button onClick={() => setOpen(true)} aria-label={`Preview ${s.name}`} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-fg"><Eye className="h-3.5 w-3.5" /></button>
        </Tip>
        <Tip label="Delete">
          <button onClick={onDelete} aria-label={`Delete ${s.name}`} className="rounded-md p-1 text-subtle hover:bg-surface-3 hover:text-danger"><X className="h-3.5 w-3.5" /></button>
        </Tip>
      </span>
      <Modal open={open} onOpenChange={(o) => (setOpen(o), o && setName(s.name))} title={s.name} bare size="xl" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button><Button variant="primary" onClick={() => (setOpen(false), onApply())}>Apply this search</Button></>}>
        {/* the name is editable right here; the filters below are read-only (apply, adjust, save again to change them) */}
        <div className="border-b border-line px-5 pb-4 pt-5">
          <label className="label" htmlFor="saved-search-name">Name</label>
          <div className="flex items-center gap-2">
            <input id="saved-search-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => commit(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Saved search name" className="field h-9 max-w-md text-sm font-semibold" />
            <Pencil className="h-4 w-4 shrink-0 text-subtle" />
          </div>
          <Callout className="mt-3">Only the name can be changed here — to change the filters, apply the search, adjust them and save it again.</Callout>
        </div>
        <div className="px-5 py-4"><QueryPreview qs={s.qs} /></div>
      </Modal>
    </div>
  );
}
