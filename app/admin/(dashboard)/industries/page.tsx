import { getAllIndustries } from '@/lib/db/admin-queries';
import { IndustriesTable } from '@/components/admin/IndustriesTable';

export default async function IndustriesPage() {
  const industries = await getAllIndustries();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">行业管理</h1>
      </div>

      <IndustriesTable industries={industries} />
    </div>
  );
}
