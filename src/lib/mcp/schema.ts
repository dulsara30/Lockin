import { z } from 'zod';

type Json = Record<string, unknown>;

/**
 * Converts the small Zod subset used by MCP tool inputs into JSON Schema,
 * so each tool has a single source of truth for validation and its published schema.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Json {
  const def = schema._def as Record<string, any>;
  const description = schema.description ? { description: schema.description } : {};

  switch (def.typeName as string) {
    case 'ZodString': {
      const out: Json = { type: 'string', ...description };
      for (const c of def.checks as { kind: string; value?: number; regex?: RegExp }[]) {
        if (c.kind === 'min') out.minLength = c.value;
        if (c.kind === 'max') out.maxLength = c.value;
        if (c.kind === 'email') out.format = 'email';
        if (c.kind === 'regex' && c.regex) out.pattern = c.regex.source;
      }
      return out;
    }
    case 'ZodNumber': {
      const out: Json = { type: 'number', ...description };
      for (const c of def.checks as { kind: string; value?: number }[]) {
        if (c.kind === 'int') out.type = 'integer';
        if (c.kind === 'min') out.minimum = c.value;
        if (c.kind === 'max') out.maximum = c.value;
      }
      return out;
    }
    case 'ZodBoolean':
      return { type: 'boolean', ...description };
    case 'ZodEnum':
      return { type: 'string', enum: def.values, ...description };
    case 'ZodLiteral':
      return { const: def.value, ...description };
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(def.type), ...description };
    case 'ZodRecord':
      return {
        type: 'object',
        additionalProperties: zodToJsonSchema(def.valueType),
        ...description,
      };
    case 'ZodOptional':
    case 'ZodNullable':
      return { ...zodToJsonSchema(def.innerType), ...description };
    case 'ZodDefault':
      return {
        ...zodToJsonSchema(def.innerType),
        default: def.defaultValue(),
        ...description,
      };
    case 'ZodEffects':
      return { ...zodToJsonSchema(def.schema), ...description };
    case 'ZodObject': {
      const shape = (schema as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
      const properties: Record<string, Json> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        if (!value.isOptional()) required.push(key);
      }
      return {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
        ...description,
      };
    }
    default:
      return { ...description };
  }
}
