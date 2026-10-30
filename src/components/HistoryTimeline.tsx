import type { LucideIcon } from "lucide-react";
import { Clock, Download, FileArchive, Globe, HardDrive, Pencil, Plus, Share2 } from "lucide-react";
import { fmtDate } from "@/lib/format";
import type { HistoryEvent } from "@/types";

const EV_ICON: Record<HistoryEvent["kind"], LucideIcon> = { created: Plus, ingested: HardDrive, edited: Pencil, shared: Share2, archived: FileArchive, published: Globe, retrieved: Download };

// The one history timeline: datasets, proposals and experiments all show their events like this, newest first
export function HistoryTimeline({ events }: { events: HistoryEvent[] }) {
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));
  if (!sorted.length) return <div className="card p-6 text-sm text-muted"><Clock className="mb-2 h-5 w-5 text-subtle" />Nothing has happened to this record yet.</div>;
  return (
    <div className="card p-5">
      <ol className="relative space-y-6 border-l border-line pl-7">
        {sorted.map((e) => {
          const Icon = EV_ICON[e.kind];
          return (
            <li key={e.id} className="relative">
              <span className="absolute -left-[41px] flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-muted"><Icon className="h-3.5 w-3.5" /></span>
              <div className="text-sm font-medium">{e.text}</div>
              <div className="text-xs text-muted">{e.actor} · <span title={fmtDate(e.at, true)}>{fmtDate(e.at)}</span></div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
