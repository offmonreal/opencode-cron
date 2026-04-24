import { randomUUID } from "crypto";

export interface Job {
  id: string;
  cron: string;
  prompt: string;
  sessionId: string;
  serverUrl: string;
  serverUsername?: string;
  serverPassword?: string;
  recurring: boolean;
  createdAt: string;
  workspaceDir?: string;
}

// Jobs live only in memory — they die when OpenCode closes.
// This is intentional: cron jobs are tied to the current OpenCode session.
// No restore on restart needed (and not wanted).
const jobs = new Map<string, Job>();

export function createJob(data: Omit<Job, "id" | "createdAt">): Job {
  const job: Job = { id: randomUUID(), createdAt: new Date().toISOString(), ...data };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job {
  const job = jobs.get(id);
  if (!job) throw new Error(`Job not found: ${id}`);
  return job;
}

export function deleteJob(id: string): void {
  jobs.delete(id);
}

export function listJobs(): Job[] {
  return [...jobs.values()];
}
