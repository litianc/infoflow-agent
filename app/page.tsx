import Link from 'next/link';
import { Header, Footer } from '@/components/layout';
import { IndustryCard } from '@/components/industry';
import { ArticleCard } from '@/components/article';
import { getIndustriesWithStats, getIndustriesForNav, getArticles } from '@/lib/db/queries';
import { Flame, Clock, Mail } from 'lucide-react';

export const revalidate = 300; // 5分钟重新验证

export default async function HomePage() {
  // 并行获取数据
  const [industriesNav, industriesWithStats, { articles: latestArticles }, { articles: featuredArticles }] =
    await Promise.all([
      getIndustriesForNav(),
      getIndustriesWithStats(),
      getArticles({ page: 1, pageSize: 10, sort: 'latest' }),
      getArticles({ page: 1, pageSize: 4, sort: 'score', featured: true }),
    ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header industries={industriesNav} />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {/* 热门推荐 */}
          {featuredArticles.length > 0 && (
            <section className="mb-12">
              <div className="flex items-center space-x-2 mb-6">
                <Flame className="h-5 w-5 text-orange-500" />
                <h2 className="text-xl font-bold">今日热点</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {featuredArticles.map((article) => (
                  <ArticleCard key={article.id} {...article} />
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-8 lg:grid-cols-3">
            {/* 行业板块 */}
            <section className="lg:col-span-1">
              <h2 className="text-xl font-bold mb-6">行业板块</h2>
              <div className="grid gap-4">
                {industriesWithStats.map((industry) => (
                  <IndustryCard key={industry.id} {...industry} />
                ))}
              </div>
            </section>

            {/* 最新资讯 */}
            <section className="lg:col-span-2">
              <div className="flex items-center space-x-2 mb-6">
                <Clock className="h-5 w-5 text-blue-500" />
                <h2 className="text-xl font-bold">最新资讯</h2>
              </div>
              {latestArticles.length > 0 ? (
                <div className="space-y-4">
                  {latestArticles.map((article) => (
                    <ArticleCard key={article.id} {...article} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>暂无资讯</p>
                  <p className="text-sm mt-2">请先添加数据源并运行采集任务</p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
