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

  const job = await getJob(jobId).catch((e: unknown) => {
    log(`ERROR loading job: ${e}`);
    throw e;
  });

  log(`job loaded: cron=${job.cron} workspaceDir=${job.workspaceDir ?? "none"}`);

  const state = await loadServerState();
  const serverUrl = state?.serverUrl ?? job.serverUrl;
  const serverUsername = state?.serverUsername ?? job.serverUsername;
  const serverPassword = state?.serverPassword ?? job.serverPassword;

  log(`serverUrl=${serverUrl} hasAuth=${!!(serverUsername || serverPassword)}`);

  const authHeaders: Record<string, string> = {};
  if (serverUsername || serverPassword) {
    const encoded = Buffer.from(`${serverUsername ?? ""}:${serverPassword ?? ""}`).toString("base64");
    authHeaders["Authorization"] = `Basic ${encoded}`;
  }

  const sessionRes = await fetch(`${serverUrl}/session`, { headers: authHeaders }).catch((e: unknown) => {
    log(`ERROR fetching sessions: ${e}`);
    return null;
  });

  let sessionId = job.sessionId;
  if (sessionRes?.ok) {
    const sessions: Array<{ id: string; directory?: string; parentID?: string; time: { updated: number } }> = await sessionRes.json();
    const roots = sessions.filter(s => !s.parentID).sort((a, b) => b.time.updated - a.time.updated);
    log(`sessions total=${sessions.length} roots=${roots.length}`);
    if (job.workspaceDir) {
      const match = roots.find(s => s.directory === job.workspaceDir);
      if (match) {
        log(`session matched by workspaceDir: ${match.id}`);
        sessionId = match.id;
      } else {
        log(`no session matched workspaceDir=${job.workspaceDir}, falling back to most recent`);
        sessionId = roots[0]?.id ?? job.sessionId;
      }
    } else {
      sessionId = roots[0]?.id ?? job.sessionId;
    }
    log(`using session: ${sessionId} dir=${roots.find(s => s.id === sessionId)?.directory ?? "unknown"}`);
  } else if (sessionRes) {
    log(`ERROR GET /session → HTTP ${sessionRes.status}`);
  }

  log(`POST /session/${sessionId}/prompt_async prompt="${job.prompt.slice(0, 60)}"`);

  const promptRes = await fetch(`${serverUrl}/session/${sessionId}/prompt_async`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders },
    body: JSON.stringify({ parts: [{ type: "text", text: job.prompt }] }),
  }).catch((e: unknown) => {
    log(`ERROR POST prompt_async: ${e}`);
    throw e;
  });

  if (!promptRes.ok) {
    const body = await promptRes.text().catch(() => "");
    log(`ERROR HTTP ${promptRes.status} ${promptRes.statusText}: ${body.slice(0, 200)}`);
    throw new Error(`HTTP ${promptRes.status}`);
  }

  log(`SUCCESS HTTP ${promptRes.status}`);

  if (!job.recurring) {
    await unregisterTimer(job.id);
    await deleteJob(job.id);
  }
}
