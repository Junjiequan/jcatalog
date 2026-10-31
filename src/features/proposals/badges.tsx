import clsx from "clsx";
import { Beaker, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Primitives";
import { proposalKind, proposalMeta, type Proposal } from "@/types";

// A proposal and an experiment must be told apart at a glance: different icon, different colour, and the word itself
export const KIND_UI = {
  proposal: { label: "Proposal", icon: FileText, cls: "bg-accent-soft text-accent", tile: "bg-accent-soft text-accent" },
  experiment: { label: "Experiment", icon: Beaker, cls: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300", tile: "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300" },
} as const;

export function KindBadge({ p, className }: { p: Pick<Proposal, "type" | "parentProposalId">; className?: string }) {
  const k = KIND_UI[proposalKind(p)];
  return (
    <span title={p.type} className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-4", k.cls, className)}>
      <k.icon className="h-3 w-3 shrink-0" />{k.label}
    </span>
  );
}

// SciCat keeps the facility's status words in metadata: ALLOCATED, ACTIVE, COMPLETED…
export const statusOf = (p: Proposal) => String(proposalMeta(p, proposalKind(p) === "experiment" ? "status_experiment" : "status_proposal") ?? "");
const STATUS_TONE: Record<string, "success" | "accent" | "neutral" | "warn"> = { ACTIVE: "success", ALLOCATED: "accent", COMPLETED: "neutral", CLOSED: "neutral", PENDING: "warn" };
export function ProposalStatus({ p }: { p: Proposal }) {
  const v = statusOf(p);
  if (!v) return null;
  return <Badge tone={STATUS_TONE[v] ?? "neutral"} title={`${proposalMeta(p, "status_experiment") !== undefined && proposalKind(p) === "experiment" ? "Experiment" : "Proposal"} status`}>{v.charAt(0) + v.slice(1).toLowerCase()}</Badge>;
}
