import { Metadata } from 'next';
import { Route } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Runway',
};

export default function RunwayPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Runway</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hero pipeline view of daily capacity and workflow lanes
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center">
        <Route className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-foreground">Runway Pipeline View</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          Select or initialize a mission to inspect connected daily lanes and capacity forecasting.
        </p>
      </div>
    </div>
  );
}
