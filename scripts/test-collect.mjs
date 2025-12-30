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
    /\/(\d{4})[-/](\d{1,2})[-/](\d{1,2})\//,
    /\/(\d{4})(\d{2})(\d{2})\//,
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

// 从上下文提取日期
function extractDateFromContext(text) {
  const now = new Date();
  const currentYear = now.getFullYear();
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

    let saved = 0, withDate = 0;
    for (const article of articles) {
      const urlHash = crypto.createHash('md5').update(article.url).digest('hex');
      const existing = await db.execute({ sql: 'SELECT id FROM articles WHERE url_hash = ?', args: [urlHash] });
      if (existing.rows.length > 0) continue;

      const scores = calculateScore(article.title, source.tier || 2);
      const publishDate = article.date || new Date().toISOString();
      if (article.date) withDate++;

      await db.execute({
        sql: `INSERT INTO articles (id, source_id, industry_id, title, url, url_hash, publish_date, score, score_relevance, score_timeliness, score_impact, score_credibility, priority, is_featured, is_deleted, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '中', 0, 0, datetime('now'), datetime('now'))`,
        args: [crypto.randomUUID(), source.id, source.industry_id, article.title, article.url, urlHash, publishDate, scores.score, scores.scoreRelevance, scores.scoreTimeliness, scores.scoreImpact, scores.scoreCredibility]
      });
      saved++;
    }

    console.log(`✅ ${saved} 篇 (${withDate} 有日期)`);
    totalSaved += saved;
    totalWithDate += withDate;

  } catch (error) {
    console.log(`❌ ${error.message}`);
  }
}

console.log(`\n=== 完成 ===`);
console.log(`总计: ${totalSaved} 篇, 其中 ${totalWithDate} 篇有日期 (${totalSaved > 0 ? Math.round(totalWithDate/totalSaved*100) : 0}%)`);

// 显示示例
console.log('\n示例文章:');
const samples = await db.execute(`SELECT title, publish_date, url FROM articles ORDER BY created_at DESC LIMIT 5`);
for (const row of samples.rows) {
  const dateStr = row.publish_date ? new Date(row.publish_date).toLocaleDateString('zh-CN') : '无日期';
  console.log(`  [${dateStr}] ${row.title.substring(0, 40)}...`);
}

db.close();
