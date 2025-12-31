#!/usr/bin/env node
/**
 * 测试 RSS Feed 内容质量
 */

const RSS_FEEDS = [
  { name: '36氪', url: 'https://36kr.com/feed' },
  { name: 'IT之家', url: 'https://www.ithome.com/rss/' },
  { name: 'InfoQ', url: 'https://www.infoq.cn/feed' },
  { name: '创业邦', url: 'https://www.cyzone.cn/rss/' },
  { name: '国际电子商情', url: 'https://www.esmchina.com/rss' },
  { name: '机器之心', url: 'https://www.jiqizhixin.com/rss' },
  { name: '芯智讯', url: 'https://www.icsmart.cn/feed/' },
  { name: '量子位', url: 'https://www.qbitai.com/feed' },
  { name: '雷锋网AI', url: 'https://www.leiphone.com/feed' },
];

console.log('=== RSS Feed 内容测试 ===\n');

for (const feed of RSS_FEEDS) {
  process.stdout.write(`${feed.name}... `);
  try {
    const response = await fetch(feed.url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSReader/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      console.log(`❌ HTTP ${response.status}`);
      continue;
    }
    
    const xml = await response.text();
    
    // 统计文章数量
    const items = xml.match(/<item>|<entry>/gi) || [];
    
    // 提取示例标题
    const titleMatch = xml.match(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([^\]<]+)/i) ||
                       xml.match(/<entry>[\s\S]*?<title>(?:<!\[CDATA\[)?([^\]<]+)/i);
    const title = titleMatch ? titleMatch[1].trim().substring(0, 40) : '(无标题)';
    
    // 检查日期字段
    const hasDate = /<pubDate>|<published>|<updated>/i.test(xml);
    
    console.log(`✅ ${items.length} 篇, 有日期: ${hasDate ? '是' : '否'}`);
    console.log(`   示例: ${title}...`);
    
  } catch (e) {
    console.log(`❌ ${e.message}`);
  }
}
