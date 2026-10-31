import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/SidePanel";
import { Tip } from "@/components/ui/Overlay";
import { useHotkeys } from "@/hooks/hooks";
import { useUI } from "@/store/ui";
import { ErrorState, Skeleton } from "@/components/ui/Primitives";

// The preview of a list item (a sample, a proposal…): what it is at a glance, then "Open details". It sits beside the
// list and pushes it aside, like a dataset's preview, so the list stays usable while it is open. Which item is open is
// kept in the URL (?peek=), see usePeekParam.
export function PeekSheet({ open, onClose, onPrev, onNext, children }: { open: boolean; onClose: () => void; onPrev?: () => void; onNext?: () => void; children: ReactNode }) {
  const selectionOpen = useUI((s) => s.selectionOpen);
  useHotkeys({
    j: () => open && onNext?.(),
    k: () => open && onPrev?.(),
    Escape: () => open && !document.querySelector("[role=dialog]") && onClose(),
  });
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Preview"
      yields={selectionOpen}
      actions={
        <>
          <Tip label="Previous" kbd="K"><Button size="icon-sm" variant="ghost" onClick={onPrev} disabled={!onPrev} aria-label="Previous"><ChevronUp className="h-4 w-4" /></Button></Tip>
          <Tip label="Next" kbd="J"><Button size="icon-sm" variant="ghost" onClick={onNext} disabled={!onNext} aria-label="Next"><ChevronDown className="h-4 w-4" /></Button></Tip>
        </>
      }
    >
      {children}
    </SidePanel>
  );
}

// What shows while the item loads, or why it cannot be shown
export function PeekState({ error, onRetry }: { error?: Error; onRetry: () => void }) {
  if (error) return <ErrorState title="Can't show this" message={error.message} onRetry={onRetry} />;
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

// the buttons at the foot of a preview, which stay in view while the content scrolls
export function PeekFooter({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 flex gap-2 border-t border-line bg-surface p-3">{children}</div>;
}

// one fact, an icon instead of a label column
export function PeekFact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <li title={label} className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-subtle" />
      <span className="min-w-0 truncate">{children}</span>
    </li>
  );
}
