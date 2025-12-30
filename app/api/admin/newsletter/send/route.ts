import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscribers, articles, industries, newsletterLogs } from '@/lib/db/schema';
import { eq, desc, and, gte } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';
import {
  sendEmail,
  generateUnsubscribeToken,
  isEmailAvailable,
} from '@/lib/email';
import {
  generateNewsletterHTML,
  generateNewsletterText,
  NewsletterData,
  NewsletterArticle,
} from '@/lib/newsletter-template';
import crypto from 'crypto';

// POST /api/admin/newsletter/send - 发送周报
export async function POST(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    // 检查邮件服务是否可用
    const emailAvailable = await isEmailAvailable();
    if (!emailAvailable) {
      return NextResponse.json(
        { success: false, error: { code: 'EMAIL_NOT_CONFIGURED', message: '邮件服务未配置' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { subject, daysRange = 7 } = body;

    if (!subject) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '缺少邮件主题' } },
        { status: 400 }
      );
    }

    // 获取活跃订阅者
    const activeSubscribers = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.isActive, true));

    if (activeSubscribers.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_SUBSCRIBERS', message: '没有活跃的订阅者' } },
        { status: 400 }
      );
    }

    // 获取最近一段时间的文章
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
      return NextResponse.json(
        { success: false, error: { code: 'NO_ARTICLES', message: '没有可发送的文章' } },
        { status: 400 }
      );
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

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

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
      } else {
        failedCount++;
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

    return NextResponse.json({
      success: true,
      data: {
        totalRecipients: activeSubscribers.length,
        successCount,
        failedCount,
        articlesCount: newsletterArticles.length,
        weekNumber,
      },
    });
  } catch (error) {
    console.error('[Newsletter] Send error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SEND_ERROR', message: '发送失败' } },
      { status: 500 }
    );
  }
}

// GET /api/admin/newsletter/send - 获取发送历史
export async function GET(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const logs = await db
      .select()
      .from(newsletterLogs)
      .orderBy(desc(newsletterLogs.createdAt))
      .limit(20);

    return NextResponse.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('[Newsletter] Get logs error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '获取发送历史失败' } },
      { status: 500 }
    );
  }
}
