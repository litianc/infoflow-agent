import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { sources, articles, collectLogs, settings, industries } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { generateSummary, isLLMAvailable, classifyArticleIndustry } from '@/lib/llm';

// Vercel Cron 密钥验证
const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/collect - 定时采集任务（由 Vercel Cron 调用）
export async function GET(request: NextRequest) {
  // 验证 Cron 密钥（防止未授权调用）
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron] Starting scheduled collection...');

  try {
    // 检查是否启用定时采集
    const scheduleEnabled = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'schedule_enabled'))
      .limit(1);

    if (scheduleEnabled.length > 0 && scheduleEnabled[0].value === 'false') {
      console.log('[Cron] Scheduled collection is disabled');
      return NextResponse.json({
        success: true,
        message: 'Scheduled collection is disabled',
        skipped: true,
      });
    }

    // 获取所有活跃的数据源
    const activeSources = await db
      .select()
      .from(sources)
      .where(eq(sources.isActive, true));

    if (activeSources.length === 0) {
      console.log('[Cron] No active sources to collect');
      return NextResponse.json({
        success: true,
        message: 'No active sources',
        collected: 0,
      });
    }

    console.log(`[Cron] Found ${activeSources.length} active sources`);

    // 获取所有行业信息，用于 LLM 分类
    const allIndustries = await db
      .select({
        id: industries.id,
        name: industries.name,
        keywords: industries.keywords,
      })
      .from(industries)
      .where(eq(industries.isActive, true));

    let totalArticles = 0;
    let successCount = 0;
    let failedCount = 0;

    // 逐个采集数据源
    for (const source of activeSources) {
      const startedAt = new Date().toISOString();
      let articlesCount = 0;
      let errorMessage: string | null = null;

      try {
        console.log(`[Cron] Collecting from: ${source.name}`);

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

        // 解析文章
        const extractedArticles = extractArticles(html, source.url, 20);

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
                console.log(`[Cron] Summary generation failed for: ${article.title}`);
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
                  console.log(`[Cron] LLM classified "${article.title}" -> industry ${classifiedIndustryId}`);
                }
              } catch {
                console.log(`[Cron] Industry classification failed for: ${article.title}`);
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

        totalArticles += articlesCount;
        successCount++;
        console.log(`[Cron] ${source.name}: collected ${articlesCount} articles`);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown error';
        failedCount++;

        // 更新数据源错误状态
        await db
          .update(sources)
          .set({
            errorCount: sql`${sources.errorCount} + 1`,
            lastError: errorMessage,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(sources.id, source.id));

        console.error(`[Cron] ${source.name}: failed - ${errorMessage}`);
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

    // 更新最后采集时间
    await db
      .insert(settings)
      .values({
        key: 'last_cron_run',
        value: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: new Date().toISOString(),
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });

    console.log(
      `[Cron] Completed: ${successCount}/${activeSources.length} sources, ${totalArticles} new articles`
    );

    // 重新验证页面缓存，使首页和行业页面显示最新数据
    try {
      revalidatePath('/');
      revalidatePath('/industry/[slug]', 'page');
      console.log('[Cron] Revalidated page cache');
    } catch (error) {
      console.warn('[Cron] Failed to revalidate cache:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSources: activeSources.length,
        successCount,
        failedCount,
        totalArticles,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Cron] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
  // 2024-12-30 或 2024/12/30
  /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  // 12-30 或 12/30（当年）
  /(?<!\d)(\d{1,2})[-/](\d{1,2})(?!\d)/,
  // 2024年12月30日
  /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  // 12月30日
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
        // 完整日期：年月日
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      } else if (match.length === 3) {
        // 只有月日，使用当年
        year = currentYear;
        month = parseInt(match[1]);
        day = parseInt(match[2]);
      } else {
        continue;
      }

      // 验证日期有效性
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= currentYear + 1) {
        const date = new Date(year, month - 1, day);
        // 不能是未来日期
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

    let fullUrl = href;
    if (href.startsWith('/')) {
      fullUrl = baseUrlObj.origin + href;
    } else if (!href.startsWith('http')) {
      fullUrl = baseUrlObj.origin + '/' + href;
    }

    if (articles.some((a) => a.url === fullUrl)) {
      continue;
    }

    // 尝试从链接周围的 HTML 提取日期（前后 200 字符）
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
