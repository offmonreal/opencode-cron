# opencode-cron

MCP tool that schedules recurring prompts into an active OpenCode session.

Unlike `opencode-scheduler`, this injects prompts into the **same existing session** via the OpenCode HTTP API — no new process, no cold start, no lost context.

## Requirements

- Node.js ≥ 20
- OpenCode desktop app **or** `opencode serve`

## How the server URL is resolved

The plugin resolves the OpenCode HTTP API URL in this order:

1. `serverUrl` parameter passed to `CronCreate`
2. `OPENCODE_SERVER_URL` environment variable
3. `http://127.0.0.1:$OPENCODE_PORT` — the desktop app sets `OPENCODE_PORT` automatically
4. `http://127.0.0.1:4096` — default fallback for `opencode serve`

The desktop app starts its own embedded HTTP server on a dynamic port and sets `OPENCODE_PORT`. Since MCP servers are subprocesses of OpenCode, they inherit this variable automatically — no manual configuration needed.

## Install

```bash
npm install -g opencode-cron
```

Add to `opencode.json`:

```json
{
  "mcp": {
    "cron": {
      "type": "local",
      "command": ["opencode-cron"]
    }
  }
}
```

Or without global install, point directly to the built file:

```json
{
  "mcp": {
    "cron": {
      "type": "local",
      "command": ["node", "/path/to/opencode-cron/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `CronCreate` | Schedule a recurring prompt |
| `CronDelete` | Delete a job by ID |
| `CronList` | List all jobs |

### CronCreate

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cron` | string | — | Cron expression, e.g. `*/5 * * * *` |
| `prompt` | string | — | Text to inject when timer fires |
| `recurring` | boolean | `true` | `false` = run once then delete |
| `serverUrl` | string | auto | Override OpenCode server URL |

## How it works

1. `CronCreate` resolves the OpenCode server URL and calls `GET /session` to find the current active session
2. Registers a crontab entry pointing to the fire script
3. At each tick: `POST /session/:id/prompt_async` — non-blocking inject into the session

Jobs are stored in `~/.config/opencode-cron/jobs/`. Logs in `~/.config/opencode-cron/logs/`.

## Build from source

```bash
npm install
npm run build
```

## License

MIT
