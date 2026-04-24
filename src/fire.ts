import { getJob, deleteJob } from "./storage.js";
import { unregisterTimer } from "./scheduler.js";
import { loadServerState } from "./server-state.js";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const logDir = join(homedir(), ".config", "opencode-cron", "logs");
mkdirSync(logDir, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  process.stderr.write(line);
  try { appendFileSync(join(logDir, "fire.log"), line); } catch {}
}

async function tuiPublish(serverUrl: string, authHeaders: Record<string, string>, directory: string, body: object): Promise<Response> {
  const url = `${serverUrl}/tui/publish?directory=${encodeURIComponent(directory)}`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify(body),
  });
}

export async function fireJob(jobId: string): Promise<void> {
  log(`START jobId=${jobId}`);

  const job = await getJob(jobId).catch((e: unknown) => {
    log(`ERROR loading job: ${e}`);
    throw e;
  });

  log(`job loaded: cron=${job.cron} workspaceDir=${job.workspaceDir ?? "none"}`);

  const state = await loadServerState();
  const serverUrl = state?.serverUrl ?? job.serverUrl;
  const serverUsername = state?.serverUsername ?? job.serverUsername;
  const serverPassword = state?.serverPassword ?? job.serverPassword;

  log(`serverUrl=${serverUrl}`);

  const authHeaders: Record<string, string> = {};
  if (serverUsername || serverPassword) {
    const encoded = Buffer.from(`${serverUsername ?? ""}:${serverPassword ?? ""}`).toString("base64");
    authHeaders["Authorization"] = `Basic ${encoded}`;
  }

  const directory = job.workspaceDir ?? process.cwd();

  log(`tui.prompt.append → directory=${directory} prompt="${job.prompt.slice(0, 60)}"`);

  const appendRes = await tuiPublish(serverUrl, authHeaders, directory, {
    type: "tui.prompt.append",
    properties: { text: job.prompt },
  }).catch((e: unknown) => {
    log(`ERROR tui.prompt.append: ${e}`);
    throw e;
  });

  if (!appendRes.ok) {
    const body = await appendRes.text().catch(() => "");
    log(`ERROR tui.prompt.append HTTP ${appendRes.status}: ${body.slice(0, 200)}`);
    throw new Error(`HTTP ${appendRes.status}`);
  }

  log(`tui.prompt.append OK ${appendRes.status}, submitting...`);

  const submitRes = await tuiPublish(serverUrl, authHeaders, directory, {
    type: "tui.command.execute",
    properties: { command: "prompt.submit" },
  }).catch((e: unknown) => {
    log(`ERROR tui.command.execute: ${e}`);
    throw e;
  });

  if (!submitRes.ok) {
    const body = await submitRes.text().catch(() => "");
    log(`ERROR tui.command.execute HTTP ${submitRes.status}: ${body.slice(0, 200)}`);
    throw new Error(`HTTP ${submitRes.status}`);
  }

  log(`SUCCESS prompt submitted HTTP ${submitRes.status}`);

  if (!job.recurring) {
    await unregisterTimer(job.id);
    await deleteJob(job.id);
  }
}
