import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sources } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

// GET /api/admin/sources/[id] - 获取单个数据源
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const result = await db.select().from(sources).where(eq(sources.id, id)).limit(1);

    if (!result[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '数据源不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Get source error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '获取数据源失败' } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/sources/[id] - 更新数据源
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { name, url, industryId, tier, config, isActive } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (name !== undefined) updateData.name = name;
    if (url !== undefined) updateData.url = url;
    if (industryId !== undefined) updateData.industryId = industryId;
    if (tier !== undefined) updateData.tier = tier;
    if (config !== undefined) updateData.config = config;
    if (isActive !== undefined) updateData.isActive = isActive;

    const result = await db
      .update(sources)
      .set(updateData)
      .where(eq(sources.id, id))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '数据源不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Update source error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '更新数据源失败' } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sources/[id] - 删除数据源
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const result = await db.delete(sources).where(eq(sources.id, id)).returning();

    if (!result[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '数据源不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete source error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '删除数据源失败' } },
      { status: 500 }
    );
  }
}
