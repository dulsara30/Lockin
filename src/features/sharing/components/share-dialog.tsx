'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, Loader2, LogOut, Pencil, Share2, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  actionAddMember,
  actionLeaveMission,
  actionListMembers,
  actionRemoveMember,
  actionUpdateMemberRole,
} from '@/features/sharing/actions';
import type { MemberRole, MissionRole } from '@/lib/access';
import { cn } from '@/lib/utils';

export interface MemberItem {
  userId: string;
  name: string;
  email: string;
  role: MissionRole;
  isOwner: boolean;
}

interface ShareDialogProps {
  missionId: string;
  missionTitle: string;
  myRole: MissionRole;
  currentUserId: string;
  initialMembers: MemberItem[];
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-primary/15 text-[11px] font-bold text-primary',
        className
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

const ROLE_LABEL: Record<MissionRole, string> = {
  owner: 'Owner',
  editor: 'Can edit',
  viewer: 'Can view',
};

/** Compact "who has access" button (avatar stack) that opens the sharing dialog. */
export function ShareDialog({
  missionId,
  missionTitle,
  myRole,
  currentUserId,
  initialMembers,
}: ShareDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [members, setMembers] = React.useState<MemberItem[]>(initialMembers);
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<MemberRole>('viewer');
  const [busy, setBusy] = React.useState<string | null>(null);
  const isOwner = myRole === 'owner';

  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const reload = React.useCallback(async () => {
    const res = await actionListMembers(missionId);
    if (res.success) setMembers(res.data as MemberItem[]);
  }, [missionId]);

  // Always show fresh membership when the dialog opens
  React.useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy('add');
    const res = await actionAddMember({ missionId, email, role });
    setBusy(null);
    if (res.success) {
      toast.success('Access granted');
      setEmail('');
      await reload();
    } else {
      toast.error(res.error);
    }
  };

  const handleRole = async (memberUserId: string, next: MemberRole) => {
    setBusy(memberUserId);
    const res = await actionUpdateMemberRole({ missionId, memberUserId, role: next });
    setBusy(null);
    if (res.success) {
      toast.success('Permission updated');
      await reload();
    } else {
      toast.error(res.error);
    }
  };

  const handleRemove = async (m: MemberItem) => {
    if (!confirm(`Remove ${m.name}? They will immediately lose access to this mission.`)) return;
    setBusy(m.userId);
    const res = await actionRemoveMember({ missionId, memberUserId: m.userId });
    setBusy(null);
    if (res.success) {
      toast.success('Access removed');
      await reload();
    } else {
      toast.error(res.error);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this mission? You will lose access until the owner shares it again.')) {
      return;
    }
    setBusy('leave');
    const res = await actionLeaveMission(missionId);
    setBusy(null);
    if (res.success) {
      toast.success('You left the mission');
      router.push('/missions');
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const shown = members.slice(0, 4);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-hover transition-colors"
        title="Members and sharing"
      >
        <span className="flex -space-x-2">
          {shown.map((m) => (
            <Avatar
              key={m.userId}
              name={m.name}
              className="h-6 w-6 text-[9px] ring-2 ring-surface"
            />
          ))}
        </span>
        <Share2 className="h-3.5 w-3.5 text-primary" />
        <span>{isOwner ? 'Share' : `${members.length} members`}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-surface border-border p-6 shadow-2xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>{isOwner ? 'Share mission' : 'Mission members'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              &ldquo;{missionTitle}&rdquo;.{' '}
              {isOwner
                ? 'Only people with a Lockin account can be added. Changes take effect immediately.'
                : `You have ${ROLE_LABEL[myRole].toLowerCase()} access.`}
            </DialogDescription>
          </DialogHeader>

          {isOwner && (
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 pt-2">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@email.com"
                autoComplete="off"
                className="text-xs flex-1"
                required
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className="rounded-xl border border-border bg-background px-2.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                aria-label="Permission"
              >
                <option value="viewer">Can view</option>
                <option value="editor">Can edit</option>
              </select>
              <Button
                type="submit"
                disabled={busy === 'add'}
                className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
              >
                {busy === 'add' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                <span>Add</span>
              </Button>
            </form>
          )}

          <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-border/50 rounded-xl border border-border/60">
            {members.map((m) => {
              const isMe = m.userId === currentUserId;
              return (
                <div key={m.userId} className="flex items-center gap-3 p-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {m.name}
                      {isMe && <span className="ml-1 text-muted-foreground">(you)</span>}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                  </div>

                  {m.isOwner || !isOwner ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {m.role === 'viewer' ? (
                        <Eye className="h-3 w-3" />
                      ) : m.role === 'editor' ? (
                        <Pencil className="h-3 w-3" />
                      ) : (
                        <ShieldCheck className="h-3 w-3 text-primary" />
                      )}
                      {ROLE_LABEL[m.role]}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={m.role}
                        disabled={busy === m.userId}
                        onChange={(e) => handleRole(m.userId, e.target.value as MemberRole)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-foreground focus:outline-none focus:border-primary"
                        aria-label={`Permission for ${m.name}`}
                      >
                        <option value="viewer">Can view</option>
                        <option value="editor">Can edit</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        disabled={busy === m.userId}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors"
                        title="Remove access"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isOwner && (
            <div className="flex justify-end pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLeave}
                disabled={busy === 'leave'}
                className="text-xs gap-1.5 text-danger hover:bg-danger/10 hover:text-danger"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Leave mission</span>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
