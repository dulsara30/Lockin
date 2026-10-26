import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from '@/lib/mcp/schema';
import { signConfirmToken, verifyConfirmToken, CONFIRM_TTL_MS } from '@/lib/mcp/confirm';
import { bearerToken, originAllowed } from '@/lib/mcp/auth';
import { createMcpHandler, describeTool, ToolDef, ToolError } from '@/lib/mcp/protocol';
import { summarizeArgs } from '@/server/dal/mcp';
import { tools } from '@/server/mcp/tools';

const SECRET = 'x'.repeat(40);

describe('zodToJsonSchema', () => {
  it('maps the supported subset', () => {
    const s = zodToJsonSchema(
      z.object({
        a: z.string().min(2).max(5),
        b: z.number().int().min(1).max(9),
        c: z.enum(['x', 'y']).default('x'),
        d: z.array(z.string()).optional(),
        e: z.boolean(),
      })
    ) as { properties: Record<string, Record<string, unknown>>; required: string[] };
    expect(s.properties.a).toMatchObject({ type: 'string', minLength: 2, maxLength: 5 });
    expect(s.properties.b).toMatchObject({ type: 'integer', minimum: 1, maximum: 9 });
    expect(s.properties.c).toMatchObject({ enum: ['x', 'y'], default: 'x' });
    expect(s.required.sort()).toEqual(['a', 'b', 'e']);
  });
});

describe('confirmation tokens', () => {
  const args = { stepId: 'a'.repeat(24) };

  it('accepts the exact call once signed', () => {
    const t = signConfirmToken(SECRET, 'delete_step', args, 'u1');
    expect(verifyConfirmToken(SECRET, t, 'delete_step', args, 'u1').ok).toBe(true);
  });

  it('rejects other tools, args, users, secrets, tampering and expiry', () => {
    const now = Date.now();
    const t = signConfirmToken(SECRET, 'delete_step', args, 'u1', now);
    expect(verifyConfirmToken(SECRET, t, 'delete_runway', args, 'u1').ok).toBe(false);
    expect(verifyConfirmToken(SECRET, t, 'delete_step', { stepId: 'b'.repeat(24) }, 'u1').ok).toBe(
      false
    );
    expect(verifyConfirmToken(SECRET, t, 'delete_step', args, 'u2').ok).toBe(false);
    expect(verifyConfirmToken('y'.repeat(40), t, 'delete_step', args, 'u1').ok).toBe(false);
    expect(verifyConfirmToken(SECRET, t + 'x', 'delete_step', args, 'u1').ok).toBe(false);
    expect(verifyConfirmToken(SECRET, 'garbage', 'delete_step', args, 'u1').ok).toBe(false);
    expect(
      verifyConfirmToken(SECRET, t, 'delete_step', args, 'u1', now + CONFIRM_TTL_MS + 1).ok
    ).toBe(false);
  });

  it('is independent of key order in the arguments', () => {
    const t = signConfirmToken(SECRET, 't', { a: 1, b: 2 }, 'u');
    expect(verifyConfirmToken(SECRET, t, 't', { b: 2, a: 1 }, 'u').ok).toBe(true);
  });
});

describe('transport guards', () => {
  it('extracts bearer tokens', () => {
    expect(bearerToken('Bearer abc123')).toBe('abc123');
    expect(bearerToken('bearer abc123')).toBe('abc123');
    expect(bearerToken('Bearer a b')).toBeNull();
    expect(bearerToken('abc123')).toBeNull();
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
  });

  it('allows no Origin, same host and allow-listed origins only', () => {
    expect(originAllowed(null, 'app.com', [])).toBe(true);
    expect(originAllowed('https://app.com', 'app.com', [])).toBe(true);
    expect(originAllowed('https://evil.com', 'app.com', [])).toBe(false);
    expect(originAllowed('https://tool.dev', 'app.com', ['https://tool.dev'])).toBe(true);
    expect(originAllowed('not a url', 'app.com', [])).toBe(false);
  });

  it('redacts secrets in audit args', () => {
    const s = summarizeArgs({ apiKey: 'abc', confirmToken: 't', title: 'ok' });
    expect(s).not.toContain('abc');
    expect(s).toContain('ok');
  });
});

function harness() {
  const run = vi.fn(async () => ({ done: true }));
  const audit = vi.fn(async () => undefined);
  const used = new Set<string>();
  const fakeTools: ToolDef[] = [
    {
      name: 'read_thing',
      title: 'Read',
      description: 'r',
      tier: 'read',
      input: z.object({ n: z.number().int().min(1) }),
      run: async ({ n }: { n: number }) => ({ n }),
    },
    {
      name: 'boom',
      title: 'Boom',
      description: 'b',
      tier: 'write',
      input: z.object({}),
      run: async () => {
        throw new Error('mongo://secret-host exploded');
      },
    },
    {
      name: 'friendly',
      title: 'Friendly',
      description: 'f',
      tier: 'write',
      input: z.object({}),
      run: async () => {
        throw new ToolError('Mission not found');
      },
    },
    {
      name: 'del',
      title: 'Del',
      description: 'd',
      tier: 'critical',
      input: z.object({ id: z.string() }),
      preview: async ({ id }: { id: string }) => `Will delete ${id}`,
      run,
    },
  ];
  const handler = createMcpHandler({
    tools: fakeTools,
    secret: SECRET,
    resolveUserId: async () => 'user-1',
    audit,
    consumeConfirmation: async (jti) => (used.has(jti) ? false : (used.add(jti), true)),
  });
  const call = (name: string, args: unknown, id = 1) =>
    handler.handle({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
  return { handler, call, run, audit };
}

type Result = { result: { content: { text: string }[]; isError?: boolean } };
const textOf = (r: unknown) => (r as Result).result.content[0].text;

describe('MCP protocol handler', () => {
  it('negotiates protocol versions on initialize', async () => {
    const { handler } = harness();
    const r = (await handler.handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    })) as { result: { protocolVersion: string; capabilities: object } };
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(r.result.capabilities).toHaveProperty('tools');

    const r2 = (await handler.handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    })) as { result: { protocolVersion: string } };
    expect(r2.result.protocolVersion).toBe('2025-06-18');
  });

  it('handles notifications, ping, unknown methods and invalid requests', async () => {
    const { handler } = harness();
    expect(
      await handler.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })
    ).toBeNull();
    expect(await handler.handle({ jsonrpc: '2.0', id: 1, method: 'ping' })).toMatchObject({
      result: {},
    });
    expect(await handler.handle({ jsonrpc: '2.0', id: 1, method: 'nope' })).toMatchObject({
      error: { code: -32601 },
    });
    expect(await handler.handle({ id: 1 })).toMatchObject({ error: { code: -32600 } });
    expect(await handler.handle([])).toMatchObject({ error: { code: -32600 } });
  });

  it('lists tools with annotations and a confirmToken field on critical tools', async () => {
    const { handler } = harness();
    const r = (await handler.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })) as {
      result: { tools: ReturnType<typeof describeTool>[] };
    };
    const byName = Object.fromEntries(r.result.tools.map((t) => [t.name, t]));
    expect(byName.read_thing.annotations.readOnlyHint).toBe(true);
    expect(byName.del.annotations.destructiveHint).toBe(true);
    expect(Object.keys((byName.del.inputSchema as { properties: object }).properties)).toContain(
      'confirmToken'
    );
    expect(
      Object.keys((byName.read_thing.inputSchema as { properties: object }).properties)
    ).not.toContain('confirmToken');
  });

  it('validates arguments and runs read tools', async () => {
    const { call } = harness();
    expect(textOf(await call('read_thing', { n: 3 }))).toContain('"n": 3');
    const bad = (await call('read_thing', { n: 0 })) as Result;
    expect(bad.result.isError).toBe(true);
    expect(textOf(bad)).toContain('Invalid arguments');
    expect(((await call('missing', {})) as Result).result.isError).toBe(true);
  });

  it('never leaks internal error details but shows safe errors', async () => {
    const { call } = harness();
    const internal = (await call('boom', {})) as Result;
    expect(internal.result.isError).toBe(true);
    expect(textOf(internal)).not.toContain('mongo');
    expect(textOf(await call('friendly', {}))).toBe('Mission not found');
  });

  it('enforces ask-first for critical tools: preview, then single-use confirmation', async () => {
    const { call, run, audit } = harness();

    const first = textOf(await call('del', { id: 'abc' }));
    expect(first).toContain('CONFIRMATION REQUIRED');
    expect(first).toContain('Will delete abc');
    expect(run).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ tool: 'del', status: 'confirmation_required' })
    );

    const token = /confirmToken[^:]*: (\S+)/.exec(first)![1];

    // A different argument set cannot reuse the token
    const wrongArgs = (await call('del', { id: 'other', confirmToken: token })) as Result;
    expect(wrongArgs.result.isError).toBe(true);
    expect(run).not.toHaveBeenCalled();

    // Forged token
    expect(((await call('del', { id: 'abc', confirmToken: 'a.b' })) as Result).result.isError).toBe(
      true
    );

    // Valid confirmation executes exactly once
    expect(((await call('del', { id: 'abc', confirmToken: token })) as Result).result.isError).toBe(
      undefined
    );
    expect(run).toHaveBeenCalledTimes(1);
    const replay = (await call('del', { id: 'abc', confirmToken: token })) as Result;
    expect(replay.result.isError).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('Lockin tool catalog invariants', () => {
  const names = tools.map((t) => t.name);

  it('has unique names and publishes a valid schema for each tool', () => {
    expect(new Set(names).size).toBe(names.length);
    for (const t of tools) {
      const d = describeTool(t);
      expect((d.inputSchema as { type: string }).type).toBe('object');
      expect(d.description.length).toBeGreaterThan(10);
    }
  });

  it('does not expose account, credential, database or mission-deletion tools', () => {
    for (const n of names) {
      expect(n).not.toMatch(/delete_mission|user|account|password|key|session|database|query|raw/);
    }
    expect(names).not.toContain('delete_mission');
  });

  it('marks exactly the destructive / permission-changing tools as critical, with previews', () => {
    const critical = tools.filter((t) => t.tier === 'critical').map((t) => t.name);
    expect(critical.sort()).toEqual(
      [
        'add_member',
        'archive_mission',
        'delete_runway',
        'delete_step',
        'remove_member',
        'update_member_role',
      ].sort()
    );
    for (const t of tools.filter((x) => x.tier === 'critical')) {
      expect(typeof t.preview).toBe('function');
      expect(describeTool(t).annotations.destructiveHint).toBe(true);
    }
    // Nothing non-critical may be named like a destructive action
    for (const t of tools.filter((x) => x.tier !== 'critical')) {
      expect(t.name).not.toMatch(/^(delete|remove|archive|share|add_member)/);
    }
  });

  it('read tools are annotated read-only', () => {
    for (const t of tools.filter((x) => x.tier === 'read')) {
      expect(describeTool(t).annotations.readOnlyHint).toBe(true);
    }
  });
});
