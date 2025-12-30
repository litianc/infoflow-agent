import { NextResponse } from 'next/server';
import { getSetting, updateSetting } from '@/lib/db/queries';
import { clearLLMConfigCache } from '@/lib/llm';

// 设置项的键名
const SETTING_KEYS = {
  COLLECT_INTERVAL: 'collect_interval',
  COLLECT_CONCURRENCY: 'collect_concurrency',
  SCHEDULE_ENABLED: 'schedule_enabled',
  LLM_ENABLED: 'llm_enabled',
  LLM_MODEL: 'llm_model',
  LLM_API_KEY: 'llm_api_key',
  LLM_API_BASE: 'llm_api_base',
  SCORE_WEIGHTS: 'score_weights',
} as const;

// GET: 获取所有设置
export async function GET() {
  try {
    const [
      collectInterval,
      collectConcurrency,
      scheduleEnabled,
      llmEnabled,
      llmModel,
      llmApiKey,
      llmApiBase,
      scoreWeights,
    ] = await Promise.all([
      getSetting<string>(SETTING_KEYS.COLLECT_INTERVAL),
      getSetting<number>(SETTING_KEYS.COLLECT_CONCURRENCY),
      getSetting<boolean>(SETTING_KEYS.SCHEDULE_ENABLED),
      getSetting<boolean>(SETTING_KEYS.LLM_ENABLED),
      getSetting<string>(SETTING_KEYS.LLM_MODEL),
      getSetting<string>(SETTING_KEYS.LLM_API_KEY),
      getSetting<string>(SETTING_KEYS.LLM_API_BASE),
      getSetting<{
        relevance: number;
        timeliness: number;
        impact: number;
        credibility: number;
      }>(SETTING_KEYS.SCORE_WEIGHTS),
    ]);

    // 返回设置，环境变量作为默认值
    const settings = {
      collectInterval: collectInterval || 'daily',
      collectConcurrency: collectConcurrency ?? 5,
      scheduleEnabled: scheduleEnabled ?? true,
      llmEnabled: llmEnabled ?? true,
      llmModel: llmModel || process.env.LLM_MODEL || 'GLM-4.5-Air',
      // API Key 脱敏处理：只返回前8位 + 掩码
      llmApiKey: llmApiKey
        ? `${llmApiKey.slice(0, 8)}${'*'.repeat(Math.max(0, llmApiKey.length - 8))}`
        : '',
      llmApiBase: llmApiBase || process.env.LLM_API_BASE || 'https://open.bigmodel.cn/api/paas/v4',
      scoreWeights: scoreWeights || {
        relevance: 40,
        timeliness: 25,
        impact: 20,
        credibility: 15,
      },
    };

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    console.error('[Settings API] GET error:', error);
    return NextResponse.json(
      { success: false, error: '获取设置失败' },
      { status: 500 }
    );
  }
}

// PUT: 更新设置
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      collectInterval,
      collectConcurrency,
      scheduleEnabled,
      llmEnabled,
      llmModel,
      llmApiKey,
      llmApiBase,
      scoreWeights,
    } = body;

    // 更新各项设置
    const updates: Promise<void>[] = [];

    if (collectInterval !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.COLLECT_INTERVAL, collectInterval));
    }
    if (collectConcurrency !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.COLLECT_CONCURRENCY, collectConcurrency));
    }
    if (scheduleEnabled !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.SCHEDULE_ENABLED, scheduleEnabled));
    }
    if (llmEnabled !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.LLM_ENABLED, llmEnabled));
    }
    if (llmModel !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.LLM_MODEL, llmModel));
    }
    // API Key：只有非脱敏的值才保存（即不包含 * 的值）
    if (llmApiKey !== undefined && !llmApiKey.includes('*')) {
      updates.push(updateSetting(SETTING_KEYS.LLM_API_KEY, llmApiKey));
    }
    if (llmApiBase !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.LLM_API_BASE, llmApiBase));
    }
    if (scoreWeights !== undefined) {
      updates.push(updateSetting(SETTING_KEYS.SCORE_WEIGHTS, scoreWeights));
    }

    await Promise.all(updates);

    // 清除 LLM 配置缓存，使新配置立即生效
    clearLLMConfigCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Settings API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: '保存设置失败' },
      { status: 500 }
    );
  }
}
