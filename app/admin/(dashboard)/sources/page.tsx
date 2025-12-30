import { getAllSources, getAllIndustries } from '@/lib/db/admin-queries';
import { SourcesTable } from '@/components/admin/SourcesTable';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function SourcesPage() {
  const [sources, industries] = await Promise.all([
    getAllSources(),
    getAllIndustries(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">数据源管理</h1>
        <Link href="/admin/sources/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            添加数据源
          </Button>
        </Link>
      </div>

      <SourcesTable sources={sources} industries={industries} />
    </div>
  );
}
