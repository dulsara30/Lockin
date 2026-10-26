import { buildXlsx } from './xlsx';
import { buildPdf, PdfBlock } from './pdf';

export const EXPORT_FORMATS = ['json', 'md', 'csv', 'xlsx', 'pdf'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportStep {
  title: string;
  status: string;
  estimateMin: number;
  actualMin: number;
  notes: string;
  checklist: { text: string; done: boolean }[];
}

export interface ExportDay {
  dayIndex: number; // 0-based
  steps: ExportStep[];
}

export interface ExportDoc {
  mission: { title: string; description: string; priority: string; tags: string[] };
  runway: { title: string; version: number; dayCount: number };
  hoursPerDay: number;
  /** 'runway' = every day, 'day' = a single day */
  scope: 'runway' | 'day';
  days: ExportDay[];
  exportedAt: string;
}

export interface RenderedExport {
  filename: string;
  mime: string;
  encoding: 'utf8' | 'base64';
  content: string;
}

const STATUS_LABEL: Record<string, string> = {
  todo: 'To Do',
  doing: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
  skipped: 'Skipped',
};

const statusLabel = (s: string) => STATUS_LABEL[s] || s;

function slug(v: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'export'
  );
}

export function exportBaseName(doc: ExportDoc): string {
  const base = `lockin-${slug(doc.mission.title)}-v${doc.runway.version}`;
  return doc.scope === 'day' ? `${base}-day-${doc.days[0].dayIndex + 1}` : base;
}

/** Single-line, pipe-free text so the Markdown stays re-importable by the template parser. */
const oneLine = (v: string) => v.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();

// ---------------------------------------------------------------- JSON
// Same shape as the importable plan schema (extra fields are ignored on import).
export function toJson(doc: ExportDoc): string {
  return JSON.stringify(
    {
      title: doc.mission.title,
      description: doc.mission.description,
      dayCount: doc.runway.dayCount,
      hoursPerDay: doc.hoursPerDay,
      priority: ['low', 'medium', 'high'].includes(doc.mission.priority)
        ? doc.mission.priority
        : 'high',
      tags: doc.mission.tags,
      days: doc.days.map((d) => ({
        dayIndex: d.dayIndex,
        steps: d.steps.map((s) => ({
          title: s.title,
          estimateMin: s.estimateMin,
          priority: 'medium',
          notes: s.notes,
          checklist: s.checklist,
          status: s.status,
          actualMin: s.actualMin,
        })),
      })),
      meta: {
        format: 'lockin-runway-export',
        version: '1.0',
        exportedAt: doc.exportedAt,
        scope: doc.scope,
        runway: doc.runway.title,
        runwayVersion: doc.runway.version,
      },
    },
    null,
    2
  );
}

// ---------------------------------------------------------------- Markdown
export function toMarkdown(doc: ExportDoc): string {
  let md = `# Mission: ${oneLine(doc.mission.title)}\n`;
  md += `days: ${doc.runway.dayCount}\n`;
  md += `hoursPerDay: ${doc.hoursPerDay}\n`;
  if (['low', 'medium', 'high'].includes(doc.mission.priority)) {
    md += `priority: ${doc.mission.priority}\n`;
  }
  if (doc.mission.tags.length) md += `tags: ${doc.mission.tags.map(oneLine).join(', ')}\n`;
  if (doc.mission.description) md += `description: ${oneLine(doc.mission.description)}\n`;
  md += `runway: ${oneLine(doc.runway.title)} (v${doc.runway.version})\n\n`;

  for (const day of doc.days) {
    md += `## Day ${day.dayIndex + 1}\n`;
    if (day.steps.length === 0) md += `<!-- buffer day -->\n`;
    for (const st of day.steps) {
      const mark = st.status === 'done' ? 'x' : ' ';
      const note = st.notes ? ` | ${oneLine(st.notes)}` : ' | ';
      md += `- [${mark}] ${oneLine(st.title)} | ${st.estimateMin}m | medium${note === ' | ' ? '' : note}\n`;
      for (const item of st.checklist) {
        md += `  - [${item.done ? 'x' : ' '}] ${oneLine(item.text)}\n`;
      }
    }
    md += '\n';
  }
  return md;
}

// ---------------------------------------------------------------- Tabular (CSV / XLSX)
export const TABLE_HEADERS = [
  'Day',
  'Task',
  'Status',
  'Estimate (min)',
  'Actual (min)',
  'Subtasks done',
  'Subtasks',
  'Notes',
] as const;

export type Cell = string | number;

export function toRows(doc: ExportDoc): Cell[][] {
  const rows: Cell[][] = [];
  for (const day of doc.days) {
    for (const s of day.steps) {
      const done = s.checklist.filter((c) => c.done).length;
      rows.push([
        day.dayIndex + 1,
        s.title,
        statusLabel(s.status),
        s.estimateMin,
        s.actualMin,
        s.checklist.length ? `${done}/${s.checklist.length}` : '',
        s.checklist.map((c) => `[${c.done ? 'x' : ' '}] ${c.text}`).join('\n'),
        s.notes,
      ]);
    }
  }
  return rows;
}

/** Neutralize spreadsheet formula injection (=, +, -, @, tab, CR) in text cells. */
function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

export function toCsv(doc: ExportDoc): string {
  const esc = (c: Cell) => {
    const text = typeof c === 'number' ? String(c) : safeText(c);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [TABLE_HEADERS as readonly Cell[], ...toRows(doc)].map((r) => r.map(esc).join(','));
  // BOM so Excel detects UTF-8
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------- PDF
function toPdfBlocks(doc: ExportDoc): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  const all = doc.days.flatMap((d) => d.steps);
  const planned = all.reduce((a, s) => a + s.estimateMin, 0);
  const done = all.filter((s) => s.status === 'done').length;

  blocks.push({ text: doc.mission.title, size: 18, bold: true });
  blocks.push({
    text: `${doc.runway.title} (v${doc.runway.version}) - ${
      doc.scope === 'day' ? `Day ${doc.days[0].dayIndex + 1} only` : `${doc.runway.dayCount} days`
    }`,
    size: 11,
    gapBefore: 4,
  });
  blocks.push({
    text: `${done}/${all.length} tasks done - ${(planned / 60).toFixed(1)}h planned - exported ${doc.exportedAt.slice(0, 10)}`,
    size: 9,
    gapBefore: 2,
  });

  for (const day of doc.days) {
    const mins = day.steps.reduce((a, s) => a + s.estimateMin, 0);
    blocks.push({
      text: `Day ${day.dayIndex + 1}  (${day.steps.length} tasks, ${(mins / 60).toFixed(1)}h)`,
      size: 13,
      bold: true,
      gapBefore: 16,
    });
    if (day.steps.length === 0) {
      blocks.push({ text: 'No tasks (buffer day)', size: 10, indent: 8, gapBefore: 4 });
    }
    for (const s of day.steps) {
      blocks.push({
        text: `[${s.status === 'done' ? 'x' : ' '}] ${s.title}  (${s.estimateMin}m, ${statusLabel(s.status)}${
          s.actualMin ? `, ${s.actualMin}m actual` : ''
        })`,
        size: 10,
        indent: 8,
        gapBefore: 6,
      });
      for (const c of s.checklist) {
        blocks.push({ text: `[${c.done ? 'x' : ' '}] ${c.text}`, size: 9, indent: 28 });
      }
      if (s.notes) {
        blocks.push({ text: oneLine(s.notes).slice(0, 600), size: 9, indent: 28, gapBefore: 2 });
      }
    }
  }
  return blocks;
}

// ---------------------------------------------------------------- Dispatcher
export function renderExport(doc: ExportDoc, format: ExportFormat): RenderedExport {
  const base = exportBaseName(doc);
  switch (format) {
    case 'json':
      return {
        filename: `${base}.json`,
        mime: 'application/json',
        encoding: 'utf8',
        content: toJson(doc),
      };
    case 'md':
      return {
        filename: `${base}.md`,
        mime: 'text/markdown',
        encoding: 'utf8',
        content: toMarkdown(doc),
      };
    case 'csv':
      return {
        filename: `${base}.csv`,
        mime: 'text/csv',
        encoding: 'utf8',
        content: toCsv(doc),
      };
    case 'xlsx':
      return {
        filename: `${base}.xlsx`,
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        encoding: 'base64',
        content: buildXlsx('Runway', TABLE_HEADERS, toRows(doc)).toString('base64'),
      };
    case 'pdf':
      return {
        filename: `${base}.pdf`,
        mime: 'application/pdf',
        encoding: 'base64',
        content: buildPdf(toPdfBlocks(doc)).toString('base64'),
      };
  }
}
