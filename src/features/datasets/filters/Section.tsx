import { type ReactNode, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, FilterX, Info } from "lucide-react";
import { Explain, Tip } from "@/components/ui/Overlay";
import { useUI } from "@/store/ui";

// Closed unless the user opened it (remembered), it is one of the few open by default, or it holds a selection.
export function Section({ sid, title, icon, info, badge, defaultOpen = false, onToggle, onClear, children }: { sid?: string; title: string; icon?: ReactNode; info?: ReactNode; badge?: number; defaultOpen?: boolean; onToggle?: (open: boolean) => void; onClear?: () => void; children: ReactNode }) {
  const sections = useUI((s) => s.filterSections);
  const set = useUI((s) => s.set);
  const key = sid ?? title;
  const open = sections[key] ?? (defaultOpen || !!badge);
  const flip = () => (set({ filterSections: { ...sections, [key]: !open } }), onToggle?.(!open));
  const focus = useUI((s) => s.focusSection);
  const [flash, setFlash] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // asked for from the applied-filter bar: open, bring into view, flash once
  useEffect(() => {
    if (focus !== key) return;
    set({ filterSections: { ...useUI.getState().filterSections, [key]: true } });
    // a beat later, so a panel that is just sliding open has its layout; the flag is cleared only then,
    // or the dependency change would cancel this timer before it fires
    const id = setTimeout(() => {
      box.current?.scrollIntoView({ block: "start" });
      setFlash(true);
      set({ focusSection: undefined });
      setTimeout(() => setFlash(false), 1600);
    }, 250);
    return () => clearTimeout(id);
  }, [focus, key, set]);
  return (
    // no row chrome: a small label over its options, separated by space and a faint rule; the chevron folds it
    <div ref={box} className={clsx("scroll-mt-11 border-t border-line/60 px-4 py-3 transition-colors duration-700 ease-out first:border-t-0 [.panel-head+&]:border-t-0 [.panel-head+&]:pt-2", flash && "bg-accent-soft/80")}>
      <div className="flex items-center gap-1">
        <button onClick={flip} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle hover:text-fg">
          {icon}
          <span className="truncate">{title}</span>
          {!!badge && <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold normal-case leading-4 tracking-normal text-accent-fg">{badge}</span>}
          <ChevronDown className={clsx("h-3 w-3 shrink-0 opacity-60 transition-transform group-hover:opacity-100", !open && "-rotate-90")} />
        </button>
        {!!badge && onClear && (
          <Tip label={`Clear ${title.toLowerCase()} (${badge})`}>
            <button onClick={onClear} aria-label={`Clear ${title}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-surface-3 hover:text-fg"><FilterX className="h-3.5 w-3.5" /></button>
          </Tip>
        )}
        {info && (
          <Explain title={title} text={info}>
            <button aria-label={`About ${title}`} className="flex h-6 w-6 shrink-0 cursor-help items-center justify-center rounded-full text-subtle hover:bg-surface-3 hover:text-fg"><Info className="h-3.5 w-3.5" /></button>
          </Explain>
        )}
      </div>
      {open && <div className="mt-3 animate-fade-in">{children}</div>}
    </div>
  );
}
