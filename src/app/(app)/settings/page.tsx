import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getUserSettings } from '@/server/dal/settings';
import { listConnectedApps } from '@/server/dal/oauth';
import { SettingsView } from '@/features/settings/components/settings-view';

export const metadata: Metadata = {
  title: 'Settings | Lockin',
  description: 'Customize workspace appearance, work capacity targets, and encrypted Gemini keys.',
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [settings, connectedApps] = await Promise.all([
    getUserSettings(session.user.id),
    listConnectedApps(session.user.id),
  ]);

  return (
    <div className="container py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <SettingsView
        initialSettings={settings}
        userEmail={session.user.email}
        connectedApps={connectedApps}
      />
    </div>
  );
}
