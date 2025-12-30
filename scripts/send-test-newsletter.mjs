import { readFileSync } from 'fs';
import { createClient } from '@libsql/client';
import nodemailer from 'nodemailer';

// 获取收件人邮箱（命令行参数或环境变量）
const TEST_EMAIL = process.argv[2] || process.env.TEST_EMAIL;
if (!TEST_EMAIL) {
  console.error('Usage: node scripts/send-test-newsletter.mjs <email>');
  console.error('  or set TEST_EMAIL environment variable');
  process.exit(1);
}

// Load environment variables from .env.local
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    process.env[key.trim()] = valueParts.join('=').trim();
  }
});

// Database
const db = createClient({
  url: 'file:./local.db',
});

// Get all active industries first
const industriesResult = await db.execute(`
  SELECT id, name, color FROM industries WHERE is_active = 1
`);
const allIndustries = industriesResult.rows;

// 配置参数
const MIN_ARTICLES = 2;        // 每个行业最少2篇
const MAX_ARTICLES = 5;        // 每个行业最多5篇
const MIN_SCORE = 55;          // 最低评分门槛
const DAYS_RANGE = 7;          // 最近7天的文章

// 计算日期范围
const startDate = new Date();
startDate.setDate(startDate.getDate() - DAYS_RANGE);
const startDateStr = startDate.toISOString();

// Get 2-5 high-scoring articles from each industry
const articles = [];

for (const industry of allIndustries) {
  // 先获取该行业符合条件的高分文章（近7天内）
  const industryArticles = await db.execute({
    sql: `
      SELECT a.id, a.title, a.url, a.summary, a.score, a.publish_date,
             ? as industry_name, ? as industry_color
      FROM articles a
      WHERE a.industry_id = ?
        AND a.is_deleted = 0
        AND a.score >= ?
        AND a.created_at >= ?
      ORDER BY a.score DESC
      LIMIT ?
    `,
    args: [industry.name, industry.color, industry.id, MIN_SCORE, startDateStr, MAX_ARTICLES]
  });

  const count = industryArticles.rows.length;
  if (count >= MIN_ARTICLES) {
    // 有足够高分文章，全部加入
    articles.push(...industryArticles.rows);
    console.log(`${industry.name}: ${count} 篇高分文章`);
  } else if (count > 0) {
    // 高分文章不足，但有一些
    articles.push(...industryArticles.rows);
    console.log(`${industry.name}: ${count} 篇文章（不足${MIN_ARTICLES}篇）`);
  } else {
    console.log(`${industry.name}: 无高分文章，跳过`);
  }
}

console.log(`\n总计: ${articles.length} 篇文章`);

// Calculate stats from selected articles (not all articles)
const statsMap = {};
for (const art of articles) {
  const name = art.industry_name || '未分类';
  if (!statsMap[name]) {
    statsMap[name] = { name, color: art.industry_color || '#3b82f6', count: 0 };
  }
  statsMap[name].count++;
}
const stats = Object.values(statsMap).sort((a, b) => b.count - a.count);

// Industry icons
const icons = {
  '数据中心': '🏢',
  '云计算': '☁️',
  'AI算力': '🤖',
  '芯片半导体': '💾',
  '网络通信': '📡',
  '政策监管': '📋',
  '投资并购': '💰',
};

// Get recommendation level
function getRecLevel(score) {
  if (!score) return { text: '普通', color: '#9ca3af', icon: '○' };
  if (score >= 90) return { text: '必读', color: '#ef4444', icon: '★★★' };
  if (score >= 75) return { text: '推荐', color: '#f97316', icon: '★★' };
  if (score >= 60) return { text: '值得', color: '#22c55e', icon: '★' };
  return { text: '普通', color: '#9ca3af', icon: '○' };
}

// Group articles by industry
const byIndustry = {};
for (const art of articles) {
  const ind = art.industry_name || '未分类';
  if (!byIndustry[ind]) byIndustry[ind] = [];
  byIndustry[ind].push(art);
}

// Generate HTML
const statsHtml = stats.map(s => `
  <td style="text-align: center; padding: 8px 12px;">
    <div style="font-size: 20px; margin-bottom: 4px;">${icons[s.name] || '📰'}</div>
    <div style="font-size: 20px; font-weight: 600; color: ${s.color || '#3b82f6'};">${s.count}</div>
    <div style="font-size: 12px; color: #9ca3af;">${s.name}</div>
  </td>
`).join('');

const articlesHtml = Object.entries(byIndustry).map(([industry, arts]) => {
  const icon = icons[industry] || '📰';
  const items = arts.map(art => {
    const rec = getRecLevel(art.score);
    return `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
          <div style="margin-bottom: 8px;">
            <span style="display: inline-block; padding: 2px 8px; background: ${rec.color}15; color: ${rec.color}; font-size: 12px; font-weight: 500; border-radius: 4px;">${rec.icon} ${rec.text}</span>
            <span style="color: #9ca3af; font-size: 12px; margin-left: 8px;">评分 ${art.score || '-'}</span>
          </div>
          <a href="${art.url}" style="color: #1f2937; font-size: 16px; font-weight: 500; text-decoration: none; line-height: 1.5;" target="_blank">${art.title}</a>
          ${art.summary ? `<p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;">${art.summary}</p>` : ''}
          <div style="margin-top: 8px;">
            <a href="${art.url}" style="color: #3b82f6; font-size: 13px; text-decoration: none;" target="_blank">阅读原文 →</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px 16px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px 8px 0 0;">
          <span style="font-size: 18px; margin-right: 8px;">${icon}</span>
          <span style="font-size: 16px; font-weight: 600; color: #1f2937;">${industry}</span>
          <span style="color: #9ca3af; font-size: 14px; margin-left: 8px;">${arts.length} 篇</span>
        </td>
      </tr>
      ${items}
    </table>
  `;
}).join('');

const now = new Date();
const weekNum = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000);

const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>行业情报周报 - 第${weekNum}期</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
              <div style="margin-bottom: 16px;">
                <span style="font-size: 28px; font-weight: 700; color: #3b82f6;">InfoFlow</span>
                <span style="font-size: 14px; color: #9ca3af; margin-left: 8px;">行业情报</span>
              </div>
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1f2937;">行业情报周报</h1>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">${now.getFullYear()}年 第${weekNum}期 · ${now.toLocaleDateString('zh-CN')}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px;">
              <div style="text-align: center; margin-bottom: 8px;">
                <span style="font-size: 14px; color: #6b7280;">本期精选</span>
                <span style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 8px;">${articles.length}</span>
                <span style="font-size: 14px; color: #6b7280;">篇行业资讯</span>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                <tr>${statsHtml}</tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent);"></div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px;">
              ${articlesHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">感谢您订阅行业情报周报</p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">如需退订，请回复本邮件或联系管理员</p>
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <span style="font-size: 12px; color: #9ca3af;">Powered by InfoFlow · 行业情报平台</span>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// Send email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SMTP_HOST,
  port: parseInt(process.env.EMAIL_SMTP_PORT || '465'),
  secure: process.env.EMAIL_SMTP_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_SMTP_USER,
    pass: process.env.EMAIL_SMTP_PASSWORD,
  },
});

console.log('Sending email...');
console.log('SMTP Host:', process.env.EMAIL_SMTP_HOST);
console.log('SMTP User:', process.env.EMAIL_SMTP_USER);
console.log('To:', TEST_EMAIL);

try {
  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: TEST_EMAIL,
    subject: `行业情报周报 - 第${weekNum}期 (${now.toLocaleDateString('zh-CN')})`,
    html: html,
  });
  console.log('Email sent successfully!');
  console.log('Message ID:', result.messageId);
} catch (error) {
  console.error('Failed to send email:', error.message);
}

db.close();
