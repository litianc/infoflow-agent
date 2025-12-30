import { getAllIndustries } from '@/lib/db/admin-queries';
import { SourceWizard } from '@/components/admin/SourceWizard';

export default async function NewSourcePage() {
  const industries = await getAllIndustries();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">添加数据源</h1>
      <SourceWizard industries={industries} />
    </div>
  );
}
