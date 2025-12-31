import { db } from './index';
import { industries, articles, sources, collectLogs } from './schema';
import { eq, desc, sql, count, and, gte } from 'drizzle-orm';
import type { DashboardData } from '@/types';

// 获取仪表盘数据
export async function getDashboardData(): Promise<DashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  // 统计数据
  const [totalArticlesResult, todayArticlesResult, sourceStats] = await Promise.all([
    db.select({ count: count() }).from(articles).where(eq(articles.isDeleted, false)),
    db
      .select({ count: count() })
      .from(articles)
      .where(and(eq(articles.isDeleted, false), gte(articles.createdAt, todayStr))),
    db
      .select({
        total: count(),
        active: sql<number>`SUM(CASE WHEN ${sources.isActive} = 1 THEN 1 ELSE 0 END)`,
        failed: sql<number>`SUM(CASE WHEN ${sources.errorCount} > 0 AND ${sources.isActive} = 1 THEN 1 ELSE 0 END)`,
      })
      .from(sources),
  ]);

  // 行业分布
  const industryDistResult = await db
    .select({
      industry: industries.name,
      count: sql<number>`(
        SELECT COUNT(*) FROM ${articles}
        WHERE ${articles.industryId} = ${industries.id}
        AND ${articles.isDeleted} = 0
      )`,
    })
    .from(industries)
    .where(eq(industries.isActive, true))
    .orderBy(industries.sortOrder);

  const totalArticles = totalArticlesResult[0]?.count || 0;
  const industryDistribution = industryDistResult.map((item) => ({
    industry: item.industry,
    count: item.count,
    percentage: totalArticles > 0 ? Math.round((item.count / totalArticles) * 100) : 0,
  }));

  // 最近采集记录
  const recentCollectionsResult = await db
    .select({
      sourceId: collectLogs.sourceId,
      status: collectLogs.status,
      articlesCount: collectLogs.articlesCount,
      finishedAt: collectLogs.finishedAt,
      errorMessage: collectLogs.errorMessage,
    })
    .from(collectLogs)
    .orderBy(desc(collectLogs.finishedAt))
    .limit(10);

  // 获取数据源名称
  const recentCollections = await Promise.all(
    recentCollectionsResult.map(async (log) => {
      let sourceName = '未知来源';
      if (log.sourceId) {
        const source = await db
          .select({ name: sources.name })
          .from(sources)
          .where(eq(sources.id, log.sourceId))
          .limit(1);
        sourceName = source[0]?.name || '未知来源';
      }
      return {
        sourceId: log.sourceId || '',
        sourceName,
        status: log.status as 'success' | 'failed',
        articlesCount: log.articlesCount || 0,
        finishedAt: log.finishedAt || '',
        error: log.errorMessage || undefined,
      };
    })
  );

  return {
    stats: {
      totalArticles,
      todayArticles: todayArticlesResult[0]?.count || 0,
      activeSources: sourceStats[0]?.active || 0,
      totalSources: sourceStats[0]?.total || 0,
      failedSources: sourceStats[0]?.failed || 0,
    },
    industryDistribution,
    recentCollections,
  };
}

// 获取所有数据源
export async function getAllSources() {
  const result = await db
    .select({
      id: sources.id,
      name: sources.name,
      url: sources.url,
      industryId: sources.industryId,
      tier: sources.tier,
      config: sources.config,
      isActive: sources.isActive,
      lastCollectedAt: sources.lastCollectedAt,
      successCount: sources.successCount,
      errorCount: sources.errorCount,
      lastError: sources.lastError,
      createdAt: sources.createdAt,
    })
    .from(sources)
    .orderBy(desc(sources.createdAt));

  // 获取行业名称
  return Promise.all(
    result.map(async (source) => {
      let industry = null;
      if (source.industryId) {
        const ind = await db
          .select({ id: industries.id, name: industries.name, slug: industries.slug })
          .from(industries)
          .where(eq(industries.id, source.industryId))
          .limit(1);
        industry = ind[0] || null;
      }
      return { ...source, industry };
    })
  );
}

// 获取单个数据源
export async function getSourceById(id: string) {
  const result = await db
    .select()
    .from(sources)
    .where(eq(sources.id, id))
    .limit(1);

  return result[0] || null;
}

// 获取所有行业（管理用）
export async function getAllIndustries() {
  return db
    .select()
    .from(industries)
    .orderBy(industries.sortOrder);
}

// 获取所有文章（管理用）
export async function getAdminArticles({
  page = 1,
  pageSize = 20,
  industryId,
  sourceId,
  search,
}: {
  page?: number;
  pageSize?: number;
  industryId?: string;
  sourceId?: string;
  search?: string;
}) {
  const offset = (page - 1) * pageSize;
  const conditions = [eq(articles.isDeleted, false)];

  if (industryId) {
    conditions.push(eq(articles.industryId, industryId));
  }
  if (sourceId) {
    conditions.push(eq(articles.sourceId, sourceId));
  }

  const totalResult = await db
    .select({ count: count() })
    .from(articles)
    .where(and(...conditions));

  const result = await db
    .select()
    .from(articles)
    .where(and(...conditions))
    .orderBy(desc(articles.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    articles: result,
    total: totalResult[0]?.count || 0,
  };
}
