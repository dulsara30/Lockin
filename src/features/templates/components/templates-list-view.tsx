'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteTemplateAction, deployTemplateToMissionAction } from '@/features/templates/actions';
import { Button } from '@/components/ui/button';
import {
  LayoutTemplate,
  Calendar,
  Layers,
  ArrowRight,
  Trash2,
  Sparkles,
  Download,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export interface TemplateItem {
  _id: string;
  name: string;
  description?: string;
  structure: {
    title: string;
    description?: string;
    dayCount: number;
    hoursPerDay: number;
    priority: string;
    tags?: string[];
    days: Array<{
      dayIndex: number;
      steps: Array<{
        title: string;
        estimateMin: number;
      }>;
    }>;
  };
  createdAt: string;
}

interface TemplatesListViewProps {
  initialTemplates: TemplateItem[];
}

export function TemplatesListView({ initialTemplates }: TemplatesListViewProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>(initialTemplates);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleLaunch = async (templateId: string) => {
    setLoadingId(templateId);
    try {
      const res = await deployTemplateToMissionAction(templateId);
      if (res.success && res.missionId) {
        toast.success('Template deployed into new active runway! Lock in.');
        router.push(`/runway?missionId=${res.missionId}`);
      } else {
        toast.error(res.error || 'Failed to instantiate template.');
      }
    } catch {
      toast.error('Unexpected error launching template.');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      const res = await deleteTemplateAction(templateId);
      if (res.success) {
        setTemplates((prev) => prev.filter((t) => t._id !== templateId));
        toast.success('Template deleted.');
      } else {
        toast.error('Could not delete template.');
      }
    } catch {
      toast.error('Error deleting template.');
    }
  };

  const handleDownloadTemplateJson = (t: TemplateItem) => {
    const blob = new Blob([JSON.stringify(t.structure, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            <LayoutTemplate className="h-3.5 w-3.5 text-cyan" />
            <span>Reusable Pipelines</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Mission Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Save successful sprint structures and deploy multi-day runways in one click.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/brain-dump">
            <Button className="bg-primary hover:bg-primary/90 text-white font-medium text-xs gap-1.5 shadow-md shadow-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Import or Dump Plan</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Templates Grid */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <LayoutTemplate className="h-7 w-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-foreground">No saved templates yet</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              You can save any active mission from its runway page as a reusable template, or
              generate one from a brain dump.
            </p>
          </div>
          <Link href="/brain-dump">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-border text-foreground bg-background hover:bg-surface-hover gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 text-cyan" />
              <span>Create First Template</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => {
            const stepCount = tpl.structure.days.reduce(
              (acc, d) => acc + (d.steps?.length || 0),
              0
            );
            const totalHours =
              Math.round(
                (tpl.structure.days.reduce(
                  (acc, d) =>
                    acc + (d.steps?.reduce((sAcc, s) => sAcc + (s.estimateMin || 0), 0) || 0),
                  0
                ) /
                  60) *
                  10
              ) / 10;

            return (
              <div
                key={tpl._id}
                className="rounded-2xl border border-border bg-surface p-5 shadow-lg flex flex-col justify-between hover:border-primary/50 transition-all group space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-foreground tracking-tight group-hover:text-primary transition-colors">
                      {tpl.name}
                    </h3>
                    <button
                      onClick={() => handleDelete(tpl._id)}
                      className="text-muted-foreground hover:text-danger p-1 transition-colors"
                      title="Delete template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {tpl.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  )}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{tpl.structure.dayCount} Days</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 text-cyan" />
                    <span>
                      {stepCount} steps ({totalHours}h)
                    </span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => handleLaunch(tpl._id)}
                    disabled={loadingId === tpl._id}
                    className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium text-xs gap-1.5 shadow-md shadow-primary/20"
                  >
                    {loadingId === tpl._id ? (
                      'Deploying Runway...'
                    ) : (
                      <>
                        <span>Use Template</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleDownloadTemplateJson(tpl)}
                    className="h-8 w-8 border-border bg-background text-muted-foreground hover:text-foreground"
                    title="Export Template JSON"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
