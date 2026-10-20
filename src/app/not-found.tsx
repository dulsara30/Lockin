import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface mb-6 shadow-xl">
        <Compass className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-foreground">404</h1>
      <h2 className="mt-2 text-lg font-semibold text-foreground">Pipeline Off Course</h2>
      <p className="mt-2 text-xs text-muted-foreground max-w-sm">
        The destination you are seeking does not exist or has been shifted in your schedule.
      </p>
      <div className="mt-6">
        <Link href="/today">
          <Button variant="default" className="gap-2 text-xs">
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dispatch</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}
