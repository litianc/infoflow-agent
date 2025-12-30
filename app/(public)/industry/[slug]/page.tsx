import { notFound } from 'next/navigation';
import { Header, Footer } from '@/components/layout';
import { ArticleCard } from '@/components/article';
import { Badge } from '@/components/ui/badge';
import { getIndustryBySlug, getIndustriesForNav, getArticles } from '@/lib/db/queries';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const industry = await getIndustryBySlug(slug);

  if (!industry) {
    return { title: '板块不存在' };
  }

  return {
    title: industry.name,
    description: industry.description || `${industry.name}行业最新资讯`,
  };
}

export default async function IndustryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { page = '1', sort = 'latest' } = await searchParams;

  const [industry, industriesNav] = await Promise.all([
    getIndustryBySlug(slug),
    getIndustriesForNav(),
  ]);

  if (!industry) {
    notFound();
  }

  const currentPage = Math.max(1, parseInt(page));
  const pageSize = 20;

  const { articles, total } = await getArticles({
    industrySlug: slug,
    page: currentPage,
    pageSize,
    sort: sort as 'latest' | 'score',
  });

  const totalPages = Math.ceil(total / pageSize);
  const keywords = (industry.keywords as string[]) || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header industries={industriesNav} />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* 板块头部 */}
          <div
            className="rounded-lg p-6 mb-8"
            style={{
              backgroundColor: `${industry.color}15`,
              borderLeft: `4px solid ${industry.color}`,
            }}
          >
            <div className="flex items-center space-x-3 mb-3">
              <span className="text-3xl">{industry.icon}</span>
              <h1 className="text-2xl font-bold">{industry.name}</h1>
            </div>
            <p className="text-muted-foreground mb-4">
              {industry.description || '暂无描述'}
            </p>
            <div className="flex flex-wrap gap-2">
              {keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary">
                  {keyword}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              共 {total} 篇文章
            </p>
          </div>

          {/* 筛选和排序 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">排序：</span>
              <a
                href={`/industry/${slug}?sort=latest`}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  sort === 'latest'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                最新
              </a>
              <a
                href={`/industry/${slug}?sort=score`}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  sort === 'score'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
              >
                最热
              </a>
            </div>
          </div>

          {/* 文章列表 */}
          {articles.length > 0 ? (
            <div className="space-y-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} {...article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>该板块暂无文章</p>
            </div>
          )}

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-8">
              {currentPage > 1 && (
                <a
                  href={`/industry/${slug}?page=${currentPage - 1}&sort=${sort}`}
                  className="px-4 py-2 rounded-md border hover:bg-accent transition-colors"
                >
                  上一页
                </a>
              )}
              <span className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页
              </span>
              {currentPage < totalPages && (
                <a
                  href={`/industry/${slug}?page=${currentPage + 1}&sort=${sort}`}
                  className="px-4 py-2 rounded-md border hover:bg-accent transition-colors"
                >
                  下一页
                </a>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
