import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Next.js modules
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/headers for server components
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }),
  headers: () => new Headers(),
}));

// Mock environment variables for tests
process.env.ADMIN_PASSWORD = 'test-password-123';
process.env.TURSO_DATABASE_URL = 'file::memory:';

// Global fetch mock reset
beforeEach(() => {
  vi.clearAllMocks();
});

// Clean up after tests
afterAll(() => {
  vi.resetAllMocks();
});
