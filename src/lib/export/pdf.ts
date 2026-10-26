/**
 * Minimal dependency-free PDF writer: A4, built-in Helvetica / Helvetica-Bold,
 * word wrapping and pagination. Text is encoded as WinAnsi (Latin-1); other
 * characters are replaced with "?".
 */

export interface PdfBlock {
  text: string;
  size: number;
  bold?: boolean;
  indent?: number;
  gapBefore?: number;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;

function toLatin1(v: string): string {
  return v
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\xa1-\xff]/g, '?');
}

const esc = (v: string) => v.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function wrap(text: string, maxChars: number): string[] {
  const words = toLatin1(text).split(' ');
  const lines: string[] = [];
  let line = '';
  for (let w of words) {
    while (w.length > maxChars) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(w.slice(0, maxChars));
      w = w.slice(maxChars);
    }
    if ((line ? line.length + 1 : 0) + w.length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

export function buildPdf(blocks: PdfBlock[]): Buffer {
  const pages: string[] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    if (ops.length) pages.push(ops.join('\n'));
    ops = [];
    y = PAGE_H - MARGIN;
  };

  for (const b of blocks) {
    const indent = b.indent ?? 0;
    const leading = b.size * 1.35;
    // Average Helvetica glyph is ~0.5em wide (bold a bit wider)
    const maxChars = Math.max(
      10,
      Math.floor((PAGE_W - 2 * MARGIN - indent) / (b.size * (b.bold ? 0.56 : 0.5)))
    );
    y -= b.gapBefore ?? 0;

    for (const line of wrap(b.text, maxChars)) {
      if (y - leading < MARGIN) newPage();
      y -= leading;
      ops.push(
        `BT /${b.bold ? 'F2' : 'F1'} ${b.size} Tf ${MARGIN + indent} ${y.toFixed(2)} Td (${esc(line)}) Tj ET`
      );
    }
  }
  if (ops.length || pages.length === 0) pages.push(ops.join('\n'));

  // Objects: 1 Catalog, 2 Pages, 3 F1, 4 F2, then (page, content) pairs
  const objects: string[] = [];
  const kids: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] =
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

  pages.forEach((content, i) => {
    const pageNum = 5 + i * 2;
    const contentNum = pageNum + 1;
    kids.push(`${pageNum} 0 R`);
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
    objects[contentNum] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let n = 1; n < objects.length; n++) {
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let n = 1; n < objects.length; n++) {
    out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  return Buffer.from(out, 'latin1');
}
