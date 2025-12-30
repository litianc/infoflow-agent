import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Header, Footer } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { getArticleById, getIndustriesForNav, getArticles } from '@/lib/db/queries';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ExternalLink, Calendar, BarChart3, Building2, Copy, ArrowLeft } from 'lucide-react';
import { Metadata } from 'next';
import { ArticleCard } from '@/components/article';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article) {
    return { title: '文章不存在' };
  }

  return {
    title: article.title,
    description: article.summary || article.title,
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { id } = await params;

  const [article, industriesNav] = await Promise.all([
    getArticleById(id),
    getIndustriesForNav(),
  ]);

  if (!article || article.isDeleted) {
    notFound();
  }

  // 获取相关文章
  let relatedArticles: Awaited<ReturnType<typeof getArticles>>['articles'] = [];
  if (article.industryId) {
    const { articles } = await getArticles({
      industrySlug: article.industry?.slug,
      page: 1,
      pageSize: 5,
      sort: 'score',
    });
    relatedArticles = articles.filter((a) => a.id !== article.id).slice(0, 4);
  }

  const priorityColor = {
    '高': 'destructive',
    '中': 'secondary',
    '低': 'outline',
  }[article.priority || '中'] || 'secondary';

  return (
    <div className="min-h-screen flex flex-col">
      <Header industries={industriesNav} />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* 返回按钮 */}
          <Link
            href={article.industry ? `/industry/${article.industry.slug}` : '/'}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回{article.industry?.name || '首页'}
          </Link>

          {/* 文章头部 */}
          <article>
            <header className="mb-8">
              <h1 className="text-2xl md:text-3xl font-bold leading-tight mb-4">
                {article.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {article.source && (
                  <div className="flex items-center">
                    <Building2 className="h-4 w-4 mr-1" />
                    {article.source.name}
                  </div>
                )}
                {article.publishDate && (
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(article.publishDate), 'yyyy年MM月dd日', { locale: zhCN })}
                  </div>
                )}
                {article.industry && (
                  <Link
                    href={`/industry/${article.industry.slug}`}
                    className="hover:text-foreground transition-colors"
                  >
                    <Badge
                      variant="outline"
                      style={{ borderColor: article.industry.color, color: article.industry.color }}
                    >
                      {article.industry.icon} {article.industry.name}
                    </Badge>
                  </Link>
                )}
                <Badge variant={priorityColor as 'destructive' | 'secondary' | 'outline'}>
                  {article.priority}优先级
                </Badge>
              </div>
            </header>

            {/* AI 摘要 */}
            {article.summary && (
              <Card className="mb-8 border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center">
                    <BarChart3 className="h-4 w-4 mr-2 text-primary" />
                    AI 摘要
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {article.summary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 评分详情 */}
            <Card className="mb-8">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">评分详情</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{article.scoreRelevance}</div>
                    <div className="text-xs text-muted-foreground">相关性 /40</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{article.scoreTimeliness}</div>
                    <div className="text-xs text-muted-foreground">时效性 /25</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{article.scoreImpact}</div>
                    <div className="text-xs text-muted-foreground">影响力 /20</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{article.scoreCredibility}</div>
                    <div className="text-xs text-muted-foreground">可信度 /15</div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="text-center">
                  <div className="text-3xl font-bold">{article.score}</div>
                  <div className="text-sm text-muted-foreground">总分 /100</div>
                </div>
              </CardContent>
            </Card>

            {/* 正文内容 */}
            {article.content && (
              <div className="prose prose-neutral dark:prose-invert max-w-none mb-8">
                <div
                  dangerouslySetInnerHTML={{ __html: article.content }}
                  className="leading-relaxed"
                />
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex flex-wrap gap-3 mb-8">
              <Button asChild>
                <a href={article.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  查看原文
                </a>
              </Button>
              <Button variant="outline" onClick={() => {}}>
                <Copy className="h-4 w-4 mr-2" />
                复制链接
              </Button>
            </div>
          </article>

          {/* 相关推荐 */}
          {relatedArticles.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold mb-6">相关推荐</h2>
              <div className="space-y-4">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard key={relatedArticle.id} {...relatedArticle} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
