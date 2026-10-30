export function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  const v = n / 1024 ** i;
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${u[i]}`;
}

export const fmtNum = (n: number) => n.toLocaleString("en-US");

const COMPACT = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
// big counts read as approximate (238k) which is honest at scale and keeps the column narrow
export const fmtCount = (n: number) => (n < 0 ? "–" : n < 10000 ? n.toLocaleString("en-US") : COMPACT.format(n));

export function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (!withTime) return date;
  return `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function relTime(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return RTF.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return RTF.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return RTF.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return RTF.format(Math.round(diff / (86400 * 30)), "month");
  return RTF.format(Math.round(diff / (86400 * 365)), "year");
}

export const initials = (name: string) =>
  name
    .replace(/^(Dr\.|Prof\.)\s*/, "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const humanizeKey = (k: string) => k.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export const plural = (n: number, one: string, many = one + "s") => `${fmtNum(n)} ${n === 1 ? one : many}`;

export const toISODate = (d: Date) => d.toISOString().slice(0, 10);

export function downloadBlob(filename: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
