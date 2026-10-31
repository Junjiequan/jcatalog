import { Children, cloneElement, isValidElement, useId, type ReactNode } from "react";
import clsx from "clsx";
import { ChevronRight } from "lucide-react";
import { useElementWidth } from "@/hooks/hooks";

// the title band, exactly like the Datasets page: title only, no description (the `subtitle` prop is accepted and ignored)
export function PageHeader({ title, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div data-band className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 pt-4 sm:px-6 [&:not(:has(+[data-band]))]:border-b [&:not(:has(+[data-band]))]:border-line [&:not(:has(+[data-band]))]:pb-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// Every page follows the Datasets pattern: a white band at the top holding the title and the toolbar, then the
// content with the same side padding. Bands (PageHeader, ListToolbar) run edge to edge; everything else is inset.
export const Page = ({ children }: { children: ReactNode; wide?: boolean }) => (
  <div className="flex min-h-full w-full flex-col bg-surface pb-6 animate-fade-in [&>*:not([data-band])]:mx-4 sm:[&>*:not([data-band])]:mx-6 [&>[data-band]+*:not([data-band])]:mt-4">{children}</div>
);

export const ListToolbar = ({ children }: { children: ReactNode }) => <div data-band className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 pb-3 pt-3 sm:px-6">{children}</div>;

// Puts `id` (and what describes it) on the first native control inside `node`, however deep (a password box with a
// show button around it, say). Returns the id that control ends up with: its own, or the one given.
function wire(node: ReactNode, id: string, describedBy?: string): [ReactNode, string | undefined] {
  let controlId: string | undefined;
  const walk = (n: ReactNode): ReactNode =>
    Children.map(n, (child) => {
      if (controlId || !isValidElement<Record<string, unknown>>(child)) return child;
      if (typeof child.type === "string" && ["input", "select", "textarea"].includes(child.type)) {
        controlId = (child.props.id as string | undefined) ?? id;
        return cloneElement(child, { id: controlId, "aria-describedby": describedBy });
      }
      return child.props.children ? cloneElement(child, undefined, walk(child.props.children as ReactNode)) : child;
    });
  const wired = walk(node);
  return [wired, controlId];
}

// A labelled form field: the label is tied to the control, so a screen reader says what the box is for, and the hint
// or error is read with it. Anything that is not a native control (a segmented choice) is labelled as a group.
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: ReactNode; className?: string }) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  const [control, controlId] = wire(children, id, note ? noteId : undefined);
  return (
    <div className={className} role={controlId ? undefined : "group"} aria-labelledby={controlId ? undefined : `${id}-label`}>
      <label id={`${id}-label`} htmlFor={controlId} className="label">{label}</label>
      {control}
      {note && <p id={noteId} className={clsx("mt-1 text-xs", error ? "text-danger" : "text-subtle")} role={error ? "alert" : undefined}>{note}</p>}
    </div>
  );
}

// The one card grid every page shares. Columns follow the results area's width (dense: 2 / 3 / 5, wide: 1 / 2 / 3);
// page sizes are multiples of 5, so a dense grid's rows are full on wide screens. When the last row is short and
// another page exists, a "more on the next page" card fills the gap so a short row never reads as the end.
export function CardGrid({ children, count, hasMore, onNext, wide, className }: { children: ReactNode; count: number; hasMore?: boolean; onNext?: () => void; wide?: boolean; className?: string }) {
  // dense (dataset thumbnails): 2 / 3 / 5 across by width. wide (text cards): as many as fit at the width the content needs.
  const [ref, w] = useElementWidth<HTMLDivElement>();
  const GAP = 16;
  const MIN = 320;
  const cols = !w ? (wide ? 1 : 2) : wide ? Math.max(1, Math.floor((w + GAP) / (MIN + GAP))) : w >= 900 ? 5 : w >= 640 ? 3 : 2;
  const short = count % cols !== 0;
  return (
    <div ref={ref} className={clsx("mb-4", className)}>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
        {hasMore && onNext && short && (
          <button
            onClick={onNext}
            className="group/next flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong text-sm font-medium text-muted transition-colors hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 transition-colors group-hover/next:bg-accent group-hover/next:text-accent-fg"><ChevronRight className="h-5 w-5" /></span>
            More on the next page
          </button>
        )}
      </div>
    </div>
  );
}

// The card shell every grid shares (Datasets included): lifts on hover, and tints when selected
export const cardCls = (selected: boolean, extra?: string) => clsx("group relative card transition-all hover:-translate-y-0.5 hover:shadow-pop", selected && "border-selection/50 bg-selection-soft/40", extra);

// One "label: value" line of a detail card; nothing is drawn when there is no value
export const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (children === undefined || children === null || children === "" ? null : <div className="flex justify-between gap-4 border-b border-line py-2 text-[13px] last:border-b-0"><dt className="shrink-0 text-subtle">{label}</dt><dd className="min-w-0 text-right font-medium [overflow-wrap:anywhere]">{children}</dd></div>);
