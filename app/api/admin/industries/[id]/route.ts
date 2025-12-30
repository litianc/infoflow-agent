import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { industries } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';

// PUT /api/admin/industries/[id] - 更新行业
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
    const { name, description, icon, color, keywords, isActive, sortOrder } = body;

    const updateData: Record<string, unknown> = {
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (keywords !== undefined) updateData.keywords = keywords;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const result = await db
      .update(industries)
      .set(updateData)
      .where(eq(industries.id, id))
      .returning();

    if (!result[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '行业不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (error) {
    console.error('Update industry error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '更新行业失败' } },
      { status: 500 }
    );
  }
}
