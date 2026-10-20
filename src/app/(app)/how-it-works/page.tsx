import { Metadata } from 'next';
import { HowItWorksView } from '@/features/guide/components/how-it-works-view';

export const metadata: Metadata = {
  title: 'How It Works | Lockin System Guide',
  description:
    'Comprehensive interactive guide to Lockin: Missions, Runway Pipelines, 24h Day Focus, AI Re-planning, and Performance Insights.',
};

export default function HowItWorksPage() {
  return (
    <div className="container py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <HowItWorksView />
    </div>
  );
}
