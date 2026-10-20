import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getTodayDashboardData } from '@/server/dal/today';
import { TodayDashboard } from '@/features/today/components/today-dashboard';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const data = await getTodayDashboardData(userId).catch(() => ({
    todaySteps: [],
    nextUpStep: null,
    totalPlannedMin: 0,
    totalCompletedMin: 0,
    streakDays: 0,
  }));

  return (
    <TodayDashboard
      todaySteps={JSON.parse(JSON.stringify(data.todaySteps))}
      nextUpStep={data.nextUpStep ? JSON.parse(JSON.stringify(data.nextUpStep)) : null}
      totalPlannedMin={data.totalPlannedMin}
      totalCompletedMin={data.totalCompletedMin}
      streakDays={data.streakDays}
    />
  );
}
