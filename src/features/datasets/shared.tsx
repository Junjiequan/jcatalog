import { Archive, FlaskConical, GitBranch, Globe, HardDrive, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Primitives";
import { Explain } from "@/components/ui/Overlay";
import type { DatasetType, Storage } from "@/types";

// Every status tag carries a plain-language explanation on hover.
export const TAG_HELP = {
  raw: { title: "Raw data", text: "Exactly what the instrument recorded, untouched. The starting point for any analysis.", icon: FlaskConical },
  derived: { title: "Derived data", text: "Produced from raw data by processing or analysis. Its detail page links back to the source datasets.", icon: GitBranch },
  online: { title: "On disk", text: "Stored on fast online storage. You can browse the files and download right away.", icon: HardDrive },
  archived: { title: "Archived to tape", text: "Moved to the tape archive to free up disk. Request a retrieval and it will be back on disk, usually within a few hours.", icon: Archive },
  retrieving: { title: "Retrieving from tape", text: "A retrieval is in progress. The files will be back on disk once it finishes; watch it under Jobs.", icon: Loader2 },
  published: { title: "Published", text: "Openly available with a permanent DOI. Anyone can find, cite and download it, even without an account.", icon: Globe },
} as const;

const Tag = ({ help, children }: { help: keyof typeof TAG_HELP; children: React.ReactNode }) => {
  const h = TAG_HELP[help];
  return <Explain title={h.title} text={h.text} icon={h.icon}><span className="inline-flex cursor-help">{children}</span></Explain>;
};

export const TypeBadge = ({ type }: { type: DatasetType }) => (
  <Tag help={type}><Badge tone={type === "raw" ? "accent" : "neutral"}>{type === "raw" ? "Raw" : "Derived"}</Badge></Tag>
);

export function StorageBadge({ storage }: { storage: Storage }) {
  if (storage === "online") return <Tag help="online"><Badge tone="success" icon={HardDrive}>On disk</Badge></Tag>;
  if (storage === "archived") return <Tag help="archived"><Badge tone="warn" icon={Archive}>Archived</Badge></Tag>;
  return (
    <Tag help="retrieving">
      <Badge tone="accent">
        <Loader2 className="h-3 w-3 animate-spin" />
        Retrieving
      </Badge>
    </Tag>
  );
}

export const PublishedBadge = () => <Tag help="published"><Badge tone="success" icon={Globe}>Published</Badge></Tag>;
