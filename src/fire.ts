#!/usr/bin/env node
import { getJob, deleteJob } from "./storage.js";
import { unregisterTimer } from "./scheduler.js";
import { loadServerState } from "./server-state.js";

const jobId = process.argv[2];
if (!jobId) {
  process.stderr.write("Usage: fire.js <jobId>\n");
  process.exit(1);
}

const job = await getJob(jobId);

// Prefer live server state (updated each time MCP server starts) over stale job values
const state = await loadServerState();
const serverUrl = state?.serverUrl ?? job.serverUrl;
const serverUsername = state?.serverUsername ?? job.serverUsername;
const serverPassword = state?.serverPassword ?? job.serverPassword;

const authHeaders: Record<string, string> = {};
if (serverUsername || serverPassword) {
  const encoded = Buffer.from(`${serverUsername ?? ""}:${serverPassword ?? ""}`).toString("base64");
  authHeaders["Authorization"] = `Basic ${encoded}`;
}

// Always resolve the current active session at fire time
async function getCurrentSessionId(): Promise<string> {
  const res = await fetch(`${serverUrl}/session`, { headers: authHeaders });
  if (!res.ok) return job.sessionId;
  const sessions: Array<{ id: string; parentID?: string; time: { updated: number } }> = await res.json();
  const sorted = sessions.filter(s => !s.parentID).sort((a, b) => b.time.updated - a.time.updated);
  return sorted[0]?.id ?? job.sessionId;
}

const sessionId = await getCurrentSessionId();

const res = await fetch(`${serverUrl}/session/${sessionId}/prompt_async`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...authHeaders },
  body: JSON.stringify({ parts: [{ type: "text", text: job.prompt }] }),
});

if (!res.ok) {
  process.stderr.write(`[opencode-cron] HTTP ${res.status}: ${res.statusText}\n`);
  process.exit(1);
}

if (!job.recurring) {
  await unregisterTimer(job.id);
  await deleteJob(job.id);
}
