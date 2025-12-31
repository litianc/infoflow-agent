#!/usr/bin/env node
/**
 * 配置数据源的 RSS Feed URL
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

// 数据源名称到 RSS URL 的映射
const RSS_MAPPINGS = {
  '36氪': 'https://36kr.com/feed',
  'IT之家': 'https://www.ithome.com/rss/',
  'InfoQ': 'https://www.infoq.cn/feed',
  '创业邦': 'https://www.cyzone.cn/rss/',
  '国际电子商情': 'https://www.esmchina.com/rss',
  '机器之心': 'https://www.jiqizhixin.com/rss',
  '芯智讯': 'https://www.icsmart.cn/feed/',
  '量子位': 'https://www.qbitai.com/feed',
  '雷锋网': 'https://www.leiphone.com/feed',
};

console.log('=== 配置数据源 RSS URL ===\n');

const sources = await db.execute('SELECT id, name, config FROM sources WHERE is_active = 1');

let updated = 0;
for (const source of sources.rows) {
  const rssUrl = RSS_MAPPINGS[source.name];
  if (rssUrl) {
    let config = {};
    try {
      config = source.config ? JSON.parse(source.config) : {};
    } catch (e) {
      config = {};
    }

    config.rssUrl = rssUrl;

    await db.execute({
      sql: 'UPDATE sources SET config = ? WHERE id = ?',
      args: [JSON.stringify(config), source.id]
    });

    console.log(`✅ ${source.name}: ${rssUrl}`);
    updated++;
  }
}

console.log(`\n共更新 ${updated} 个数据源的 RSS 配置`);

db.close();
