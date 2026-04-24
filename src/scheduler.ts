import { schedule, type ScheduledTask } from "node-cron";
import type { Job } from "./storage.js";
import { fireJob } from "./fire.js";

// In-memory map of active cron tasks.
// Dies with the process — intentionally not persisted to disk.
const tasks = new Map<string, ScheduledTask>();

export function registerTimer(job: Job): void {
  if (tasks.has(job.id)) return;
  const task = schedule(job.cron, () => { fireJob(job.id).catch(() => {}); });
  tasks.set(job.id, task);
}

export function unregisterTimer(jobId: string): void {
  const task = tasks.get(jobId);
  if (task) {
    task.stop();
    tasks.delete(jobId);
  }
}
