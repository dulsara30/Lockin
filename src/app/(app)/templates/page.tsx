import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getTemplates } from '@/server/dal/templates';
import {
  TemplatesListView,
  TemplateItem,
} from '@/features/templates/components/templates-list-view';

export const metadata: Metadata = {
  title: 'Templates | Lockin',
  description: 'Reusable sprint blueprints and multi-day mission templates.',
};

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const rawTemplates = await getTemplates(session.user.id);
  const formattedTemplates: TemplateItem[] = rawTemplates.map((t) => ({
    _id: t._id.toString(),
    name: t.name,
    description: t.description,
    structure: t.structure,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
  }));

  return (
    <div className="container py-8 px-4 sm:px-6 max-w-7xl mx-auto">
      <TemplatesListView initialTemplates={formattedTemplates} />
    </div>
  );
}
