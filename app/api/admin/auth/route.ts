import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, createSession, deleteSession, verifySession } from '@/lib/auth';

// POST /api/admin/auth - 登录
export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '请输入密码' } },
        { status: 400 }
      );
    }

    const isValid = await verifyPassword(password);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PASSWORD', message: '密码错误' } },
        { status: 401 }
      );
    }

    await createSession();

    return NextResponse.json({ success: true, message: '登录成功' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'UNKNOWN_ERROR', message: '登录失败' } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/auth - 登出
export async function DELETE() {
  try {
    await deleteSession();
    return NextResponse.json({ success: true, message: '已退出登录' });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'UNKNOWN_ERROR', message: '退出失败' } },
      { status: 500 }
    );
  }
}

// GET /api/admin/auth - 检查登录状态
export async function GET() {
  try {
    const isAuthenticated = await verifySession();
    return NextResponse.json({ success: true, data: { isAuthenticated } });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json({ success: true, data: { isAuthenticated: false } });
  }
}
