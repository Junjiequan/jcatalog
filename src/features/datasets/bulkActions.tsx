import { Copy, FileSpreadsheet, FileText, HardDriveDownload, ScanSearch, type LucideIcon } from "lucide-react";
import { api } from "@/api";
import { toast } from "@/store/toasts";
import type { SelItem, SelKind } from "@/store/selection";
import { exportPdf } from "@/features/selection/exportPdf";
import { fmtBytes, plural } from "@/lib/format";

// One bulk action over the selection. `kinds` says what it applies to; it runs on that part of the selection only.
export interface BulkAction {
  id: string;
  label: string;
  icon: LucideIcon;
  kinds?: SelKind[];
  // when given, offered only if it returns true for the part of the selection it applies to
  enabled?: (list: SelItem[]) => boolean;
  run: (list: SelItem[], ctx: { nav: (to: string) => void }) => Promise<void> | void;
}

export const partFor = (a: BulkAction, list: SelItem[]) => (a.kinds ? list.filter((i) => a.kinds!.includes(i.kind)) : list);
// the actions that belong to one kind, in menu order; general ones (no kinds) are listed apart
export const actionsFor = (kind: SelKind, list: SelItem[]) => BULK_ACTIONS.filter((a) => a.kinds?.includes(kind) && applies(a, list.filter((i) => i.kind === kind)));
export const GENERAL_ACTIONS = () => BULK_ACTIONS.filter((a) => !a.kinds);
export const applies = (a: BulkAction, list: SelItem[]) => {
  const part = partFor(a, list);
  return part.length > 0 && (!a.enabled || a.enabled(part));
};

// optional external viewer, e.g. https://viewer.example.org/open?pids={pids}
const HDF_VIEWER = import.meta.env.VITE_HDF_VIEWER_URL as string | undefined;

export const BULK_ACTIONS: BulkAction[] = [
  {
    id: "retrieve",
    label: "Retrieve from archive",
    icon: HardDriveDownload,
    kinds: ["dataset"],
    enabled: (list) => list.some((i) => i.archived),
    run: async (list, { nav }) => {
      const archived = list.filter((i) => i.archived);
      try {
        await Promise.all(archived.map((i) => api.datasets.requestRetrieval(i.id)));
        toast.success("Retrieval requested", { description: `${plural(archived.length, "archived dataset")} will be copied back to disk.`, action: { label: "View jobs", onClick: () => nav("/jobs") } });
      } catch {
        toast.error("Couldn't request the retrieval", { description: "Please try again." });
      }
    },
  },
  {
    id: "hdf",
    label: "Open in HDF viewer",
    icon: ScanSearch,
    kinds: ["dataset"],
    run: (list) => {
      if (!HDF_VIEWER) {
        toast.info("No HDF viewer configured", { description: "Set VITE_HDF_VIEWER_URL to the viewer's open-URL template to enable this." });
        return;
      }
      window.open(HDF_VIEWER.replace("{pids}", encodeURIComponent(list.map((i) => i.id).join(","))), "_blank", "noopener");
    },
  },
  {
    id: "pdf",
    label: "Export as PDF",
    icon: FileText,
    // every kind, with the full record of each item (see features/selection/exportPdf)
    kinds: ["dataset", "proposal", "experiment", "sample", "instrument", "published", "job"],
    run: async (list) => {
      try {
        await exportPdf(list);
      } catch {
        toast.error("Couldn't open the print view", { description: "Allow pop-ups for this site and try again." });
      }
    },
  },
  {
    id: "copy",
    label: "Copy identifiers",
    icon: Copy,
    run: async (list) => {
      await navigator.clipboard.writeText(list.map((i) => i.id).join(", "));
      toast.success(`Copied ${plural(list.length, "identifier")}`, { description: "Comma-separated, ready to paste." });
    },
  },
  {
    id: "csv",
    label: "Export list as CSV",
    icon: FileSpreadsheet,
    run: (list) => {
      const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [["kind", "id", "name", "size_bytes", "files", "archived"], ...list.map((i) => [i.kind, i.id, i.name, i.size ?? "", i.files ?? "", i.kind === "dataset" ? (i.archived ? "yes" : "no") : ""])];
      const blob = new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "selection.csv" });
      a.click();
      URL.revokeObjectURL(a.href);
    },
  },
];
