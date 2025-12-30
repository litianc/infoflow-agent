import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';

interface DetectedConfig {
  articleContainer: string;
  titleSelector: string;
  linkSelector: string;
  dateSelector: string | null;
  summarySelector: string | null;
}

interface PreviewArticle {
  title: string;
  url: string;
  date: string | null;
  summary: string | null;
}

// 常见的文章列表选择器模式
const COMMON_PATTERNS = {
  containers: [
    'article',
    '.article',
    '.post',
    '.news-item',
    '.list-item',
    '.card',
    '[class*="article"]',
    '[class*="post"]',
    '[class*="news"]',
    '[class*="item"]',
    'li',
  ],
  titles: [
    'h1 a',
    'h2 a',
    'h3 a',
    '.title a',
    '.headline a',
    'a.title',
    '[class*="title"] a',
    'a[class*="title"]',
    'h1',
    'h2',
    'h3',
  ],
  links: ['a[href]', 'a.read-more', 'a.more', '[class*="link"]'],
  dates: [
    'time',
    '.date',
    '.time',
    '.published',
    '[class*="date"]',
    '[class*="time"]',
    '[datetime]',
  ],
  summaries: [
    '.summary',
    '.excerpt',
    '.description',
    '.intro',
    'p',
    '[class*="summary"]',
    '[class*="desc"]',
  ],
};

// POST /api/admin/auto-detect - 智能识别网页结构
export async function POST(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '请输入URL' },
        },
        { status: 400 }
      );
    }

    // 验证 URL 格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'URL格式不正确' },
        },
        { status: 400 }
      );
    }

    // 获取页面内容
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FETCH_FAILED',
            message: `无法访问页面: ${response.status}`,
          },
        },
        { status: 400 }
      );
    }

    const html = await response.text();

    // 使用简单的正则解析（生产环境建议使用 cheerio 或 JSDOM）
    const result = analyzeHtmlStructure(html, parsedUrl.origin);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'PARSE_FAILED', message: result.error },
          confidence: 0,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      success: true,
      confidence: result.confidence,
      config: result.config,
      preview: result.preview,
    });
  } catch (error) {
    console.error('Auto-detect error:', error);
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'TIMEOUT', message: '请求超时，请检查URL是否可访问' },
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: '识别失败，请重试' },
      },
      { status: 500 }
    );
  }
}

// 分析 HTML 结构
function analyzeHtmlStructure(
  html: string,
  baseUrl: string
): {
  success: boolean;
  confidence: number;
  config?: DetectedConfig;
  preview?: PreviewArticle[];
  error?: string;
} {
  // 提取所有链接
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*)*)<\/a>/gi;
  const links: { href: string; text: string }[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();

    // 过滤掉导航链接、资源链接等
    if (
      text.length > 10 &&
      text.length < 200 &&
      !href.startsWith('#') &&
      !href.startsWith('javascript:') &&
      !href.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|zip)$/i)
    ) {
      let fullHref = href;
      if (href.startsWith('/')) {
        fullHref = baseUrl + href;
      } else if (!href.startsWith('http')) {
        fullHref = baseUrl + '/' + href;
      }

      links.push({ href: fullHref, text });
    }
  }

  // 去重
  const uniqueLinks = Array.from(
    new Map(links.map((l) => [l.href, l])).values()
  );

  if (uniqueLinks.length < 3) {
    return {
      success: false,
      confidence: 0,
      error: '未能识别到足够的文章链接',
    };
  }

  // 尝试提取日期
  const dateRegex =
    /(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d+\s*(分钟|小时|天|周|月)前|今天|昨天)/g;
  const dates: string[] = [];
  let dateMatch;
  while ((dateMatch = dateRegex.exec(html)) !== null) {
    dates.push(dateMatch[1]);
  }

  // 构建预览数据
  const preview: PreviewArticle[] = uniqueLinks.slice(0, 10).map((link, index) => ({
    title: link.text,
    url: link.href,
    date: dates[index] || null,
    summary: null,
  }));

  // 计算置信度
  let confidence = 0.5;
  if (uniqueLinks.length >= 10) confidence += 0.2;
  if (dates.length >= 5) confidence += 0.15;
  if (uniqueLinks.every((l) => l.text.length > 15)) confidence += 0.15;

  // 返回默认配置（简单模式）
  const config: DetectedConfig = {
    articleContainer: 'article, .article, .post, .news-item, li',
    titleSelector: 'h2 a, h3 a, .title a, a',
    linkSelector: 'a[href]',
    dateSelector: 'time, .date, .time, [class*="date"]',
    summarySelector: '.summary, .excerpt, .description, p',
  };

  return {
    success: true,
    confidence: Math.min(confidence, 1),
    config,
    preview,
  };
}
