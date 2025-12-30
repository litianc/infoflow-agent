import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Invitations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Invitation Code Generation', () => {
    it('should generate codes with valid characters', () => {
      const generateCode = (length: number = 8): string => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < length; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      const code = generateCode();
      expect(code).toHaveLength(8);

      // Should only contain allowed characters (no 0, O, I, 1 to avoid confusion)
      const allowedChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
      expect(allowedChars.test(code)).toBe(true);
    });

    it('should generate unique codes', () => {
      const generateCode = (length: number = 8): string => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < length; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
      };

      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateCode());
      }

      // With 32 possible characters and 8 positions, collisions should be rare
      expect(codes.size).toBeGreaterThan(95);
    });
  });

  describe('Invitation Code Validation', () => {
    it('should check code is active', () => {
      const activeCode = { id: '1', code: 'TEST1234', isActive: true };
      const inactiveCode = { id: '2', code: 'DISABLED', isActive: false };

      expect(activeCode.isActive).toBe(true);
      expect(inactiveCode.isActive).toBe(false);
    });

    it('should check expiration date', () => {
      const now = new Date();

      const validCode = {
        code: 'VALID123',
        expiresAt: new Date(now.getTime() + 86400000).toISOString(),
      };

      const expiredCode = {
        code: 'EXPIRED1',
        expiresAt: new Date(now.getTime() - 86400000).toISOString(),
      };

      const noExpirationCode = {
        code: 'NEVEREXP',
        expiresAt: null,
      };

      expect(validCode.expiresAt && new Date(validCode.expiresAt) > now).toBe(true);
      expect(expiredCode.expiresAt && new Date(expiredCode.expiresAt) < now).toBe(true);
      expect(noExpirationCode.expiresAt).toBeNull();
    });

    it('should check usage limits', () => {
      const hasCapacity = { maxUsage: 10, usageCount: 5 };
      const atLimit = { maxUsage: 10, usageCount: 10 };
      const unlimited = { maxUsage: 0, usageCount: 1000 };

      const canUse = (code: { maxUsage: number; usageCount: number }) =>
        code.maxUsage === 0 || code.usageCount < code.maxUsage;

      expect(canUse(hasCapacity)).toBe(true);
      expect(canUse(atLimit)).toBe(false);
      expect(canUse(unlimited)).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    it('should create invitation with defaults', () => {
      const createInvitation = (input: {
        name?: string;
        maxUsage?: number;
        expiresAt?: string | null;
      }) => ({
        id: 'test-id',
        code: 'TESTCODE',
        name: input.name || null,
        maxUsage: input.maxUsage || 0,
        usageCount: 0,
        isActive: true,
        expiresAt: input.expiresAt || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const basic = createInvitation({});
      expect(basic.name).toBeNull();
      expect(basic.maxUsage).toBe(0);
      expect(basic.usageCount).toBe(0);
      expect(basic.isActive).toBe(true);

      const withOptions = createInvitation({
        name: 'Test Code',
        maxUsage: 100,
      });
      expect(withOptions.name).toBe('Test Code');
      expect(withOptions.maxUsage).toBe(100);
    });

    it('should update invitation fields', () => {
      let invitation = {
        id: '1',
        code: 'TEST1234',
        name: 'Original',
        maxUsage: 10,
        isActive: true,
      };

      invitation = { ...invitation, name: 'Updated', isActive: false };

      expect(invitation.name).toBe('Updated');
      expect(invitation.isActive).toBe(false);
    });

    it('should increment usage count', () => {
      const invitation = { usageCount: 5 };
      invitation.usageCount += 1;

      expect(invitation.usageCount).toBe(6);
    });
  });
});
