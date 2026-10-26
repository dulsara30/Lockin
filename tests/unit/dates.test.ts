import { describe, it, expect } from 'vitest';
import { dayDate, dayIndexForDate } from '@/lib/dates';

const TZ = 'Asia/Colombo'; // UTC+5:30

describe('calendar day helpers', () => {
  it('maps day indexes to calendar dates in the user timezone', () => {
    // 22:00 UTC on Jan 1 is already Jan 2 in Colombo
    const start = new Date('2026-01-01T22:00:00Z');
    expect(dayDate(start, 0, TZ)).toBe('2026-01-02');
    expect(dayDate(start, 3, TZ)).toBe('2026-01-05');
    expect(dayDate(start, 0, 'UTC')).toBe('2026-01-01');
  });

  it('crosses month boundaries', () => {
    expect(dayDate(new Date('2026-01-30T05:00:00Z'), 3, 'UTC')).toBe('2026-02-02');
  });

  it('uses calendar days, not 24-hour blocks', () => {
    const start = new Date('2026-03-10T20:00:00Z'); // Mar 11 01:30 in Colombo
    // 10 hours later it is already the next calendar day
    expect(dayIndexForDate(start, new Date('2026-03-11T06:00:00Z'), 'UTC')).toBe(1);
    // same Colombo calendar day, even though > 0 hours passed
    expect(dayIndexForDate(start, new Date('2026-03-11T10:00:00Z'), TZ)).toBe(0);
    expect(dayIndexForDate(start, new Date('2026-03-09T00:00:00Z'), 'UTC')).toBe(-1);
  });

  it('start day is day 0', () => {
    const now = new Date('2026-05-05T09:00:00Z');
    expect(dayIndexForDate(now, now, TZ)).toBe(0);
  });
});
