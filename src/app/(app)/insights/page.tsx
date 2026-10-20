import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getInsightsData } from '@/server/dal/insights';
import { InsightsDashboard } from '@/features/insights/components/insights-dashboard';

export const metadata: Metadata = {
  title: 'Insights | Lockin',
  description: 'Burn-down velocity, planned vs actual time, streak, and mission analytics.',
};

export default async function InsightsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const data = await getInsightsData(session.user.id);

  return (
    <div className="container py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <InsightsDashboard initialData={data} />
    </div>
  );
}
