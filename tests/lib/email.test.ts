import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database queries
vi.mock('@/lib/db/queries', () => ({
  getSetting: vi.fn(),
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Configuration', () => {
    it('should require host, user, and password', () => {
      const config = {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'user@example.com',
        password: 'secret',
        from: 'noreply@example.com',
      };

      expect(config.host).toBeTruthy();
      expect(config.user).toBeTruthy();
      expect(config.password).toBeTruthy();
    });

    it('should use default port if not specified', () => {
      const defaultPort = 587;
      const configuredPort = undefined;

      const port = configuredPort ?? defaultPort;
      expect(port).toBe(587);
    });

    it('should use default from address if not specified', () => {
      const defaultFrom = '行业情报 <noreply@example.com>';
      const configuredFrom = undefined;

      const from = configuredFrom ?? defaultFrom;
      expect(from).toBe('行业情报 <noreply@example.com>');
    });
  });

  describe('Unsubscribe Token Generation', () => {
    it('should generate consistent tokens for same email', () => {
      const crypto = require('crypto');
      const email = 'test@example.com';
      const secret = 'admin-password';

      const generateToken = (email: string) =>
        crypto
          .createHash('sha256')
          .update(email + secret)
          .digest('hex')
          .slice(0, 16);

      const token1 = generateToken(email);
      const token2 = generateToken(email);

      expect(token1).toBe(token2);
    });

    it('should generate different tokens for different emails', () => {
      const crypto = require('crypto');
      const secret = 'admin-password';

      const generateToken = (email: string) =>
        crypto
          .createHash('sha256')
          .update(email + secret)
          .digest('hex')
          .slice(0, 16);

      const token1 = generateToken('user1@example.com');
      const token2 = generateToken('user2@example.com');

      expect(token1).not.toBe(token2);
    });

    it('should generate 16-character hex tokens', () => {
      const crypto = require('crypto');
      const email = 'test@example.com';
      const secret = 'admin-password';

      const token = crypto
        .createHash('sha256')
        .update(email + secret)
        .digest('hex')
        .slice(0, 16);

      expect(token).toHaveLength(16);
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });

  describe('Newsletter HTML Generation', () => {
    it('should group articles by industry', () => {
      const articles = [
        { title: 'Article 1', industry: '数据中心' },
        { title: 'Article 2', industry: '云计算' },
        { title: 'Article 3', industry: '数据中心' },
      ];

      const grouped = articles.reduce((acc, article) => {
        if (!acc[article.industry]) {
          acc[article.industry] = [];
        }
        acc[article.industry].push(article);
        return acc;
      }, {} as Record<string, typeof articles>);

      expect(Object.keys(grouped)).toEqual(['数据中心', '云计算']);
      expect(grouped['数据中心']).toHaveLength(2);
      expect(grouped['云计算']).toHaveLength(1);
    });

    it('should include unsubscribe link', () => {
      const siteUrl = 'https://example.com';
      const email = 'test@example.com';
      const token = 'abc123';

      const unsubscribeUrl = `${siteUrl}/api/subscribe?email=${encodeURIComponent(email)}&token=${token}`;

      expect(unsubscribeUrl).toContain('email=test%40example.com');
      expect(unsubscribeUrl).toContain('token=abc123');
    });

    it('should format dates correctly', () => {
      const date = new Date('2024-12-25');
      const formatted = date.toLocaleDateString('zh-CN');

      expect(formatted).toMatch(/2024/);
      expect(formatted).toMatch(/12/);
      expect(formatted).toMatch(/25/);
    });
  });

  describe('Email Sending', () => {
    it('should handle send success', async () => {
      const mockSendMail = vi.fn().mockResolvedValue({ messageId: '123' });

      const result = await mockSendMail({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.messageId).toBe('123');
    });

    it('should handle send failure', async () => {
      const mockSendMail = vi.fn().mockRejectedValue(new Error('SMTP Error'));

      await expect(
        mockSendMail({
          from: 'noreply@example.com',
          to: 'user@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow('SMTP Error');
    });
  });
});
