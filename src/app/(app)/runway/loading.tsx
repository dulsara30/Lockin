import { Route, Loader2 } from 'lucide-react';

export default function RunwayLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-primary animate-spin" />
            <div className="h-4 w-28 bg-surface-raised rounded-md" />
          </div>
          <div className="h-7 w-48 bg-surface-raised rounded-lg" />
          <div className="h-3 w-72 bg-surface-raised/60 rounded" />
        </div>
        <div className="h-9 w-28 bg-surface-raised rounded-lg" />
      </div>

      {/* Loading Status Indicator */}
      <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Loading runway pipelines...</span>
      </div>

      {/* Grid of Runway Cards Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/80 bg-surface/60 p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-3.5 w-3.5 rounded-full bg-surface-raised" />
                <div className="h-5 w-32 bg-surface-raised rounded" />
              </div>
              <div className="h-5 w-16 bg-surface-raised rounded-full" />
            </div>

            <div className="h-3.5 w-full bg-surface-raised/50 rounded" />
            <div className="h-3.5 w-4/5 bg-surface-raised/40 rounded" />

            <div className="pt-3 border-t border-border/40 grid grid-cols-3 gap-2">
              <div className="h-8 bg-surface-raised/60 rounded-lg" />
              <div className="h-8 bg-surface-raised/60 rounded-lg" />
              <div className="h-8 bg-surface-raised/60 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
