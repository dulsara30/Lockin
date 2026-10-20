import { Metadata } from 'next';
import { BarChart2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Insights',
};

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Insights</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Burn-down, velocity, planned vs actual time analytics
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center">
        <BarChart2 className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-foreground">Analytics Engine</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          Insights populate automatically as you log step completion and time blocks.
        </p>
      </div>
    </div>
  );
}
