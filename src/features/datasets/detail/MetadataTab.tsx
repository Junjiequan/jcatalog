import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CopyButton, EmptyState } from "@/components/ui/Primitives";
import { downloadBlob, humanizeKey } from "@/lib/format";
import { toast } from "@/store/toasts";
import { Dataset } from "@/types";
import { fmtMeta } from "../PeekPanel";
import { Card } from "./Card";

export function MetadataTab({ d }: { d: Dataset }) {
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const g = new Map<string, [string, Dataset["scientificMetadata"][string]][]>();
    // every word of the filter must appear in the name (as written or as shown), the value (raw or as shown) or the unit,
    // so text copied from a row, like "14 Hz" or "proton charge", finds that row
    const words = q.toLowerCase().replace(/_/g, " ").split(/\s+/).filter(Boolean);
    for (const e of Object.entries(d.scientificMetadata)) {
      const hay = `${e[0]} ${humanizeKey(e[0])} ${e[1].value} ${fmtMeta(e[1].value)} ${e[1].unit ?? ""}`.toLowerCase().replace(/_/g, " ");
      if (!words.every((w) => hay.includes(w))) continue;
      const k = e[1].group ?? "Other";
      g.set(k, [...(g.get(k) ?? []), e]);
    }
    return [...g];
  }, [d, q]);
  const exportJson = () => JSON.stringify(d.scientificMetadata, null, 2);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-subtle" />
          <input className="field pl-9" placeholder="Filter by name, value or unit…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button onClick={() => (navigator.clipboard?.writeText(exportJson()), toast.success("Measurements copied as JSON"))}>Copy JSON</Button>
        <Button onClick={() => downloadBlob(`${d.datasetName}.metadata.json`, exportJson())}><Download className="h-4 w-4" />Download</Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={Search} title="No properties match" description={`Nothing contains “${q}”.`} />
      ) : (
        groups.map(([name, rows]) => (
          <Card key={name} className="p-0">
            <div className="border-b border-line px-5 py-3"><span className="section-title">{name}</span></div>
            <div className="divide-y divide-line">
              {rows.map(([k, m]) => (
                <div key={k} className="group flex items-center gap-4 px-5 py-2.5 text-[13px] hover:bg-surface-2/60">
                  <div className="w-1/3 min-w-[120px] text-muted" title={k}>{humanizeKey(k)}</div>
                  <div className="tnum min-w-0 flex-1 font-medium">{fmtMeta(m.value)}</div>
                  <div className="w-20 text-muted">{m.unit}</div>
                  <CopyButton text={`${m.value}${m.unit ? " " + m.unit : ""}`} className="opacity-0 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
