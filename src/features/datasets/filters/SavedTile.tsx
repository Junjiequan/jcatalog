import { useState } from "react";
import { BookmarkCheck, Check, Eye, Info, Pencil, X } from "lucide-react";
import { Explain, Modal, Tip } from "@/components/ui/Overlay";
import { SEARCH_KINDS, kindOf, useUI, type SavedSearch } from "@/store/ui";
import { Button } from "@/components/ui/Button";
import { toast } from "@/store/toasts";
import { QueryPreview } from "../QueryPreview";

// A saved search as a tappable tile (like the technique tiles); eye previews, × deletes
export function SavedTile({ s, onApply, onDelete }: { s: SavedSearch; onApply: () => void; onDelete: () => void }) {
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
      <Modal open={open} onOpenChange={(o) => (setOpen(o), o && setName(s.name))} title={s.name} bare size="xl" noAutoFocus footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button><Button variant="primary" onClick={() => (setOpen(false), onApply())}>Apply this search</Button></>}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-2">
          <span className="flex items-center gap-2"><BookmarkCheck className="h-4 w-4 text-accent" /><h2 className="text-sm font-semibold">Saved {SEARCH_KINDS[kindOf(s)].noun} search</h2></span>
          {/* the explanation sits behind an info mark, the way the filter sections explain themselves */}
          <Explain title="Only the name can be changed here" text="To change the filters, apply the search, adjust them, and save it again." side="bottom" delay={200}>
            <button aria-label="About editing a saved search" className="flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-fg"><Info className="h-4 w-4" /></button>
          </Explain>
        </div>
        {/* the name is editable right here; the filters below are read-only (apply, adjust, save again to change them) */}
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-3 border-b border-line px-5 py-2.5">
          <label className="flex items-center gap-1.5 text-[13px] text-muted" htmlFor="saved-search-name"><Pencil className="h-3.5 w-3.5 shrink-0 text-subtle" strokeWidth={1.8} />Name</label>
          <div className="flex min-w-0 items-center gap-1.5 max-w-md">
            <input id="saved-search-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => commit(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Saved search name" className="field h-9 min-w-0 flex-1 text-sm font-semibold" />
            {/* applies the typed name; Enter and leaving the box do the same */}
            <Tip label={name.trim() !== "" && name.trim() !== s.name ? "Save the name" : "Name is saved"}>
              <Button size="icon-sm" variant={name.trim() !== "" && name.trim() !== s.name ? "primary" : "ghost"} disabled={!(name.trim() !== "" && name.trim() !== s.name)} aria-label="Save the name" onMouseDown={(e) => e.preventDefault()} onClick={() => (commit(name), toast.success("Name saved"))}><Check className="h-4 w-4" /></Button>
            </Tip>
          </div>
        </div>
        <div className="px-5 py-1.5"><QueryPreview qs={s.qs} /></div>
      </Modal>
    </div>
  );
}
