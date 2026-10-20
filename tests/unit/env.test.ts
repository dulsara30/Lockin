import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('Environment Schema Validation', () => {
  const envSchema = z.object({
    MONGODB_URI: z.string().min(1),
    AUTH_SECRET: z.string().min(16),
    GEMINI_API_KEY: z.string().min(1),
    ENCRYPTION_KEY: z.string().min(16),
    GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
    AI_DAILY_CAP_SHARED: z
      .string()
      .default('10')
      .transform((val) => parseInt(val, 10))
      .pipe(z.number().positive()),
  });

  it('validates correct environment variables', () => {
    const valid = {
      MONGODB_URI: 'mongodb://localhost:27017/test',
      AUTH_SECRET: 'super-secret-key-that-is-long-enough',
      GEMINI_API_KEY: 'test-api-key',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
      GEMINI_MODEL: 'gemini-2.0-flash',
      AI_DAILY_CAP_SHARED: '10',
    };

    const result = envSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AI_DAILY_CAP_SHARED).toBe(10);
    }
  });

  it('fails when MONGODB_URI is missing', () => {
    const invalid = {
      AUTH_SECRET: 'super-secret-key-that-is-long-enough',
      GEMINI_API_KEY: 'test-api-key',
      ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
    };

    const result = envSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
