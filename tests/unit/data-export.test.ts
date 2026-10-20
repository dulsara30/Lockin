import { describe, it, expect } from 'vitest';

describe('Data Export Formats', () => {
  it('formats mission structure to compliant Markdown template', () => {
    const mission = {
      title: 'Launch SaaS',
      dayCount: 2,
      priority: 'high',
      tags: ['mvp', 'saas'],
      description: 'Ship to early users',
    };

    const steps = [
      {
        dayIndex: 0,
        title: 'Setup DB',
        estimateMin: 60,
        status: 'done',
        priority: 'high',
        notes: 'Atlas',
        checklist: [{ text: 'User model', done: true }],
      },
      {
        dayIndex: 1,
        title: 'Launch on Product Hunt',
        estimateMin: 30,
        status: 'todo',
        priority: 'high',
        notes: '',
        checklist: [],
      },
    ];

    let md = `# Mission: ${mission.title}\n`;
    md += `days: ${mission.dayCount}\n`;
    md += `hoursPerDay: 4\n`;
    md += `priority: ${mission.priority}\n`;
    md += `tags: ${mission.tags.join(', ')}\n\n`;

    for (let d = 0; d < mission.dayCount; d++) {
      md += `## Day ${d + 1}\n`;
      const daySteps = steps.filter((s) => s.dayIndex === d);
      for (const st of daySteps) {
        const mark = st.status === 'done' ? 'x' : ' ';
        const note = st.notes ? ` | ${st.notes}` : '';
        md += `- [${mark}] ${st.title} | ${st.estimateMin}m | ${st.priority}${note}\n`;
      }
      md += '\n';
    }

    expect(md).toContain('# Mission: Launch SaaS');
    expect(md).toContain('days: 2');
    expect(md).toContain('## Day 1');
    expect(md).toContain('- [x] Setup DB | 60m | high | Atlas');
    expect(md).toContain('## Day 2');
    expect(md).toContain('- [ ] Launch on Product Hunt | 30m | high');
  });
});
