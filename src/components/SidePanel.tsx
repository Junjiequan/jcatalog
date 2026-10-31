import clsx from "clsx";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { create } from "zustand";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet, Tip } from "@/components/ui/Overlay";
import { ResizeEdge } from "@/components/ResizeEdge";
import { PANEL_MAX } from "@/lib/panelLimits";
import { useMediaQuery } from "@/hooks/hooks";
import { useUI } from "@/store/ui";

// Where a docked panel sits: beside the page, so the page shrinks to make room (the shell provides the element).
const DockSlot = createContext<HTMLElement | null>(null);
export const DockProvider = DockSlot.Provider;

const PAGE_MIN = 520;
const PANEL_MIN = 320;

// what sits to the left of the page's own content: the navigation column (from lg up) and the filter panel when it is open
function useNavWidth() {
  const lg = useMediaQuery("(min-width: 1024px)");
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const filters = useUI((s) => (s.filtersOpen ? s.filtersWidth : 0));
  return lg ? (collapsed ? 69 : 249) + filters : 0;
}

// The dock, when there is room for it: anything wider than a phone (below 640px there is no room, so it is a sheet there). Both panels
// can be open together while the page keeps a workable width beside them; below that the panel asked to give way
// (`yields`) steps aside while the other is open.
export function useDock(yields = false) {
  const slot = useContext(DockSlot);
  const md = useMediaQuery("(min-width: 640px)");
  const nav = useNavWidth();
  const fits = useMediaQuery(`(min-width: ${nav + PAGE_MIN + 2 * PANEL_MIN}px)`);
  return { slot: md ? slot : null, hidden: md && !fits && yields };
}

// which of the two right-hand panels are showing, so each can leave the other room
const showing = create<{ on: Record<"previewWidth" | "selectionWidth", boolean> }>(() => ({ on: { previewWidth: false, selectionWidth: false } }));

// The width a right-hand panel is drawn at, and the widest its drag may go. With both panels open, one cannot be dragged so
// wide that the page, or the other panel, is squeezed out: the other keeps at least its minimum.
export function usePanelWidth(key: "previewWidth" | "selectionWidth", active: boolean) {
  const other = key === "previewWidth" ? "selectionWidth" : "previewWidth";
  const stored = useUI((s) => s[key]);
  const otherStored = useUI((s) => s[other]);
  const otherOn = showing((s) => s.on[other]);
  const nav = useNavWidth();
  const [vw, setVw] = useState(() => innerWidth);
  useEffect(() => {
    const on = () => setVw(innerWidth);
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, []);
  useEffect(() => {
    showing.setState((s) => ({ on: { ...s.on, [key]: active } }));
    return () => showing.setState((s) => ({ on: { ...s.on, [key]: false } }));
  }, [key, active]);
  const room = vw - nav - PAGE_MIN;
  const otherWidth = otherOn ? Math.min(otherStored, Math.max(PANEL_MIN, room - PANEL_MIN)) : 0;
  const max = Math.max(PANEL_MIN, Math.min(PANEL_MAX, room - otherWidth));
  return { width: Math.min(stored, max), max };
}

// A panel for the right edge. With room it pushes the page aside, so the list stays usable while it is open (the
// dataset preview works the same way); on narrow screens it slides over the page as a sheet.
export function SidePanel({ open, onClose, title, count, actions, footer, yields, widthKey, children }: { open: boolean; onClose: () => void; title: string; count?: number; actions?: ReactNode; footer?: ReactNode; yields?: boolean; widthKey: "previewWidth" | "selectionWidth"; children: ReactNode }) {
  const { slot, hidden } = useDock(yields);
  const label = count === undefined ? title : `${title} (${count})`;
  const { width, max } = usePanelWidth(widthKey, open && !!slot && !hidden);
  if (hidden) return null;
  if (!slot) return <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={label} width="sm:w-[420px]" actions={actions} footer={footer}>{children}</Sheet>;
  if (!open) return null;
  return createPortal(
    <aside className={clsx("relative flex shrink-0 flex-col border-l animate-slide-in-right", widthKey === "selectionWidth" ? "border-line-strong" : "border-line", "bg-surface")} // the selection is always the outermost panel, whichever was opened first
    style={{ width, order: widthKey === "selectionWidth" ? 2 : 1 }}>
      <ResizeEdge side="left" grows="left" width={width} min={PANEL_MIN} max={max} initial={400} onChange={(w) => useUI.getState().set({ [widthKey]: w })} label="Resize panel" tone={widthKey === "selectionWidth" ? "selection" : "blue"} />
      <div className={clsx("flex h-12 shrink-0 items-center justify-between border-b border-line px-4")}>
        <span className="section-title">{label}</span>
        <div className="flex items-center gap-0.5">
          {actions}
          <Tip label="Close" kbd="Esc"><Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close preview"><X className="h-4 w-4" /></Button></Tip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0 border-t border-line p-3">{footer}</div>}
    </aside>,
    slot,
  );
}
