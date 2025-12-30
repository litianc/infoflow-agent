import { db } from './index';
import { industries, articles, sources, collectLogs, settings } from './schema';
import { eq, desc, sql, and, or, like, count } from 'drizzle-orm';
import type { IndustryWithStats, ArticleWithRelations } from '@/types';

// 获取所有活跃行业（带统计）
export async function getIndustriesWithStats(): Promise<IndustryWithStats[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const result = await db
    .select({
      id: industries.id,
      name: industries.name,
      slug: industries.slug,
      description: industries.description,
      icon: industries.icon,
      color: industries.color,
      keywords: industries.keywords,
      isActive: industries.isActive,
      articleCount: sql<number>`(
        SELECT COUNT(*) FROM articles
        WHERE articles.industry_id = industries.id
        AND articles.is_deleted = 0
      )`,
      todayCount: sql<number>`(
        SELECT COUNT(*) FROM articles
        WHERE articles.industry_id = industries.id
        AND articles.is_deleted = 0
        AND articles.created_at >= ${todayStr}
      )`,
    })
    .from(industries)
    .where(eq(industries.isActive, true))
    .orderBy(industries.sortOrder);

  return result as IndustryWithStats[];
}

// 获取行业列表（简单版，用于导航）
export async function getIndustriesForNav() {
  return db
    .select({
      name: industries.name,
      slug: industries.slug,
      color: industries.color,
    })
    .from(industries)
    .where(eq(industries.isActive, true))
    .orderBy(industries.sortOrder);
}

// 获取单个行业
export async function getIndustryBySlug(slug: string) {
  const result = await db
    .select()
    .from(industries)
    .where(eq(industries.slug, slug))
    .limit(1);
  return result[0] || null;
}

// 获取文章列表
export async function getArticles({
  industrySlug,
  page = 1,
  pageSize = 20,
  sort = 'latest',
  featured,
  search,
  daysRange = 30,
}: {
  industrySlug?: string;
  page?: number;
  pageSize?: number;
  sort?: 'latest' | 'score';
  featured?: boolean;
  search?: string;
  daysRange?: number;
}): Promise<{ articles: ArticleWithRelations[]; total: number }> {
  const offset = (page - 1) * pageSize;

  // 计算日期范围
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysRange);
  const startDateStr = startDate.toISOString();

  // 构建基础查询条件
  const conditions = [
    eq(articles.isDeleted, false),
    sql`${articles.createdAt} >= ${startDateStr}`,
  ];

  if (featured !== undefined) {
    conditions.push(eq(articles.isFeatured, featured));
  }

  // 搜索条件
  if (search) {
    conditions.push(
      or(
        like(articles.title, `%${search}%`),
        like(articles.summary, `%${search}%`),
        like(articles.content, `%${search}%`)
      )!
    );
  }

  // 如果指定了行业，需要先查询行业ID
  let industryId: string | undefined;
  if (industrySlug) {
    const industry = await getIndustryBySlug(industrySlug);
    if (industry) {
      industryId = industry.id;
      conditions.push(eq(articles.industryId, industryId));
    }
  }

  // 获取总数
  const totalResult = await db
    .select({ count: count() })
    .from(articles)
    .where(and(...conditions));
  const total = totalResult[0]?.count || 0;

  // 获取文章列表
  const orderBy = sort === 'score' ? desc(articles.score) : desc(articles.publishDate);

  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      url: articles.url,
      summary: articles.summary,
      publishDate: articles.publishDate,
      score: articles.score,
      priority: articles.priority,
      isFeatured: articles.isFeatured,
      createdAt: articles.createdAt,
      sourceId: articles.sourceId,
      industryId: articles.industryId,
    })
    .from(articles)
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset);

  // 获取关联的来源和行业信息
  const articlesWithRelations: ArticleWithRelations[] = await Promise.all(
    result.map(async (article) => {
      let source = null;
      let industry = null;

      if (article.sourceId) {
        const sourceResult = await db
          .select({ id: sources.id, name: sources.name, tier: sources.tier })
          .from(sources)
          .where(eq(sources.id, article.sourceId))
          .limit(1);
        source = sourceResult[0] || null;
      }

      if (article.industryId) {
        const industryResult = await db
          .select({
            id: industries.id,
            name: industries.name,
            slug: industries.slug,
            color: industries.color,
          })
          .from(industries)
          .where(eq(industries.id, article.industryId))
          .limit(1);
        industry = industryResult[0] || null;
      }

      return {
        id: article.id,
        title: article.title,
        url: article.url,
        summary: article.summary,
        publishDate: article.publishDate,
        score: article.score ?? 0,
        priority: article.priority ?? '中',
        isFeatured: article.isFeatured ?? false,
        createdAt: article.createdAt,
        source: source ? { ...source, tier: source.tier ?? 2 } : null,
        industry: industry ? { ...industry, color: industry.color ?? '#3B82F6' } : null,
      };
    })
  );

  return { articles: articlesWithRelations, total };
}

// 获取单篇文章详情
export async function getArticleById(id: string) {
  const result = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  const article = result[0];
  if (!article) return null;

  let source = null;
  let industry = null;

  if (article.sourceId) {
    const sourceResult = await db
      .select()
      .from(sources)
      .where(eq(sources.id, article.sourceId))
      .limit(1);
    source = sourceResult[0] || null;
  }

  if (article.industryId) {
    const industryResult = await db
      .select()
      .from(industries)
      .where(eq(industries.id, article.industryId))
      .limit(1);
    industry = industryResult[0] || null;
  }

  return { ...article, source, industry };
}

// 搜索文章
export async function searchArticles({
  query,
  industrySlug,
  page = 1,
  pageSize = 20,
}: {
  query: string;
  industrySlug?: string;
  page?: number;
  pageSize?: number;
}) {
  return getArticles({
    search: query,
    industrySlug,
    page,
    pageSize,
    sort: 'score',
  });
}

// 获取系统设置
export async function getSetting<T>(key: string): Promise<T | null> {
  const result = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);

  return result[0]?.value as T || null;
}

// 更新系统设置
export async function updateSetting(key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: sql`CURRENT_TIMESTAMP` },
    });
}
