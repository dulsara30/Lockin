import crypto from 'crypto';

/**
 * Pure OAuth 2.1 helpers for the MCP authorization flow (no DB, unit tested).
 * Lockin acts as both the authorization server and the protected resource.
 */

// ------------------------------------------------------------------ scopes
export const SCOPES = ['mcp:read', 'mcp:write', 'mcp:critical'] as const;
export type Scope = (typeof SCOPES)[number];
export type ToolTierName = 'read' | 'write' | 'critical';

/** Granting a level includes every lower level. */
const LEVEL: Record<Scope, number> = { 'mcp:read': 1, 'mcp:write': 2, 'mcp:critical': 3 };
const TIER_LEVEL: Record<ToolTierName, number> = { read: 1, write: 2, critical: 3 };

export function parseScopes(raw: string | null | undefined): Scope[] {
  const wanted = (raw || '').split(/\s+/).filter(Boolean);
  const valid = wanted.filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
  return valid.length ? Array.from(new Set(valid)) : ['mcp:read'];
}

export function highestLevel(scopes: readonly string[]): number {
  return Math.max(0, ...scopes.map((s) => LEVEL[s as Scope] ?? 0));
}

export function scopeAllowsTier(scopes: readonly string[], tier: ToolTierName): boolean {
  return highestLevel(scopes) >= TIER_LEVEL[tier];
}

/** Normalizes a chosen level into the canonical scope list ("critical" => all three). */
export function scopesForLevel(level: 'read' | 'write' | 'critical'): Scope[] {
  const max = TIER_LEVEL[level];
  return SCOPES.filter((s) => LEVEL[s] <= max);
}

// ------------------------------------------------------------------ tokens
export function randomToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
export const AUTH_CODE_TTL_SEC = 60;

// -------------------------------------------------------------------- PKCE
const VERIFIER_RE = /^[A-Za-z0-9\-._~]{43,128}$/;
const CHALLENGE_RE = /^[A-Za-z0-9\-_]{43}$/;

export const isValidChallenge = (c: string) => CHALLENGE_RE.test(c);
export const isValidVerifier = (v: string) => VERIFIER_RE.test(v);

export function pkceChallengeFor(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!isValidVerifier(verifier) || !isValidChallenge(challenge)) return false;
  const a = Buffer.from(pkceChallengeFor(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ------------------------------------------------------------ redirect URIs
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/** https anywhere, or http only on loopback (native clients such as CLI tools). */
export function isValidRedirectUri(uri: string): boolean {
  if (typeof uri !== 'string' || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && LOOPBACK.has(u.hostname);
}

/**
 * Exact match, except loopback redirects may vary the port (RFC 8252 section 7.3),
 * because CLI clients pick an ephemeral port per login.
 */
export function redirectUriMatches(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  try {
    const r = new URL(requested);
    if (r.protocol !== 'http:' || !LOOPBACK.has(r.hostname)) return false;
    return registered.some((reg) => {
      const u = new URL(reg);
      return (
        u.protocol === 'http:' &&
        u.hostname === r.hostname &&
        u.pathname === r.pathname &&
        u.search === r.search
      );
    });
  } catch {
    return false;
  }
}

// --------------------------------------------------------------- allow-list
export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined, allowed: string[]): boolean {
  return !!email && allowed.includes(email.trim().toLowerCase());
}

// ---------------------------------------------------------------- metadata
export function resourceUrl(base: string) {
  return `${base}/api/mcp`;
}

export function protectedResourceMetadata(base: string) {
  return {
    resource: resourceUrl(base),
    authorization_servers: [base],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Lockin',
  };
}

export function authorizationServerMetadata(base: string) {
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [...SCOPES],
  };
}

export function wwwAuthenticate(base: string, error?: 'invalid_token' | 'insufficient_scope') {
  const meta = `${base}/.well-known/oauth-protected-resource/api/mcp`;
  return `Bearer resource_metadata="${meta}"${error ? `, error="${error}"` : ''}`;
}

// ------------------------------------------------- authorize request parsing
export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: Scope[];
  resource?: string;
}

export type AuthorizeParseResult =
  { ok: true; params: AuthorizeParams } | { ok: false; error: string; description: string };

/**
 * Validates the non-client-bound parts of an authorization request.
 * client_id / redirect_uri registration checks happen separately against the registry.
 */
export function parseAuthorizeRequest(
  q: Record<string, string | string[] | undefined>,
  base: string
): AuthorizeParseResult {
  const one = (k: string) => (Array.isArray(q[k]) ? q[k]![0] : (q[k] as string | undefined));
  const clientId = one('client_id');
  const redirectUri = one('redirect_uri');
  if (!clientId || !redirectUri) {
    return { ok: false, error: 'invalid_request', description: 'Missing client or redirect.' };
  }
  if (one('response_type') !== 'code') {
    return {
      ok: false,
      error: 'unsupported_response_type',
      description: 'Only code is supported.',
    };
  }
  const challenge = one('code_challenge');
  if (!challenge || one('code_challenge_method') !== 'S256' || !isValidChallenge(challenge)) {
    return { ok: false, error: 'invalid_request', description: 'PKCE (S256) is required.' };
  }
  const resource = one('resource');
  if (resource && resource.replace(/\/$/, '') !== resourceUrl(base)) {
    return { ok: false, error: 'invalid_target', description: 'Unknown resource.' };
  }
  const state = one('state');
  if (state && state.length > 512) {
    return { ok: false, error: 'invalid_request', description: 'State too long.' };
  }
  return {
    ok: true,
    params: {
      clientId,
      redirectUri,
      codeChallenge: challenge,
      state,
      scopes: parseScopes(one('scope')),
      resource,
    },
  };
}
