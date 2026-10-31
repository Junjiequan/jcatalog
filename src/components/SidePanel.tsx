import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet, Tip } from "@/components/ui/Overlay";
import { useMediaQuery } from "@/hooks/hooks";

// Where a docked panel sits: beside the page, so the page shrinks to make room (the shell provides the element).
const DockSlot = createContext<HTMLElement | null>(null);
export const DockProvider = DockSlot.Provider;

// The dock, when there is room for it: wide screens only. Two panels fit side by side only on the widest; below that
// the panel asked to give way (`yields`) steps aside while the other is open.
export function useDock(yields = false) {
  const slot = useContext(DockSlot);
  const xl = useMediaQuery("(min-width: 1280px)");
  const xxl = useMediaQuery("(min-width: 1536px)");
  return { slot: xl ? slot : null, hidden: xl && !xxl && yields };
}

// A panel for the right edge. With room it pushes the page aside, so the list stays usable while it is open (the
// dataset preview works the same way); on narrow screens it slides over the page as a sheet.
export function SidePanel({ open, onClose, title, actions, footer, yields, children }: { open: boolean; onClose: () => void; title: string; actions?: ReactNode; footer?: ReactNode; yields?: boolean; children: ReactNode }) {
  const { slot, hidden } = useDock(yields);
  if (hidden) return null;
  if (!slot) return <Sheet open={open} onOpenChange={(o) => !o && onClose()} title={title} width="sm:w-[420px]" actions={actions} footer={footer}>{children}</Sheet>;
  if (!open) return null;
  return createPortal(
    <aside className="flex w-[400px] shrink-0 flex-col border-l border-line bg-surface animate-slide-in-right">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="section-title">{title}</span>
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
