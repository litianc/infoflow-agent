import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyPassword } from '@/lib/auth';

describe('Auth Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('verifyPassword', () => {
    it('密码正确时应该返回 true', async () => {
      process.env.ADMIN_PASSWORD = 'correct-password';
      const result = await verifyPassword('correct-password');
      expect(result).toBe(true);
    });

    it('密码错误时应该返回 false', async () => {
      process.env.ADMIN_PASSWORD = 'correct-password';
      const result = await verifyPassword('wrong-password');
      expect(result).toBe(false);
    });

    it('ADMIN_PASSWORD 未设置时应该返回 false', async () => {
      delete process.env.ADMIN_PASSWORD;
      const result = await verifyPassword('any-password');
      expect(result).toBe(false);
    });

    it('空密码应该返回 false', async () => {
      process.env.ADMIN_PASSWORD = 'correct-password';
      const result = await verifyPassword('');
      expect(result).toBe(false);
    });

    it('ADMIN_PASSWORD 为空字符串时，空密码应该验证失败', async () => {
      process.env.ADMIN_PASSWORD = '';
      // 当前实现：空字符串比对空字符串会返回 true
      // 这是一个潜在的安全问题，但我们测试当前行为
      // 注意：lib/auth.ts 中检查 !adminPassword 会返回 false
      const result = await verifyPassword('');
      // 由于 '' 是 falsy，所以 !adminPassword 为 true，返回 false
      expect(result).toBe(false);
    });

    it('密码应该区分大小写', async () => {
      process.env.ADMIN_PASSWORD = 'Password123';
      expect(await verifyPassword('PASSWORD123')).toBe(false);
      expect(await verifyPassword('password123')).toBe(false);
      expect(await verifyPassword('Password123')).toBe(true);
    });

    it('密码应该支持特殊字符', async () => {
      process.env.ADMIN_PASSWORD = 'P@ssw0rd!#$%';
      expect(await verifyPassword('P@ssw0rd!#$%')).toBe(true);
    });

    it('密码应该支持中文', async () => {
      process.env.ADMIN_PASSWORD = '管理员密码123';
      expect(await verifyPassword('管理员密码123')).toBe(true);
      expect(await verifyPassword('管理员密码124')).toBe(false);
    });

    it('密码不应该 trim 空格', async () => {
      process.env.ADMIN_PASSWORD = ' password ';
      expect(await verifyPassword(' password ')).toBe(true);
      expect(await verifyPassword('password')).toBe(false);
    });
  });
});

// 注意：createSession, verifySession, deleteSession, getSessionStatus
// 这些函数依赖 next/headers 的 cookies()，需要在集成测试中测试
// 或使用更完整的 mock 环境
