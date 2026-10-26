'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  Table,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { actionExportRunway } from '@/features/export/actions';
import type { ExportFormat } from '@/lib/export/runway-export';

interface ExportMenuProps {
  runwayId: string;
  /** When set, only this day (0-based) is exported; otherwise the whole runway. */
  dayIndex?: number;
  className?: string;
}

const OPTIONS: { format: ExportFormat; label: string; hint: string; icon: React.ElementType }[] = [
  { format: 'pdf', label: 'PDF document', hint: '.pdf', icon: FileType },
  { format: 'xlsx', label: 'Excel workbook', hint: '.xlsx', icon: FileSpreadsheet },
  { format: 'csv', label: 'CSV spreadsheet', hint: '.csv', icon: Table },
  { format: 'md', label: 'Markdown', hint: '.md (re-importable)', icon: FileText },
  { format: 'json', label: 'JSON', hint: '.json (re-importable)', icon: FileJson },
];

function download(filename: string, mime: string, encoding: 'utf8' | 'base64', content: string) {
  let part: BlobPart;
  if (encoding === 'base64') {
    const bin = atob(content);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    part = bytes;
  } else {
    part = content;
  }
  const url = URL.createObjectURL(new Blob([part], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ExportMenu({ runwayId, dayIndex, className }: ExportMenuProps) {
  const [busy, setBusy] = React.useState<ExportFormat | null>(null);
  const isDay = dayIndex !== undefined;

  const run = async (format: ExportFormat) => {
    setBusy(format);
    try {
      const res = await actionExportRunway({ runwayId, dayIndex, format });
      if (res.success) {
        download(res.filename, res.mime, res.encoding, res.content);
        toast.success(
          `Exported ${isDay ? `Day ${dayIndex + 1}` : 'full runway'} as ${format.toUpperCase()}`
        );
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error('Export failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          className={className ?? 'text-xs gap-1.5 border-border bg-surface hover:bg-surface-hover'}
          title={isDay ? 'Export this day' : 'Export the whole runway'}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span>{isDay ? 'Export Day' : 'Export'}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          {isDay ? `Day ${dayIndex + 1} only` : 'All days, tasks and subtasks'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ format, label, hint, icon: Icon }) => (
          <DropdownMenuItem
            key={format}
            onSelect={() => void run(format)}
            className="gap-2 text-xs cursor-pointer"
          >
            <Icon className="h-4 w-4 text-primary" />
            <span className="flex-1">{label}</span>
            <span className="text-[10px] text-muted-foreground">{hint}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
