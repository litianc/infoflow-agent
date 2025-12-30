import { NextRequest } from 'next/server';

/**
 * 创建模拟的 NextRequest 对象
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: object;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', body, headers = {} } = options;

  const requestInit: RequestInit = {
    method,
    headers: new Headers({
      'Content-Type': 'application/json',
      ...headers,
    }),
  };

  if (body && method !== 'GET') {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(new URL(url, 'http://localhost:3000'), requestInit);
}

/**
 * 解析 API 响应
 */
export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * 创建带认证的请求
 */
export function createAuthenticatedRequest(
  url: string,
  options: {
    method?: string;
    body?: object;
    sessionId?: string;
  } = {}
): NextRequest {
  const { sessionId = 'test-session-id', ...rest } = options;

  return createMockRequest(url, {
    ...rest,
    headers: {
      Cookie: `admin_session=${sessionId}`,
    },
  });
}

/**
 * 标准 API 响应类型
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
