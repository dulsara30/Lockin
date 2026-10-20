'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { actionCreateMission } from '@/features/missions/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
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
  const [dayCount, setDayCount] = React.useState(5);
  const [tags, setTags] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);
    const startDate = new Date();
    const deadline = new Date(startDate.getTime() + dayCount * 24 * 60 * 60 * 1000);

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
      dayCount: Number(dayCount),
      startDate,
      deadline,
    });

    setIsSubmitting(false);

    if (res.success && res.data) {
      toast.success('Mission pipeline created!');
      router.push(`/runway?missionId=${res.data._id}`);
    } else {
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
            Configure the multi-day runway for your initiative
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
          <Label htmlFor="desc">Description / Objectives (Optional)</Label>
          <textarea
            id="desc"
            rows={3}
            placeholder="Context, core deliverables, and desired outcomes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="days">Runway Length ({dayCount} Days)</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={30}
              value={dayCount}
              onChange={(e) => setDayCount(Math.max(1, Math.min(30, Number(e.target.value))))}
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
          <Label>Accent Pipeline Color</Label>
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
            placeholder="dev, urgent, personal, launch"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="text-xs"
          />
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
            className="bg-gradient-to-r from-primary to-info text-white font-medium shadow-md shadow-primary/25 gap-2 text-xs"
          >
            <span>{isSubmitting ? 'Initializing...' : 'Initialize Runway'}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
