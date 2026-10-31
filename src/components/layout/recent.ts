import { Beaker, Database, FileText, FlaskConical, Globe } from "lucide-react";
import { datasetLink, proposalLink } from "@/lib/query";

// the same colours as the proposal and experiment icons elsewhere; one width, so the tags line up
export const KIND_TAG = {
  dataset: { label: "Dataset", cls: "bg-teal-500/15 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300" },
  proposal: { label: "Proposal", cls: "bg-accent/15 text-accent" },
  experiment: { label: "Experiment", cls: "bg-violet-500/15 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300" },
  sample: { label: "Sample", cls: "bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300" },
  published: { label: "Published", cls: "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" },
};
export const RECENT_ICON = { dataset: Database, proposal: FileText, experiment: Beaker, sample: FlaskConical, published: Globe };
export const recentLink = (kind: keyof typeof KIND_TAG | undefined, id: string) => (kind === "proposal" || kind === "experiment" ? proposalLink(id) : kind === "sample" ? `/samples/${encodeURIComponent(id)}` : kind === "published" ? `/published/${encodeURIComponent(id)}` : datasetLink(id));
