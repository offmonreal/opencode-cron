import { readdirSync, readFileSync } from "fs";
import { join } from "path";

interface Session {
  id: string;
  parentID?: string;
  time: {
    created: number;
    updated: number;
  };
}

// OpenCode writes the sidecar port to its own log file on each launch.
// We read it here because the port is dynamic (no fixed port by default).
// The log file path is ~/Library/Logs/ai.opencode.desktop/*.log.
function findPortFromLog(): string | null {
  const logDir = join(process.env.HOME ?? "", "Library/Logs/ai.opencode.desktop");
  let files: string[];
  try {
    files = readdirSync(logDir)
      .filter(f => f.endsWith(".log"))
      .sort()
      .reverse();
  } catch {
    return null;
  }
  for (const file of files) {
    try {
      const content = readFileSync(join(logDir, file), "utf8");
      const matches = [...content.matchAll(/Spawning sidecar port=(\d+)/g)];
      if (matches.length > 0) {
        return matches[matches.length - 1][1];
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function resolveServerUrl(override?: string): string {
  if (override) return override;
  if (process.env.OPENCODE_SERVER_URL) return process.env.OPENCODE_SERVER_URL;
  if (process.env.OPENCODE_PORT) return `http://127.0.0.1:${process.env.OPENCODE_PORT}`;
  const port = findPortFromLog();
  if (port) return `http://127.0.0.1:${port}`;
  return "http://127.0.0.1:4096";
}

export function makeAuthHeaders(): HeadersInit {
  const username = process.env.OPENCODE_SERVER_USERNAME ?? "";
  const password = process.env.OPENCODE_SERVER_PASSWORD ?? "";
  if (!username && !password) return {};
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

// IMPORTANT: always pass `directory` when calling from a known workspace.
// Without it, GET /session returns only a subset of sessions (apparently limited
// to ~18 from other workspaces), and the current workspace sessions are missing.
// With ?directory=..., OpenCode filters to sessions for that exact workspace path.
// Pick the most-recently-updated non-child session — that's the one the user is looking at.
export async function findCurrentSession(serverUrl: string, directory?: string): Promise<string> {
  const url = directory
    ? `${serverUrl}/session?directory=${encodeURIComponent(directory)}`
    : `${serverUrl}/session`;
  let res: Response;
  try {
    res = await fetch(url, { headers: makeAuthHeaders() });
  } catch {
    const port = findPortFromLog();
    const hint = port
      ? `Found sidecar port ${port} in logs — maybe OpenCode was restarted? Try again.`
      : `Could not auto-detect port. Set OPENCODE_SERVER_URL env var or pass serverUrl to CronCreate.`;
    throw new Error(`Cannot reach OpenCode server at ${serverUrl}.\n${hint}`);
  }
  if (!res.ok) throw new Error(`OpenCode server error at ${serverUrl}: ${res.status}`);
  const sessions: Session[] = await res.json();
  const sorted = sessions
    .filter(s => !s.parentID)
    .sort((a, b) => b.time.updated - a.time.updated);
  if (sorted.length === 0) throw new Error("No active session found");
  return sorted[0].id;
}
