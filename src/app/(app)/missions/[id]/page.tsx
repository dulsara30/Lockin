import { Metadata } from 'next';
import { MissionDetailView } from '@/features/missions/components/mission-detail-view';

export const metadata: Metadata = {
  title: 'Mission Details',
};

interface MissionPageProps {
  params: Promise<{ id: string }>;
}

export default async function MissionPage({ params }: MissionPageProps) {
  const { id } = await params;
  return <MissionDetailView missionId={id} />;
}
