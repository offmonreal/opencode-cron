#!/usr/bin/env node
import { getJob, deleteJob } from "./storage.js";
import { unregisterTimer } from "./scheduler.js";

const jobId = process.argv[2];
if (!jobId) {
  process.stderr.write("Usage: fire.js <jobId>\n");
  process.exit(1);
}

const job = await getJob(jobId);

const res = await fetch(`${job.serverUrl}/session/${job.sessionId}/prompt_async`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
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
