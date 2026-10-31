import { type ReactNode } from "react";
import clsx from "clsx";
import { type LucideIcon, Tag } from "lucide-react";
import { TECH_HUE, TECH_INFO } from "@/lib/techniques";
import { Explain, MoreChip } from "./Overlay";

export type Tone = "neutral" | "accent" | "teal" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted",
  accent: "bg-accent-soft text-accent",
  teal: "bg-teal/12 text-teal",
  success: "bg-success/10 text-success",
  warn: "bg-warn/10 text-warn",
  danger: "bg-danger/10 text-danger",
};

export function Badge({ tone = "neutral", icon: Icon, children, className, title }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title ?? (typeof children === "string" ? children : undefined)} className={clsx("inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4", TONES[tone], className)}>
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}

export function TechBadge({ name, className, clickable }: { name: string; className?: string; clickable?: boolean }) {
  const [light, dark] = TECH_HUE[name] ?? ["100 116 139", "148 163 184"];
  const info = TECH_INFO[name];
  return (
    <Explain title={info?.name ?? name} text={info?.text ?? "No description for this technique yet. One can be added to the instrument record."}>
      <span
        style={{ "--t": light, "--td": dark } as React.CSSProperties}
        className={clsx("inline-flex max-w-[200px] items-center gap-1 whitespace-nowrap rounded-md bg-surface-3/70 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-muted", clickable ? "cursor-pointer" : "cursor-help", className)}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--t))] dark:bg-[rgb(var(--td))]" />
        <span className="min-w-0 truncate">{name}</span>
      </span>
    </Explain>
  );
}

export const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface-2 px-1 font-sans text-[10px] font-medium text-muted">{children}</kbd>
);

// Keywords are how people find an experiment, so they get their own labelled, tinted row (and a tap filters the list by that word)
export function KeywordChips({ words, onPick, size = "md", max, nowrap }: { words: string[]; onPick?: (w: string) => void; size?: "sm" | "md"; max?: number; nowrap?: boolean }) {
  if (!words.length) return null;
  const shown = max ? words.slice(0, max) : words;
  return (
    <span className={clsx("inline-flex items-center gap-1.5", nowrap ? "flex-nowrap whitespace-nowrap" : "flex-wrap")}>
      {shown.map((w) => {
        const cls = clsx("inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft font-medium text-accent", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs");
        return onPick ? (
          <button key={w} onClick={(e) => (e.stopPropagation(), onPick(w))} title={`Show everything tagged “${w}”`} className={clsx(cls, "hover:border-accent hover:bg-accent hover:text-accent-fg")}><Tag className="h-3 w-3" />{w}</button>
        ) : (
          <span key={w} className={cls}><Tag className="h-3 w-3" />{w}</span>
        );
      })}
      {max !== undefined && words.length > max && <MoreChip count={words.length - max} title="All keywords"><KeywordChips words={words} onPick={onPick} size={size} /></MoreChip>}
    </span>
  );
}
