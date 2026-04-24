interface Session {
  id: string;
  parentID?: string;
  updatedAt: number;
}

export async function findCurrentSession(serverUrl: string): Promise<string> {
  const res = await fetch(`${serverUrl}/session`);
  if (!res.ok) throw new Error(`Cannot reach OpenCode server at ${serverUrl} (${res.status})`);
  const sessions: Session[] = await res.json();
  const sorted = sessions
    .filter(s => !s.parentID)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  if (sorted.length === 0) throw new Error("No active session found");
  return sorted[0].id;
}
