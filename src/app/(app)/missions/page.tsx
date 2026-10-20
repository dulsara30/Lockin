import { Metadata } from 'next';
import { MissionsListView } from '@/features/missions/components/missions-list-view';

export const metadata: Metadata = {
  title: 'Missions',
};

export default function MissionsPage() {
  return <MissionsListView />;
}
