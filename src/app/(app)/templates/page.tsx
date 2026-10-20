import { Metadata } from 'next';
import { LayoutTemplate } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Templates',
};

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Templates</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reusable sprint structures and workflow blueprints
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center">
        <LayoutTemplate className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-foreground">Mission Blueprints</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          Save your best recurring sprints as templates to spin up new missions in seconds.
        </p>
      </div>
    </div>
  );
}
