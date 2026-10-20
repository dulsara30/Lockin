import { describe, it, expect } from 'vitest';

describe('Health Check Logic', () => {
  it('correctly maps database ready states', () => {
    const mapState = (state: number) => {
      return state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected';
    };

    expect(mapState(1)).toBe('connected');
    expect(mapState(2)).toBe('connecting');
    expect(mapState(0)).toBe('disconnected');
    expect(mapState(3)).toBe('disconnected');
  });

  it('determines overall health based on database connection', () => {
    const isHealthy = (dbStatus: string) => dbStatus === 'connected';
    expect(isHealthy('connected')).toBe(true);
    expect(isHealthy('connecting')).toBe(false);
    expect(isHealthy('disconnected')).toBe(false);
  });
});
