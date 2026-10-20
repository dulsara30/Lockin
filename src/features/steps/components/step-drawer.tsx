'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Clock,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  Play,
  FileText,
  Tag,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StepStatus } from '@/lib/planning';
import { actionUpdateStep, actionDeleteStep } from '@/features/missions/actions';
import { toast } from 'sonner';
import Link from 'next/link';

export interface StepData {
  _id: string;
  missionId: string;
  dayIndex: number;
  order: string;
  title: string;
  notes: string;
  estimateMin: number;
  actualMin: number;
  status: StepStatus;
  checklist: { text: string; done: boolean }[];
  customFields?: Record<string, unknown>;
}

interface StepDrawerProps {
  step: StepData | null;
  isOpen: boolean;
  onClose: () => void;
  onStepUpdated: (updated: StepData) => void;
  onStepDeleted: (stepId: string) => void;
}

const statusOptions: { label: string; value: StepStatus; color: string }[] = [
  { label: 'To Do', value: 'todo', color: 'bg-muted-foreground/30 text-foreground' },
  { label: 'In Progress', value: 'doing', color: 'bg-primary/20 text-primary border-primary/30' },
  { label: 'Done', value: 'done', color: 'bg-success/20 text-success border-success/30' },
  { label: 'Blocked', value: 'blocked', color: 'bg-danger/20 text-danger border-danger/30' },
  { label: 'Skipped', value: 'skipped', color: 'bg-muted text-muted-foreground' },
];

export function StepDrawer({
  step,
  isOpen,
  onClose,
  onStepUpdated,
  onStepDeleted,
}: StepDrawerProps) {
  const [isEditingNotes, setIsEditingNotes] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [estimateMin, setEstimateMin] = React.useState(30);
  const [status, setStatus] = React.useState<StepStatus>('todo');
  const [checklist, setChecklist] = React.useState<{ text: string; done: boolean }[]>([]);
  const [newSubtask, setNewSubtask] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (step) {
      setTitle(step.title);
      setNotes(step.notes || '');
      setEstimateMin(step.estimateMin || 30);
      setStatus(step.status);
      setChecklist(step.checklist || []);
      setIsEditingNotes(!step.notes);
    }
  }, [step]);

  if (!step) return null;

  const handleSave = async (overrides: Partial<StepData> = {}) => {
    setIsSaving(true);
    const payload = {
      title,
      notes,
      estimateMin: Number(estimateMin),
      status,
      checklist,
      ...overrides,
    };

    const res = await actionUpdateStep(step._id, payload);
    setIsSaving(false);

    if (res.success && res.data) {
      toast.success('Step saved');
      onStepUpdated(res.data);
    } else {
      toast.error('Failed to update step');
    }
  };

  const handleStatusChange = (newStatus: StepStatus) => {
    setStatus(newStatus);
    handleSave({ status: newStatus });
  };

  const handleToggleSubtask = (index: number) => {
    const updated = [...checklist];
    updated[index].done = !updated[index].done;
    setChecklist(updated);
    handleSave({ checklist: updated });
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;

    const updated = [...checklist, { text: newSubtask.trim(), done: false }];
    setChecklist(updated);
    setNewSubtask('');
    handleSave({ checklist: updated });
  };

  const handleRemoveSubtask = (index: number) => {
    const updated = checklist.filter((_, i) => i !== index);
    setChecklist(updated);
    handleSave({ checklist: updated });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this step?')) return;
    const res = await actionDeleteStep(step._id);
    if (res.success) {
      toast.success('Step deleted');
      onStepDeleted(step._id);
      onClose();
    } else {
      toast.error('Failed to delete step');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-surface border-border p-6 shadow-2xl">
        <DialogHeader className="space-y-3 pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                Day {step.dayIndex + 1}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-mono">{step.actualMin || 0}m actual</span>
              </div>
            </div>

            <Link href={`/lockin?stepId=${step._id}`}>
              <Button
                size="sm"
                className="bg-primary/20 text-primary hover:bg-primary hover:text-white border border-primary/30 gap-1.5 text-xs h-7"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Lock In</span>
              </Button>
            </Link>
          </div>

          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleSave()}
            className="text-lg font-bold border-transparent hover:border-border focus:border-primary bg-transparent px-1 -ml-1 transition-colors"
            placeholder="Step title..."
          />
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Status and Estimate Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      status === opt.value
                        ? `${opt.color} ring-1 ring-primary/40 scale-105`
                        : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="estimate">Estimate (Minutes)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="estimate"
                  type="number"
                  min={5}
                  step={5}
                  value={estimateMin}
                  onChange={(e) => setEstimateMin(Number(e.target.value))}
                  onBlur={() => handleSave()}
                  className="w-28 font-mono text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  ({(estimateMin / 60).toFixed(1)} hrs)
                </span>
              </div>
            </div>
          </div>

          {/* Subtasks Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
                <span>
                  Checklist ({checklist.filter((c) => c.done).length}/{checklist.length})
                </span>
              </Label>
            </div>

            <div className="space-y-1.5">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="group flex items-center justify-between gap-2 p-2 rounded-xl bg-surface-hover/50 hover:bg-surface-hover transition-colors text-xs"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleSubtask(idx)}
                    className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                  >
                    {item.done ? (
                      <CheckSquare className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span
                      className={
                        item.done
                          ? 'line-through text-muted-foreground truncate'
                          : 'text-foreground truncate'
                      }
                    >
                      {item.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveSubtask(idx)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-danger p-1 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
                <Input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add a subtask..."
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="secondary" className="h-8 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>

          {/* Markdown Notes (Strictly markdown, no raw HTML rendered) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-info" />
                <span>Notes & Context (Markdown)</span>
              </Label>
              <button
                type="button"
                onClick={() => setIsEditingNotes(!isEditingNotes)}
                className="text-xs text-primary hover:underline"
              >
                {isEditingNotes ? 'Preview' : 'Edit'}
              </button>
            </div>

            {isEditingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => handleSave()}
                placeholder="Write notes, steps, links or specifications in Markdown..."
                className="w-full h-32 rounded-xl border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y font-mono"
              />
            ) : (
              <div
                onClick={() => setIsEditingNotes(true)}
                className="min-h-[5rem] rounded-xl border border-border bg-surface/50 p-3 text-xs text-foreground/90 cursor-pointer hover:border-primary/40 transition-colors prose prose-invert prose-xs max-w-none"
              >
                {notes ? (
                  <ReactMarkdown>{notes}</ReactMarkdown>
                ) : (
                  <span className="text-muted-foreground italic">
                    Click to add notes in markdown...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              className="text-danger hover:bg-danger/10 hover:text-danger text-xs gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Step</span>
            </Button>

            <Button size="sm" onClick={() => handleSave()} disabled={isSaving} className="text-xs">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
