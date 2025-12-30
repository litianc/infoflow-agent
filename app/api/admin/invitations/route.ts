import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invitationCodes, subscribers } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';
import crypto from 'crypto';

// 生成随机邀请码
function generateCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET /api/admin/invitations - 获取邀请码列表
export async function GET(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const codes = await db
      .select()
      .from(invitationCodes)
      .orderBy(desc(invitationCodes.createdAt));

    return NextResponse.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    console.error('[Invitations] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '获取邀请码失败' } },
      { status: 500 }
    );
  }
}

// POST /api/admin/invitations - 创建邀请码
export async function POST(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { name, maxUsage, expiresAt } = body;

    // 生成唯一邀请码
    let code = generateCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .select()
        .from(invitationCodes)
        .where(eq(invitationCodes.code, code))
        .limit(1);
      if (existing.length === 0) break;
      code = generateCode();
      attempts++;
    }

    const newCode = await db
      .insert(invitationCodes)
      .values({
        id: crypto.randomUUID().slice(0, 16),
        code,
        name: name || null,
        maxUsage: maxUsage || 0,
        expiresAt: expiresAt || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newCode[0],
    });
  } catch (error) {
    console.error('[Invitations] POST error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '创建邀请码失败' } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/invitations - 更新邀请码
export async function PUT(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, maxUsage, expiresAt, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '缺少邀请码ID' } },
        { status: 400 }
      );
    }

    await db
      .update(invitationCodes)
      .set({
        name: name !== undefined ? name : undefined,
        maxUsage: maxUsage !== undefined ? maxUsage : undefined,
        expiresAt: expiresAt !== undefined ? expiresAt : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(invitationCodes.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Invitations] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '更新邀请码失败' } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/invitations - 删除邀请码
export async function DELETE(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '缺少邀请码ID' } },
        { status: 400 }
      );
    }

    await db.delete(invitationCodes).where(eq(invitationCodes.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Invitations] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '删除邀请码失败' } },
      { status: 500 }
    );
  }
}
