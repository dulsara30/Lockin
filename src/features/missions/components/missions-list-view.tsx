'use client';

import * as React from 'react';
import Link from 'next/link';
import { Target, Plus, Calendar, Clock, ArrowRight, Trash2, Archive, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  actionGetMissions,
  actionArchiveMission,
  actionDeleteMission,
} from '@/features/missions/actions';
import { toast } from 'sonner';

interface MissionSummary {
  _id: string;
  title: string;
  description?: string;
  color: string;
  priority: string;
  dayCount: number;
  startDate: string;
  deadline: string;
  status: string;
  archived: boolean;
  createdAt: string;
}

export function MissionsListView() {
  const [missions, setMissions] = React.useState<MissionSummary[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchMissions = async () => {
    setIsLoading(true);
    const res = await actionGetMissions();
    if (res.success && res.data) {
      setMissions(res.data);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchMissions();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this mission?')) return;
    const res = await actionDeleteMission(id);
    if (res.success) {
      toast.success('Mission deleted');
      setMissions((prev) => prev.filter((m) => m._id !== id));
    } else {
      toast.error('Failed to delete mission');
    }
  };

  const handleArchive = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await actionArchiveMission(id, true);
    if (res.success) {
      toast.success('Mission archived');
      setMissions((prev) => prev.filter((m) => m._id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Missions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Active multi-day project pipelines</p>
        </div>
        <Link href="/missions/new">
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2 text-xs font-medium shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            <span>Create Mission</span>
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-40 rounded-2xl border border-border bg-surface/40 animate-pulse p-6"
            />
          ))}
        </div>
      ) : missions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center">
          <Target className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground">No active missions</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-6">
            Lockin turns big objectives into sequenced daily pipelines. Create your first mission to
            get started.
          </p>
          <Link href="/missions/new">
            <Button className="bg-primary hover:bg-primary-hover text-white text-xs gap-2">
              <Plus className="h-4 w-4" />
              <span>Create Your First Mission</span>
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {missions.map((mission) => (
            <Link
              key={mission._id}
              href={`/runway?missionId=${mission._id}`}
              className="group block relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: mission.color || '#7C5CFF' }}
              />

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {mission.title}
                  </h3>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                    {mission.priority}
                  </span>
                </div>

                {mission.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {mission.description}
                  </p>
                )}

                <div className="pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{mission.dayCount} Days</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleArchive(mission._id, e)}
                      className="p-1 rounded hover:bg-surface-hover hover:text-foreground text-muted-foreground"
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDelete(mission._id, e)}
                      className="p-1 rounded hover:bg-danger/20 hover:text-danger text-muted-foreground"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
