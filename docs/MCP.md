# Lockin MCP server

A private remote [MCP](https://modelcontextprotocol.io) server that lets Claude plan and manage your Lockin workspace. It ships in the same Next.js / Vercel deployment at `POST /api/mcp` (Streamable HTTP, stateless, JSON responses). There is nothing extra to deploy.

## Enable it

Set these in `.env.local` and in Vercel (Production), then redeploy:

| Variable              | Required | Description                                                                        |
| --------------------- | -------- | ---------------------------------------------------------------------------------- |
| `MCP_SECRET_KEY`      | yes      | Bearer secret, **at least 32 characters**. Generate with `openssl rand -hex 32`.   |
| `MCP_USER_EMAIL`      | yes      | Email of the Lockin account MCP acts as. It gets exactly that user's permissions.  |
| `MCP_ALLOWED_ORIGINS` | no       | Comma-separated browser origins allowed to call MCP. CLI clients send no `Origin`. |

If either required variable is missing the endpoint returns `404`, so it is off by default.

## Connect Claude

Claude Code:

```bash
claude mcp add --transport http lockin https://YOUR-DOMAIN/api/mcp --header "Authorization: Bearer YOUR_MCP_SECRET_KEY"
```

Claude Desktop (`claude_desktop_config.json`, uses the `mcp-remote` bridge):

```json
{
  "mcpServers": {
    "lockin": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://YOUR-DOMAIN/api/mcp",
        "--header",
        "Authorization:${LOCKIN_MCP_AUTH}"
      ],
      "env": { "LOCKIN_MCP_AUTH": "Bearer YOUR_MCP_SECRET_KEY" }
    }
  }
}
```

Note: claude.ai web "custom connectors" require OAuth, which this static-key server does not implement.

## What it can do

Everything goes through the same access layer as the web UI (owner / editor / viewer), so MCP can never exceed what that user can do in the app.

- **Read (36 tools total):** `whoami`, `list_missions`, `get_mission`, `get_runway`, `get_day`, `get_step`, `get_today`, `get_insights`, `list_members`, `list_templates`, `get_settings`, `get_ai_usage`, `export_runway` (json, md, csv, xlsx, pdf), `parse_template`.
- **AI (uses your daily AI quota, preview only):** `generate_plan`, `replan_preview`.
- **Write:** `create_mission`, `update_mission`, `create_runway`, `create_step`, `update_step`, `move_step`, `rollover_steps`, `start_day`, `switch_active_runway`, `log_time`, `save_plan`, `apply_replan`, `deploy_template`, `save_mission_as_template`.
- **Critical (ask first):** `delete_step`, `delete_runway`, `archive_mission`, `add_member`, `update_member_role`, `remove_member`.

### Ask-first for critical tools (enforced by the server)

A critical call without a token never executes. It returns a preview of the exact impact plus a signed confirmation token bound to the tool, the exact arguments and the user (5 minute expiry, single use). Claude must show the preview, get your approval, then repeat the identical call with `confirmToken`. Critical tools are also annotated `destructiveHint`, so clients prompt too.

### Deliberately not available

Deleting missions, deleting or disabling users or accounts, passwords, sessions, API-key (BYOK) management, whole-account data export, and any raw database access or schema change.

## Security model

- Static bearer secret compared in constant time; failures are throttled per IP and never say why.
- Rate limit of 120 requests/minute per IP, 256 KB body limit, strict JSON-RPC and Zod validation of every tool input.
- `Origin` check (DNS-rebinding protection); no CORS headers are sent.
- Every call is written to an audit trail (`mcpaudits`, 90-day TTL) with redacted arguments, status and IP.
- Internal errors are never returned to the client; only deliberate messages are.
- Mission content is untrusted data. The server instructions tell the model not to follow commands found inside steps or notes, and critical actions need your confirmation regardless.
- Rotate by changing `MCP_SECRET_KEY` and redeploying. Revoke instantly by unsetting it.
