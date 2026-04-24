#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { findCurrentSession, resolveServerUrl } from "./session.js";
import { createJob, deleteJob, listJobs } from "./storage.js";
import { registerTimer, unregisterTimer } from "./scheduler.js";
import { saveServerState } from "./server-state.js";
import { appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const logDir = join(homedir(), ".config", "opencode-cron", "logs");
mkdirSync(logDir, { recursive: true });
function log(msg: string) {
  const line = `[${new Date().toISOString()}] [index] ${msg}\n`;
  process.stderr.write(line);
  try { appendFileSync(join(logDir, "fire.log"), line); } catch {}
}

log(`STARTUP cwd=${process.cwd()}`);

// Capture server URL and credentials at startup.
// OpenCode sets OPENCODE_SERVER_USERNAME / OPENCODE_SERVER_PASSWORD in env when spawning MCP servers.
// Port is detected from OpenCode's own log file (see session.ts: findPortFromLog).
saveServerState({
  serverUrl: resolveServerUrl(),
  serverUsername: process.env.OPENCODE_SERVER_USERNAME,
  serverPassword: process.env.OPENCODE_SERVER_PASSWORD,
});

// No job restore on startup — jobs are in-memory only.
// When OpenCode restarts, old jobs are intentionally dropped.
// The user must call CronCreate again to re-schedule.

const server = new McpServer({ name: "opencode-cron", version: "1.0.0" });

server.tool(
  "CronCreate",
  "Schedule a recurring prompt to be injected into the current OpenCode session",
  {
    cron: z.string().describe("Cron expression, e.g. */5 * * * *"),
    prompt: z.string().describe("Prompt text to inject when timer fires"),
    serverUrl: z.string().optional().describe("OpenCode server URL (default: http://localhost:4096)"),
  },
  async ({ cron, prompt, serverUrl }) => {
    log(`CronCreate called cron="${cron}" cwd=${process.cwd()}`);
    try {
      const url = resolveServerUrl(serverUrl);
      // Pass cwd as directory so GET /session?directory=... returns only sessions
      // for THIS workspace, not sessions from other workspaces.
      const sessionId = await findCurrentSession(url, process.cwd());
      const serverUsername = process.env.OPENCODE_SERVER_USERNAME;
      const serverPassword = process.env.OPENCODE_SERVER_PASSWORD;
      const job = createJob({ cron, prompt, sessionId, serverUrl: url, serverUsername, serverPassword, recurring: true, workspaceDir: process.cwd() });
      registerTimer(job);
      log(`CronCreate OK jobId=${job.id}`);
      return {
        content: [{ type: "text", text: `Job ${job.id} created. Cron: ${cron}. Fires every tick until stopped. To stop: call CronDelete with jobId="${job.id}".` }],
      };
    } catch (e: unknown) {
      log(`CronCreate ERROR: ${e}`);
      throw e;
    }
  }
);

server.tool(
  "CronDelete",
  "Delete a scheduled cron job",
  { jobId: z.string().describe("Job ID to delete") },
  async ({ jobId }) => {
    unregisterTimer(jobId);
    deleteJob(jobId);
    return { content: [{ type: "text", text: `Job ${jobId} deleted.` }] };
  }
);

server.tool(
  "CronList",
  "List all scheduled cron jobs",
  {},
  async () => {
    const jobs = listJobs();
    const text = jobs.length === 0
      ? "No scheduled jobs."
      : jobs.map(j => `${j.id}  ${j.cron}  session:${j.sessionId}  ${j.recurring ? "recurring" : "once"}`).join("\n");
    return { content: [{ type: "text", text }] };
  }
);

await server.connect(new StdioServerTransport());
