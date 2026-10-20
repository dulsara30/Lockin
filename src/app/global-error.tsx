'use client';

import * as React from 'react';

export default function RootGlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error('Critical Root Error:', error.message);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">System Halt</h1>
          <p className="text-xs text-muted-foreground">
            A critical error occurred at the root level.
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary-hover"
          >
            Restart Application
          </button>
        </div>
      </body>
    </html>
  );
}
