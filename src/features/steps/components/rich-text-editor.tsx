'use client';

import * as React from 'react';
import {
  Bold,
  Code,
  Eraser,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
} from 'lucide-react';
import {
  TreeNode,
  hasUnsupportedMarkdown,
  markdownToHtml,
  normalizeNotes,
  safeUrl,
  treeToMarkdown,
} from '@/lib/notes';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  value: string;
  /** Called (debounced) while typing with the Markdown value. */
  onChange: (markdown: string) => void;
  /** Called when the editor loses focus, with the final Markdown value. */
  onCommit: (markdown: string) => void;
  placeholder?: string;
}

function domToTree(node: Node): TreeNode[] {
  const out: TreeNode[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out.push({ text: child.textContent ?? '' });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      out.push({
        tag: el.tagName.toLowerCase(),
        href: el.tagName === 'A' ? (el.getAttribute('href') ?? undefined) : undefined,
        children: domToTree(el),
      });
    }
  });
  return out;
}

const toMarkdown = (root: HTMLElement) => treeToMarkdown(domToTree(root));

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function currentBlockTag(): string {
  const sel = window.getSelection();
  let node: Node | null = sel?.anchorNode ?? null;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  while (node && !/^(P|DIV|H1|H2|H3|BLOCKQUOTE|LI|PRE)$/.test((node as HTMLElement).tagName)) {
    node = node.parentNode;
  }
  return (node as HTMLElement | null)?.tagName ?? '';
}

/**
 * Lightweight rich-text editor (no extra dependencies). Content is stored as Markdown:
 * the DOM is converted with an allow-listed converter, pasted content is re-rendered from
 * plain text, and raw HTML never reaches the database.
 */
export function RichTextEditor({ value, onChange, onCommit, placeholder }: RichTextEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const latest = React.useRef(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mode, setMode] = React.useState<'rich' | 'markdown'>(
    hasUnsupportedMarkdown(value) ? 'markdown' : 'rich'
  );
  const [md, setMd] = React.useState(value);
  const [empty, setEmpty] = React.useState(!value.trim());

  // Load HTML into the editor only when it (re)appears, so typing never moves the caret
  React.useEffect(() => {
    if (mode === 'rich' && ref.current) {
      ref.current.innerHTML = markdownToHtml(normalizeNotes(latest.current));
      setEmpty(!ref.current.textContent?.trim());
    }
  }, [mode]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const emit = (immediate: boolean) => {
    const root = ref.current;
    if (!root) return;
    setEmpty(!root.textContent?.trim());
    const markdown = toMarkdown(root);
    latest.current = markdown;
    if (timer.current) clearTimeout(timer.current);
    if (immediate) onChange(markdown);
    else timer.current = setTimeout(() => onChange(markdown), 300);
  };

  const run = (fn: () => void) => {
    ref.current?.focus();
    fn();
    emit(false);
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    // Markdown-style shortcuts: "- " / "* " / "• " => bullet list, "1. " => numbered list
    const native = e.nativeEvent as InputEvent;
    if (native.inputType === 'insertText' && native.data === ' ') {
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      if (sel && node && node.nodeType === Node.TEXT_NODE && sel.anchorOffset <= 3) {
        const before = (node.textContent ?? '').slice(0, sel.anchorOffset);
        const bullet = /^(?:[-*•])\s$/.test(before);
        const numbered = /^\d+[.)]\s$/.test(before);
        if ((bullet || numbered) && currentBlockTag() !== 'LI') {
          node.textContent = (node.textContent ?? '').slice(before.length);
          const range = document.createRange();
          range.setStart(node, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          exec(numbered ? 'insertOrderedList' : 'insertUnorderedList');
        }
      }
    }
    emit(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    // Re-render from plain text through our own converter: foreign HTML is never inserted
    exec('insertHTML', markdownToHtml(normalizeNotes(text)));
    emit(false);
  };

  const toggleBlock = (tag: 'h2' | 'blockquote') =>
    run(() => exec('formatBlock', currentBlockTag() === tag.toUpperCase() ? 'p' : tag));

  const addLink = () => {
    const url = window.prompt('Link URL (https://…)');
    const safe = url ? safeUrl(url) : null;
    if (safe) run(() => exec('createLink', safe));
  };

  const makeCode = () => {
    const text = window.getSelection()?.toString();
    if (!text) return;
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    run(() => exec('insertHTML', `<code>${esc}</code>`));
  };

  const switchMode = (next: 'rich' | 'markdown') => {
    if (next === mode) return;
    if (mode === 'rich' && ref.current) {
      const markdown = toMarkdown(ref.current);
      latest.current = markdown;
      setMd(markdown);
      onChange(markdown);
    } else {
      latest.current = md;
    }
    setMode(next);
  };

  const tool = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      key={label}
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-colors"
    >
      {icon}
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-surface focus-within:ring-2 focus-within:ring-primary/50">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 px-1.5 py-1">
        {mode === 'rich' && (
          <>
            {tool('Bold (Ctrl+B)', <Bold className="h-3.5 w-3.5" />, () => run(() => exec('bold')))}
            {tool('Italic (Ctrl+I)', <Italic className="h-3.5 w-3.5" />, () =>
              run(() => exec('italic'))
            )}
            {tool('Heading', <Heading2 className="h-3.5 w-3.5" />, () => toggleBlock('h2'))}
            {tool('Bulleted list', <List className="h-3.5 w-3.5" />, () =>
              run(() => exec('insertUnorderedList'))
            )}
            {tool('Numbered list', <ListOrdered className="h-3.5 w-3.5" />, () =>
              run(() => exec('insertOrderedList'))
            )}
            {tool('Quote', <Quote className="h-3.5 w-3.5" />, () => toggleBlock('blockquote'))}
            {tool('Inline code', <Code className="h-3.5 w-3.5" />, makeCode)}
            {tool('Link', <Link2 className="h-3.5 w-3.5" />, addLink)}
            {tool('Clear formatting', <Eraser className="h-3.5 w-3.5" />, () =>
              run(() => {
                exec('removeFormat');
                exec('formatBlock', 'p');
              })
            )}
            {tool('Undo', <Undo2 className="h-3.5 w-3.5" />, () => run(() => exec('undo')))}
            {tool('Redo', <Redo2 className="h-3.5 w-3.5" />, () => run(() => exec('redo')))}
          </>
        )}
        <div className="ml-auto flex items-center gap-1 text-[11px]">
          {(['rich', 'markdown'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => switchMode(m)}
              className={cn(
                'rounded-md px-2 py-0.5 font-medium capitalize transition-colors',
                mode === m
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m === 'rich' ? 'Rich text' : 'Markdown'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'rich' ? (
        <div className="relative">
          {empty && placeholder && (
            <span className="pointer-events-none absolute left-3 top-3 text-xs italic text-muted-foreground">
              {placeholder}
            </span>
          )}
          <div
            ref={ref}
            role="textbox"
            aria-multiline="true"
            aria-label="Notes"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={handleInput}
            onPaste={handlePaste}
            onBlur={() => {
              if (timer.current) clearTimeout(timer.current);
              if (ref.current) onCommit(toMarkdown(ref.current));
            }}
            className="notes-content min-h-[9rem] max-h-80 overflow-y-auto p-3 text-xs text-foreground focus:outline-none"
          />
        </div>
      ) : (
        <textarea
          value={md}
          onChange={(e) => {
            setMd(e.target.value);
            latest.current = e.target.value;
            onChange(e.target.value);
          }}
          onBlur={() => onCommit(md)}
          placeholder="Write notes in Markdown…"
          className="h-44 w-full resize-y bg-transparent p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      )}
    </div>
  );
}
