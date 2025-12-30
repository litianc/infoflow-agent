import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { sources, articles, collectLogs, industries } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';
import crypto from 'crypto';
import { generateSummary, isLLMAvailable, classifyArticleIndustry } from '@/lib/llm';

// POST /api/admin/collect - 触发采集任务
export async function POST(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { sourceIds, limit = 20 } = body;

    // 获取要采集的数据源
    let sourcesToCollect;
    if (sourceIds && sourceIds.length > 0) {
      sourcesToCollect = await db
        .select()
        .from(sources)
        .where(eq(sources.isActive, true));
      sourcesToCollect = sourcesToCollect.filter((s) =>
        sourceIds.includes(s.id)
      );
    } else {
      sourcesToCollect = await db
        .select()
        .from(sources)
        .where(eq(sources.isActive, true));
    }

    if (sourcesToCollect.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'NO_SOURCES', message: '没有可采集的数据源' },
      });
    }

    // 获取所有行业信息，用于 LLM 分类
    const allIndustries = await db
      .select({
        id: industries.id,
        name: industries.name,
        keywords: industries.keywords,
      })
      .from(industries)
      .where(eq(industries.isActive, true));

    const results: {
      sourceId: string;
      sourceName: string;
      status: 'success' | 'failed';
      articlesCount: number;
      error?: string;
    }[] = [];

    // 逐个采集数据源
    for (const source of sourcesToCollect) {
      const startedAt = new Date().toISOString();
      let articlesCount = 0;
      let errorMessage: string | null = null;

      try {
        // 获取页面内容
        const response = await fetch(source.url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9',
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();

        // 解析文章（简单实现）
        const extractedArticles = extractArticles(html, source.url, limit);

        // 保存文章到数据库
        for (const article of extractedArticles) {
          const urlHash = crypto
            .createHash('md5')
            .update(article.url)
            .digest('hex');

          // 检查是否已存在
          const existing = await db
            .select()
            .from(articles)
            .where(eq(articles.urlHash, urlHash))
            .limit(1);

          if (existing.length === 0) {
            const articleId = crypto.randomUUID();

            // 如果 LLM 可用，生成摘要
            let summary: string | null = null;
            if (isLLMAvailable()) {
              try {
                summary = await generateSummary(article.title);
              } catch {
                console.log(`[Collect] Summary generation failed for: ${article.title}`);
              }
            }

            // 基于文章内容进行行业分类（优先使用 LLM）
            let finalIndustryId: string | null = null;

            if (allIndustries.length > 0 && isLLMAvailable()) {
              try {
                // 使用标题和摘要进行分类
                const contentForClassification = summary
                  ? `${article.title}\n${summary}`
                  : article.title;

                const classifiedIndustryId = await classifyArticleIndustry(
                  contentForClassification,
                  allIndustries.map(ind => ({
                    id: ind.id,
                    name: ind.name,
                    keywords: ind.keywords || [],
                  }))
                );
                if (classifiedIndustryId) {
                  finalIndustryId = classifiedIndustryId;
                  console.log(`[Collect] LLM classified "${article.title}" -> industry ${classifiedIndustryId}`);
                }
              } catch {
                console.log(`[Collect] Industry classification failed for: ${article.title}`);
              }
            }

            // 如果 LLM 分类失败或不可用，回退到数据源的行业设置
            if (!finalIndustryId) {
              finalIndustryId = source.industryId;
            }

            const scores = calculateScore(article, source.tier || 2);
            await db.insert(articles).values({
              id: articleId,
              sourceId: source.id,
              industryId: finalIndustryId,
              title: article.title,
              url: article.url,
              urlHash,
              publishDate: article.date || new Date().toISOString(),
              summary,
              score: scores.score,
              scoreRelevance: scores.scoreRelevance,
              scoreTimeliness: scores.scoreTimeliness,
              scoreImpact: scores.scoreImpact,
              scoreCredibility: scores.scoreCredibility,
              priority: '中',
              isFeatured: false,
              isDeleted: false,
            });
            articlesCount++;
          }
        }

        // 更新数据源状态
        await db
          .update(sources)
          .set({
            lastCollectedAt: new Date().toISOString(),
            successCount: sql`${sources.successCount} + 1`,
            lastError: null,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(sources.id, source.id));

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'success',
          articlesCount,
        });
      } catch (error) {
        errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // 更新数据源错误状态
        await db
          .update(sources)
          .set({
            errorCount: sql`${sources.errorCount} + 1`,
            lastError: errorMessage,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(sources.id, source.id));

        results.push({
          sourceId: source.id,
          sourceName: source.name,
          status: 'failed',
          articlesCount: 0,
          error: errorMessage,
        });
      }

      // 记录采集日志
      await db.insert(collectLogs).values({
        id: crypto.randomUUID(),
        sourceId: source.id,
        status: errorMessage ? 'failed' : 'success',
        articlesCount,
        errorMessage,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    }

    const successCount = results.filter((r) => r.status === 'success').length;
    const totalArticles = results.reduce((sum, r) => sum + r.articlesCount, 0);

    // 重新验证页面缓存，使首页和行业页面显示最新数据
    try {
      revalidatePath('/');
      revalidatePath('/industry/[slug]', 'page');
    } catch (error) {
      console.warn('[Collect] Failed to revalidate cache:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSources: sourcesToCollect.length,
        successCount,
        failedCount: sourcesToCollect.length - successCount,
        totalArticles,
        results,
      },
    });
  } catch (error) {
    console.error('Collect error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'COLLECT_ERROR', message: '采集失败' },
      },
      { status: 500 }
    );
  }
}

// 无意义标题过滤规则
const INVALID_TITLE_PATTERNS = [
  /^(查看|点击|了解|阅读|更多|详情|详细|进入|返回|下载|登录|注册|订阅)/,
  /^(首页|关于|联系|帮助|搜索|设置|个人中心)/,
  /(详情|更多|点击这里|click|more|view|read)\s*[>»→]?\s*$/i,
  /^[\s\d\-_./]+$/,  // 纯数字、符号
  /^[<>《》【】\[\]「」『』]+.*[<>《》【】\[\]「」『』]+$/,  // 被特殊符号包裹
  /&[a-z]+;/i,  // 包含未解码的 HTML 实体
];

// 日期提取正则
const DATE_PATTERNS = [
  /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  /(?<!\d)(\d{1,2})[-/](\d{1,2})(?!\d)/,
  /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  /(\d{1,2})月(\d{1,2})日/,
];

// 从文本中提取日期
function extractDate(text: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      let year: number, month: number, day: number;

      if (match.length === 4) {
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else if (match.length === 3) {
        year = currentYear;
        month = parseInt(match[1]);
        day = parseInt(match[2]);
      } else {
        continue;
      }

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= currentYear + 1) {
        const date = new Date(year, month - 1, day);
        if (date <= now) {
          return date.toISOString();
        }
      }
    }
  }
  return null;
}

// 从 HTML 中提取文章
function extractArticles(
  html: string,
  baseUrl: string,
  limit: number
): { title: string; url: string; date: string | null }[] {
  const articles: { title: string; url: string; date: string | null }[] = [];

  // 提取链接
  const linkRegex =
    /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*)*)<\/a>/gi;
  let match;

  const baseUrlObj = new URL(baseUrl);

  while ((match = linkRegex.exec(html)) !== null && articles.length < limit) {
    const matchIndex = match.index;
    const href = match[1];
    let text = match[2].replace(/<[^>]*>/g, '').trim();

    // 解码 HTML 实体
    text = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
      .trim();

    // 基础过滤
    if (
      text.length < 10 ||
      text.length > 200 ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip)$/i)
    ) {
      continue;
    }

    // 过滤无意义标题
    if (INVALID_TITLE_PATTERNS.some(pattern => pattern.test(text))) {
      continue;
    }

    // 构建完整URL
    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = baseUrlObj.origin + href;
    } else if (!href.startsWith('http')) {
      fullUrl = baseUrlObj.origin + '/' + href;
    }

    // 去重
    if (articles.some((a) => a.url === fullUrl)) {
      continue;
    }

    // 尝试从链接周围的 HTML 提取日期
    const contextStart = Math.max(0, matchIndex - 200);
    const contextEnd = Math.min(html.length, matchIndex + match[0].length + 200);
    const context = html.slice(contextStart, contextEnd).replace(/<[^>]*>/g, ' ');
    const articleDate = extractDate(context);

    articles.push({
      title: text,
      url: fullUrl,
      date: articleDate,
    });
  }

  return articles;
}

// 计算文章评分（返回四维评分）
interface ScoreResult {
  score: number;
  scoreRelevance: number;
  scoreTimeliness: number;
  scoreImpact: number;
  scoreCredibility: number;
}

function calculateScore(article: { title: string }, tier: number): ScoreResult {
  // 相关性评分 (满分40): 基于标题长度和关键词
  let relevance = 20;
  if (article.title.length > 15) relevance += 5;
  if (article.title.length > 30) relevance += 5;
  const relevanceKeywords = ['数据中心', '云计算', 'AI', '芯片', '算力', '服务器', '网络'];
  for (const keyword of relevanceKeywords) {
    if (article.title.includes(keyword)) {
      relevance += 10;
      break;
    }
  }
  relevance = Math.min(relevance, 40);

  // 时效性评分 (满分25): 假设新采集的都是新文章
  const timeliness = 20;

  // 影响力评分 (满分20): 基于关键词
  let impact = 10;
  const impactKeywords = ['重大', '突破', '首次', '发布', '官方', '新政', '融资', '上市', '收购', '投资'];
  for (const keyword of impactKeywords) {
    if (article.title.includes(keyword)) {
      impact += 10;
      break;
    }
  }
  impact = Math.min(impact, 20);

  // 可信度评分 (满分15): 基于来源等级
  let credibility = 8;
  if (tier === 1) credibility = 15;
  else if (tier === 2) credibility = 12;
  else credibility = 8;

  const total = relevance + timeliness + impact + credibility;

  return {
    score: Math.min(total, 100),
    scoreRelevance: relevance,
    scoreTimeliness: timeliness,
    scoreImpact: impact,
    scoreCredibility: credibility,
  };
}

// GET /api/admin/collect - 获取采集日志
export async function GET(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const sourceId = searchParams.get('sourceId');

    let query = db
      .select({
        log: collectLogs,
        source: {
          id: sources.id,
          name: sources.name,
        },
      })
      .from(collectLogs)
      .leftJoin(sources, eq(collectLogs.sourceId, sources.id))
      .orderBy(sql`${collectLogs.startedAt} DESC`)
      .limit(limit);

    if (sourceId) {
      query = query.where(eq(collectLogs.sourceId, sourceId)) as typeof query;
    }

    const logs = await query;

    return NextResponse.json({
      success: true,
      data: logs.map((l) => ({
        ...l.log,
        source: l.source,
      })),
    });
  } catch (error) {
    console.error('Get collect logs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'DB_ERROR', message: '获取日志失败' },
      },
      { status: 500 }
    );
  }
}
