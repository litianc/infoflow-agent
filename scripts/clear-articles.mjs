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
await db.execute('DELETE FROM articles');
console.log('已清空 articles 表');
db.close();
