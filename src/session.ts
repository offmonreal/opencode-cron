interface Session {
  id: string;
  parentID?: string;
  updatedAt: number;
}

export async function findCurrentSession(serverUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${serverUrl}/session`);
  } catch {
    throw new Error(
      `OpenCode HTTP server is not running at ${serverUrl}.\n` +
      `This plugin requires OpenCode to run in server mode.\n` +
      `Start it with: opencode serve\n` +
      `Then open your project and try again.`
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
