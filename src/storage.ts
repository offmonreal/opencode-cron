import { readFile, writeFile, mkdir, unlink, readdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
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
  firePath: string;
  createdAt: string;
  workspaceDir?: string;
}

const storageDir = join(homedir(), ".config", "opencode-cron", "jobs");

async function ensureDir(): Promise<void> {
  await mkdir(storageDir, { recursive: true });
}

export async function createJob(data: Omit<Job, "id" | "createdAt">): Promise<Job> {
  await ensureDir();
  const job: Job = { id: randomUUID(), createdAt: new Date().toISOString(), ...data };
  await writeFile(join(storageDir, `${job.id}.json`), JSON.stringify(job, null, 2));
  return job;
}

export async function getJob(id: string): Promise<Job> {
  const raw = await readFile(join(storageDir, `${id}.json`), "utf-8");
  return JSON.parse(raw) as Job;
}

export async function deleteJob(id: string): Promise<void> {
  await unlink(join(storageDir, `${id}.json`)).catch(() => {});
}

export async function listJobs(): Promise<Job[]> {
  await ensureDir();
  const files = (await readdir(storageDir)).filter(f => f.endsWith(".json"));
  const jobs = await Promise.all(
    files.map(f => readFile(join(storageDir, f), "utf-8").then(raw => JSON.parse(raw) as Job))
  );
  return jobs;
}
