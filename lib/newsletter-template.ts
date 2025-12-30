/**
 * 周报邮件模板
 * 简洁清爽的设计风格
 */

export interface NewsletterArticle {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  score: number | null;
  industryName: string | null;
  industryColor: string | null;
  publishDate: string | null;
}

export interface NewsletterData {
  weekNumber: number;
  year: number;
  dateRange: string;
  articles: NewsletterArticle[];
  industryStats: { name: string; count: number; color: string }[];
}

// 根据评分获取推荐等级
function getRecommendationLevel(score: number | null): { text: string; color: string; icon: string } {
  if (!score) return { text: '普通', color: '#9ca3af', icon: '○' };
  if (score >= 90) return { text: '必读', color: '#ef4444', icon: '★★★' };
  if (score >= 75) return { text: '推荐', color: '#f97316', icon: '★★' };
  if (score >= 60) return { text: '值得', color: '#22c55e', icon: '★' };
  return { text: '普通', color: '#9ca3af', icon: '○' };
}

// 行业图标映射
const industryIcons: Record<string, string> = {
  '数据中心': '🏢',
  '云计算': '☁️',
  'AI算力': '🤖',
  '芯片半导体': '💾',
  '网络通信': '📡',
  '政策监管': '📋',
  '投资并购': '💰',
};

function getIndustryIcon(industryName: string | null): string {
  if (!industryName) return '📰';
  return industryIcons[industryName] || '📰';
}

// 生成周报 HTML 模板
export function generateNewsletterHTML(data: NewsletterData): string {
  const { weekNumber, year, dateRange, articles, industryStats } = data;

  // 按行业分组文章
  const articlesByIndustry = articles.reduce((acc, article) => {
    const industry = article.industryName || '未分类';
    if (!acc[industry]) {
      acc[industry] = [];
    }
    acc[industry].push(article);
    return acc;
  }, {} as Record<string, NewsletterArticle[]>);

  // 生成文章列表 HTML
  const articlesHTML = Object.entries(articlesByIndustry)
    .map(([industry, industryArticles]) => {
      const icon = getIndustryIcon(industry);
      const articleItems = industryArticles
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((article) => {
          const rec = getRecommendationLevel(article.score);
          return `
            <tr>
              <td style="padding: 16px 0; border-bottom: 1px solid #f3f4f6;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="display: inline-block; padding: 2px 8px; background: ${rec.color}15; color: ${rec.color}; font-size: 12px; font-weight: 500; border-radius: 4px;">${rec.icon} ${rec.text}</span>
                        <span style="color: #9ca3af; font-size: 12px;">评分 ${article.score || '-'}</span>
                      </div>
                      <a href="${article.url}" style="color: #1f2937; font-size: 16px; font-weight: 500; text-decoration: none; line-height: 1.5;" target="_blank">
                        ${article.title}
                      </a>
                      ${article.summary ? `<p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;">${article.summary}</p>` : ''}
                      <div style="margin-top: 8px;">
                        <a href="${article.url}" style="color: #3b82f6; font-size: 13px; text-decoration: none;" target="_blank">阅读原文 →</a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        })
        .join('');

      return `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 16px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 8px 8px 0 0;">
              <span style="font-size: 18px; margin-right: 8px;">${icon}</span>
              <span style="font-size: 16px; font-weight: 600; color: #1f2937;">${industry}</span>
              <span style="color: #9ca3af; font-size: 14px; margin-left: 8px;">${industryArticles.length} 篇</span>
            </td>
          </tr>
          ${articleItems}
        </table>
      `;
    })
    .join('');

  // 生成行业统计 HTML
  const statsHTML = industryStats
    .map(
      (stat) => `
      <td style="text-align: center; padding: 8px 12px;">
        <div style="font-size: 20px; margin-bottom: 4px;">${getIndustryIcon(stat.name)}</div>
        <div style="font-size: 20px; font-weight: 600; color: ${stat.color || '#3b82f6'};">${stat.count}</div>
        <div style="font-size: 12px; color: #9ca3af;">${stat.name}</div>
      </td>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>行业情报周报 - 第${weekNumber}期</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #f3f4f6;">
              <div style="margin-bottom: 16px;">
                <span style="font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">InfoFlow</span>
                <span style="font-size: 14px; color: #9ca3af; margin-left: 8px;">行业情报</span>
              </div>
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #1f2937;">
                行业情报周报
              </h1>
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                ${year}年 第${weekNumber}期 · ${dateRange}
              </p>
            </td>
          </tr>

          <!-- Stats Overview -->
          <tr>
            <td style="padding: 24px 32px;">
              <div style="text-align: center; margin-bottom: 8px;">
                <span style="font-size: 14px; color: #6b7280;">本期精选</span>
                <span style="font-size: 24px; font-weight: 700; color: #1f2937; margin: 0 8px;">${articles.length}</span>
                <span style="font-size: 14px; color: #6b7280;">篇行业资讯</span>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                <tr>
                  ${statsHTML}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, #e5e7eb, transparent);"></div>
            </td>
          </tr>

          <!-- Articles -->
          <tr>
            <td style="padding: 24px 32px;">
              ${articlesHTML}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                感谢您订阅行业情报周报
              </p>
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                如需退订，请回复本邮件或联系管理员
              </p>
              <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                <span style="font-size: 12px; color: #9ca3af;">
                  Powered by InfoFlow · 行业情报平台
                </span>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// 生成纯文本版本（用于不支持 HTML 的邮件客户端）
export function generateNewsletterText(data: NewsletterData): string {
  const { weekNumber, year, dateRange, articles } = data;

  const header = `
========================================
InfoFlow 行业情报周报
${year}年 第${weekNumber}期
${dateRange}
========================================

本期精选 ${articles.length} 篇行业资讯

`;

  const articlesByIndustry = articles.reduce((acc, article) => {
    const industry = article.industryName || '未分类';
    if (!acc[industry]) {
      acc[industry] = [];
    }
    acc[industry].push(article);
    return acc;
  }, {} as Record<string, NewsletterArticle[]>);

  const articlesText = Object.entries(articlesByIndustry)
    .map(([industry, industryArticles]) => {
      const articleItems = industryArticles
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .map((article) => {
          const rec = getRecommendationLevel(article.score);
          return `
[${rec.text}] ${article.title}
评分: ${article.score || '-'}
${article.summary ? `摘要: ${article.summary}` : ''}
原文: ${article.url}
`;
        })
        .join('\n');

      return `
【${industry}】(${industryArticles.length}篇)
----------------------------------------
${articleItems}`;
    })
    .join('\n');

  const footer = `
========================================
感谢您订阅行业情报周报
如需退订，请回复本邮件或联系管理员

Powered by InfoFlow · 行业情报平台
========================================
`;

  return header + articlesText + footer;
}
