import { describe, it, expect } from 'vitest';
import { renderExport, toCsv, toMarkdown, ExportDoc } from '@/lib/export/runway-export';
import { parseMarkdownTemplate, parseJsonTemplate } from '@/lib/templates/parser';
import { crc32 } from '@/lib/export/xlsx';

const doc = (scope: 'runway' | 'day' = 'runway'): ExportDoc => ({
  mission: { title: 'Launch "MVP" | v1', description: 'Ship it', priority: 'high', tags: ['a'] },
  runway: { title: 'Main Runway', version: 2, dayCount: 3 },
  hoursPerDay: 4,
  scope,
  exportedAt: '2026-01-02T00:00:00.000Z',
  days: [0, 1, 2]
    .filter((d) => scope === 'runway' || d === 1)
    .map((d) => ({
      dayIndex: d,
      steps:
        d === 2
          ? []
          : [
              {
                title: d === 0 ? '=HYPERLINK("http://evil")' : 'Build, test',
                status: d === 0 ? 'done' : 'todo',
                estimateMin: 45,
                actualMin: 10,
                notes: 'line1\nline2 | pipe',
                checklist: [{ text: 'sub', done: true }],
              },
            ],
    })),
});

describe('runway export', () => {
  it('exports every day for the runway scope and one day for the day scope', () => {
    const all = JSON.parse(renderExport(doc('runway'), 'json').content);
    expect(all.days).toHaveLength(3);
    const one = JSON.parse(renderExport(doc('day'), 'json').content);
    expect(one.days).toHaveLength(1);
    expect(one.days[0].dayIndex).toBe(1);
    expect(renderExport(doc('day'), 'md').filename).toMatch(/-day-2\.md$/);
  });

  it('JSON and Markdown re-import through the template parsers', () => {
    const fromJson = parseJsonTemplate(renderExport(doc(), 'json').content);
    expect(fromJson.days[0].steps[0].estimateMin).toBe(45);

    const fromMd = parseMarkdownTemplate(toMarkdown(doc()));
    expect(fromMd.days.length).toBeGreaterThanOrEqual(3);
    expect(fromMd.days[1].steps[0].title).toBe('Build, test');
    expect(fromMd.days[1].steps[0].checklist?.[0].text).toBe('sub');
  });

  it('neutralizes spreadsheet formula injection and escapes CSV', () => {
    const csv = toCsv(doc());
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"line1\nline2 | pipe"');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('produces a valid zip-based xlsx with correct CRCs', () => {
    const out = renderExport(doc(), 'xlsx');
    expect(out.encoding).toBe('base64');
    const buf = Buffer.from(out.content, 'base64');
    expect(buf.readUInt32LE(0)).toBe(0x04034b50);

    // Walk local headers, verify stored data against its CRC
    let off = 0;
    const names: string[] = [];
    while (buf.readUInt32LE(off) === 0x04034b50) {
      const crc = buf.readUInt32LE(off + 14);
      const size = buf.readUInt32LE(off + 18);
      const nameLen = buf.readUInt16LE(off + 26);
      const name = buf.subarray(off + 30, off + 30 + nameLen).toString();
      const data = buf.subarray(off + 30 + nameLen, off + 30 + nameLen + size);
      expect(crc32(data)).toBe(crc);
      names.push(name);
      off += 30 + nameLen + size;
    }
    expect(names).toContain('xl/worksheets/sheet1.xml');
    expect(buf.readUInt32LE(off)).toBe(0x02014b50);
  });

  it('produces a structurally valid PDF', () => {
    const pdf = Buffer.from(renderExport(doc(), 'pdf').content, 'base64').toString('latin1');
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe('xref');
    expect(pdf).toContain('/Type /Catalog');
  });
});
