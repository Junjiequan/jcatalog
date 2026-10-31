import { type ReactNode } from "react";
import clsx from "clsx";
import { AlertTriangle, Info, type LucideIcon, SearchX } from "lucide-react";
import { Button } from "./Button";

export const Skeleton = ({ className, style }: { className?: string; style?: React.CSSProperties }) => <div style={style} className={clsx("animate-pulse rounded-md bg-surface-3", className)} />;

export function ProgressBar({ value, tone = "accent", className }: { value: number; tone?: "accent" | "success" | "danger"; className?: string }) {
  const color = { accent: "bg-accent", success: "bg-success", danger: "bg-danger" }[tone];
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div className={clsx("h-full rounded-full transition-all duration-300", color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, children, className }: { icon: LucideIcon; title: string; description?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon className="h-7 w-7" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </div>
  );
}

/** What every list shows when a search matches nothing. */

export function NoMatches({ query, noun, onClear }: { query: string; noun: string; onClear: () => void }) {
  return (
    <EmptyState icon={SearchX} title={`No ${noun} match “${query.trim()}”`} description="Check the spelling or try fewer words.">
      <Button onClick={onClear}>Clear search</Button>
    </EmptyState>
  );
}

/** The row under a page header that holds the search box and any list controls. */

export function ErrorState({ title = "We couldn't load this", message, onRetry, className }: { title?: string; message?: string; onRetry?: () => void; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
        <AlertTriangle className="h-7 w-7" strokeWidth={1.6} />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {onRetry && <Button className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

// An explanatory note: an icon, an optional title, and a sentence or two. Use it wherever a screen needs to
// say what can and cannot be done here, instead of a loose paragraph.
export function Callout({ tone = "info", icon: Icon, title, children, className }: { tone?: "info" | "neutral" | "warn"; icon?: LucideIcon; title?: ReactNode; children: ReactNode; className?: string }) {
  const I = Icon ?? (tone === "warn" ? AlertTriangle : Info);
  return (
    <div
      role="note"
      className={clsx(
        // with a title the icon sits on the first line; a single sentence gets it centred
        "flex gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed",
        title ? "items-start" : "items-center",
        tone === "info" && "border-accent/25 bg-accent-soft/50 text-fg/90",
        tone === "neutral" && "border-line bg-surface-2 text-muted",
        tone === "warn" && "border-warn/40 bg-warn/10 text-fg/90",
        className,
      )}
    >
      <I className={clsx("h-4 w-4 shrink-0", title && "mt-0.5", tone === "info" ? "text-accent" : tone === "warn" ? "text-warn" : "text-subtle")} strokeWidth={1.8} />
      <div className="min-w-0">
        {title && <div className="font-semibold text-fg">{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
}
