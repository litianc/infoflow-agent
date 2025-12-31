#!/usr/bin/env node
/**
 * 分析日期识别效果
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
} catch (e) {}

const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./local.db' });

// 判断是否有真实日期：publish_date 和 created_at 差距超过60秒
// 或者 publish_date 的时间部分不是整点（说明来自相对时间解析）
const result = await db.execute(`
  SELECT
    s.name,
    COUNT(*) as total,
    SUM(CASE
      WHEN ABS(julianday(a.publish_date) - julianday(a.created_at)) > 0.0007 THEN 1
      WHEN strftime('%H:%M:%S', a.publish_date) != strftime('%H:%M:%S', a.created_at) THEN 1
      ELSE 0
    END) as with_real_date
  FROM articles a
  JOIN sources s ON a.source_id = s.id
  GROUP BY s.id
  ORDER BY with_real_date DESC, s.name
`);

console.log('\n=== 日期识别效果分析 ===\n');
console.log('数据源              成功率   (有日期/总数)');
console.log('-'.repeat(50));

let totalWithDate = 0, total = 0;
for (const row of result.rows) {
  const rate = Math.round((row.with_real_date / row.total) * 100);
  const status = rate === 100 ? '✅' : rate > 0 ? '⚠️' : '❌';
  console.log(`${status} ${row.name.padEnd(16)} ${(rate + '%').padStart(5)}   (${row.with_real_date}/${row.total})`);
  totalWithDate += row.with_real_date;
  total += row.total;
}
console.log('-'.repeat(50));
console.log(`总计                ${Math.round(totalWithDate/total*100)}%   (${totalWithDate}/${total})`);

db.close();
