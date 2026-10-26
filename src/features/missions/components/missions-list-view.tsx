'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  Calendar,
  Route,
  CheckCircle2,
  ArrowRight,
  Users,
  Eye,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { actionGetMissions } from '@/features/missions/actions';
import { toast } from 'sonner';

export interface MissionListItem {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  color?: string;
  priority: string;
  deadline: string | Date;
  status: string;
  hasRunway?: boolean;
  stepCount?: number;
  completedStepCount?: number;
  runwayId?: string;
  role?: 'owner' | 'editor' | 'viewer';
  ownerName?: string;
  memberCount?: number;
}

type MissionFilter = 'all' | 'mine' | 'shared';

export function MissionsListView() {
  const [missions, setMissions] = React.useState<MissionListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<MissionFilter>('all');

  const fetchMissions = async () => {
    setIsLoading(true);
    const res = await actionGetMissions();
    if (res.success && res.data) {
      setMissions(res.data as MissionListItem[]);
    } else if (!res.success && res.error) {
      toast.error(res.error);
    }
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchMissions();
  }, []);

  const mineCount = missions.filter((m) => (m.role ?? 'owner') === 'owner').length;
  const sharedCount = missions.length - mineCount;
  const visible = missions.filter((m) => {
    const isMine = (m.role ?? 'owner') === 'owner';
    return filter === 'all' ? true : filter === 'mine' ? isMine : !isMine;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Missions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Core initiatives and tasks. Click any mission to inspect details, manage its runway, or
            edit properties.
          </p>
        </div>
        <Link href="/missions/new">
          <Button className="bg-primary hover:bg-primary-hover text-white gap-2 text-xs font-medium shadow-md shadow-primary/20">
            <Plus className="h-4 w-4" />
            <span>Create Mission</span>
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-1.5" role="tablist" aria-label="Mission filter">
        {(
          [
            ['all', 'All', missions.length],
            ['mine', 'My Missions', mineCount],
            ['shared', 'Shared with me', sharedCount],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              filter === key
                ? 'border-primary bg-primary/15 text-foreground'
                : 'border-border bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-mono opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-border bg-surface/40 animate-pulse p-6"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-4">
            <Target className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">
            {filter === 'shared' ? 'Nothing shared with you yet' : 'No missions created yet'}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 mb-6">
            Missions are the foundation of your plan. Break large initiatives into structured
            timeframes.
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
          {visible.map((mission) => {
            const completedCount = mission.completedStepCount || 0;
            const totalCount = mission.stepCount || 0;
            const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const deadlineFormatted = new Date(mission.deadline).toISOString().split('T')[0];

            return (
              <Link
                key={mission._id}
                href={`/missions/${mission._id}`}
                className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-surface/80 p-5 backdrop-blur-sm transition-all duration-200 hover:border-primary/50 hover:bg-surface-raised hover:shadow-lg hover:shadow-primary/5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: mission.color || '#7C5CFF' }}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                        {mission.category || 'Initiative'}
                      </span>
                      {mission.role && mission.role !== 'owner' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
                          {mission.role === 'editor' ? (
                            <Pencil className="h-2.5 w-2.5" />
                          ) : (
                            <Eye className="h-2.5 w-2.5" />
                          )}
                          <span>{mission.role === 'editor' ? 'Can edit' : 'View only'}</span>
                        </span>
                      )}
                      {mission.role === 'owner' && (mission.memberCount || 0) > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          <Users className="h-2.5 w-2.5" />
                          <span>{mission.memberCount}</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        mission.priority === 'urgent'
                          ? 'border-danger/30 text-danger bg-danger/10'
                          : mission.priority === 'high'
                            ? 'border-warning/30 text-warning bg-warning/10'
                            : 'border-border text-muted-foreground bg-surface'
                      }`}
                    >
                      {mission.priority}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {mission.title}
                  </h3>

                  {mission.role && mission.role !== 'owner' && mission.ownerName && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Shared by {mission.ownerName}
                    </p>
                  )}

                  {mission.description && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {mission.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border/60 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{deadlineFormatted}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      <span>
                        {completedCount}/{totalCount}
                      </span>
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-surface-raised rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] font-medium text-primary flex items-center gap-1 group-hover:underline">
                      <span>View Pipeline</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </span>
                    {mission.hasRunway && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan bg-cyan/10 border border-cyan/20 px-2 py-0.5 rounded-full">
                        <Route className="h-2.5 w-2.5" />
                        <span>Runway Active</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
