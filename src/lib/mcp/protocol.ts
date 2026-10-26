import { z } from 'zod';
import { zodToJsonSchema } from './schema';
import { signConfirmToken, verifyConfirmToken } from './confirm';

export const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'] as const;
const MAX_RESULT_CHARS = 200_000;

export type ToolTier = 'read' | 'write' | 'critical';

export interface ToolContext {
  userId: string;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  tier: ToolTier;
  /** Uses AI quota or external services */
  openWorld?: boolean;
  input: z.AnyZodObject;
  /** Critical tools: describes the exact impact shown before confirmation */
  preview?: (args: any, ctx: ToolContext) => Promise<string>;
  run: (args: any, ctx: ToolContext) => Promise<unknown>;
}

export interface AuditEntry {
  userId?: string;
  tool: string;
  tier: ToolTier;
  args: unknown;
  status: 'ok' | 'error' | 'confirmation_required';
  error?: string;
  durationMs: number;
}

export interface McpDeps {
  tools: ToolDef[];
  secret: string;
  resolveUserId: () => Promise<string>;
  audit: (entry: AuditEntry) => Promise<void>;
  /** Returns true the first time a confirmation id is consumed (single use). */
  consumeConfirmation: (jti: string) => Promise<boolean>;
  serverInfo?: { name: string; version: string };
  instructions?: string;
}

/** Errors whose message is safe to show the model/user. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolError';
  }
}

const SAFE_ERRORS = new Set(['ToolError', 'AccessError']);

const confirmField = z
  .string()
  .max(2000)
  .optional()
  .describe('Confirmation token returned by the first call. Required to execute critical tools.');

const requestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().min(1).max(100),
  params: z.record(z.unknown()).optional(),
});

type RpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

const ok = (id: string | number, result: unknown): RpcResponse => ({
  jsonrpc: '2.0',
  id,
  result,
});
const fail = (id: string | number | null, code: number, message: string): RpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

const truncate = (t: string) => `${t.slice(0, MAX_RESULT_CHARS)}\n...[truncated]`;
const text = (t: string, isError = false) => ({
  content: [{ type: 'text', text: t.length > MAX_RESULT_CHARS ? truncate(t) : t }],
  ...(isError ? { isError: true } : {}),
});

export function describeTool(tool: ToolDef) {
  const critical = tool.tier === 'critical';
  const input = critical ? tool.input.extend({ confirmToken: confirmField }) : tool.input;
  return {
    name: tool.name,
    title: tool.title,
    description: critical
      ? `${tool.description} CRITICAL: the first call only returns a preview and a confirmation token; ask the user, then repeat the identical call with confirmToken.`
      : tool.description,
    inputSchema: zodToJsonSchema(input),
    annotations: {
      title: tool.title,
      readOnlyHint: tool.tier === 'read',
      destructiveHint: critical,
      idempotentHint: tool.tier === 'read',
      openWorldHint: !!tool.openWorld,
    },
  };
}

export function createMcpHandler(deps: McpDeps) {
  const byName = new Map(deps.tools.map((t) => [t.name, t]));
  const serverInfo = deps.serverInfo ?? { name: 'lockin', version: '1.0.0' };

  async function callTool(name: string, rawArgs: unknown): Promise<unknown> {
    const tool = byName.get(name);
    if (!tool) return text(`Unknown tool: ${name}`, true);

    const started = Date.now();
    const critical = tool.tier === 'critical';
    const schema = critical ? tool.input.extend({ confirmToken: confirmField }) : tool.input;

    const parsed = schema.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const msg = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
        .join('; ');
      return text(`Invalid arguments: ${msg}`, true);
    }

    const { confirmToken, ...args } = parsed.data as Record<string, unknown> & {
      confirmToken?: string;
    };
    let userId: string | undefined;
    const log = (status: AuditEntry['status'], error?: string) =>
      deps
        .audit({
          userId,
          tool: name,
          tier: tool.tier,
          args,
          status,
          error,
          durationMs: Date.now() - started,
        })
        .catch(() => undefined);

    try {
      userId = await deps.resolveUserId();
      const ctx: ToolContext = { userId };

      if (critical) {
        if (!confirmToken) {
          const impact = tool.preview
            ? await tool.preview(args, ctx)
            : 'This action is destructive.';
          const token = signConfirmToken(deps.secret, name, args, userId);
          await log('confirmation_required');
          return text(
            [
              `CONFIRMATION REQUIRED for "${name}". Nothing has been changed yet.`,
              '',
              impact,
              '',
              'Ask the user to approve. To proceed, repeat the exact same call with this',
              `confirmToken (valid 5 minutes, single use): ${token}`,
            ].join('\n')
          );
        }

        const check = verifyConfirmToken(deps.secret, confirmToken, name, args, userId);
        if (!check.ok) throw new ToolError(`Confirmation rejected: ${check.reason}.`);
        if (!(await deps.consumeConfirmation(check.jti))) {
          throw new ToolError('Confirmation rejected: token already used.');
        }
      }

      const result = await tool.run(args, ctx);
      await log('ok');
      return text(JSON.stringify(result ?? { success: true }, null, 2));
    } catch (error) {
      const safe = error instanceof Error && SAFE_ERRORS.has(error.name);
      await log('error', safe ? (error as Error).message : 'internal error');
      if (!safe) {
        console.error('MCP tool error:', name, error instanceof Error ? error.message : error);
      }
      return text(safe ? (error as Error).message : 'The tool failed. Try again later.', true);
    }
  }

  async function handleOne(message: unknown): Promise<RpcResponse | null> {
    const parsed = requestSchema.safeParse(message);
    if (!parsed.success) return fail(null, -32600, 'Invalid Request');
    const { id, method, params } = parsed.data;

    switch (method) {
      case 'initialize': {
        if (id === undefined) return null;
        const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : '';
        const protocolVersion = (SUPPORTED_PROTOCOLS as readonly string[]).includes(requested)
          ? requested
          : SUPPORTED_PROTOCOLS[0];
        return ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo,
          ...(deps.instructions ? { instructions: deps.instructions } : {}),
        });
      }
      case 'ping':
        return id === undefined ? null : ok(id, {});
      case 'tools/list':
        return id === undefined ? null : ok(id, { tools: deps.tools.map(describeTool) });
      case 'tools/call': {
        if (id === undefined) return null;
        const name = typeof params?.name === 'string' ? params.name : '';
        return ok(id, await callTool(name, params?.arguments));
      }
      default:
        if (id === undefined || method.startsWith('notifications/')) return null;
        return fail(id, -32601, `Method not found: ${method}`);
    }
  }

  return {
    async handle(body: unknown): Promise<RpcResponse | RpcResponse[] | null> {
      if (Array.isArray(body)) {
        if (body.length === 0 || body.length > 20) return fail(null, -32600, 'Invalid Request');
        const out = (await Promise.all(body.map(handleOne))).filter(
          (r): r is RpcResponse => r !== null
        );
        return out.length ? out : null;
      }
      return handleOne(body);
    },
  };
}
