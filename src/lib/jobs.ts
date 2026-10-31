import type { Job } from "@/types";

export type JobKindOfStatus = "waiting" | "running" | "success" | "partial" | "failed" | "cancelled" | "other";

// Each facility chooses its own status codes; the backend's own examples match them with patterns such as /^finished/.
// Known words are grouped here, and any other code is shown as it came, never dropped or hidden.
const RULES: [RegExp, JobKindOfStatus][] = [
  [/cancel|abort|withdraw/i, "cancelled"],
  [/with\w*errors?|partial/i, "partial"],
  [/unsuccess|fail|error|reject|timeout|expired/i, "failed"],
  [/^finished|success|complete|done/i, "success"],
  [/progress|running|started|processing|transfer/i, "running"],
  [/pending|queue|created|submitted|waiting|scheduled|requested/i, "waiting"],
];

export const classifyStatus = (code: string): JobKindOfStatus => RULES.find(([re]) => re.test(code))?.[1] ?? "other";

// "jobSubmitted" -> "Job submitted"
export const humanizeStatus = (code: string) => {
  const t = code.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const isActiveJob = (j: Pick<Job, "statusCode">) => ["waiting", "running"].includes(classifyStatus(j.statusCode));
export const isFailedJob = (j: Pick<Job, "statusCode">) => ["failed", "partial"].includes(classifyStatus(j.statusCode));
