import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import { signupSchema, loginInputSchema } from '@/features/auth/schemas';

describe('Auth Validation Schemas', () => {
  it('validates correct signup input and lowercases email', () => {
    const input = {
      name: 'Test User',
      email: '  TEST@Lockin.App  ',
      password: 'password123',
    };

    const result = signupSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('test@lockin.app');
      expect(result.data.name).toBe('Test User');
    }
  });

  it('rejects short password (< 8 chars)', () => {
    const input = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'short',
    };

    const result = signupSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const input = {
      name: 'Test User',
      email: 'not-an-email',
      password: 'password123',
    };

    const result = signupSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('validates login input', () => {
    const input = {
      email: 'user@example.com',
      password: 'password123',
    };

    const result = loginInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('verifies bcryptjs hash matches password', async () => {
    const password = 'mySecretPassword123';
    const hash = await bcrypt.hash(password, 12);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('wrongPassword', hash)).toBe(false);
  });
});
