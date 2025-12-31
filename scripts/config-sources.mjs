#!/usr/bin/env node
/**
 * 配置数据源的日期选择器
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';

// 加载环境变量
try {
  const envContent = readFileSync('.env.local', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
} catch (e) {
  console.log('Warning: .env.local not found');
}

const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./local.db' });

// 数据源日期选择器配置
const sourceConfigs = [
  // IT之家: 使用 #pubtime_baidu
  { name: 'IT之家', dateSelector: '#pubtime_baidu' },
  // 数据中心世界: 使用 em 标签
  { name: '数据中心世界', dateSelector: 'em' },
  // 中国IDC圈: 使用 .time
  { name: '中国IDC圈', dateSelector: '.time' },
];

console.log('=== 配置数据源日期选择器 ===\n');

for (const { name, dateSelector } of sourceConfigs) {
  const config = JSON.stringify({ dateSelector });
  await db.execute({
    sql: 'UPDATE sources SET config = ? WHERE name = ?',
    args: [config, name]
  });
  console.log(`✅ ${name}: ${dateSelector}`);
}

// 显示所有有配置的数据源
console.log('\n当前已配置的数据源:');
const result = await db.execute('SELECT name, config FROM sources WHERE is_active = 1');
for (const row of result.rows) {
  let cfg = {};
  try {
    cfg = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
  } catch { cfg = {}; }
  if (cfg.dateSelector) {
    console.log(`  ${row.name}: ${cfg.dateSelector}`);
  }
}

db.close();
