import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 生成随机ID的SQL
const randomId = sql`(lower(hex(randomblob(8))))`;

// 行业板块表
export const industries = sqliteTable('industries', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  icon: text('icon').default('📰'),
  color: text('color').default('#3B82F6'),
  keywords: text('keywords', { mode: 'json' }).notNull().$type<string[]>().default([]),
  weight: integer('weight').default(10),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 数据源表
export const sources = sqliteTable('sources', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  name: text('name').notNull(),
  url: text('url').notNull(),
  industryId: text('industry_id').references(() => industries.id),
  tier: integer('tier').default(2), // 1-3 优先级
  config: text('config', { mode: 'json' }).notNull().$type<SourceConfig>().default({}),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  lastCollectedAt: text('last_collected_at'),
  successCount: integer('success_count').default(0),
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 文章表
export const articles = sqliteTable('articles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  sourceId: text('source_id').references(() => sources.id),
  industryId: text('industry_id').references(() => industries.id),
  title: text('title').notNull(),
  url: text('url').notNull(),
  urlHash: text('url_hash').notNull().unique(),
  publishDate: text('publish_date'),
  content: text('content'),
  summary: text('summary'),

  // 评分相关
  score: integer('score').default(0),
  scoreRelevance: integer('score_relevance').default(0),
  scoreTimeliness: integer('score_timeliness').default(0),
  scoreImpact: integer('score_impact').default(0),
  scoreCredibility: integer('score_credibility').default(0),
  priority: text('priority').default('中'), // 高/中/低

  // 状态标记
  isFeatured: integer('is_featured', { mode: 'boolean' }).default(false),
  isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false),

  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_articles_industry').on(table.industryId),
  index('idx_articles_publish_date').on(table.publishDate),
  index('idx_articles_score').on(table.score),
  index('idx_articles_is_featured').on(table.isFeatured),
]);

// 采集日志表
export const collectLogs = sqliteTable('collect_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  sourceId: text('source_id').references(() => sources.id),
  status: text('status').notNull(), // success/failed
  articlesCount: integer('articles_count').default(0),
  errorMessage: text('error_message'),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
});

// 系统设置表
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 邀请码表
export const invitationCodes = sqliteTable('invitation_codes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  code: text('code').notNull().unique(),
  name: text('name'), // 邀请码名称/备注
  maxUsage: integer('max_usage').default(0), // 0 表示无限制
  usageCount: integer('usage_count').default(0),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  expiresAt: text('expires_at'), // 过期时间，null 表示永不过期
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
});

// 订阅者表
export const subscribers = sqliteTable('subscribers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  email: text('email').notNull().unique(),
  name: text('name'),
  invitationCodeId: text('invitation_code_id').references(() => invitationCodes.id),
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  subscribedAt: text('subscribed_at').default(sql`CURRENT_TIMESTAMP`),
  unsubscribedAt: text('unsubscribed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_subscribers_email').on(table.email),
  index('idx_subscribers_is_active').on(table.isActive),
]);

// 周报发送记录表
export const newsletterLogs = sqliteTable('newsletter_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 16)),
  subject: text('subject').notNull(),
  recipientCount: integer('recipient_count').default(0),
  successCount: integer('success_count').default(0),
  failedCount: integer('failed_count').default(0),
  status: text('status').notNull(), // pending/sending/completed/failed
  sentAt: text('sent_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 类型定义
export interface SourceConfig {
  scraperType?: 'generic' | 'custom' | 'rss';
  rssUrl?: string;  // RSS Feed URL，优先使用
  listUrl?: string;
  encoding?: string;
  articleContainer?: string;
  titleSelector?: string;
  linkSelector?: string;
  dateSelector?: string;
  summarySelector?: string;
  dateFormat?: string;
  [key: string]: unknown;
}

// 表类型导出
export type Industry = typeof industries.$inferSelect;
export type NewIndustry = typeof industries.$inferInsert;

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;

export type CollectLog = typeof collectLogs.$inferSelect;
export type NewCollectLog = typeof collectLogs.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type InvitationCode = typeof invitationCodes.$inferSelect;
export type NewInvitationCode = typeof invitationCodes.$inferInsert;

export type Subscriber = typeof subscribers.$inferSelect;
export type NewSubscriber = typeof subscribers.$inferInsert;

export type NewsletterLog = typeof newsletterLogs.$inferSelect;
export type NewNewsletterLog = typeof newsletterLogs.$inferInsert;
