/**
 * Notes are stored as plain Markdown (never HTML). This module is pure (no DOM) so it can
 * be unit tested: it normalizes sloppy text (e.g. "•" bullets written by AI tools) into real
 * Markdown lists, and converts between Markdown and the small HTML subset used by the
 * rich-text editor. All HTML we emit is generated here from escaped text, never passed through.
 */

// ------------------------------------------------------------------ normalize
const BULLET = /^(\s*)[•▪◦●‣]\s+/;
const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+/;

/**
 * Turns "•" bullets (including several packed into one line) into Markdown "- " items.
 * Idempotent, and leaves fenced code blocks untouched.
 */
export function normalizeNotes(input: string): string {
  if (!input) return '';
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inFence = false;

  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      out.push(raw);
      continue;
    }
    if (inFence) {
      out.push(raw);
      continue;
    }

    if (BULLET.test(raw)) {
      const indent = raw.match(BULLET)![1];
      const rest = raw.replace(BULLET, '');
      pushBullets(out, indent, rest);
      continue;
    }

    // Inline bullets packed in one line: "Facts: • one • two"
    const parts = raw.split(/\s[•▪◦●‣]\s+/);
    if (parts.length >= 2 && (parts.length >= 3 || /:\s*$/.test(parts[0]))) {
      const head = parts[0].trimEnd();
      if (head) out.push(head);
      for (const item of parts.slice(1)) if (item.trim()) out.push(`- ${item.trim()}`);
      continue;
    }

    out.push(raw);
  }

  // A list should start after a blank line so every renderer treats it as a list
  const spaced: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const prev = spaced[spaced.length - 1];
    if (
      LIST_ITEM.test(out[i]) &&
      prev !== undefined &&
      prev.trim() !== '' &&
      !LIST_ITEM.test(prev) &&
      !/^\s/.test(out[i])
    ) {
      spaced.push('');
    }
    spaced.push(out[i]);
  }
  return spaced.join('\n');
}

function pushBullets(out: string[], indent: string, rest: string) {
  const parts = rest.split(/\s[•▪◦●‣]\s+/);
  out.push(`${indent}- ${parts[0].trim()}`);
  for (const p of parts.slice(1)) if (p.trim()) out.push(`${indent}- ${p.trim()}`);
}

/**
 * For display: also keeps single line breaks inside a paragraph (people type notes with
 * plain Enter), without touching lists, headings, quotes or code.
 */
export function forDisplay(md: string): string {
  const lines = normalizeNotes(md).split('\n');
  let inFence = false;
  const plain = (l: string) =>
    l.trim() !== '' && !LIST_ITEM.test(l) && !/^\s*(#{1,6}\s|>|```|---+\s*$)/.test(l);
  return lines
    .map((line, i) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return plain(line) && i + 1 < lines.length && plain(lines[i + 1]) ? `${line}  ` : line;
    })
    .join('\n');
}

/** Syntax the rich editor cannot represent; such notes open in Markdown mode instead. */
export function hasUnsupportedMarkdown(md: string): boolean {
  return (
    /^\s*\|.*\|\s*$/m.test(md) ||
    /!\[[^\]]*\]\(/.test(md) ||
    /<\/?[a-z][^>]*>/i.test(md) ||
    /^\s*[-*+]\s+\[[ xX]\]/m.test(md) ||
    /^\s*\[\^/m.test(md)
  );
}

// -------------------------------------------------------------- markdown -> html
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Only web / mail / site-relative links survive; anything else (javascript:, data:) is dropped. */
export function safeUrl(url: string): string | null {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(u) && !/[\s"<>]/.test(u)) return u;
  return null;
}

function inline(text: string): string {
  const escapes: string[] = [];
  // Backslash escapes become placeholders so they are never re-interpreted
  let s = text.replace(/\\([\\`*_[\]#>+\-.!()|])/g, (_m, c: string) => {
    escapes.push(c);
    return `\u0000${escapes.length - 1}\u0000`;
  });
  s = escapeHtml(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const safe = safeUrl(url.replace(/&amp;/g, '&'));
    return safe
      ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  });
  return s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => escapeHtml(escapes[Number(i)]));
}

interface ListNode {
  ordered: boolean;
  items: { html: string; children: ListNode[] }[];
}

const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function renderList(node: ListNode): string {
  const tag = node.ordered ? 'ol' : 'ul';
  return `<${tag}>${node.items
    .map((it) => `<li>${it.html}${it.children.map(renderList).join('')}</li>`)
    .join('')}</${tag}>`;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      html.push('<hr>');
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i]))
        quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      html.push(`<blockquote><p>${quote.map(inline).join('<br>')}</p></blockquote>`);
      continue;
    }

    if (ITEM.test(line)) {
      const stack: { indent: number; list: ListNode }[] = [];
      let root: ListNode | null = null;
      while (i < lines.length && ITEM.test(lines[i])) {
        const m = ITEM.exec(lines[i])!;
        const indent = m[1].replace(/\t/g, '  ').length;
        const ordered = /\d/.test(m[2]);
        const item = { html: inline(m[3]), children: [] as ListNode[] };

        while (stack.length && indent < stack[stack.length - 1].indent) stack.pop();
        if (!stack.length || indent > stack[stack.length - 1].indent) {
          const list: ListNode = { ordered, items: [] };
          if (stack.length) {
            const parent = stack[stack.length - 1].list;
            parent.items[parent.items.length - 1]?.children.push(list);
          } else {
            root = root ?? list;
          }
          stack.push({ indent, list });
        }
        stack[stack.length - 1].list.items.push(item);
        i++;
      }
      if (root) html.push(renderList(root));
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*(```|#{1,3}\s|>|---+\s*$)/.test(lines[i]) &&
      !ITEM.test(lines[i])
    ) {
      para.push(lines[i++]);
    }
    html.push(`<p>${para.map((l) => inline(l.trimEnd())).join('<br>')}</p>`);
  }

  return html.join('');
}

// -------------------------------------------------------------- tree -> markdown
export interface TreeNode {
  tag?: string; // lowercase element name, absent for text
  text?: string;
  href?: string;
  children?: TreeNode[];
}

const escapeMd = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/(^|[^\w])_|_(?=[^\w]|$)/g, (m) => m.replace('_', '\\_'))
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');

function inlineMd(nodes: TreeNode[] = []): string {
  return nodes
    .map((n) => {
      if (n.text !== undefined) return escapeMd(n.text.replace(/ /g, ' '));
      const inner = inlineMd(n.children);
      switch (n.tag) {
        case 'strong':
        case 'b':
          return inner.trim() ? `**${inner}**` : inner;
        case 'em':
        case 'i':
          return inner.trim() ? `*${inner}*` : inner;
        case 'code':
          return inner.trim() ? `\`${unescapeMd(inner)}\`` : inner;
        case 'a': {
          const safe = n.href ? safeUrl(n.href) : null;
          return safe && inner ? `[${inner}](${safe})` : inner;
        }
        case 'br':
          return '\n';
        default:
          return inner;
      }
    })
    .join('');
}

const unescapeMd = (s: string) => s.replace(/\\([\\*`_[\]])/g, '$1');

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'blockquote',
  'pre',
  'hr',
]);

function listMd(node: TreeNode, depth: number): string[] {
  const ordered = node.tag === 'ol';
  const lines: string[] = [];
  let n = 1;
  for (const li of node.children ?? []) {
    if (li.tag !== 'li') continue;
    const kids = li.children ?? [];
    const own = kids.filter((k) => k.tag !== 'ul' && k.tag !== 'ol');
    const text = inlineMd(own)
      .replace(/\s*\n\s*/g, ' ')
      .trim();
    lines.push(`${'  '.repeat(depth)}${ordered ? `${n++}.` : '-'} ${text}`);
    for (const sub of kids.filter((k) => k.tag === 'ul' || k.tag === 'ol')) {
      lines.push(...listMd(sub, depth + 1));
    }
  }
  return lines;
}

function blocksMd(nodes: TreeNode[]): string[] {
  const blocks: string[] = [];
  let run: TreeNode[] = [];
  const flush = () => {
    const text = inlineMd(run).trim();
    if (text) blocks.push(...text.split(/\n{2,}/).map((p) => p.replace(/\n/g, '  \n')));
    run = [];
  };

  for (const n of nodes) {
    if (n.text !== undefined || !n.tag || !BLOCK_TAGS.has(n.tag)) {
      run.push(n);
      continue;
    }
    flush();
    switch (n.tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = Math.min(3, Number(n.tag[1]));
        const text = inlineMd(n.children).trim();
        if (text) blocks.push(`${'#'.repeat(level)} ${text}`);
        break;
      }
      case 'ul':
      case 'ol':
        blocks.push(listMd(n, 0).join('\n'));
        break;
      case 'blockquote': {
        const inner = blocksMd(n.children ?? []).join('\n\n');
        if (inner)
          blocks.push(
            inner
              .split('\n')
              .map((l) => `> ${l}`)
              .join('\n')
          );
        break;
      }
      case 'pre': {
        const code = (n.children ?? []).map((c) => c.text ?? flattenText(c)).join('');
        blocks.push(`\`\`\`\n${code.replace(/\n$/, '')}\n\`\`\``);
        break;
      }
      case 'hr':
        blocks.push('---');
        break;
      default: {
        // p / div: a block of inline content (nested blocks are handled recursively)
        const hasBlock = (n.children ?? []).some((c) => c.tag && BLOCK_TAGS.has(c.tag));
        if (hasBlock) blocks.push(...blocksMd(n.children ?? []));
        else {
          const text = inlineMd(n.children).trim();
          if (text) blocks.push(text.replace(/\n/g, '  \n'));
        }
      }
    }
  }
  flush();
  return blocks.filter(Boolean);
}

function flattenText(n: TreeNode): string {
  return n.text ?? (n.children ?? []).map(flattenText).join('');
}

export function treeToMarkdown(nodes: TreeNode[]): string {
  return blocksMd(nodes).join('\n\n');
}

/** Plain-text preview of Markdown notes for cards (no syntax characters). */
export function plainPreview(md: string, max = 160): string {
  const text = normalizeNotes(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\\([\\`*_[\]#>+\-.!()|])/g, '$1')
    .replace(/(\*\*|__|\*|_|`)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}
