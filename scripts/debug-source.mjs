#!/usr/bin/env node
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

const sourceName = process.argv[2] || '中国IDC圈';
const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./local.db' });

// 获取该数据源的文章
const result = await db.execute({
  sql: `SELECT a.title, a.url, a.publish_date 
        FROM articles a 
        JOIN sources s ON a.source_id = s.id 
        WHERE s.name = ? 
        LIMIT 3`,
  args: [sourceName]
});

console.log(`=== ${sourceName} 文章 ===\n`);
for (const row of result.rows) {
  console.log(`标题: ${row.title}`);
  console.log(`URL: ${row.url}`);
  console.log(`日期: ${row.publish_date}`);
  console.log('');
}
db.close();
