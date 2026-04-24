import { schedule, type ScheduledTask } from "node-cron";
import type { Job } from "./storage.js";
import { fireJob } from "./fire.js";

const tasks = new Map<string, ScheduledTask>();

export async function registerTimer(job: Job): Promise<void> {
  if (tasks.has(job.id)) return;
  const task = schedule(job.cron, () => { fireJob(job.id).catch(() => {}); });
  tasks.set(job.id, task);
}

export async function unregisterTimer(jobId: string): Promise<void> {
  const task = tasks.get(jobId);
  if (task) {
    task.stop();
    tasks.delete(jobId);
  }
}
