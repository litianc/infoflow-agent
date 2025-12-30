// 行业板块配色
export const INDUSTRY_COLORS = {
  datacenter: '#3B82F6',   // 数据中心 - 蓝色
  cloud: '#8B5CF6',        // 云计算 - 紫色
  'ai-computing': '#F59E0B', // AI算力 - 橙色
  semiconductor: '#10B981', // 芯片 - 绿色
  network: '#06B6D4',      // 网络通信 - 青色
  policy: '#EF4444',       // 政策监管 - 红色
  investment: '#EC4899',   // 投资并购 - 粉色
} as const;

// 默认行业数据
export const DEFAULT_INDUSTRIES = [
  {
    name: '数据中心',
    slug: 'datacenter',
    description: 'IDC行业动态，覆盖机房建设、运维、能效等领域',
    icon: '🏢',
    color: '#3B82F6',
    keywords: ['IDC', '数据中心', '机房', '机柜', 'PUE', '液冷', '制冷'],
    weight: 10,
    sortOrder: 1,
  },
  {
    name: '云计算',
    slug: 'cloud',
    description: '云服务市场动态，覆盖公有云、私有云、混合云',
    icon: '☁️',
    color: '#8B5CF6',
    keywords: ['云计算', '云服务', 'IaaS', 'PaaS', 'SaaS', '公有云', '私有云'],
    weight: 10,
    sortOrder: 2,
  },
  {
    name: 'AI算力',
    slug: 'ai-computing',
    description: '智算/超算领域动态，覆盖GPU集群、训练推理',
    icon: '🤖',
    color: '#F59E0B',
    keywords: ['AI算力', '智算中心', '超算中心', 'GPU集群', '训练', '推理'],
    weight: 10,
    sortOrder: 3,
  },
  {
    name: '芯片半导体',
    slug: 'semiconductor',
    description: '上游供应链动态，覆盖芯片、处理器、国产化',
    icon: '💾',
    color: '#10B981',
    keywords: ['芯片', '处理器', 'CPU', 'GPU', 'NPU', '国产化', '先进制程'],
    weight: 10,
    sortOrder: 4,
  },
  {
    name: '网络通信',
    slug: 'network',
    description: '基础设施动态，覆盖5G、带宽、CDN、边缘计算',
    icon: '📡',
    color: '#06B6D4',
    keywords: ['5G', '网络', '带宽', 'CDN', '边缘计算', '光通信'],
    weight: 10,
    sortOrder: 5,
  },
  {
    name: '政策监管',
    slug: 'policy',
    description: '政策法规动态，覆盖东数西算、新基建、标准规范',
    icon: '📜',
    color: '#EF4444',
    keywords: ['东数西算', '新基建', '政策', '标准', '工信部', '发改委'],
    weight: 10,
    sortOrder: 6,
  },
  {
    name: '投资并购',
    slug: 'investment',
    description: '资本市场动态，覆盖融资、投资、并购、IPO',
    icon: '💰',
    color: '#EC4899',
    keywords: ['融资', '投资', '并购', '收购', 'IPO', '上市', '估值'],
    weight: 10,
    sortOrder: 7,
  },
] as const;

// 评分权重默认值
export const DEFAULT_SCORE_WEIGHTS = {
  relevance: 40,
  timeliness: 25,
  impact: 20,
  credibility: 15,
} as const;

// 分页默认值
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// 数据源优先级说明
export const SOURCE_TIER_LABELS = {
  1: 'Tier 1 - 官方/权威',
  2: 'Tier 2 - 专业媒体',
  3: 'Tier 3 - 自媒体/其他',
} as const;
