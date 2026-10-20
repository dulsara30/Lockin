'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  Calendar,
  Clock,
  ArrowRight,
  Trash2,
  Archive,
  Route,
  CheckCircle2,
  Settings2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  actionGetMissions,
  actionArchiveMission,
  actionDeleteMission,
} from '@/features/missions/actions';
import { MissionModal, MissionWithRunway } from './mission-modal';
import { toast } from 'sonner';

export function MissionsListView() {
  const [missions, setMissions] = React.useState<MissionWithRunway[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [selectedMission, setSelectedMission] = React.useState<MissionWithRunway | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

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

  const handleOpenMissionModal = (mission: MissionWithRunway) => {
    setSelectedMission(mission);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this mission and its runway?')) return;
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
          <p className="text-xs text-muted-foreground mt-0.5">
            Core initiatives and tasks. Click any mission to inspect, edit details, or configure its
            runway.
          </p>
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
              className="h-44 rounded-2xl border border-border bg-surface/40 animate-pulse p-6"
            />
          ))}
        </div>
      ) : missions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-surface/30 p-12 text-center max-w-lg mx-auto">
          <Target className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground">No active missions</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-6">
            Missions are your high-level tasks and objectives. A mission can live without a runway,
            or you can attach a sequenced execution runway to it anytime.
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
          {missions.map((mission) => {
            const hasRunway = !!mission.hasRunway;
            const stepCount = mission.stepCount ?? 0;
            const completedCount = mission.completedStepCount ?? 0;
            const pct = stepCount > 0 ? Math.round((completedCount / stepCount) * 100) : 0;

            return (
              <div
                key={mission._id}
                onClick={() => handleOpenMissionModal(mission)}
                className="group cursor-pointer relative overflow-hidden rounded-2xl border border-border bg-surface p-5 transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 flex flex-col justify-between"
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

                  {/* Runway Status & KPI */}
                  <div className="flex items-center gap-2.5 pt-2 text-xs font-mono">
                    {hasRunway ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold">
                        <Route className="h-3.5 w-3.5" />
                        <span>Runway Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border text-[11px]">
                        <span>No Runway</span>
                      </span>
                    )}

                    {hasRunway && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-background text-muted-foreground border border-border text-[11px]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-lime" />
                        <span>
                          {completedCount}/{stepCount}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {stepCount > 0 && (
                    <div className="w-full bg-background h-1.5 rounded-full overflow-hidden border border-border">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3 mt-4 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Due {new Date(mission.deadline).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-primary group-hover:underline flex items-center gap-1 font-sans font-medium">
                      <span>Details & Edit</span>
                      <Settings2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mission Details & Edit Modal */}
      <MissionModal
        mission={selectedMission}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onMissionUpdated={() => fetchMissions()}
        onMissionDeleted={(deletedId) => {
          setMissions((prev) => prev.filter((m) => m._id !== deletedId));
        }}
      />
    </div>
  );
}
