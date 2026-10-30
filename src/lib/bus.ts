import type { Job } from "@/types";

export const bus = new EventTarget();

export const emitChanged = () => bus.dispatchEvent(new Event("data-changed"));

export const emitJobDone =(job: Job) => bus.dispatchEvent(new CustomEvent<Job>("job-done", { detail: job }));
