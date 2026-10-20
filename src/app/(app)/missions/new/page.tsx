'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { actionCreateMission } from '@/features/missions/actions';
import { actionCreateRunway } from '@/features/runway/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Sparkles, ArrowRight, ArrowLeft, Route } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const paletteColors = [
  '#7C5CFF', // Violet
  '#2DE2E6', // Cyan
  '#C6FF3D', // Lime
  '#FFB020', // Amber
  '#FF5D73', // Coral
  '#FF61D2', // Pink
  '#38EF7D', // Emerald
];

export default function NewMissionPage() {
  const router = useRouter();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [color, setColor] = React.useState('#7C5CFF');
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [deadlineDays, setDeadlineDays] = React.useState(14);
  const [tags, setTags] = React.useState('');
  const [createInitialRunway, setCreateInitialRunway] = React.useState(false);
  const [runwayDays, setRunwayDays] = React.useState(5);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Mission title is required');
      return;
    }

    setIsSubmitting(true);
    const startDate = new Date();
    const deadline = new Date(startDate.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

    const res = await actionCreateMission({
      title: title.trim(),
      description: description.trim(),
      color,
      priority,
      tags: tags
        ? tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      dayCount: Number(deadlineDays),
      startDate,
      deadline,
    });

    if (res.success && res.data) {
      const missionId = res.data._id;

      if (createInitialRunway) {
        const runwayRes = await actionCreateRunway({
          missionId,
          title: `${title.trim()} Main Runway`,
          dayCount: Number(runwayDays),
        });

        setIsSubmitting(false);
        if (runwayRes.success && runwayRes.data) {
          toast.success('Mission & initial runway created!');
          router.push(`/runway?missionId=${missionId}&runwayId=${runwayRes.data._id}`);
          return;
        }
      }

      setIsSubmitting(false);
      toast.success('Mission created successfully!');
      router.push(`/missions/${missionId}`);
    } else {
      setIsSubmitting(false);
      toast.error(res.error || 'Failed to create mission');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border/60">
        <Link href="/missions">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Create New Mission</h1>
          <p className="text-xs text-muted-foreground">
            Missions are your overarching goals and initiatives. Runways are created under missions.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border border-border bg-surface p-6 shadow-xl"
      >
        <div className="space-y-2">
          <Label htmlFor="title">Mission Title</Label>
          <Input
            id="title"
            required
            placeholder="e.g. Launch V1 Product, Complete Research Paper, Ship Feature"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-base font-medium"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Description / Scope (Optional)</Label>
          <textarea
            id="desc"
            rows={3}
            placeholder="Objectives, deliverables, key constraints..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="days">Mission Target Timeline ({deadlineDays} Days)</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={365}
              value={deadlineDays}
              onChange={(e) => setDeadlineDays(Math.max(1, Number(e.target.value)))}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`text-xs py-2 rounded-xl capitalize font-medium border transition-all ${
                    priority === p
                      ? 'border-primary bg-primary/20 text-primary font-semibold ring-1 ring-primary/40'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-hover'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Color Palette */}
        <div className="space-y-2">
          <Label>Accent Color</Label>
          <div className="flex items-center gap-3">
            {paletteColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  color === c
                    ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-background'
                    : 'hover:scale-110 opacity-80'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (Comma-separated)</Label>
          <Input
            id="tags"
            placeholder="launch, dev, sprint, client"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Optional Initial Runway */}
        <div className="p-4 rounded-xl border border-border bg-background/50 space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={createInitialRunway}
              onChange={(e) => setCreateInitialRunway(e.target.checked)}
              className="h-4 w-4 rounded accent-primary cursor-pointer"
            />
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Route className="h-4 w-4 text-primary" />
              <span>Initialize an execution runway immediately under this mission</span>
            </span>
          </label>

          {createInitialRunway && (
            <div className="pt-2 border-t border-border/60 pl-6">
              <div className="space-y-1.5 max-w-xs">
                <Label htmlFor="rDays" className="text-xs text-muted-foreground">
                  Runway Length (Days)
                </Label>
                <Input
                  id="rDays"
                  type="number"
                  min={1}
                  max={30}
                  value={runwayDays}
                  onChange={(e) => setRunwayDays(Math.max(1, Math.min(30, Number(e.target.value))))}
                  className="font-mono text-xs w-28"
                />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-between">
          <Link href="/missions">
            <Button variant="ghost" size="sm" type="button" className="text-xs">
              Cancel
            </Button>
          </Link>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary-hover text-white font-medium shadow-md shadow-primary/25 gap-2 text-xs"
          >
            <span>
              {isSubmitting
                ? 'Creating...'
                : createInitialRunway
                  ? 'Create Mission & Runway'
                  : 'Create Mission'}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
