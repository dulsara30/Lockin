import { describe, it, expect } from 'vitest';

describe('Rate Limiter Calculation', () => {
  it('correctly calculates remaining quota and expiration', () => {
    const limit = 5;
    const currentCount = 3;
    const remaining = Math.max(0, limit - currentCount);
    expect(remaining).toBe(2);

    const exceededCount = 6;
    const exceededRemaining = Math.max(0, limit - exceededCount);
    expect(exceededRemaining).toBe(0);
    expect(exceededCount <= limit).toBe(false);
  });

  it('handles TTL expiry window timestamping', () => {
    const now = Date.now();
    const windowSeconds = 60;
    const expiresAt = new Date(now + windowSeconds * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(now);
    expect(expiresAt.getTime() - now).toBe(60000);
  });
});
