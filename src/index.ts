#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { findCurrentSession, resolveServerUrl } from "./session.js";
import { createJob, deleteJob, listJobs } from "./storage.js";
import { registerTimer, unregisterTimer } from "./scheduler.js";
import { saveServerState } from "./server-state.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const firePath = join(__dirname, "fire.js");

// Save current session credentials so fire.ts can use them even after OpenCode restarts
await saveServerState({
  serverUrl: resolveServerUrl(),
  serverUsername: process.env.OPENCODE_SERVER_USERNAME,
  serverPassword: process.env.OPENCODE_SERVER_PASSWORD,
});

const server = new McpServer({ name: "opencode-cron", version: "1.0.0" });

server.tool(
  "CronCreate",
  "Schedule a recurring prompt to be injected into the current OpenCode session",
  {
    cron: z.string().describe("Cron expression, e.g. */5 * * * *"),
    prompt: z.string().describe("Prompt text to inject when timer fires"),
    recurring: z.boolean().optional().describe("Repeat on schedule (default: true). false = run once"),
    serverUrl: z.string().optional().describe("OpenCode server URL (default: http://localhost:4096)"),
  },
  async ({ cron, prompt, recurring = true, serverUrl }) => {
    const url = resolveServerUrl(serverUrl);
    const sessionId = await findCurrentSession(url);
    const serverUsername = process.env.OPENCODE_SERVER_USERNAME;
    const serverPassword = process.env.OPENCODE_SERVER_PASSWORD;
    const job = await createJob({ cron, prompt, sessionId, serverUrl: url, serverUsername, serverPassword, recurring, firePath, workspaceDir: process.cwd() });
    await registerTimer(job);
    return {
      content: [{ type: "text", text: `Job ${job.id} created. Cron: ${cron}. Session: ${sessionId}.` }],
    };
  }
);

server.tool(
  "CronDelete",
  "Delete a scheduled cron job",
  { jobId: z.string().describe("Job ID to delete") },
  async ({ jobId }) => {
    await unregisterTimer(jobId);
    await deleteJob(jobId);
    return { content: [{ type: "text", text: `Job ${jobId} deleted.` }] };
  }
);

server.tool(
  "CronList",
  "List all scheduled cron jobs",
  {},
  async () => {
    const jobs = await listJobs();
    const text = jobs.length === 0
      ? "No scheduled jobs."
      : jobs.map(j => `${j.id}  ${j.cron}  session:${j.sessionId}  ${j.recurring ? "recurring" : "once"}`).join("\n");
    return { content: [{ type: "text", text }] };
  }
);

await server.connect(new StdioServerTransport());
