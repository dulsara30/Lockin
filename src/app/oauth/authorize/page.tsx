import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { Eye, Pencil, ShieldAlert } from 'lucide-react';
import { auth } from '@/lib/auth';
import { env } from '@/lib/env';
import { getBaseUrl } from '@/lib/oauth/base-url';
import {
  highestLevel,
  isEmailAllowed,
  parseAllowedEmails,
  parseAuthorizeRequest,
  redirectUriMatches,
} from '@/lib/oauth/core';
import { getClient } from '@/server/dal/oauth';
import { submitAuthorizationAction } from '@/features/oauth/actions';
import { OAuthShell } from '@/features/oauth/components/oauth-shell';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Authorize',
  robots: { index: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

function ErrorCard({ message }: { message: string }) {
  return (
    <OAuthShell title="Cannot connect" subtitle={message}>
      <div className="flex justify-center">
        <Link href="/today">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Lockin
          </Button>
        </Link>
      </div>
    </OAuthShell>
  );
}

const LEVELS = [
  {
    value: 'read',
    title: 'Read only',
    desc: 'View missions, runways, steps, insights and exports.',
    icon: Eye,
  },
  {
    value: 'write',
    title: 'Read & write',
    desc: 'Also create and edit missions, runways and steps, use AI planning and log time.',
    icon: Pencil,
  },
  {
    value: 'critical',
    title: 'Full access',
    desc: 'Also delete steps and runways, archive missions and manage sharing. Each of these still needs your approval in the chat before it runs.',
    icon: ShieldAlert,
  },
] as const;

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const query = await searchParams;

  // Not signed in: use the normal Lockin login (Google or password), then come back here
  const session = await auth();
  if (!session?.user?.id) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (typeof v === 'string') qs.set(k, v);
    }
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${qs.toString()}`)}`);
  }

  const allowed = parseAllowedEmails(env.MCP_ALLOWED_EMAILS);
  if (allowed.length === 0)
    return <ErrorCard message="MCP access is not enabled on this server." />;
  if (!isEmailAllowed(session.user.email, allowed)) {
    return (
      <ErrorCard
        message={`${session.user.email ?? 'This account'} is not allowed to connect apps. MCP access is invite-only: to request it, contact the developer via dulsaramanakal.me.`}
      />
    );
  }

  const base = getBaseUrl(await headers(), env.NEXTAUTH_URL);
  const parsed = parseAuthorizeRequest(query, base);
  if (!parsed.ok) return <ErrorCard message={parsed.description} />;

  const client = await getClient(parsed.params.clientId);
  if (!client || !redirectUriMatches(client.redirectUris, parsed.params.redirectUri)) {
    return (
      <ErrorCard message="This app is not registered or its redirect address does not match." />
    );
  }

  const requested = highestLevel(parsed.params.scopes);
  const defaultLevel = requested >= 3 ? 'critical' : 'write';
  const redirectHost = new URL(parsed.params.redirectUri).host;

  return (
    <OAuthShell
      title={`Connect ${client.clientName}`}
      subtitle={`Signed in as ${session.user.email}. The app will act as you in Lockin.`}
    >
      <form action={submitAuthorizationAction} className="space-y-5">
        <input type="hidden" name="client_id" value={parsed.params.clientId} />
        <input type="hidden" name="redirect_uri" value={parsed.params.redirectUri} />
        <input type="hidden" name="code_challenge" value={parsed.params.codeChallenge} />
        <input type="hidden" name="code_challenge_method" value="S256" />
        <input type="hidden" name="state" value={parsed.params.state ?? ''} />
        <input type="hidden" name="resource" value={parsed.params.resource ?? ''} />

        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-foreground mb-2">
            Choose what it can do
          </legend>
          {LEVELS.map(({ value, title, desc, icon: Icon }) => (
            <label
              key={value}
              className="flex cursor-pointer gap-3 rounded-xl border border-border bg-background p-3 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input
                type="radio"
                name="level"
                value={value}
                defaultChecked={value === defaultLevel}
                className="mt-0.5 accent-primary"
              />
              <span className="space-y-0.5">
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {title}
                </span>
                <span className="block text-muted-foreground">{desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          You will be sent back to <strong className="text-foreground">{redirectHost}</strong>.
          Never share an approval you did not start. You can revoke access any time in Settings
          &rarr; Connected apps.
        </p>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="submit"
            name="decision"
            value="deny"
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            Deny
          </Button>
          <Button
            type="submit"
            name="decision"
            value="allow"
            size="sm"
            className="bg-primary hover:bg-primary-hover text-white text-xs"
          >
            Allow access
          </Button>
        </div>
      </form>
    </OAuthShell>
  );
}
