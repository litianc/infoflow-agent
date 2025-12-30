import { readFileSync } from 'fs';
import { createClient } from '@libsql/client';
import crypto from 'crypto';

// Load environment variables
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

const db = createClient({ url: 'file:./local.db' });

// Get new sources
const sourcesResult = await db.execute(`
  SELECT s.id, s.name, s.url, s.industry_id, i.name as industry_name
  FROM sources s
  JOIN industries i ON s.industry_id = i.id
  WHERE s.id LIKE 'src-%' AND s.is_active = 1
`);
const sources = sourcesResult.rows;

console.log(`Testing ${sources.length} new sources...\n`);

// 无意义标题过滤规则
const INVALID_TITLE_PATTERNS = [
  /^(查看|点击|了解|阅读|更多|详情|详细|进入|返回|下载|登录|注册|订阅)/,
  /^(首页|关于|联系|帮助|搜索|设置|个人中心)/,
  /(详情|更多|点击这里|click|more|view|read)\s*[>»→]?\s*$/i,
  /^[\s\d\-_./]+$/,
  /^[<>《》【】\[\]「」『』]+.*[<>《》【】\[\]「」『』]+$/,
  /&[a-z]+;/i,
];

// Extract articles function
function extractArticles(html, baseUrl, limit = 20) {
  const articles = [];
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/a][^>]*>[^<]*)*)<\/a>/gi;
  let match;

  let baseUrlObj;
  try {
    baseUrlObj = new URL(baseUrl);
  } catch {
    return articles;
  }

  while ((match = linkRegex.exec(html)) !== null && articles.length < limit) {
    const href = match[1];
    let text = match[2].replace(/<[^>]*>/g, '').trim();

    // 解码 HTML 实体
    text = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
      .trim();

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

    articles.push({ title: text, url: fullUrl });
  }

  return articles;
}

// Test each source
const results = [];

for (const source of sources) {
  process.stdout.write(`Testing ${source.name}... `);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}`);
      results.push({ ...source, status: 'failed', error: `HTTP ${response.status}`, articles: 0 });
      continue;
    }

    const html = await response.text();
    const articles = extractArticles(html, source.url, 20);

    if (articles.length > 0) {
      console.log(`✅ ${articles.length} articles found`);

      // Save articles to database
      let saved = 0;
      for (const article of articles) {
        const urlHash = crypto.createHash('md5').update(article.url).digest('hex');

        // Check if exists
        const existing = await db.execute({
          sql: 'SELECT id FROM articles WHERE url_hash = ?',
          args: [urlHash]
        });

        if (existing.rows.length === 0) {
          await db.execute({
            sql: `INSERT INTO articles (id, source_id, industry_id, title, url, url_hash, publish_date, score, priority, is_featured, is_deleted, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, '中', 0, 0, datetime('now'), datetime('now'))`,
            args: [crypto.randomUUID(), source.id, source.industry_id, article.title, article.url, urlHash, 60]
          });
          saved++;
        }
      }

      console.log(`   └─ Saved ${saved} new articles`);
      results.push({ ...source, status: 'success', articles: articles.length, saved });

      // Update source status
      await db.execute({
        sql: `UPDATE sources SET last_collected_at = datetime('now'), success_count = success_count + 1, last_error = NULL WHERE id = ?`,
        args: [source.id]
      });
    } else {
      console.log(`⚠️ No articles extracted`);
      results.push({ ...source, status: 'empty', articles: 0 });
    }
  } catch (error) {
    console.log(`❌ ${error.message}`);
    results.push({ ...source, status: 'failed', error: error.message, articles: 0 });

    // Update error status
    await db.execute({
      sql: `UPDATE sources SET error_count = error_count + 1, last_error = ? WHERE id = ?`,
      args: [error.message, source.id]
    });
  }
}

// Summary
console.log('\n========== Summary ==========\n');

const byIndustry = {};
for (const r of results) {
  if (!byIndustry[r.industry_name]) {
    byIndustry[r.industry_name] = { success: 0, failed: 0, articles: 0, saved: 0 };
  }
  if (r.status === 'success') {
    byIndustry[r.industry_name].success++;
    byIndustry[r.industry_name].articles += r.articles;
    byIndustry[r.industry_name].saved += r.saved || 0;
  } else {
    byIndustry[r.industry_name].failed++;
  }
}

for (const [industry, stats] of Object.entries(byIndustry)) {
  console.log(`${industry}: ${stats.success}/${stats.success + stats.failed} sources, ${stats.saved} new articles`);
}

db.close();
