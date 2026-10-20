import { Metadata } from 'next';
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Lock-In Mode',
};

export default function LockinModePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-2 shadow-lg shadow-primary/10">
        <Zap className="h-7 w-7 text-primary" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Lock-In Mode</h1>
      <p className="text-xs text-muted-foreground max-w-sm">
        Full-screen single step focus with big mono timer and auto time logs.
      </p>
      <Link href="/today">
        <Button variant="outline" size="sm" className="mt-2 text-xs">
          Return to Today
        </Button>
      </Link>
    </div>
  );
}
