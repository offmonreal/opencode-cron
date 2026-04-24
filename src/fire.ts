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

export async function fireJob(jobId: string): Promise<void> {
  log(`START jobId=${jobId}`);

  const job = getJob(jobId);
  log(`job loaded: cron=${job.cron} workspaceDir=${job.workspaceDir ?? "none"}`);

  // Server state is set at startup from env vars / log detection.
  // Falls back to values stored in the job at CronCreate time (shouldn't be needed
  // since server state is always set, but kept as safety net).
  const state = loadServerState();
  const serverUrl = state?.serverUrl ?? job.serverUrl;
  const serverUsername = state?.serverUsername ?? job.serverUsername;
  const serverPassword = state?.serverPassword ?? job.serverPassword;

  log(`serverUrl=${serverUrl}`);

  const authHeaders: Record<string, string> = {};
  if (serverUsername || serverPassword) {
    const encoded = Buffer.from(`${serverUsername ?? ""}:${serverPassword ?? ""}`).toString("base64");
    authHeaders["Authorization"] = `Basic ${encoded}`;
  }

  // Use the exact session from which CronCreate was called.
  // Each agent has its own session — we must not redirect to another.
  const sessionId = job.sessionId;
  log(`using sessionId=${sessionId}`);

  // IMPORTANT: body must be { parts: [{type:"text", text}] }, NOT { text }.
  // The /session/{id}/prompt_async endpoint follows the OpenCode message part schema.
  // Sending { text } returns HTTP 400 "expected array, received undefined" for parts.
  const res = await fetch(`${serverUrl}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ parts: [{ type: "text", text: job.prompt }] }),
  }).catch((e: unknown) => {
    log(`ERROR prompt_async: ${e}`);
    throw e;
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    log(`ERROR prompt_async HTTP ${res.status}: ${body.slice(0, 200)}`);
    // Session gone — stop the job so it doesn't keep firing into the void.
    if (res.status === 404 || res.status === 410) {
      log(`Session ${sessionId} not found, stopping job ${jobId}`);
      unregisterTimer(jobId);
      deleteJob(jobId);
    }
    throw new Error(`HTTP ${res.status}`);
  }

  log(`SUCCESS HTTP ${res.status}`);

  if (!job.recurring) {
    unregisterTimer(job.id);
    deleteJob(job.id);
  }
}
