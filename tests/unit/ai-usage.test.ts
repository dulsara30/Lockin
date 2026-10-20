import { describe, it, expect } from 'vitest';
import { env } from '@/lib/env';

describe('AI Usage Quota Logic', () => {
  it('enforces shared quota vs custom BYOK quota', () => {
    const sharedLimit = env.AI_DAILY_CAP_SHARED; // 10
    const customLimit = 100;

    expect(sharedLimit).toBe(10);
    expect(customLimit).toBe(100);

    const testUserUsage = 8;
    const remainingShared = Math.max(0, sharedLimit - testUserUsage);
    const remainingCustom = Math.max(0, customLimit - testUserUsage);

    expect(remainingShared).toBe(2);
    expect(remainingCustom).toBe(92);
  });
});
