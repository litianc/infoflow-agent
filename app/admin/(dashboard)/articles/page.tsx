import { getAdminArticles, getAllIndustries, getAllSources } from '@/lib/db/admin-queries';
import { ArticlesTable } from '@/components/admin/ArticlesTable';

interface PageProps {
  searchParams: Promise<{ page?: string; industry?: string; source?: string }>;
}

export default async function ArticlesPage({ searchParams }: PageProps) {
  const { page = '1', industry, source } = await searchParams;
  const currentPage = Math.max(1, parseInt(page));

  const [{ articles, total }, industries, sources] = await Promise.all([
    getAdminArticles({
      page: currentPage,
      pageSize: 20,
      industryId: industry,
      sourceId: source,
    }),
    getAllIndustries(),
    getAllSources(),
  ]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">内容管理</h1>
        <div className="text-sm text-muted-foreground">共 {total} 篇文章</div>
      </div>

      <ArticlesTable
        articles={articles}
        industries={industries}
        sources={sources}
        currentPage={currentPage}
        totalPages={totalPages}
        selectedIndustry={industry}
        selectedSource={source}
      />
    </div>
  );
}
