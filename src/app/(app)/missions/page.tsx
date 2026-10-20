import { Metadata } from 'next';
import { Target, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Missions',
};

export default function MissionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Missions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Active multi-day project pipelines</p>
        </div>
        <Link href="/missions/new">
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2 text-xs">
            <Plus className="h-4 w-4" />
            <span>Create Mission</span>
          </Button>
        </Link>
      </div>

      <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center">
        <Target className="mx-auto h-10 w-10 text-muted-foreground mb-3 opacity-60" />
        <h3 className="text-sm font-semibold text-foreground">No missions created yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
          Missions turn a big initiative into sequenced daily lanes.
        </p>
        <Link href="/missions/new">
          <Button variant="secondary" size="sm" className="text-xs">
            Get Started
          </Button>
        </Link>
      </div>
    </div>
  );
}
