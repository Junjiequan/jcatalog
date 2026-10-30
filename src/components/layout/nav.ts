import { Beaker, Database, FileText, FlaskConical, Globe, ListChecks, Microscope } from "lucide-react";

export const NAV = [
  { to: "/datasets", label: "Datasets", icon: Database, key: "d", hint: "Search and browse all data" },
  { to: "/proposals", label: "Proposals", icon: FileText, key: "p", hint: "Approved beam time and teams" },
  { to: "/experiments", label: "Experiments", icon: Beaker, key: "e", hint: "Runs under a proposal" },
  { to: "/samples", label: "Samples", icon: FlaskConical, key: "s", hint: "Materials you measured" },
  { to: "/instruments", label: "Instruments", icon: Microscope, key: "i", hint: "Beamlines and microscopes" },
  { to: "/published", label: "Published", icon: Globe, key: "r", hint: "Citable data with DOIs" },
  { to: "/jobs", label: "Jobs", icon: ListChecks, key: "j", hint: "Downloads and retrievals" },
] as const;

export const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
