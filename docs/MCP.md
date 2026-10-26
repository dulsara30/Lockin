# Lockin MCP server

A private remote [MCP](https://modelcontextprotocol.io) server that lets Claude plan and manage your Lockin workspace. It ships in the same Next.js / Vercel deployment at `POST /api/mcp` (Streamable HTTP, stateless, JSON responses). Lockin is also its own OAuth 2.1 server, so you connect by signing in to Lockin (Google or password) and pressing Allow. There are no keys to copy.

## Your setup checklist

1. **Env vars** (`.env.local` and Vercel, Production), then redeploy:

   | Variable             | Required | Description                                                                                               |
   | -------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
   | `MCP_ALLOWED_EMAILS` | yes      | Comma-separated Lockin account emails allowed to connect, e.g. `you@gmail.com`. Empty = MCP is off (404). |
   | `NEXTAUTH_URL`       | yes      | Your production URL, e.g. `https://lockin.vercel.app` (no trailing slash). It becomes the OAuth issuer.   |

   `AUTH_SECRET`, `GOOGLE` credentials and the database are already configured. Nothing else is needed. The old `MCP_SECRET_KEY` and `MCP_USER_EMAIL` variables are no longer used and can be deleted.

2. **Sign in once** at your Lockin site with the account listed in `MCP_ALLOWED_EMAILS` (Google works).
3. **Add the connector in Claude** (below).

## Add Lockin to Claude

**Claude.ai / Claude Desktop (custom connector)**

1. Settings -> Connectors -> Add custom connector.
2. Name: `Lockin`. URL: `https://YOUR-DOMAIN/api/mcp`. Leave any OAuth client ID/secret fields empty (Lockin registers the client automatically).
3. Click Connect. A Lockin window opens: sign in (Google or email), choose the access level, press **Allow access**.
4. In a chat, enable the Lockin connector from the tools menu and try "What's on my plate today?".

**Claude Code**

```bash
claude mcp add --transport http lockin https://YOUR-DOMAIN/api/mcp
```

Then run `/mcp` inside Claude Code, pick `lockin` and choose Authenticate. A browser opens for the same sign-in and consent.

Connector UIs change between releases. If a field name differs, the URL above is the only thing you must provide.

## Access levels (you choose on the consent screen)

| Level        | Tools                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Read only    | Missions, runways, days, steps, today, insights, members, templates, settings, exports, parsing.     |
| Read & write | Also create/edit missions, runways and steps, AI planning, save plans, log time, templates.          |
| Full access  | Also delete steps and runways, archive missions and manage sharing (each still needs your approval). |

Tools above the granted level are hidden from Claude entirely. Everything goes through the same owner / editor / viewer checks as the web app, so MCP can never exceed what your account can do in the UI.

### Ask-first for critical tools (enforced by the server)

`delete_step`, `delete_runway`, `archive_mission`, `add_member`, `update_member_role` and `remove_member` never run on the first call. The first call returns a preview of the exact impact and a signed single-use token bound to that exact call (5 minute expiry). Claude must show you the preview, get your approval, then repeat the call with the token.

### Deliberately not available

Deleting missions, deleting or disabling users or accounts, passwords, sessions, API-key (BYOK) management, whole-account data export, and any raw database access or schema change.

## Managing and revoking access

Settings -> **Connected apps** lists every connected client with its access level and last use. **Disconnect** revokes its tokens immediately. Removing an email from `MCP_ALLOWED_EMAILS` blocks that account on the very next request, even with a valid token.

## Security model

- **OAuth 2.1 for public clients:** authorization code + mandatory PKCE (S256), exact redirect URI matching (https, or loopback http for CLI tools), 60 second single-use codes, dynamic client registration (rate-limited, public clients only).
- **Tokens:** random 256-bit values stored only as SHA-256 hashes. Access tokens last 1 hour and are bound to this server (audience). Refresh tokens last 30 days and rotate on every use; reusing an old refresh token revokes the whole grant.
- **Sign-in reuses Lockin:** the consent screen requires a normal Lockin session (Google or password) and an allow-listed email. The decision is re-validated server-side; the form is not trusted.
- Rate limits on registration, token, revoke and MCP calls. Failed token attempts are throttled per IP and never say why.
- `Origin` check (DNS-rebinding protection), no CORS on MCP, 256 KB body limit, strict JSON-RPC and Zod validation of every tool input.
- Every tool call is audited (`mcpaudits`, 90-day TTL) with redacted arguments, client, status and IP.
- Internal errors are never returned to the client. Mission content is treated as untrusted data, and critical actions need your confirmation regardless.

## Endpoints

`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `POST /api/oauth/register`, `GET /oauth/authorize`, `POST /api/oauth/token`, `POST /api/oauth/revoke`, `POST /api/mcp`.
