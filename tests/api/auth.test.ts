import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, DELETE, GET } from '@/app/api/admin/auth/route';
import { createMockRequest, parseResponse, ApiResponse } from '../helpers';

// Mock auth module
vi.mock('@/lib/auth', () => ({
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  verifySession: vi.fn(),
}));

import {
  verifyPassword,
  createSession,
  deleteSession,
  verifySession,
} from '@/lib/auth';

describe('Auth API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/auth (登录)', () => {
    it('密码正确时应该登录成功', async () => {
      vi.mocked(verifyPassword).mockResolvedValue(true);
      vi.mocked(createSession).mockResolvedValue('test-session-id');

      const request = createMockRequest('/api/admin/auth', {
        method: 'POST',
        body: { password: 'correct-password' },
      });

      const response = await POST(request);
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('登录成功');
      expect(verifyPassword).toHaveBeenCalledWith('correct-password');
      expect(createSession).toHaveBeenCalled();
    });

    it('密码错误时应该返回 401', async () => {
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const request = createMockRequest('/api/admin/auth', {
        method: 'POST',
        body: { password: 'wrong-password' },
      });

      const response = await POST(request);
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('INVALID_PASSWORD');
      expect(createSession).not.toHaveBeenCalled();
    });

    it('没有提供密码时应该返回 400', async () => {
      const request = createMockRequest('/api/admin/auth', {
        method: 'POST',
        body: {},
      });

      const response = await POST(request);
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('密码为空字符串时应该返回 400', async () => {
      const request = createMockRequest('/api/admin/auth', {
        method: 'POST',
        body: { password: '' },
      });

      const response = await POST(request);
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(400);
      expect(data.error?.code).toBe('VALIDATION_ERROR');
    });

    it('verifyPassword 抛出异常时应该返回 500', async () => {
      vi.mocked(verifyPassword).mockRejectedValue(new Error('Database error'));

      const request = createMockRequest('/api/admin/auth', {
        method: 'POST',
        body: { password: 'test' },
      });

      const response = await POST(request);
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('DELETE /api/admin/auth (登出)', () => {
    it('应该成功登出', async () => {
      vi.mocked(deleteSession).mockResolvedValue(undefined);

      const response = await DELETE();
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('已退出登录');
      expect(deleteSession).toHaveBeenCalled();
    });

    it('deleteSession 失败时应该返回 500', async () => {
      vi.mocked(deleteSession).mockRejectedValue(new Error('Cookie error'));

      const response = await DELETE();
      const data = await parseResponse<ApiResponse>(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('GET /api/admin/auth (检查状态)', () => {
    it('已登录时应该返回 isAuthenticated: true', async () => {
      vi.mocked(verifySession).mockResolvedValue(true);

      const response = await GET();
      const data = await parseResponse<ApiResponse<{ isAuthenticated: boolean }>>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.isAuthenticated).toBe(true);
    });

    it('未登录时应该返回 isAuthenticated: false', async () => {
      vi.mocked(verifySession).mockResolvedValue(false);

      const response = await GET();
      const data = await parseResponse<ApiResponse<{ isAuthenticated: boolean }>>(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.isAuthenticated).toBe(false);
    });

    it('verifySession 失败时应该返回 isAuthenticated: false', async () => {
      vi.mocked(verifySession).mockRejectedValue(new Error('Session error'));

      const response = await GET();
      const data = await parseResponse<ApiResponse<{ isAuthenticated: boolean }>>(response);

      expect(response.status).toBe(200);
      expect(data.data?.isAuthenticated).toBe(false);
    });
  });
});
