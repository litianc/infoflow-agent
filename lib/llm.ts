/**
 * LLM 服务封装
 * 支持智谱 GLM、OpenAI 兼容 API
 * 配置优先级：数据库设置 > 环境变量
 * 无配置时自动降级
 */

import { getSetting } from './db/queries';

interface LLMConfig {
  apiKey: string;
  apiBase: string;
  model: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

// 配置缓存（避免频繁查询数据库）
let configCache: LLMConfig | null = null;
let configCacheTime: number = 0;
const CONFIG_CACHE_TTL = 60000; // 1分钟缓存

// 获取 LLM 配置（数据库优先，环境变量兜底）
async function getLLMConfigAsync(): Promise<LLMConfig | null> {
  // 检查缓存
  if (configCache && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  try {
    // 从数据库读取配置
    const dbEnabled = await getSetting<boolean>('llm_enabled');

    // 如果数据库明确禁用了 LLM
    if (dbEnabled === false) {
      configCache = null;
      configCacheTime = Date.now();
      return null;
    }

    const dbApiKey = await getSetting<string>('llm_api_key');
    const dbApiBase = await getSetting<string>('llm_api_base');
    const dbModel = await getSetting<string>('llm_model');

    // 数据库配置优先，环境变量兜底
    const apiKey = dbApiKey || process.env.LLM_API_KEY;
    const apiBase = dbApiBase || process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';
    const model = dbModel || process.env.LLM_MODEL || 'GLM-4-Flash';

    if (!apiKey) {
      configCache = null;
      configCacheTime = Date.now();
      return null;
    }

    configCache = { apiKey, apiBase, model };
    configCacheTime = Date.now();
    return configCache;
  } catch (error) {
    // 数据库查询失败时，回退到环境变量
    console.warn('[LLM] Failed to read config from database, falling back to env vars:', error);

    const apiKey = process.env.LLM_API_KEY;
    const apiBase = process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';
    const model = process.env.LLM_MODEL || 'GLM-4-Flash';

    if (!apiKey) {
      return null;
    }

    return { apiKey, apiBase, model };
  }
}

// 同步版本（用于快速检查，使用缓存或环境变量）
function getLLMConfigSync(): LLMConfig | null {
  // 如果有缓存，使用缓存
  if (configCache && Date.now() - configCacheTime < CONFIG_CACHE_TTL) {
    return configCache;
  }

  // 回退到环境变量
  const apiKey = process.env.LLM_API_KEY;
  const apiBase = process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4';
  const model = process.env.LLM_MODEL || 'GLM-4-Flash';

  if (!apiKey) {
    return null;
  }

  return { apiKey, apiBase, model };
}

// 清除配置缓存（配置更新后调用）
export function clearLLMConfigCache(): void {
  configCache = null;
  configCacheTime = 0;
}

// 检查 LLM 是否可用（同步版本，用于快速判断）
export function isLLMAvailable(): boolean {
  return getLLMConfigSync() !== null;
}

// 检查 LLM 是否可用（异步版本，更准确）
export async function isLLMAvailableAsync(): Promise<boolean> {
  const config = await getLLMConfigAsync();
  return config !== null;
}

// 调用 LLM API
async function callLLM(messages: ChatMessage[]): Promise<string | null> {
  const config = await getLLMConfigAsync();

  if (!config) {
    console.log('[LLM] Not configured, skipping');
    return null;
  }

  try {
    const response = await fetch(`${config.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[LLM] API error:', response.status, error);
      return null;
    }

    const data: ChatCompletionResponse = await response.json();
    return data.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('[LLM] Request failed:', error);
    return null;
  }
}

// 生成文章摘要
export async function generateSummary(
  title: string,
  content?: string | null
): Promise<string | null> {
  const textToSummarize = content || title;

  if (textToSummarize.length < 20) {
    return null;
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个专业的新闻编辑，擅长撰写简洁精准的新闻摘要。
请根据提供的文章标题和内容，生成一段80-150字的中文摘要。
要求：
1. 突出核心信息和关键数据
2. 语言简洁专业
3. 不要使用"本文"、"该文"等指代词
4. 直接输出摘要内容，不要加任何前缀`,
    },
    {
      role: 'user',
      content: `标题：${title}\n\n${content ? `内容：${content.slice(0, 2000)}` : '请根据标题生成摘要'}`,
    },
  ];

  const summary = await callLLM(messages);

  if (summary) {
    // 清理可能的前缀
    return summary
      .replace(/^(摘要[：:]\s*|总结[：:]\s*)/i, '')
      .trim();
  }

  return null;
}

// 批量生成摘要
export async function generateSummaries(
  articles: { id: string; title: string; content?: string | null }[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  const available = await isLLMAvailableAsync();
  if (!available) {
    console.log('[LLM] Not available, skipping batch summary generation');
    return results;
  }

  for (const article of articles) {
    try {
      const summary = await generateSummary(article.title, article.content);
      if (summary) {
        results.set(article.id, summary);
      }
      // 添加延迟避免速率限制
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`[LLM] Failed to generate summary for ${article.id}:`, error);
    }
  }

  return results;
}

// 使用 LLM 对文章进行行业分类
export async function classifyArticleIndustry(
  title: string,
  industries: { id: string; name: string; keywords: string[] }[]
): Promise<string | null> {
  const available = await isLLMAvailableAsync();
  if (!available) {
    return null;
  }

  // 构建行业列表描述
  const industryDescriptions = industries
    .map((ind, idx) => `${idx + 1}. ${ind.name}（关键词：${ind.keywords.join('、')}）`)
    .join('\n');

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个行业分类专家。请根据文章标题，判断它最适合归类到哪个行业。

可选的行业列表：
${industryDescriptions}

请直接输出最匹配的行业名称，不要输出其他内容。如果无法确定，请输出"未分类"。`,
    },
    {
      role: 'user',
      content: `文章标题：${title}`,
    },
  ];

  const result = await callLLM(messages);

  if (result) {
    const matchedName = result.trim();
    // 查找匹配的行业
    const matched = industries.find(
      (ind) => ind.name === matchedName || matchedName.includes(ind.name)
    );
    if (matched) {
      return matched.id;
    }
  }

  return null;
}

// 分析文章相关性评分
export async function analyzeRelevance(
  title: string,
  industryKeywords: string[]
): Promise<number | null> {
  const available = await isLLMAvailableAsync();
  if (!available) {
    return null;
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个行业分析专家。请根据文章标题和行业关键词，评估文章与该行业的相关性。
只输出一个0-100的数字，不要输出其他内容。
- 90-100: 高度相关，直接讨论该行业核心话题
- 70-89: 较相关，涉及该行业重要内容
- 50-69: 一般相关，有部分内容涉及
- 30-49: 弱相关，仅间接相关
- 0-29: 不相关`,
    },
    {
      role: 'user',
      content: `行业关键词：${industryKeywords.join('、')}\n文章标题：${title}`,
    },
  ];

  const result = await callLLM(messages);

  if (result) {
    const score = parseInt(result.trim(), 10);
    if (!isNaN(score) && score >= 0 && score <= 100) {
      return score;
    }
  }

  return null;
}
