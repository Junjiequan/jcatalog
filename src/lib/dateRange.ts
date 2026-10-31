import { toISODate } from "@/lib/format";

// The created-date range the way the filter panel words it, so a filter reads the same wherever it is shown
export const MONTHS = 36;

export const monthStart = (i: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (MONTHS - i), 1);
};

export const monthLabel = (i: number) => monthStart(i).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });

export const indexOf = (iso?: string) => {
  if (!iso) return undefined;
  const d = new Date(iso);
  const m0 = monthStart(0);
  const i = (d.getFullYear() - m0.getFullYear()) * 12 + (d.getMonth() - m0.getMonth()) + (d.getDate() > 15 ? 1 : 0);
  return Math.max(0, Math.min(MONTHS, i));
};

export const PRESETS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "3 months", days: 90 },
  { label: "12 months", days: 365 },
];

export const daysAgo = (n: number) => toISODate(new Date(Date.now() - n * 86400000));


export function rangeLabel(from?: string, to?: string) {
  if (!from && !to) return "Any time";
  const preset = PRESETS.find((p) => from === daysAgo(p.days) && !to);
  if (preset) return `Last ${preset.label}`;
  return `${from ? monthLabel(indexOf(from) ?? 0) : "…"} – ${to ? monthLabel(indexOf(to) ?? MONTHS) : "now"}`;
}
