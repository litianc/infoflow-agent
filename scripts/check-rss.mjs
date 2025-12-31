#!/usr/bin/env node
/**
 * 检查数据源是否有 RSS Feed
 */
import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

try {
  const envContent = readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {}

const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./local.db' });

// 常见的 RSS 路径
const RSS_PATHS = [
  '/rss', '/rss.xml', '/feed', '/feed.xml', '/atom.xml',
  '/rss/', '/feed/', '/index.xml', '/rss/index.xml',
  '/feeds/posts/default', '/blog/rss', '/news/rss'
];

async function checkRSS(baseUrl, name) {
  const results = [];
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;
  
  // 先检查页面中的 RSS 链接
  try {
    const response = await fetch(baseUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSChecker/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const html = await response.text();
      // 查找 <link rel="alternate" type="application/rss+xml">
      const rssLinks = html.match(/<link[^>]*type=["']application\/(rss|atom)\+xml["'][^>]*>/gi) || [];
      for (const link of rssLinks) {
        const hrefMatch = link.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          let rssUrl = hrefMatch[1];
          if (rssUrl.startsWith('/')) rssUrl = origin + rssUrl;
          else if (!rssUrl.startsWith('http')) rssUrl = origin + '/' + rssUrl;
          results.push({ url: rssUrl, source: 'page-link' });
        }
      }
    }
  } catch (e) {}

  // 尝试常见路径
  for (const path of RSS_PATHS) {
    const rssUrl = origin + path;
    try {
      const response = await fetch(rssUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSChecker/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const text = await response.text();
        // 检查是否是有效的 RSS/Atom
        if (text.includes('<rss') || text.includes('<feed') || text.includes('<channel>')) {
          results.push({ url: rssUrl, source: 'common-path' });
        }
      }
    } catch (e) {}
  }

  return results;
}

const sources = await db.execute('SELECT name, url FROM sources WHERE is_active = 1 ORDER BY name');

console.log('=== RSS Feed 检查 ===\n');

for (const source of sources.rows) {
  process.stdout.write(`${source.name}... `);
  const rssFeeds = await checkRSS(source.url, source.name);
  if (rssFeeds.length > 0) {
    console.log(`✅ 找到 ${rssFeeds.length} 个`);
    rssFeeds.forEach(r => console.log(`   ${r.url}`));
  } else {
    console.log('❌ 未找到');
  }
}

db.close();
