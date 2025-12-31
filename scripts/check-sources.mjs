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

const db = createClient({ url: process.env.TURSO_DATABASE_URL || 'file:./local.db' });
const result = await db.execute("SELECT name, url, config FROM sources WHERE is_active = 1 ORDER BY name");
console.log('=== 数据源配置 ===\n');
for (const row of result.rows) {
  let cfg = {};
  try { cfg = row.config ? JSON.parse(row.config) : {}; } catch {}
  const selector = cfg.dateSelector || '(无)';
  console.log(`${row.name.padEnd(12)}: ${selector}`);
}
db.close();
