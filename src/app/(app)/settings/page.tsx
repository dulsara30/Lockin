import { Metadata } from 'next';
import { Settings as SettingsIcon, Sliders, KeyRound, Shield, Clock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="pb-4 border-b border-border/60">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Workspace preferences, capacity configuration, and API keys
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <Clock className="h-4 w-4" />
            <span>Capacity & Timezone</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Default daily working hours (4h), timezone (Asia/Colombo), and weekday limits.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2 text-info font-semibold text-sm">
            <KeyRound className="h-4 w-4" />
            <span>Gemini AI BYOK</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Bring your own Gemini API key for up to 100 plan generations per day (stored AES-256-GCM
            encrypted).
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2 text-warning font-semibold text-sm">
            <Sliders className="h-4 w-4" />
            <span>Custom Fields & Statuses</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Customize task columns, statuses, priority levels, and display density.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center gap-2 text-success font-semibold text-sm">
            <Shield className="h-4 w-4" />
            <span>Security & Data</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Export workspace as JSON or Markdown. Multi-user session management.
          </p>
        </div>
      </div>
    </div>
  );
}
