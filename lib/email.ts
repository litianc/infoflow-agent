/**
 * 邮件服务
 * 支持通过 SMTP 发送周报邮件
 * 配置优先级：数据库设置 > 环境变量
 */

import nodemailer from 'nodemailer';
import { getSetting } from './db/queries';
import crypto from 'crypto';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

// 配置缓存
let configCache: EmailConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1分钟缓存

// 获取邮件配置
async function getEmailConfig(): Promise<EmailConfig | null> {
  // 检查缓存
  if (configCache && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    const dbEnabled = await getSetting<boolean>('email_enabled');
    if (dbEnabled === false) {
      configCache = null;
      configCacheTime = Date.now();
      return null;
    }

    const dbHost = await getSetting<string>('email_smtp_host');
    const dbPort = await getSetting<number>('email_smtp_port');
    const dbSecure = await getSetting<boolean>('email_smtp_secure');
    const dbUser = await getSetting<string>('email_smtp_user');
    const dbPassword = await getSetting<string>('email_smtp_password');
    const dbFrom = await getSetting<string>('email_from');

    // 数据库配置优先，环境变量兜底
    const host = dbHost || process.env.EMAIL_SMTP_HOST;
    const port = dbPort || parseInt(process.env.EMAIL_SMTP_PORT || '587');
    const secure = dbSecure ?? (process.env.EMAIL_SMTP_SECURE === 'true');
    const user = dbUser || process.env.EMAIL_SMTP_USER;
    const password = dbPassword || process.env.EMAIL_SMTP_PASSWORD;
    const from = dbFrom || process.env.EMAIL_FROM || '行业情报 <noreply@example.com>';

    if (!host || !user || !password) {
      configCache = null;
      configCacheTime = Date.now();
      return null;
    }

    configCache = { host, port, secure, user, password, from };
    configCacheTime = Date.now();
    return configCache;
  } catch (error) {
    console.warn('[Email] Failed to read config from database:', error);

    const host = process.env.EMAIL_SMTP_HOST;
    const port = parseInt(process.env.EMAIL_SMTP_PORT || '587');
    const secure = process.env.EMAIL_SMTP_SECURE === 'true';
    const user = process.env.EMAIL_SMTP_USER;
    const password = process.env.EMAIL_SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM || '行业情报 <noreply@example.com>';

    if (!host || !user || !password) {
      return null;
    }

    return { host, port, secure, user, password, from };
  }
}

// 清除配置缓存
export function clearEmailConfigCache(): void {
  configCache = null;
  configCacheTime = 0;
}

// 检查邮件服务是否可用
export async function isEmailAvailable(): Promise<boolean> {
  const config = await getEmailConfig();
  return config !== null;
}

// 创建邮件传输器
async function createTransporter() {
  const config = await getEmailConfig();
  if (!config) {
    throw new Error('Email not configured');
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

// 生成取消订阅链接的 token
export function generateUnsubscribeToken(email: string): string {
  return crypto
    .createHash('sha256')
    .update(email + process.env.ADMIN_PASSWORD)
    .digest('hex')
    .slice(0, 16);
}

// 发送单封邮件
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  try {
    const config = await getEmailConfig();
    if (!config) {
      console.error('[Email] Not configured');
      return false;
    }

    const transporter = await createTransporter();

    await transporter.sendMail({
      from: config.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    });

    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

// 生成周报 HTML 内容
export function generateNewsletterHtml({
  articles,
  unsubscribeUrl,
  siteUrl,
  siteName,
}: {
  articles: {
    title: string;
    url: string;
    summary: string | null;
    industry: string;
    publishDate: string;
  }[];
  unsubscribeUrl: string;
  siteUrl: string;
  siteName: string;
}): string {
  const articlesByIndustry = articles.reduce((acc, article) => {
    if (!acc[article.industry]) {
      acc[article.industry] = [];
    }
    acc[article.industry].push(article);
    return acc;
  }, {} as Record<string, typeof articles>);

  const articlesHtml = Object.entries(articlesByIndustry)
    .map(([industry, arts]) => `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #3B82F6;">${industry}</h2>
        ${arts.map(art => `
          <div style="margin-bottom: 16px;">
            <a href="${art.url}" style="font-size: 16px; color: #1a1a1a; text-decoration: none; font-weight: 500;">
              ${art.title}
            </a>
            ${art.summary ? `<p style="font-size: 14px; color: #666; margin: 8px 0 0; line-height: 1.6;">${art.summary}</p>` : ''}
            <p style="font-size: 12px; color: #999; margin: 4px 0 0;">${new Date(art.publishDate).toLocaleDateString('zh-CN')}</p>
          </div>
        `).join('')}
      </div>
    `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="font-size: 24px; color: #1a1a1a; margin: 0;">${siteName}</h1>
      <p style="font-size: 14px; color: #666; margin: 8px 0 0;">行业情报周报</p>
    </div>

    <div style="background-color: #f0f7ff; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: #1a1a1a;">
        本期共收录 <strong>${articles.length}</strong> 篇行业资讯，涵盖 <strong>${Object.keys(articlesByIndustry).length}</strong> 个行业领域。
      </p>
    </div>

    ${articlesHtml}

    <div style="text-align: center; padding-top: 24px; border-top: 1px solid #eee;">
      <p style="font-size: 12px; color: #999;">
        <a href="${siteUrl}" style="color: #3B82F6; text-decoration: none;">访问网站</a>
        &nbsp;|&nbsp;
        <a href="${unsubscribeUrl}" style="color: #999; text-decoration: none;">取消订阅</a>
      </p>
      <p style="font-size: 12px; color: #999; margin-top: 8px;">
        © ${new Date().getFullYear()} ${siteName}. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}
