import { HistoryTimeline } from "@/components/HistoryTimeline";
import { Dataset } from "@/types";

export function HistoryTab({ d }: { d: Dataset }) {
  return <HistoryTimeline events={d.history} />;
}
