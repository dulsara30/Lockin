'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Structured client logging without PII
    console.error('Application Error Boundary Caught:', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger mb-6 shadow-xl">
        <AlertTriangle className="h-8 w-8 text-danger" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Something went wrong</h1>
      <p className="mt-2 text-xs text-muted-foreground max-w-sm">
        An unexpected error interrupted this pipeline operation.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={() => reset()} variant="default" className="gap-2 text-xs">
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </Button>
      </div>
    </div>
  );
}
