import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  ENCRYPTION_KEY: z.string().min(16, 'ENCRYPTION_KEY must be at least 16 characters'),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash-lite-preview-06-17'),
  AI_DAILY_CAP_SHARED: z
    .string()
    .default('10')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  NEXTAUTH_URL: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    const message = `Environment validation failed:\n${errorDetails}\nPlease check your .env or .env.local file. See .env.example.`;

    // In build or test environments without db connection, log warning and use fallback
    if (process.env.SKIP_ENV_VALIDATION === 'true' || process.env.NODE_ENV === 'test') {
      return envSchema.parse({
        MONGODB_URI: 'mongodb://localhost:27017/lockin',
        AUTH_SECRET: 'placeholder-secret-at-least-16-chars',
        GEMINI_API_KEY: 'placeholder-key',
        ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
        GEMINI_MODEL: 'gemini-2.5-flash-lite-preview-06-17',
        AI_DAILY_CAP_SHARED: '10',
        ...process.env,
      });
    }

    throw new Error(message);
  }

  return parsed.data;
}

export const env = validateEnv();
