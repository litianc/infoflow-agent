import { Header, Footer } from '@/components/layout';
import { ArticleCard } from '@/components/article';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { searchArticles, getIndustriesForNav, getIndustriesWithStats } from '@/lib/db/queries';
import { Search } from 'lucide-react';
import { Metadata } from 'next';
import Link from 'next/link';

interface PageProps {
  searchParams: Promise<{ q?: string; industry?: string; page?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `搜索: ${q}` : '搜索',
  };
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q = '', industry, page = '1' } = await searchParams;
  const currentPage = Math.max(1, parseInt(page));
  const pageSize = 20;

  const [industriesNav, industriesWithStats] = await Promise.all([
    getIndustriesForNav(),
    getIndustriesWithStats(),
  ]);

  let articles: Awaited<ReturnType<typeof searchArticles>>['articles'] = [];
  let total = 0;

  if (q.trim()) {
    const result = await searchArticles({
      query: q.trim(),
      industrySlug: industry,
      page: currentPage,
      pageSize,
    });
    articles = result.articles;
    total = result.total;
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-screen flex flex-col">
      <Header industries={industriesNav} />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* 搜索框 */}
          <div className="max-w-2xl mx-auto mb-8">
            <form action="/search" method="GET">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="search"
                    name="q"
                    placeholder="搜索文章..."
                    defaultValue={q}
                    className="pl-10 h-12 text-lg"
                    autoFocus
                  />
                </div>
                <Button type="submit" size="lg">
                  搜索
                </Button>
              </div>
            </form>
          </div>

          {/* 行业筛选 */}
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            <Link href={`/search?q=${encodeURIComponent(q)}`}>
              <Badge
                variant={!industry ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                全部
              </Badge>
            </Link>
            {industriesWithStats.map((ind) => (
              <Link
                key={ind.slug}
                href={`/search?q=${encodeURIComponent(q)}&industry=${ind.slug}`}
              >
                <Badge
                  variant={industry === ind.slug ? 'default' : 'outline'}
                  className="cursor-pointer"
                  style={
                    industry === ind.slug
                      ? { backgroundColor: ind.color || '#3B82F6' }
                      : {}
                  }
                >
                  {ind.icon} {ind.name}
                </Badge>
              </Link>
            ))}
          </div>

          {/* 搜索结果 */}
          {q.trim() ? (
            <>
              <div className="text-center mb-6">
                <p className="text-muted-foreground">
                  找到 <span className="font-bold text-foreground">{total}</span> 条关于
                  "<span className="font-bold text-foreground">{q}</span>" 的结果
                  {industry && (
                    <span>
                      （在 {industriesWithStats.find((i) => i.slug === industry)?.name} 板块）
                    </span>
                  )}
                </p>
              </div>

              {articles.length > 0 ? (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {articles.map((article) => (
                    <ArticleCard key={article.id} {...article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>没有找到相关文章</p>
                  <p className="text-sm mt-2">尝试使用其他关键词搜索</p>
                </div>
              )}

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-2 mt-8">
                  {currentPage > 1 && (
                    <Link
                      href={`/search?q=${encodeURIComponent(q)}${industry ? `&industry=${industry}` : ''}&page=${currentPage - 1}`}
                      className="px-4 py-2 rounded-md border hover:bg-accent transition-colors"
                    >
                      上一页
                    </Link>
                  )}
                  <span className="text-sm text-muted-foreground">
                    第 {currentPage} / {totalPages} 页
                  </span>
                  {currentPage < totalPages && (
                    <Link
                      href={`/search?q=${encodeURIComponent(q)}${industry ? `&industry=${industry}` : ''}&page=${currentPage + 1}`}
                      className="px-4 py-2 rounded-md border hover:bg-accent transition-colors"
                    >
                      下一页
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>输入关键词开始搜索</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
