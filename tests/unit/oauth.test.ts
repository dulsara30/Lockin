import { describe, it, expect } from 'vitest';
import {
  authorizationServerMetadata,
  hashToken,
  isEmailAllowed,
  isValidRedirectUri,
  parseAllowedEmails,
  parseAuthorizeRequest,
  parseScopes,
  pkceChallengeFor,
  protectedResourceMetadata,
  randomToken,
  redirectUriMatches,
  scopeAllowsTier,
  scopesForLevel,
  verifyPkce,
  wwwAuthenticate,
} from '@/lib/oauth/core';
import { getBaseUrl } from '@/lib/oauth/base-url';

const BASE = 'https://lockin.example.com';
const verifier = 'v'.repeat(50);
const challenge = pkceChallengeFor(verifier);

describe('PKCE', () => {
  it('accepts the matching S256 verifier only', () => {
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce('w'.repeat(50), challenge)).toBe(false);
    expect(verifyPkce('short', challenge)).toBe(false);
    expect(verifyPkce(verifier, 'not-a-challenge')).toBe(false);
  });

  it('matches the RFC 7636 example vector', () => {
    expect(pkceChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });
});

describe('tokens', () => {
  it('are unguessable, prefixed and stored only as hashes', () => {
    const a = randomToken('lat');
    const b = randomToken('lat');
    expect(a).not.toBe(b);
    expect(a.startsWith('lat_')).toBe(true);
    expect(a.length).toBeGreaterThan(40);
    expect(hashToken(a)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
});

describe('scopes', () => {
  it('defaults to read and ignores unknown scopes', () => {
    expect(parseScopes('')).toEqual(['mcp:read']);
    expect(parseScopes('admin root')).toEqual(['mcp:read']);
    expect(parseScopes('mcp:write mcp:write')).toEqual(['mcp:write']);
  });

  it('each level includes the lower ones', () => {
    expect(scopesForLevel('write')).toEqual(['mcp:read', 'mcp:write']);
    expect(scopeAllowsTier(scopesForLevel('read'), 'write')).toBe(false);
    expect(scopeAllowsTier(scopesForLevel('write'), 'write')).toBe(true);
    expect(scopeAllowsTier(scopesForLevel('write'), 'critical')).toBe(false);
    expect(scopeAllowsTier(scopesForLevel('critical'), 'critical')).toBe(true);
    expect(scopeAllowsTier([], 'read')).toBe(false);
  });
});

describe('redirect URIs', () => {
  it('allows https and loopback http only', () => {
    expect(isValidRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(isValidRedirectUri('http://localhost:8123/callback')).toBe(true);
    expect(isValidRedirectUri('http://127.0.0.1:9/cb')).toBe(true);
    expect(isValidRedirectUri('http://evil.com/cb')).toBe(false);
    expect(isValidRedirectUri('javascript:alert(1)')).toBe(false);
    expect(isValidRedirectUri('https://a.com/cb#frag')).toBe(false);
    expect(isValidRedirectUri('https://user:pw@a.com/cb')).toBe(false);
    expect(isValidRedirectUri('nonsense')).toBe(false);
  });

  it('matches exactly, except loopback ports may vary', () => {
    const reg = ['https://claude.ai/cb', 'http://localhost:1111/callback'];
    expect(redirectUriMatches(reg, 'https://claude.ai/cb')).toBe(true);
    expect(redirectUriMatches(reg, 'https://claude.ai/cb2')).toBe(false);
    expect(redirectUriMatches(reg, 'https://claude.ai/cb?x=1')).toBe(false);
    expect(redirectUriMatches(reg, 'http://localhost:5555/callback')).toBe(true);
    expect(redirectUriMatches(reg, 'http://localhost:5555/other')).toBe(false);
    expect(redirectUriMatches(reg, 'http://127.0.0.1:5555/callback')).toBe(false);
  });
});

describe('allow-list', () => {
  it('is case-insensitive, trimmed and empty means nobody', () => {
    const list = parseAllowedEmails(' Me@Example.com , you@x.io ');
    expect(list).toEqual(['me@example.com', 'you@x.io']);
    expect(isEmailAllowed('ME@example.COM', list)).toBe(true);
    expect(isEmailAllowed('other@x.io', list)).toBe(false);
    expect(isEmailAllowed(null, list)).toBe(false);
    expect(isEmailAllowed('me@example.com', parseAllowedEmails(undefined))).toBe(false);
  });
});

describe('authorize request parsing', () => {
  const ok = {
    response_type: 'code',
    client_id: 'c1',
    redirect_uri: 'https://claude.ai/cb',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
  };

  it('accepts a valid request', () => {
    const r = parseAuthorizeRequest(ok, BASE);
    expect(r.ok).toBe(true);
  });

  it('requires PKCE S256 and the code response type', () => {
    expect(parseAuthorizeRequest({ ...ok, code_challenge_method: 'plain' }, BASE).ok).toBe(false);
    expect(parseAuthorizeRequest({ ...ok, code_challenge: undefined }, BASE).ok).toBe(false);
    expect(parseAuthorizeRequest({ ...ok, response_type: 'token' }, BASE).ok).toBe(false);
    expect(parseAuthorizeRequest({ ...ok, client_id: undefined }, BASE).ok).toBe(false);
  });

  it('binds to this server resource (audience)', () => {
    expect(parseAuthorizeRequest({ ...ok, resource: `${BASE}/api/mcp` }, BASE).ok).toBe(true);
    expect(parseAuthorizeRequest({ ...ok, resource: 'https://other.com/api/mcp' }, BASE).ok).toBe(
      false
    );
  });
});

describe('metadata', () => {
  it('advertises PKCE-only public-client OAuth', () => {
    const m = authorizationServerMetadata(BASE);
    expect(m.issuer).toBe(BASE);
    expect(m.code_challenge_methods_supported).toEqual(['S256']);
    expect(m.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(m.registration_endpoint).toBe(`${BASE}/api/oauth/register`);
    expect(protectedResourceMetadata(BASE).resource).toBe(`${BASE}/api/mcp`);
    expect(wwwAuthenticate(BASE)).toContain(
      `resource_metadata="${BASE}/.well-known/oauth-protected-resource/api/mcp"`
    );
    expect(wwwAuthenticate(BASE, 'invalid_token')).toContain('error="invalid_token"');
  });

  it('derives the base url from config or forwarded headers', () => {
    expect(getBaseUrl(new Headers(), 'https://x.com/')).toBe('https://x.com');
    const h = new Headers({ 'x-forwarded-host': 'app.com', 'x-forwarded-proto': 'https' });
    expect(getBaseUrl(h)).toBe('https://app.com');
    expect(getBaseUrl(new Headers({ host: 'localhost:3000' }))).toBe('http://localhost:3000');
  });
});
