import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { articles } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

// PUT /api/admin/articles/[id] - 更新文章
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
    const { isFeatured, priority, industryId } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (isFeatured !== undefined) updateData.isFeatured = isFeatured;
    if (priority !== undefined) updateData.priority = priority;
    if (industryId !== undefined) updateData.industryId = industryId;

    const result = await db
      .update(articles)
      .set(updateData)
      .where(eq(articles.id, id))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Update article error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '更新文章失败' } },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/articles/[id] - 删除文章（软删除）
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
    const result = await db
      .update(articles)
      .set({ isDeleted: true, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(articles.id, id))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '文章不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete article error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '删除文章失败' } },
      { status: 500 }
    );
  }
}
