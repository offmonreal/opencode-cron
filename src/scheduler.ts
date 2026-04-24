import { spawnSync } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import type { Job } from "./storage.js";

export async function registerTimer(job: Job): Promise<void> {
  mkdirSync(join(homedir(), ".config", "opencode-cron", "logs"), { recursive: true });
  const cmd = `${process.execPath} ${job.firePath} ${job.id} >> ${logPath(job.id)} 2>&1`;
  const tag = `opencode-cron:${job.id}`;
  setCrontab(getCrontab() + `# ${tag}\n${job.cron} ${cmd}\n`);
}

export async function unregisterTimer(jobId: string): Promise<void> {
  const tag = `# opencode-cron:${jobId}`;
  const lines = getCrontab().split("\n");
  const out: string[] = [];
  let skip = false;
  for (const line of lines) {
    if (line === tag) { skip = true; continue; }
    if (skip) { skip = false; continue; }
    out.push(line);
  }
  setCrontab(out.join("\n"));
}

function logPath(jobId: string): string {
  return join(homedir(), ".config", "opencode-cron", "logs", `${jobId}.log`);
}

function getCrontab(): string {
  const r = spawnSync("crontab", ["-l"], { encoding: "utf-8" });
  return r.stdout ?? "";
}

function setCrontab(content: string): void {
  const tmp = join(tmpdir(), `opencode-cron-${Date.now()}.tmp`);
  writeFileSync(tmp, content.trim() + "\n");
  spawnSync("crontab", [tmp]);
  unlinkSync(tmp);
}
