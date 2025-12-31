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

            // 日期提取：如果列表页没有日期，尝试从文章页获取
            let publishDate = article.date;
            if (!publishDate) {
              // 获取数据源配置中的自定义日期选择器
              const sourceConfig = source.config as { dateSelector?: string } | null;
              const customSelector = sourceConfig?.dateSelector;
              publishDate = await fetchArticleDate(article.url, customSelector);
            }
            publishDate = publishDate || new Date().toISOString();

            const scores = calculateScore(article, source.tier || 2);
            await db.insert(articles).values({
              id: articleId,
              sourceId: source.id,
              industryId: finalIndustryId,
              title: article.title,
              url: article.url,
              urlHash,
              publishDate,
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
  // 用户协议、隐私政策、法律声明
  /(用户协议|服务协议|隐私政策|隐私声明|法律声明|免责声明|版权声明|使用条款)/,
  // 备案信息
  /(ICP备|网安备|京ICP|沪ICP|粤ICP|浙ICP|苏ICP|鲁ICP)/i,
  /^[京沪粤浙苏鲁川渝闽湘鄂皖赣]?(公网安备|ICP)/,
  // 广告、推广
  /^(广告|推广|赞助|合作伙伴|友情链接)/,
  // 导航、功能性链接
  /^(加入我们|联系我们|关于我们|公司介绍|招聘信息|诚聘英才)/,
  /^(意见反馈|投诉建议|客服中心|帮助中心)/,
];

// 无效URL路径模式
const INVALID_URL_PATTERNS = [
  // 用户中心、登录注册
  /\/(usercenter|user[-_]?center|member|account|login|register|signup|signin)\//i,
  /\/(agreement|privacy|terms|policy|legal|disclaimer)\b/i,
  // 广告、推广
  /\/(ad|ads|advert|banner|sponsor|promotion)\//i,
  // 静态资源、下载
  /\/(download|upload|attachment|file)\//i,
  // 特殊页面
  /\/(about|contact|help|faq|feedback|sitemap)\b/i,
];

// 外部无效域名（备案、统计等）
const INVALID_DOMAINS = [
  'beian.miit.gov.cn',
  'beian.gov.cn',
  'baidu.com/s',  // 百度搜索
  'google.com',
  'analytics.',
  'cnzz.com',
  'umeng.com',
];

// 从 URL 中提取日期（最可靠的方式）
function extractDateFromUrl(url: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 完整日期格式: /2025-12-30/ 或 /2025/12/30/ 或 /20251230/
  const fullDatePatterns = [
    /\/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\//,
    /\/(\d{4})(\d{2})(\d{2})\//,
    /[-_](\d{4})(\d{2})(\d{2})[-_.]/,
    /[?&]date=(\d{4})[-]?(\d{2})[-]?(\d{2})/,
  ];

  for (const pattern of fullDatePatterns) {
    const match = url.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);

      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= currentYear) {
        const date = new Date(year, month - 1, day);
        if (date <= now) {
          return date.toISOString();
        }
      }
    }
  }

  // YYYYMM 格式（只有年月，使用当月1日）- 如投资界 /202512/
  const yearMonthPatterns = [
    /\/(\d{4})(\d{2})\//,     // /202512/
    /\/(\d{4})\/(\d{1,2})\//, // /2025/12/
  ];

  for (const pattern of yearMonthPatterns) {
    const match = url.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);

      if (month >= 1 && month <= 12 && year >= 2020 && year <= currentYear) {
        const date = new Date(year, month - 1, 1);
        if (date <= now) {
          return date.toISOString();
        }
      }
    }
  }

  return null;
}

// 解析相对时间（昨天、前天、X天前、X小时前）
function parseRelativeTime(text: string): string | null {
  const now = new Date();

  // 提取时间部分（如 08:30）
  const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
  const setTime = (date: Date): string => {
    if (timeMatch) {
      date.setHours(parseInt(timeMatch[1]), parseInt(timeMatch[2]), 0, 0);
    }
    return date.toISOString();
  };

  // 今天 08:30
  if (/今天/.test(text)) {
    const date = new Date(now);
    return setTime(date);
  }

  // 昨天 11:47
  if (/昨天/.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return setTime(date);
  }

  // 前天 17:08
  if (/前天/.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 2);
    return setTime(date);
  }

  // X天前
  const daysAgo = text.match(/(\d+)\s*天前/);
  if (daysAgo) {
    const date = new Date(now);
    date.setDate(date.getDate() - parseInt(daysAgo[1]));
    return setTime(date);
  }

  // X小时前
  const hoursAgo = text.match(/(\d+)\s*小时前/);
  if (hoursAgo) {
    const date = new Date(now);
    date.setHours(date.getHours() - parseInt(hoursAgo[1]));
    return date.toISOString();
  }

  // X分钟前
  const minutesAgo = text.match(/(\d+)\s*分钟前/);
  if (minutesAgo) {
    const date = new Date(now);
    date.setMinutes(date.getMinutes() - parseInt(minutesAgo[1]));
    return date.toISOString();
  }

  // 刚刚
  if (/刚刚/.test(text)) {
    return now.toISOString();
  }

  return null;
}

// 日期提取正则（用于 HTML 上下文，不含标题）
const DATE_PATTERNS = [
  // 2024-12-30 或 2024/12/30
  /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
  // 2024年12月30日
  /(\d{4})年(\d{1,2})月(\d{1,2})日/,
  // 12月30日（优先匹配中文格式）
  /(\d{1,2})月(\d{1,2})日/,
  // 12-30 或 12/30（最后匹配，容易误判）
  /(?<!\d)(\d{1,2})[-/](\d{1,2})(?!\d)/,
];

// 从文本中提取日期（用于 HTML 上下文）
function extractDateFromContext(text: string): string | null {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 先尝试相对时间
  const relativeDate = parseRelativeTime(text);
  if (relativeDate) return relativeDate;

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
        // 只有月日
        year = currentYear;
        month = parseInt(match[1]);
        day = parseInt(match[2]);

        // 如果日期在未来，尝试使用去年
        const testDate = new Date(year, month - 1, day);
        if (testDate > now) {
          year = currentYear - 1;
        }
      } else {
        continue;
      }

      // 验证日期有效性
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= currentYear) {
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

// 从文章页面提取发布日期（方案四）
// customSelector: 自定义选择器，如 "#pubtime_baidu" 或 ".time" 或 "em"
async function fetchArticleDate(url: string, customSelector?: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();

    // 0. 如果有自定义选择器，优先使用
    if (customSelector) {
      const selectorPatterns: RegExp[] = [];
      if (customSelector.startsWith('#')) {
        // ID 选择器
        const id = customSelector.slice(1);
        selectorPatterns.push(new RegExp(`<[^>]*id="${id}"[^>]*>([^<]+)`, 'i'));
      } else if (customSelector.startsWith('.')) {
        // Class 选择器
        const cls = customSelector.slice(1);
        selectorPatterns.push(new RegExp(`<[^>]*class="[^"]*${cls}[^"]*"[^>]*>([^<]+)`, 'gi'));
      } else {
        // 标签选择器
        selectorPatterns.push(new RegExp(`<${customSelector}[^>]*>([^<]+)`, 'gi'));
      }

      for (const pattern of selectorPatterns) {
        const match = html.match(pattern);
        if (match) {
          const dateText = (match[1] || match[0]).replace(/<[^>]*>/g, '').trim();
          const contextDate = extractDateFromContext(dateText);
          if (contextDate) return contextDate;
        }
      }
    }

    // 1. 优先查找 meta 标签
    const metaPatterns = [
      /<meta[^>]*property="article:published_time"[^>]*content="([^"]+)"/i,
      /<meta[^>]*name="pubdate"[^>]*content="([^"]+)"/i,
      /<meta[^>]*name="publishdate"[^>]*content="([^"]+)"/i,
      /<meta[^>]*itemprop="datePublished"[^>]*content="([^"]+)"/i,
      /<meta[^>]*name="og:published_time"[^>]*content="([^"]+)"/i,
    ];

    for (const pattern of metaPatterns) {
      const match = html.match(pattern);
      if (match) {
        const date = new Date(match[1]);
        if (!isNaN(date.getTime())) return date.toISOString();
      }
    }

    // 2. 查找 time 标签
    const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"[^>]*>/i);
    if (timeMatch) {
      const date = new Date(timeMatch[1]);
      if (!isNaN(date.getTime())) return date.toISOString();
    }

    // 3. 查找常见的日期 class 元素（扩展更多模式）
    const dateClassPatterns = [
      // 通用模式
      /<[^>]*class="[^"]*(?:pub[-_]?date|publish[-_]?date|post[-_]?date|article[-_]?date|time|date)[^"]*"[^>]*>([^<]+)</gi,
      /<span[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)</gi,
      // IT之家特有
      /<span[^>]*id="pubtime_baidu"[^>]*>([^<]+)</i,
      /<[^>]*class="[^"]*pubtime[^"]*"[^>]*>([^<]+)</gi,
      // 数据中心世界 em 标签
      /<em[^>]*>(\d{4}[-/]\d{1,2}[-/]\d{1,2}[^<]*)</gi,
      // 更通用的日期模式（包含标准日期格式）
      /<[^>]*class="[^"]*(?:info|meta|author)[^"]*"[^>]*>[^<]*(\d{4}[-/]\d{1,2}[-/]\d{1,2})[^<]*/gi,
      // 创业邦等：author-date class 内嵌相对时间
      /<div[^>]*class="[^"]*author-date[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      // 通用：查找包含 今天/昨天/前天 的 span
      /<span[^>]*>[^<]*(?:今天|昨天|前天)\s+\d{1,2}:\d{2}[^<]*/gi,
    ];

    for (const pattern of dateClassPatterns) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(html)) !== null) {
        const dateText = match[1].trim();
        const relativeDate = parseRelativeTime(dateText);
        if (relativeDate) return relativeDate;
        const contextDate = extractDateFromContext(dateText);
        if (contextDate) return contextDate;
      }
    }

    // 4. 在页面正文中查找日期（限制范围避免干扰）
    const bodyMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                      html.match(/<div[^>]*class="[^"]*(?:content|article|post)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (bodyMatch) {
      const bodyText = bodyMatch[1].replace(/<[^>]*>/g, ' ').substring(0, 1000);
      const contextDate = extractDateFromContext(bodyText);
      if (contextDate) return contextDate;
    }

    return null;
  } catch {
    return null;
  }
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

    // 过滤外部无效域名
    try {
      const urlObj = new URL(fullUrl);
      if (INVALID_DOMAINS.some(domain => urlObj.hostname.includes(domain) || urlObj.href.includes(domain))) {
        continue;
      }
      // 过滤非同源链接（外部链接）
      if (urlObj.hostname !== baseUrlObj.hostname && !urlObj.hostname.endsWith('.' + baseUrlObj.hostname)) {
        continue;
      }
    } catch {
      continue; // 无效URL
    }

    // 过滤无效URL路径
    if (INVALID_URL_PATTERNS.some(pattern => pattern.test(fullUrl))) {
      continue;
    }

    if (articles.some((a) => a.url === fullUrl)) {
      continue;
    }

    // 优先从 URL 中提取日期（最可靠）
    let articleDate = extractDateFromUrl(fullUrl);

    // 如果 URL 中没有日期，尝试从链接周围的 HTML 提取（排除标题文本）
    if (!articleDate) {
      const contextStart = Math.max(0, matchIndex - 200);
      const contextEnd = Math.min(html.length, matchIndex + match[0].length + 200);
      let context = html.slice(contextStart, contextEnd).replace(/<[^>]*>/g, ' ');
      // 从上下文中移除标题文本，避免从标题中提取日期
      context = context.replace(text, '');
      articleDate = extractDateFromContext(context);
    }

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
