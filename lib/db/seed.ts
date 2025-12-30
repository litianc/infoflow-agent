import { db } from './index';
import { industries, sources, settings } from './schema';
import { DEFAULT_INDUSTRIES, DEFAULT_SCORE_WEIGHTS } from '../constants';

// 默认数据源配置
const DEFAULT_SOURCES = [
  // 数据中心行业
  { name: '中国IDC圈', url: 'https://news.idcquan.com', industrySlug: 'datacenter', tier: 2 },
  { name: '数据中心世界', url: 'http://www.dcworld.cn', industrySlug: 'datacenter', tier: 2 },
  { name: 'DTDATA', url: 'http://www.dtdata.cn', industrySlug: 'datacenter', tier: 2 },
  { name: 'ODCC', url: 'https://www.odcc.org.cn', industrySlug: 'datacenter', tier: 1 },

  // 云计算行业
  { name: 'InfoQ', url: 'https://www.infoq.cn', industrySlug: 'cloud', tier: 2 },
  { name: '云头条', url: 'https://www.yuntoutiao.com', industrySlug: 'cloud', tier: 2 },
  { name: 'TechWeb', url: 'https://www.techweb.com.cn', industrySlug: 'cloud', tier: 3 },
  { name: 'IT之家', url: 'https://www.ithome.com', industrySlug: 'cloud', tier: 3 },

  // AI算力行业
  { name: '量子位', url: 'https://www.qbitai.com', industrySlug: 'ai-computing', tier: 2 },

  // 网络通信行业
  { name: '通信世界网', url: 'https://www.cww.net.cn', industrySlug: 'network', tier: 2 },

  // 政策监管行业
  { name: '国家数据局', url: 'https://www.nda.gov.cn', industrySlug: 'policy', tier: 1 },
  { name: '工业和信息化部', url: 'https://www.miit.gov.cn', industrySlug: 'policy', tier: 1 },
  { name: '国家发展改革委', url: 'https://www.ndrc.gov.cn', industrySlug: 'policy', tier: 1 },
  { name: '国家能源局', url: 'https://www.nea.gov.cn', industrySlug: 'policy', tier: 1 },

  // 投资并购行业
  { name: '36氪', url: 'https://36kr.com', industrySlug: 'investment', tier: 2 },
] as const;

async function seed() {
  console.log('🌱 开始初始化数据库...');

  // 插入默认行业
  console.log('📁 插入默认行业板块...');
  for (const industry of DEFAULT_INDUSTRIES) {
    await db.insert(industries).values({
      name: industry.name,
      slug: industry.slug,
      description: industry.description,
      icon: industry.icon,
      color: industry.color,
      keywords: industry.keywords as unknown as string[],
      weight: industry.weight,
      sortOrder: industry.sortOrder,
      isActive: true,
    }).onConflictDoNothing();
  }

  // 获取行业 ID 映射
  const industryRecords = await db.select().from(industries);
  const industryMap = new Map(industryRecords.map(i => [i.slug, i.id]));

  // 插入默认数据源
  console.log('📰 插入默认数据源...');
  for (const source of DEFAULT_SOURCES) {
    const industryId = industryMap.get(source.industrySlug);
    if (industryId) {
      await db.insert(sources).values({
        name: source.name,
        url: source.url,
        industryId,
        tier: source.tier,
        isActive: true,
      }).onConflictDoNothing();
    }
  }

  // 插入默认设置
  console.log('⚙️ 插入默认系统设置...');
  const defaultSettings = [
    { key: 'collect_interval', value: 'daily' },
    { key: 'collect_concurrency', value: 5 },
    { key: 'llm_enabled', value: true },
    { key: 'llm_model', value: 'GLM-4.5-Air' },
    { key: 'score_weights', value: DEFAULT_SCORE_WEIGHTS },
  ];

  for (const setting of defaultSettings) {
    await db.insert(settings).values({
      key: setting.key,
      value: setting.value,
    }).onConflictDoNothing();
  }

  console.log('✅ 数据库初始化完成！');
  console.log(`   - ${DEFAULT_INDUSTRIES.length} 个行业板块`);
  console.log(`   - ${DEFAULT_SOURCES.length} 个数据源`);
}

seed().catch((error) => {
  console.error('❌ 数据库初始化失败:', error);
  process.exit(1);
});
