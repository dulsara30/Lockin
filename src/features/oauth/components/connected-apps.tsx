'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { PlugZap, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { revokeConnectedAppAction } from '@/features/oauth/actions';
import { highestLevel } from '@/lib/oauth/core';
import type { ConnectedApp } from '@/server/dal/oauth';

const LEVEL_LABEL = ['No access', 'Read only', 'Read & write', 'Full access'];

const fmt = (iso?: string) =>
  iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : 'never';

export function ConnectedApps({ initialApps }: { initialApps: ConnectedApp[] }) {
  const [apps, setApps] = React.useState(initialApps);
  const [busy, setBusy] = React.useState<string | null>(null);

  const revoke = async (app: ConnectedApp) => {
    if (!confirm(`Disconnect ${app.clientName}? It will lose access immediately.`)) return;
    setBusy(app.id);
    const res = await revokeConnectedAppAction(app.id);
    setBusy(null);
    if (res.success) {
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success('App disconnected');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <PlugZap className="h-4 w-4 text-primary" />
          Connected apps
        </h3>
        <p className="text-xs text-muted-foreground">
          Apps you authorized through MCP (for example Claude). They act as you with the access you
          granted. Disconnecting revokes their tokens immediately.
        </p>
      </div>

      {apps.length === 0 ? (
        <p className="text-xs text-muted-foreground border border-dashed border-border rounded-xl p-4 text-center">
          No apps connected.
        </p>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
          {apps.map((app) => (
            <li key={app.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{app.clientName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {LEVEL_LABEL[highestLevel(app.scopes)]} &bull; connected {fmt(app.connectedAt)}{' '}
                  &bull; last used {fmt(app.lastUsedAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy === app.id}
                onClick={() => revoke(app)}
                className="text-xs gap-1.5 text-danger hover:bg-danger/10 hover:text-danger"
              >
                <Unplug className="h-3.5 w-3.5" />
                <span>Disconnect</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
