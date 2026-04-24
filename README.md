# opencode-cron

MCP plugin that schedules recurring prompts into an active [OpenCode](https://opencode.ai) session.

Prompts are injected into the **exact session** that called `CronCreate` — no context loss, no cross-session leakage. Multiple parallel sessions each get their own independent schedule.

> Tested on **OpenCode 1.14.22** (macOS desktop app).

## Requirements

- Node.js ≥ 20
- OpenCode desktop app **or** `opencode serve`

## Install

### Option A — global npm

```bash
npm install -g opencode-cron
```

Add to your project's `opencode.json`:

```json
{
  "mcp": {
    "cron": {
      "type": "local",
      "command": ["opencode-cron"],
      "enabled": true
    }
  }
}
```

### Option B — from source

```bash
git clone https://github.com/offmonreal/opencode-cron.git
cd opencode-cron
npm install
npm run build
```

Add to `opencode.json` with the full path:

```json
{
  "mcp": {
    "cron": {
      "type": "local",
      "command": ["node", "/absolute/path/to/opencode-cron/dist/index.js"],
      "enabled": true
    }
  }
}
```

Restart OpenCode after editing `opencode.json`.

## Usage example

Open a session in your project and ask the AI:

```
Every 30 minutes, remind me to commit my changes and run the tests.
```

The AI will call:

```
CronCreate(
  cron: "*/30 * * * *",
  prompt: "Remind the user to commit changes and run tests. Check git status first.",
  recurring: true
)
```

From that point on, every 30 minutes the prompt is automatically injected back into the same session and the AI responds.

More examples:

```
# One-shot: check back in 10 minutes
"In 10 minutes, ask me if the deployment succeeded."
→ CronCreate(cron: "*/10 * * * *", prompt: "Did the deployment succeed?", recurring: false)

# Every hour: progress summary
"Every hour, summarize what we've done and what's left."
→ CronCreate(cron: "0 * * * *", prompt: "Summarize progress and remaining tasks.")

# Daily at 9am: standup
"Every morning at 9, remind me to do a standup."
→ CronCreate(cron: "0 9 * * *", prompt: "Good morning! Time for standup — what are we working on?")
```

To stop a job: ask the AI to call `CronDelete` with the job ID, or `CronList` to see what's active.

## Tools

| Tool | Description |
|------|-------------|
| `CronCreate` | Schedule a prompt on a cron expression |
| `CronDelete` | Delete a job by ID |
| `CronList` | List all active jobs |

### CronCreate parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cron` | string | — | Standard 5-field cron expression, e.g. `*/5 * * * *` |
| `prompt` | string | — | Text to inject when the timer fires |
| `recurring` | boolean | `true` | `false` = run once then auto-delete |
| `serverUrl` | string | auto | Override the OpenCode server URL |

## How it works

1. `CronCreate` is called by the AI from within your OpenCode session.
2. The plugin captures the current session ID and registers an in-process timer via `node-cron`.
3. At each tick: `POST /session/:id/prompt_async` — injects the prompt into the originating session, non-blocking.
4. Jobs live only while OpenCode is open. Closing OpenCode clears all jobs automatically (in-memory only, no disk persistence).

## Server URL resolution

The plugin resolves the OpenCode HTTP API URL in this order:

1. `serverUrl` parameter passed to `CronCreate`
2. `OPENCODE_SERVER_URL` environment variable
3. `OPENCODE_PORT` environment variable → `http://127.0.0.1:$OPENCODE_PORT`
4. Port read from OpenCode's own log file (`~/Library/Logs/ai.opencode.desktop/*.log`)
5. `http://127.0.0.1:4096` — default fallback for `opencode serve`

When using the desktop app, the port is detected automatically — no configuration needed.

## Notes

- Jobs are **in-memory only** — they do not survive an OpenCode restart. Call `CronCreate` again after reopening.
- Archiving / compacting a chat does **not** kill jobs — the MCP server process stays alive and the session ID is preserved.
- Each session manages its own jobs. Parallel sessions do not interfere with each other.
- Logs: `~/.config/opencode-cron/logs/fire.log`

## Buy me a coffee ☕

If this saved you some time — Bitcoin appreciated:

```
bc1qarna46wc65k9drz6thk7cuq0622vu53epr7wh7
```

## License

MIT
