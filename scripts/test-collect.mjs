#!/usr/bin/env node
/**
 * 测试采集脚本 - 每个数据源只采集少量文章
 * 用法: node scripts/test-collect.mjs [limit]
 * limit: 每个数据源采集的文章数量，默认 3
 */

import { createClient } from '@libsql/client';
import crypto from 'crypto';
import { readFileSync } from 'fs';

// 加载环境变量
try {
  const envContent = readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.log('Warning: .env.local not found');
}

const LIMIT = parseInt(process.argv[2]) || 3;
const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./local.db' });

console.log(`\n=== 测试采集 (每数据源 ${LIMIT} 篇) ===\n`);

// 从 URL 中提取日期
function extractDateFromUrl(url) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const urlPatterns = [
    /\/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\//,  // /2025-12-30/ or /2025/12/30/
    /\/(\d{4})(\d{2})(\d{2})\//,               // /20251230/
  ];
  for (const pattern of urlPatterns) {
    const match = url.match(pattern);
    if (match) {
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= currentYear) {
        const date = new Date(year, month - 1, day);
        if (date <= now) return date.toISOString();
      }
    }
  }
  return null;
}

// 解析相对时间（方案一核心）
function parseRelativeTime(text) {
  const now = new Date();

  // 昨天 11:47
  if (/昨天/.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return date.toISOString();
  }

  // 前天 17:08
  if (/前天/.test(text)) {
    const date = new Date(now);
    date.setDate(date.getDate() - 2);
    return date.toISOString();
  }

  // X天前
  const daysAgo = text.match(/(\d+)\s*天前/);
  if (daysAgo) {
    const date = new Date(now);
    date.setDate(date.getDate() - parseInt(daysAgo[1]));
    return date.toISOString();
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
    return now.toISOString(); // 当天
  }

  // 刚刚、今天
  if (/刚刚|今天/.test(text)) {
    return now.toISOString();
  }

  return null;
}

// 从上下文提取日期（增强版）
function extractDateFromContext(text) {
  const now = new Date();
  const currentYear = now.getFullYear();

  // 先尝试相对时间
  const relativeDate = parseRelativeTime(text);
  if (relativeDate) return relativeDate;

  // 标准日期格式
  const patterns = [
    /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
    /(\d{4})年(\d{1,2})月(\d{1,2})日/,
    /(\d{1,2})月(\d{1,2})日/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let year, month, day;
      if (match.length === 4) {
        year = parseInt(match[1]); month = parseInt(match[2]); day = parseInt(match[3]);
      } else if (match.length === 3) {
        year = currentYear; month = parseInt(match[1]); day = parseInt(match[2]);
        if (new Date(year, month - 1, day) > now) year--;
      } else continue;
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2020 && year <= currentYear) {
        const date = new Date(year, month - 1, day);
        if (date <= now) return date.toISOString();
      }
    }
  }
  return null;
}

// 方案四：从文章页面提取发布日期
async function fetchArticleDate(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();

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

    // 3. 查找常见的日期 class 元素
    const dateClassPatterns = [
      /<[^>]*class="[^"]*(?:pub[-_]?date|publish[-_]?date|post[-_]?date|article[-_]?date|time|date)[^"]*"[^>]*>([^<]+)</gi,
      /<span[^>]*class="[^"]*time[^"]*"[^>]*>([^<]+)</gi,
    ];

    for (const pattern of dateClassPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const dateText = match[1].trim();
        // 尝试解析相对时间
        const relativeDate = parseRelativeTime(dateText);
        if (relativeDate) return relativeDate;
        // 尝试解析标准日期
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
  } catch (error) {
    return null;
  }
}

// 提取文章
function extractArticles(html, baseUrl, limit) {
  const articles = [];
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*)*)<\/a>/gi;
  let match;
  let baseUrlObj;
  try { baseUrlObj = new URL(baseUrl); } catch { return articles; }

  while ((match = linkRegex.exec(html)) !== null && articles.length < limit) {
    const matchIndex = match.index;
    const href = match[1];
    let text = match[2].replace(/<[^>]*>/g, '').trim()
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code)).trim();

    if (text.length < 10 || text.length > 200 || href.startsWith('#') || href.startsWith('javascript:')) continue;
    if (/^(查看|点击|了解|阅读|更多|详情|首页|关于)/.test(text)) continue;

    let fullUrl = href;
    if (href.startsWith('/')) fullUrl = baseUrlObj.origin + href;
    else if (!href.startsWith('http')) fullUrl = baseUrlObj.origin + '/' + href;

    if (articles.some(a => a.url === fullUrl)) continue;

    // 日期提取：优先 URL，其次上下文（排除标题）
    let articleDate = extractDateFromUrl(fullUrl);
    if (!articleDate) {
      const contextStart = Math.max(0, matchIndex - 200);
      const contextEnd = Math.min(html.length, matchIndex + match[0].length + 200);
      let context = html.slice(contextStart, contextEnd).replace(/<[^>]*>/g, ' ').replace(text, '');
      articleDate = extractDateFromContext(context);
    }

    articles.push({ title: text, url: fullUrl, date: articleDate });
  }
  return articles;
}

// 计算评分
function calculateScore(title, tier) {
  let relevance = 20;
  if (title.length > 15) relevance += 5;
  if (title.length > 30) relevance += 5;
  if (/数据中心|云计算|AI|芯片|算力|服务器|网络/.test(title)) relevance += 10;
  relevance = Math.min(relevance, 40);

  const timeliness = 20;
  let impact = 10;
  if (/重大|突破|首次|发布|官方|新政|融资|上市|收购|投资/.test(title)) impact = 20;

  let credibility = tier === 1 ? 15 : tier === 2 ? 12 : 8;

  return {
    score: relevance + timeliness + impact + credibility,
    scoreRelevance: relevance, scoreTimeliness: timeliness,
    scoreImpact: impact, scoreCredibility: credibility
  };
}

// 获取数据源
const sourcesResult = await db.execute(`
  SELECT s.id, s.name, s.url, s.industry_id, s.tier
  FROM sources s WHERE s.is_active = 1
`);
const sources = sourcesResult.rows;
console.log(`找到 ${sources.length} 个活跃数据源\n`);

let totalSaved = 0;
let totalWithDate = 0;
let totalFetched = 0; // 通过方案四获取日期的数量

for (const source of sources) {
  process.stdout.write(`${source.name}... `);
  try {
    const response = await fetch(source.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { console.log(`❌ HTTP ${response.status}`); continue; }

    const html = await response.text();
    const articles = extractArticles(html, source.url, LIMIT);

    if (articles.length === 0) { console.log('⚠️ 无文章'); continue; }

    let saved = 0, withDate = 0, fetched = 0;
    for (const article of articles) {
      const urlHash = crypto.createHash('md5').update(article.url).digest('hex');
      const existing = await db.execute({ sql: 'SELECT id FROM articles WHERE url_hash = ?', args: [urlHash] });
      if (existing.rows.length > 0) continue;

      // 方案四：如果没有日期，尝试从文章页获取
      let publishDate = article.date;
      if (!publishDate) {
        process.stdout.write('📄');
        publishDate = await fetchArticleDate(article.url);
        if (publishDate) fetched++;
      }

      if (publishDate) withDate++;
      publishDate = publishDate || new Date().toISOString();

      const scores = calculateScore(article.title, source.tier || 2);

      await db.execute({
        sql: `INSERT INTO articles (id, source_id, industry_id, title, url, url_hash, publish_date, score, score_relevance, score_timeliness, score_impact, score_credibility, priority, is_featured, is_deleted, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '中', 0, 0, datetime('now'), datetime('now'))`,
        args: [crypto.randomUUID(), source.id, source.industry_id, article.title, article.url, urlHash, publishDate, scores.score, scores.scoreRelevance, scores.scoreTimeliness, scores.scoreImpact, scores.scoreCredibility]
      });
      saved++;
    }

    const fetchedStr = fetched > 0 ? `, ${fetched} 页面抓取` : '';
    console.log(`✅ ${saved} 篇 (${withDate} 有日期${fetchedStr})`);
    totalSaved += saved;
    totalWithDate += withDate;
    totalFetched += fetched;

  } catch (error) {
    console.log(`❌ ${error.message}`);
  }
}

console.log(`\n=== 完成 ===`);
console.log(`总计: ${totalSaved} 篇, 其中 ${totalWithDate} 篇有日期 (${totalSaved > 0 ? Math.round(totalWithDate/totalSaved*100) : 0}%)`);
console.log(`日期来源: ${totalWithDate - totalFetched} 篇列表页, ${totalFetched} 篇文章页抓取`);

// 显示示例
console.log('\n示例文章:');
const samples = await db.execute(`SELECT title, publish_date, url FROM articles ORDER BY created_at DESC LIMIT 5`);
for (const row of samples.rows) {
  const dateStr = row.publish_date ? new Date(row.publish_date).toLocaleDateString('zh-CN') : '无日期';
  console.log(`  [${dateStr}] ${row.title.substring(0, 40)}...`);
}

db.close();
