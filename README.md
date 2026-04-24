# opencode-cron

MCP tool that schedules recurring prompts into an active OpenCode session.

Unlike `opencode-scheduler`, this injects prompts into the **same existing session** via the OpenCode HTTP API — no new process, no cold start, no lost context.

## Requirements

- Node.js ≥ 20
- `opencode serve` running (port 4096 by default)

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
      "command": "opencode-cron"
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
| `serverUrl` | string | `http://localhost:4096` | OpenCode server URL |

## How it works

1. `CronCreate` calls `GET /session` to find the current active session
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
