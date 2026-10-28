import { describe, it, expect } from 'vitest';
import {
  forDisplay,
  hasUnsupportedMarkdown,
  markdownToHtml,
  normalizeNotes,
  plainPreview,
  safeUrl,
  treeToMarkdown,
  TreeNode,
} from '@/lib/notes';

const t = (text: string): TreeNode => ({ text });
const el = (tag: string, ...children: TreeNode[]): TreeNode => ({ tag, children });

describe('normalizeNotes', () => {
  it('turns inline and line-start bullets into Markdown lists', () => {
    const out = normalizeNotes(
      'KEY FACTS: • Service Document: GET root • Metadata Document: GET $metadata'
    );
    expect(out).toBe(
      'KEY FACTS:\n\n- Service Document: GET root\n- Metadata Document: GET $metadata'
    );
    expect(out.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(2);
    expect(normalizeNotes('• one\n• two')).toBe('- one\n- two');
  });

  it('is idempotent and leaves code fences alone', () => {
    const once = normalizeNotes('Intro\n• a\n• b');
    expect(normalizeNotes(once)).toBe(once);
    const code = '```\n• not a list\n```';
    expect(normalizeNotes(code)).toBe(code);
  });

  it('puts a blank line before a list that follows text', () => {
    expect(normalizeNotes('Steps:\n- a\n- b')).toBe('Steps:\n\n- a\n- b');
  });
});

describe('forDisplay', () => {
  it('keeps single line breaks inside paragraphs but not around lists', () => {
    expect(forDisplay('line one\nline two')).toBe('line one  \nline two');
    expect(forDisplay('Title\n\n- a\n- b')).toBe('Title\n\n- a\n- b');
  });
});

describe('markdownToHtml', () => {
  it('renders lists, nested lists, headings, emphasis and code', () => {
    const html = markdownToHtml(
      '## Title\n\n- one\n  - nested\n- two\n\n1. first\n2. second\n\n**b** *i* `c`'
    );
    expect(html).toContain('<h2>Title</h2>');
    expect(html).toContain('<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>');
    expect(html).toContain('<ol><li>first</li><li>second</li></ol>');
    expect(html).toContain('<strong>b</strong>');
    expect(html).toContain('<em>i</em>');
    expect(html).toContain('<code>c</code>');
  });

  it('never emits raw HTML or unsafe links (XSS)', () => {
    const html = markdownToHtml(
      '<script>alert(1)</script> <img src=x onerror=alert(1)> [x](javascript:alert(1)) [ok](https://a.com)'
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="https://a.com"');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes code block content', () => {
    expect(markdownToHtml('```\n<b>x</b>\n```')).toBe(
      '<pre><code>&lt;b&gt;x&lt;/b&gt;</code></pre>'
    );
  });
});

describe('treeToMarkdown', () => {
  it('converts editor DOM structure to Markdown', () => {
    const md = treeToMarkdown([
      el('h2', t('Plan')),
      el('div', t('Intro '), el('strong', t('bold')), t(' and '), el('em', t('italic'))),
      el('ul', el('li', t('one'), el('ul', el('li', t('nested')))), el('li', t('two'))),
      el('ol', el('li', t('first')), el('li', t('second'))),
      el('blockquote', el('div', t('quoted'))),
    ]);
    expect(md).toBe(
      '## Plan\n\nIntro **bold** and *italic*\n\n- one\n  - nested\n- two\n\n1. first\n2. second\n\n> quoted'
    );
  });

  it('round-trips through HTML for the supported subset', () => {
    const md = '## Title\n\nSome **bold** text\n\n- a\n- b\n\n1. x\n2. y';
    const html = markdownToHtml(md);
    expect(html).toContain('<li>a</li>');
    // literal markdown characters typed by the user are escaped, then render literally
    const out = treeToMarkdown([el('p', t('2 * 3 = 6 and snake_case'))]);
    expect(out).toBe('2 \\* 3 = 6 and snake_case');
    expect(markdownToHtml(out)).toContain('2 * 3 = 6');
  });

  it('drops unsafe link hrefs', () => {
    const md = treeToMarkdown([
      el('p', { tag: 'a', href: 'javascript:alert(1)', children: [t('x')] }),
    ]);
    expect(md).toBe('x');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://a.com/p?q=1')).toBe('https://a.com/p?q=1');
  });
});

describe('helpers', () => {
  it('detects syntax the rich editor cannot represent', () => {
    expect(hasUnsupportedMarkdown('| a | b |\n|---|---|')).toBe(true);
    expect(hasUnsupportedMarkdown('![img](x.png)')).toBe(true);
    expect(hasUnsupportedMarkdown('- [ ] task')).toBe(true);
    expect(hasUnsupportedMarkdown('## Hi\n\n- a\n- b')).toBe(false);
  });

  it('makes a plain preview for cards', () => {
    expect(plainPreview('## Hi\n\n- **bold** item\n- [link](https://a.com)')).toBe(
      'Hi bold item link'
    );
    expect(plainPreview('x'.repeat(300), 20)).toHaveLength(21);
  });
});
