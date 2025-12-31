import { notFound } from 'next/navigation';
import { getSourceById, getAllIndustries } from '@/lib/db/admin-queries';
import { SourceEditForm } from '@/components/admin/SourceEditForm';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSourcePage({ params }: PageProps) {
  const { id } = await params;
  const [source, industries] = await Promise.all([
    getSourceById(id),
    getAllIndustries(),
  ]);

  if (!source) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">编辑数据源</h1>
      <SourceEditForm source={source} industries={industries} />
    </div>
  );
}
