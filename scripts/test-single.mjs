#!/usr/bin/env node
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

const url = process.argv[2];
if (!url) { console.log('Usage: node scripts/test-single.mjs <url>'); process.exit(1); }

function parseRelativeTime(text) {
  const now = new Date();
  if (/昨天/.test(text)) { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString(); }
  if (/前天/.test(text)) { const d = new Date(now); d.setDate(d.getDate() - 2); return d.toISOString(); }
  const daysAgo = text.match(/(\d+)\s*天前/);
  if (daysAgo) { const d = new Date(now); d.setDate(d.getDate() - parseInt(daysAgo[1])); return d.toISOString(); }
  const hoursAgo = text.match(/(\d+)\s*小时前/);
  if (hoursAgo) { const d = new Date(now); d.setHours(d.getHours() - parseInt(hoursAgo[1])); return d.toISOString(); }
  if (/刚刚|今天/.test(text)) { return now.toISOString(); }
  return null;
}

function extractDateFromContext(text) {
  const relativeDate = parseRelativeTime(text);
  if (relativeDate) return relativeDate;
  const now = new Date();
  const currentYear = now.getFullYear();
  const patterns = [ /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, /(\d{4})年(\d{1,2})月(\d{1,2})日/, ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match.length >= 4) {
      const year = parseInt(match[1]), month = parseInt(match[2]), day = parseInt(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return new Date(year, month - 1, day).toISOString();
      }
    }
  }
  return null;
}

const response = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  signal: AbortSignal.timeout(15000),
});

const html = await response.text();
console.log('页面长度:', html.length);

// 查找包含"今天"的文本
const todayMatches = html.match(/[^<]*今天[^<]*/gi);
if (todayMatches) {
  console.log('\n找到包含"今天"的文本:');
  todayMatches.slice(0, 5).forEach(m => console.log('  -', m.trim().substring(0, 50)));
}

// 查找 author-date 相关内容
const authorDateMatch = html.match(/<div[^>]*class="[^"]*author-date[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
if (authorDateMatch) {
  console.log('\nauthor-date 内容:', authorDateMatch[1].replace(/<[^>]*>/g, ' ').trim().substring(0, 100));
}

// 尝试不同的pattern
const patterns = [
  /<span[^>]*>·?今天\s+\d{1,2}:\d{2}/gi,
  /今天\s+\d{1,2}:\d{2}/gi,
];
for (const p of patterns) {
  const m = html.match(p);
  if (m) console.log('\n匹配到:', m[0]);
}
