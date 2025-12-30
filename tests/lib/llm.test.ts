import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// LLM 模块的测试需要动态导入，因为它在导入时读取环境变量
describe('LLM Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isLLMAvailable', () => {
    it('没有 API Key 时应该返回 false', async () => {
      delete process.env.LLM_API_KEY;
      const { isLLMAvailable } = await import('@/lib/llm');
      expect(isLLMAvailable()).toBe(false);
    });

    it('有 API Key 时应该返回 true', async () => {
      process.env.LLM_API_KEY = 'test-api-key';
      const { isLLMAvailable } = await import('@/lib/llm');
      expect(isLLMAvailable()).toBe(true);
    });

    it('API Key 为空字符串时应该返回 false', async () => {
      process.env.LLM_API_KEY = '';
      const { isLLMAvailable } = await import('@/lib/llm');
      expect(isLLMAvailable()).toBe(false);
    });
  });

  describe('generateSummary', () => {
    it('LLM 不可用时应该返回 null', async () => {
      delete process.env.LLM_API_KEY;
      const { generateSummary } = await import('@/lib/llm');
      const result = await generateSummary('测试标题', '测试内容');
      expect(result).toBeNull();
    });

    it('标题太短时应该返回 null', async () => {
      process.env.LLM_API_KEY = 'test-key';
      const { generateSummary } = await import('@/lib/llm');
      const result = await generateSummary('短标题');
      expect(result).toBeNull();
    });

    it('API 错误时应该返回 null', async () => {
      process.env.LLM_API_KEY = 'test-key';
      process.env.LLM_API_BASE = 'https://api.test.com';

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const { generateSummary } = await import('@/lib/llm');
      const result = await generateSummary(
        '这是一个测试标题用于测试 API 错误处理'
      );

      expect(result).toBeNull();
    });

    it('网络错误时应该返回 null', async () => {
      process.env.LLM_API_KEY = 'test-key';
      process.env.LLM_API_BASE = 'https://api.test.com';

      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { generateSummary } = await import('@/lib/llm');
      const result = await generateSummary(
        '这是一个测试标题用于测试网络错误处理'
      );

      expect(result).toBeNull();
    });
  });

  describe('generateSummaries', () => {
    it('LLM 不可用时应该返回空 Map', async () => {
      delete process.env.LLM_API_KEY;
      const { generateSummaries } = await import('@/lib/llm');

      const articles = [
        { id: '1', title: '标题一', content: '内容一' },
        { id: '2', title: '标题二', content: '内容二' },
      ];

      const result = await generateSummaries(articles);
      expect(result.size).toBe(0);
    });
  });

  describe('analyzeRelevance', () => {
    it('LLM 不可用时应该返回 null', async () => {
      delete process.env.LLM_API_KEY;
      const { analyzeRelevance } = await import('@/lib/llm');
      const result = await analyzeRelevance('测试标题', ['关键词1', '关键词2']);
      expect(result).toBeNull();
    });
  });
});
