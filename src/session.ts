interface Session {
  id: string;
  parentID?: string;
  updatedAt: number;
}

export function resolveServerUrl(override?: string): string {
  if (override) return override;
  if (process.env.OPENCODE_SERVER_URL) return process.env.OPENCODE_SERVER_URL;
  const port = process.env.OPENCODE_PORT ?? "4096";
  return `http://127.0.0.1:${port}`;
}

export async function findCurrentSession(serverUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${serverUrl}/session`);
  } catch {
    throw new Error(
      `Cannot reach OpenCode server at ${serverUrl}.\n` +
      `The desktop app exposes the API on a dynamic port via OPENCODE_PORT env var.\n` +
      `Detected port: ${process.env.OPENCODE_PORT ?? "not set, using 4096"}.\n` +
      `Alternatively run: opencode serve`
    );
  }
  if (!res.ok) throw new Error(`OpenCode server error at ${serverUrl}: ${res.status}`);
  const sessions: Session[] = await res.json();
  const sorted = sessions
    .filter(s => !s.parentID)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (sorted.length === 0) throw new Error("No active session found");
  return sorted[0].id;
}
