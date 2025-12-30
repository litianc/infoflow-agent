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

// LLM Configuration
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_API_BASE = process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';
const LLM_MODEL = process.env.LLM_MODEL || 'GLM-4-Flash';

console.log('LLM Config:', LLM_API_KEY ? 'Configured' : 'Not configured');

// Get all industries
const industriesResult = await db.execute(`
  SELECT id, name, keywords FROM industries WHERE is_active = 1
`);
const industries = industriesResult.rows;
console.log(`Loaded ${industries.length} industries\n`);

// LLM classify function
async function classifyArticle(title, summary) {
  if (!LLM_API_KEY) return null;

  const content = summary ? `${title}\n${summary}` : title;
  const industryList = industries
    .map((ind, idx) => `${idx + 1}. ${ind.name}（关键词：${ind.keywords || ''}）`)
    .join('\n');

  try {
    const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个行业分类专家。请根据文章标题和内容，判断它最适合归类到哪个行业。

可选的行业列表：
${industryList}

请直接输出最匹配的行业名称，不要输出其他内容。如果无法确定，请输出"未分类"。`
          },
          {
            role: 'user',
            content: `文章内容：${content}`
          }
        ],
        max_tokens: 50,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content?.trim();

    if (result) {
      const matched = industries.find(
        ind => ind.name === result || result.includes(ind.name)
      );
      return matched?.id || null;
    }
  } catch (error) {
    // Silently fail
  }
  return null;
}

// Generate summary function
async function generateSummary(title) {
  if (!LLM_API_KEY) return null;

  try {
    const response = await fetch(`${LLM_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的新闻编辑。请根据文章标题，生成一段50-100字的中文摘要。直接输出摘要内容，不要加任何前缀。`
          },
          {
            role: 'user',
            content: `标题：${title}`
          }
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    return null;
  }
}

// 无意义标题关键词（需要过滤）
const INVALID_TITLE_PATTERNS = [
  /^(查看|点击|了解|阅读|更多|详情|详细|进入|返回|下载|登录|注册|订阅)/,
  /^(首页|关于|联系|帮助|搜索|设置|个人中心)/,
  /(详情|更多|点击这里|click|more|view|read)\s*[>»→]?\s*$/i,
  /^[\s\d\-_./]+$/,  // 纯数字、符号
  /^[<>《》【】\[\]「」『』]+.*[<>《》【】\[\]「」『』]+$/,  // 被特殊符号包裹
  /&[a-z]+;/i,  // 包含未解码的 HTML 实体
];

// Extract articles function
function extractArticles(html, baseUrl, limit = 15) {
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

    articles.push({ title: text, url: fullUrl });
  }

  return articles;
}

// Calculate score
function calculateScore(title, tier) {
  let score = 50;
  if (tier === 1) score += 20;
  else if (tier === 2) score += 10;

  if (title.length > 20) score += 5;
  if (title.length > 40) score += 5;

  const keywords = ['重大', '突破', '首次', '发布', '官方', '新政', '融资', '上市', '收购', '投资'];
  for (const keyword of keywords) {
    if (title.includes(keyword)) {
      score += 5;
      break;
    }
  }

  return Math.min(score, 100);
}

// Get all active sources
const sourcesResult = await db.execute(`
  SELECT s.id, s.name, s.url, s.industry_id, s.tier, i.name as industry_name
  FROM sources s
  LEFT JOIN industries i ON s.industry_id = i.id
  WHERE s.is_active = 1
`);
const sources = sourcesResult.rows;

console.log(`Collecting from ${sources.length} sources with LLM classification...\n`);

let totalSaved = 0;
let totalClassified = 0;

for (const source of sources) {
  process.stdout.write(`${source.name}... `);

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
      continue;
    }

    const html = await response.text();
    const articles = extractArticles(html, source.url, 15);

    if (articles.length === 0) {
      console.log(`⚠️ No articles`);
      continue;
    }

    let saved = 0;
    let classified = 0;

    for (const article of articles) {
      const urlHash = crypto.createHash('md5').update(article.url).digest('hex');

      // Check if exists
      const existing = await db.execute({
        sql: 'SELECT id FROM articles WHERE url_hash = ?',
        args: [urlHash]
      });

      if (existing.rows.length > 0) continue;

      // Generate summary
      const summary = await generateSummary(article.title);

      // LLM classify based on content
      let industryId = await classifyArticle(article.title, summary);

      if (industryId) {
        classified++;
      } else {
        // Fallback to source industry
        industryId = source.industry_id;
      }

      const score = calculateScore(article.title, source.tier || 2);

      await db.execute({
        sql: `INSERT INTO articles (id, source_id, industry_id, title, url, url_hash, summary, publish_date, score, priority, is_featured, is_deleted, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, '中', 0, 0, datetime('now'), datetime('now'))`,
        args: [crypto.randomUUID(), source.id, industryId, article.title, article.url, urlHash, summary, score]
      });
      saved++;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`✅ ${saved} saved, ${classified} LLM classified`);
    totalSaved += saved;
    totalClassified += classified;

    // Update source status
    await db.execute({
      sql: `UPDATE sources SET last_collected_at = datetime('now'), success_count = success_count + 1, last_error = NULL WHERE id = ?`,
      args: [source.id]
    });

  } catch (error) {
    console.log(`❌ ${error.message}`);
  }
}

// Summary
console.log('\n========== Summary ==========\n');
console.log(`Total saved: ${totalSaved} articles`);
console.log(`LLM classified: ${totalClassified} articles`);

// Show article counts by industry
const countResult = await db.execute(`
  SELECT i.name, COUNT(a.id) as count
  FROM industries i
  LEFT JOIN articles a ON a.industry_id = i.id AND a.is_deleted = 0
  WHERE i.is_active = 1
  GROUP BY i.id
  ORDER BY count DESC
`);

console.log('\nArticles by industry:');
for (const row of countResult.rows) {
  console.log(`  ${row.name}: ${row.count}`);
}

db.close();
