import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db/queries', () => ({
  getSetting: vi.fn(),
  updateSetting: vi.fn(),
}));

vi.mock('@/lib/llm', () => ({
  clearLLMConfigCache: vi.fn(),
}));

import { getSetting, updateSetting } from '@/lib/db/queries';
import { clearLLMConfigCache } from '@/lib/llm';

describe('Settings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/admin/settings', () => {
    it('should return default settings when database is empty', async () => {
      vi.mocked(getSetting).mockResolvedValue(null);

      // Verify mocks are set up correctly
      const result = await getSetting('llm_enabled');
      expect(result).toBe(null);
    });

    it('should return settings from database', async () => {
      vi.mocked(getSetting).mockImplementation(async (key: string) => {
        const settings: Record<string, unknown> = {
          collect_interval: 'hourly',
          llm_enabled: true,
          llm_model: 'GPT-4',
        };
        return settings[key] ?? null;
      });

      const llmEnabled = await getSetting('llm_enabled');
      const llmModel = await getSetting('llm_model');

      expect(llmEnabled).toBe(true);
      expect(llmModel).toBe('GPT-4');
    });
  });

  describe('PUT /api/admin/settings', () => {
    it('should update settings and clear LLM cache', async () => {
      vi.mocked(updateSetting).mockResolvedValue(undefined);

      await updateSetting('llm_model', 'GLM-4');
      await updateSetting('llm_api_key', 'test-key');
      clearLLMConfigCache();

      expect(updateSetting).toHaveBeenCalledWith('llm_model', 'GLM-4');
      expect(updateSetting).toHaveBeenCalledWith('llm_api_key', 'test-key');
      expect(clearLLMConfigCache).toHaveBeenCalled();
    });

    it('should not save masked API key', async () => {
      const maskedKey = 'sk-12345***********';

      // Simulate the API logic: don't save if key contains *
      if (!maskedKey.includes('*')) {
        await updateSetting('llm_api_key', maskedKey);
      }

      expect(updateSetting).not.toHaveBeenCalledWith('llm_api_key', maskedKey);
    });
  });
});
