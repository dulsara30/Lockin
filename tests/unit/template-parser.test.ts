import { describe, it, expect } from 'vitest';
import {
  parseMarkdownTemplate,
  parseChecklistToPlan,
  parseJsonTemplate,
  parseEstimateMin,
} from '@/lib/templates/parser';

describe('Template Parser', () => {
  it('parses estimate strings into minutes correctly', () => {
    expect(parseEstimateMin('45m')).toBe(45);
    expect(parseEstimateMin('1h')).toBe(60);
    expect(parseEstimateMin('1.5h')).toBe(90);
    expect(parseEstimateMin('30')).toBe(30);
    expect(parseEstimateMin('')).toBe(30);
  });

  it('parses markdown format template with subtasks and metadata', () => {
    const md = `
# Mission: Build SaaS Engine
days: 3
hoursPerDay: 4
priority: high
tags: dev, launch
description: Full MVP build sprint

## Day 1
- [ ] Database schema | 60m | high | core models
  - [ ] User table
  - [ ] Workspace table
- [ ] Auth endpoints | 45m | high

## Day 2
- [ ] Dashboard layout | 90m | medium | UI shell
- [ ] Navigation sidebar | 30m | low

## Day 3
- [ ] Production deploy | 60m | high
`;

    const plan = parseMarkdownTemplate(md);

    expect(plan.title).toBe('Build SaaS Engine');
    expect(plan.dayCount).toBe(3);
    expect(plan.hoursPerDay).toBe(4);
    expect(plan.priority).toBe('high');
    expect(plan.tags).toEqual(['dev', 'launch']);
    expect(plan.days.length).toBe(3);

    // Day 1
    const day1 = plan.days[0];
    expect(day1.steps.length).toBe(2);
    expect(day1.steps[0].title).toBe('Database schema');
    expect(day1.steps[0].estimateMin).toBe(60);
    expect(day1.steps[0].priority).toBe('high');
    expect(day1.steps[0].notes).toBe('core models');
    expect(day1.steps[0].checklist).toEqual([
      { text: 'User table', done: false },
      { text: 'Workspace table', done: false },
    ]);

    // Day 2
    const day2 = plan.days[1];
    expect(day2.steps.length).toBe(2);
    expect(day2.steps[0].title).toBe('Dashboard layout');
    expect(day2.steps[0].estimateMin).toBe(90);

    // Day 3
    const day3 = plan.days[2];
    expect(day3.steps.length).toBe(1);
    expect(day3.steps[0].title).toBe('Production deploy');
  });

  it('auto-distributes plain checklist across days without exceeding capacity', () => {
    const checklist = `
- [ ] Task Alpha | 60m
- [ ] Task Beta | 60m
- [ ] Task Gamma | 120m
- [ ] Task Delta | 60m
- [ ] Task Epsilon | 60m
`;

    // 2 hours/day capacity = 120m per day
    const plan = parseChecklistToPlan(checklist, {
      title: 'Auto Pipeline',
      dayCount: 3,
      hoursPerDay: 2,
    });

    expect(plan.dayCount).toBe(3);
    expect(plan.days.length).toBe(3);

    // Day 1: Alpha (60) + Beta (60) = 120m
    expect(plan.days[0].steps.length).toBe(2);
    const day1Mins = plan.days[0].steps.reduce((acc, s) => acc + s.estimateMin, 0);
    expect(day1Mins).toBe(120);

    // Day 2: Gamma (120m)
    expect(plan.days[1].steps.length).toBe(1);
    expect(plan.days[1].steps[0].estimateMin).toBe(120);

    // Day 3: Delta (60) + Epsilon (60) = 120m
    expect(plan.days[2].steps.length).toBe(2);
  });

  it('parses valid JSON template structure', () => {
    const jsonStr = JSON.stringify({
      title: 'JSON Mission',
      dayCount: 2,
      hoursPerDay: 4,
      priority: 'high',
      tags: ['json'],
      days: [
        {
          dayIndex: 0,
          steps: [
            {
              title: 'API setup',
              estimateMin: 45,
              priority: 'high',
              notes: '',
              checklist: [],
            },
          ],
        },
        {
          dayIndex: 1,
          steps: [],
        },
      ],
    });

    const parsed = parseJsonTemplate(jsonStr);
    expect(parsed.title).toBe('JSON Mission');
    expect(parsed.days.length).toBe(2);
    expect(parsed.days[0].steps[0].title).toBe('API setup');
  });
});
