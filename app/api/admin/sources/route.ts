import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sources } from '@/lib/db/schema';
import { verifySession } from '@/lib/auth';

// GET /api/admin/sources - 获取所有数据源
export async function GET() {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    const result = await db.select().from(sources);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Get sources error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '获取数据源失败' } },
      { status: 500 }
    );
  }
}

// POST /api/admin/sources - 创建数据源
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
    const { name, url, industryId, tier, config } = body;

    if (!name || !url) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: '名称和URL必填' } },
        { status: 400 }
      );
    }

    const result = await db.insert(sources).values({
      name,
      url,
      industryId: industryId || null,
      tier: tier || 2,
      config: config || {},
      isActive: true,
    }).returning();

    return NextResponse.json({ success: true, data: result[0] }, { status: 201 });
  } catch (error) {
    console.error('Create source error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'DB_ERROR', message: '创建数据源失败' } },
      { status: 500 }
    );
  }
}
