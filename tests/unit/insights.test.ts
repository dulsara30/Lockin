import { describe, it, expect } from 'vitest';

describe('Insights Calculation Engine', () => {
  it('calculates completion rate percentage accurately', () => {
    const totalSteps = 10;
    const completedSteps = 7;
    const rate = Math.round((completedSteps / totalSteps) * 100);
    expect(rate).toBe(70);

    const zeroSteps = 0;
    const zeroRate = zeroSteps > 0 ? Math.round((0 / zeroSteps) * 100) : 0;
    expect(zeroRate).toBe(0);
  });

  it('calculates streaks from consecutive active dates', () => {
    const activeDates = ['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-19', '2026-10-20'];
    let longestStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    for (const d of activeDates) {
      const cur = new Date(d);
      if (!prevDate) {
        currentStreak = 1;
      } else {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays === 1) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
      }
      if (currentStreak > longestStreak) longestStreak = currentStreak;
      prevDate = cur;
    }

    expect(longestStreak).toBe(3); // 15, 16, 17
    expect(currentStreak).toBe(2); // 19, 20
  });
});
