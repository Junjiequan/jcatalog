import clsx from "clsx";
import { Microscope } from "lucide-react";
import { api } from "@/api";
import { useTagTarget } from "@/components/tagScope";
import { TechBadge } from "@/components/ui/Primitives";
import { MoreChip } from "@/components/ui/Overlay";

// Clicking an instrument or technique finds more of what the page lists (see tagScope). A list that filters in place passes onPick.
// A record is measured on one or more instruments. The chip wears the ESS cyan with a solid icon tile, so the instrument reads as the record's identity;
// techniques are a different thing and live in TechniqueChips, in their own colours and their own row or column.
export function InstrumentChips({ ids, size = "md", max, nowrap, onPick }: { ids: string[]; size?: "sm" | "md"; max?: number; nowrap?: boolean; onPick?: (id: string) => void }) {
  const show = useTagTarget();
  const pick = onPick ?? show.instrument;
  const all = ids.map((id) => api.options.instruments().find((x) => x.pid === id)).filter((x) => !!x);
  if (!all.length) return null;
  const shown = max ? all.slice(0, max) : all;
  return (
    <span className={clsx("inline-flex items-center gap-1.5", nowrap ? "flex-nowrap whitespace-nowrap" : "flex-wrap")}>
      {shown.map((i) => {
        const cls = clsx(
          "inline-flex items-center whitespace-nowrap rounded-md border border-brand/40 bg-brand/10 font-semibold tracking-wide text-fg",
          size === "sm" ? "gap-1.5 py-px pl-px pr-2 text-[11px]" : "gap-2 py-0.5 pl-0.5 pr-2.5 text-[13px]",
        );
        const body = (
          <>
            <span className={clsx("flex shrink-0 items-center justify-center rounded-[5px] bg-brand text-white", size === "sm" ? "h-[18px] w-[18px]" : "h-6 w-6")}>
              <Microscope className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
            </span>
            <span className="max-w-[7rem] truncate">{i.name}</span>
          </>
        );
        return (
          <button key={i.pid} onClick={(e) => (e.stopPropagation(), pick(i.pid))} title={`Show ${show.noun} on ${i.name} · ${i.title}`} className={clsx(cls, "transition-colors hover:border-brand hover:bg-brand/20")}>{body}</button>
        );
      })}
      {max !== undefined && all.length > max && <MoreChip count={all.length - max} title="All instruments" tone="muted"><InstrumentChips ids={all.map((i) => i.pid)} size={size} onPick={onPick} /></MoreChip>}
    </span>
  );
}

// The techniques of some instruments, without repeats (a proposal or published set has no technique of its own)
export const techniquesOf = (ids: string[]) => [...new Set(ids.flatMap((id) => api.options.instruments().find((x) => x.pid === id)?.techniques ?? []))];

// `max` shows that many and a "+N" chip for the rest (the table cells use it, so a row never grows taller)
export function TechniqueChips({ names, nowrap, max, onPick }: { names: string[]; nowrap?: boolean; max?: number; onPick?: (name: string) => void }) {
  const show = useTagTarget();
  const pick = onPick ?? show.technique;
  if (!names.length) return null;
  const shown = max ? names.slice(0, max) : names;
  return (
    <span className={clsx("inline-flex items-center gap-1.5", nowrap ? "flex-nowrap whitespace-nowrap" : "flex-wrap")}>
      {shown.map((t) => <button key={t} onClick={(e) => (e.stopPropagation(), pick(t))} className="rounded-md hover:brightness-95 dark:hover:brightness-125"><TechBadge name={t} clickable /></button>)}
      {max !== undefined && names.length > max && <MoreChip count={names.length - max} title="All techniques" tone="muted"><TechniqueChips names={names} onPick={onPick} /></MoreChip>}
    </span>
  );
}
