import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscribers, articles, industries, newsletterLogs, settings } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import {
  sendEmail,
  isEmailAvailable,
} from '@/lib/email';
import {
  generateNewsletterHTML,
  generateNewsletterText,
  NewsletterData,
  NewsletterArticle,
} from '@/lib/newsletter-template';
import crypto from 'crypto';

// Vercel Cron 密钥验证
const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/newsletter - 定时发送周报（由 Vercel Cron 调用）
export async function GET(request: NextRequest) {
  // 验证 Cron 密钥（防止未授权调用）
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron Newsletter] Starting scheduled newsletter send...');

  try {
    // 检查是否启用定时发送
    const newsletterEnabled = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'newsletter_enabled'))
      .limit(1);

    if (newsletterEnabled.length > 0 && newsletterEnabled[0].value === false) {
      console.log('[Cron Newsletter] Scheduled newsletter is disabled');
      return NextResponse.json({
        success: true,
        message: 'Scheduled newsletter is disabled',
        skipped: true,
      });
    }

    // 检查邮件服务是否可用
    const emailAvailable = await isEmailAvailable();
    if (!emailAvailable) {
      console.log('[Cron Newsletter] Email service not configured');
      return NextResponse.json({
        success: false,
        error: 'Email service not configured',
      }, { status: 400 });
    }

    // 获取活跃订阅者
    const activeSubscribers = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.isActive, true));

    if (activeSubscribers.length === 0) {
      console.log('[Cron Newsletter] No active subscribers');
      return NextResponse.json({
        success: true,
        message: 'No active subscribers',
        skipped: true,
      });
    }

    // 获取最近7天的文章
    const daysRange = 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysRange);

    const recentArticles = await db
      .select({
        id: articles.id,
        title: articles.title,
        url: articles.url,
        summary: articles.summary,
        score: articles.score,
        publishDate: articles.publishDate,
        industryId: articles.industryId,
      })
      .from(articles)
      .where(
        and(
          eq(articles.isDeleted, false),
          gte(articles.publishDate, startDate.toISOString())
        )
      )
      .orderBy(desc(articles.score))
      .limit(30);

    if (recentArticles.length === 0) {
      console.log('[Cron Newsletter] No articles to send');
      return NextResponse.json({
        success: true,
        message: 'No articles to send',
        skipped: true,
      });
    }

    // 获取行业信息
    const allIndustries = await db.select().from(industries);
    const industryMap = new Map(allIndustries.map(i => [i.id, { name: i.name, color: i.color }]));

    // 准备文章数据
    const newsletterArticles: NewsletterArticle[] = recentArticles.map(art => {
      const industry = art.industryId ? industryMap.get(art.industryId) : null;
      return {
        id: art.id,
        title: art.title,
        url: art.url,
        summary: art.summary,
        score: art.score,
        industryName: industry?.name || null,
        industryColor: industry?.color || null,
        publishDate: art.publishDate,
      };
    });

    // 统计各行业文章数
    const industryStats = allIndustries
      .map(ind => ({
        name: ind.name,
        color: ind.color || '#3b82f6',
        count: newsletterArticles.filter(a => a.industryName === ind.name).length,
      }))
      .filter(stat => stat.count > 0)
      .sort((a, b) => b.count - a.count);

    // 计算周数
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);

    // 日期范围
    const endDate = new Date();
    const dateRange = `${startDate.toLocaleDateString('zh-CN')} - ${endDate.toLocaleDateString('zh-CN')}`;

    // 准备模板数据
    const newsletterData: NewsletterData = {
      weekNumber,
      year: now.getFullYear(),
      dateRange,
      articles: newsletterArticles,
      industryStats,
    };

    // 自动生成主题
    const subject = `行业周报第${weekNumber}期 | ${dateRange}`;

    // 创建发送记录
    const logId = crypto.randomUUID().slice(0, 16);
    await db.insert(newsletterLogs).values({
      id: logId,
      subject,
      recipientCount: activeSubscribers.length,
      successCount: 0,
      failedCount: 0,
      status: 'sending',
      sentAt: new Date().toISOString(),
    });

    // 生成邮件内容
    const html = generateNewsletterHTML(newsletterData);
    const text = generateNewsletterText(newsletterData);

    // 发送邮件
    let successCount = 0;
    let failedCount = 0;

    for (const subscriber of activeSubscribers) {
      const success = await sendEmail({
        to: subscriber.email,
        subject,
        html,
        text,
      });

      if (success) {
        successCount++;
        console.log(`[Cron Newsletter] Sent to ${subscriber.email}`);
      } else {
        failedCount++;
        console.log(`[Cron Newsletter] Failed to send to ${subscriber.email}`);
      }

      // 添加小延迟，避免触发速率限制
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 更新发送记录
    await db
      .update(newsletterLogs)
      .set({
        successCount,
        failedCount,
        status: 'completed',
        completedAt: new Date().toISOString(),
      })
      .where(eq(newsletterLogs.id, logId));

    console.log(`[Cron Newsletter] Completed: ${successCount}/${activeSubscribers.length} sent`);

    return NextResponse.json({
      success: true,
      data: {
        totalRecipients: activeSubscribers.length,
        successCount,
        failedCount,
        articlesCount: newsletterArticles.length,
        weekNumber,
        subject,
      },
    });
  } catch (error) {
    console.error('[Cron Newsletter] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
