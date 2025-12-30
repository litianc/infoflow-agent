// 从数据库 Schema 重新导出类型
export type {
  Industry,
  NewIndustry,
  Source,
  NewSource,
  SourceConfig,
  Article,
  NewArticle,
  CollectLog,
  NewCollectLog,
  Setting,
  NewSetting,
} from '@/lib/db/schema';

// API 响应类型
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// 带关联的文章类型
export interface ArticleWithRelations {
  id: string;
  title: string;
  url: string;
  summary: string | null;
  publishDate: string | null;
  score: number;
  priority: string;
  isFeatured: boolean;
  createdAt: string | null;
  source: {
    id: string;
    name: string;
    tier: number;
  } | null;
  industry: {
    id: string;
    name: string;
    slug: string;
    color: string;
  } | null;
}

// 带统计的行业类型
export interface IndustryWithStats {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  keywords: string[];
  articleCount: number;
  todayCount: number;
  isActive: boolean;
}

// 仪表盘数据类型
export interface DashboardData {
  stats: {
    totalArticles: number;
    todayArticles: number;
    activeSources: number;
    totalSources: number;
    failedSources: number;
  };
  industryDistribution: {
    industry: string;
    count: number;
    percentage: number;
  }[];
  recentCollections: {
    sourceId: string;
    sourceName: string;
    status: 'success' | 'failed';
    articlesCount: number;
    finishedAt: string;
    error?: string;
  }[];
}

// 系统设置类型
export interface SystemSettings {
  collectInterval: 'hourly' | 'daily' | 'weekly';
  collectConcurrency: number;
  llmEnabled: boolean;
  llmModel: string;
  llmApiKey?: string;
  llmApiBase?: string;
  scoreWeights: {
    relevance: number;
    timeliness: number;
    impact: number;
    credibility: number;
  };
}

// 错误码枚举
export enum ErrorCode {
  // 通用错误 (1xxx)
  UNKNOWN_ERROR = '1000',
  VALIDATION_ERROR = '1001',
  NOT_FOUND = '1002',
  RATE_LIMITED = '1003',

  // 认证错误 (2xxx)
  UNAUTHORIZED = '2000',
  INVALID_PASSWORD = '2001',
  SESSION_EXPIRED = '2002',

  // 数据源错误 (3xxx)
  SOURCE_NOT_FOUND = '3000',
  SOURCE_FETCH_FAILED = '3001',
  SOURCE_PARSE_FAILED = '3002',
  SOURCE_TIMEOUT = '3003',

  // 采集错误 (4xxx)
  COLLECT_ALREADY_RUNNING = '4000',
  COLLECT_TASK_NOT_FOUND = '4001',

  // LLM错误 (5xxx)
  LLM_API_ERROR = '5000',
  LLM_QUOTA_EXCEEDED = '5001',
  LLM_TIMEOUT = '5002',

  // 数据库错误 (6xxx)
  DB_CONNECTION_ERROR = '6000',
  DB_QUERY_ERROR = '6001',
  DB_CONSTRAINT_ERROR = '6002',
}
