import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscribers, invitationCodes } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

// GET /api/admin/subscribers - 获取订阅者列表
export async function GET(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const result = await db
      .select({
        subscriber: subscribers,
        invitation: {
          id: invitationCodes.id,
          code: invitationCodes.code,
          name: invitationCodes.name,
        },
      })
      .from(subscribers)
      .leftJoin(invitationCodes, eq(subscribers.invitationCodeId, invitationCodes.id))
      .orderBy(desc(subscribers.createdAt));

    return NextResponse.json({
      success: true,
      data: result.map((r) => ({
        ...r.subscriber,
        invitation: r.invitation,
      })),
    });
  } catch (error) {
    console.error('[Subscribers] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '获取订阅者失败' } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/subscribers - 更新订阅者状态
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
    const { id, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: '缺少订阅者ID' } },
        { status: 400 }
      );
    }

    await db
      .update(subscribers)
      .set({
        isActive,
        unsubscribedAt: isActive ? null : new Date().toISOString(),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(subscribers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Subscribers] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '更新订阅者失败' } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/subscribers - 删除订阅者
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
        { success: false, error: { code: 'BAD_REQUEST', message: '缺少订阅者ID' } },
        { status: 400 }
      );
    }

    await db.delete(subscribers).where(eq(subscribers.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Subscribers] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '删除订阅者失败' } },
      { status: 500 }
    );
  }
}
