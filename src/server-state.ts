// Server URL and credentials are kept in memory only.
// They are set once at MCP server startup from environment variables / log detection
// and reused by fire.ts for every job firing.
// No disk persistence needed — if OpenCode restarts, the MCP server restarts too
// and picks up fresh values from the environment.

export interface ServerState {
  serverUrl: string;
  serverUsername?: string;
  serverPassword?: string;
}

let state: ServerState | null = null;

export function saveServerState(s: ServerState): void {
  state = s;
}

export function loadServerState(): ServerState | null {
  return state;
}
