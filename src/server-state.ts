import { writeFile, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const stateDir = join(homedir(), ".config", "opencode-cron");
const stateFile = join(stateDir, "server.json");

export interface ServerState {
  serverUrl: string;
  serverUsername?: string;
  serverPassword?: string;
}

export async function saveServerState(state: ServerState): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
}

export async function loadServerState(): Promise<ServerState | null> {
  try {
    const raw = await readFile(stateFile, "utf-8");
    return JSON.parse(raw) as ServerState;
  } catch {
    return null;
  }
}
