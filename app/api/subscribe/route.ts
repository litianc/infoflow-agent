import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invitationCodes, subscribers } from '@/lib/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import crypto from 'crypto';

// POST /api/subscribe - 用户订阅周报
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, invitationCode } = body;

    // 验证邮箱格式
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: '请输入有效的邮箱地址' },
        { status: 400 }
      );
    }

    // 验证邀请码
    if (!invitationCode) {
      return NextResponse.json(
        { success: false, error: '请输入邀请码' },
        { status: 400 }
      );
    }

    // 查找邀请码
    const invitation = await db
      .select()
      .from(invitationCodes)
      .where(
        and(
          eq(invitationCodes.code, invitationCode),
          eq(invitationCodes.isActive, true)
        )
      )
      .limit(1);

    if (invitation.length === 0) {
      return NextResponse.json(
        { success: false, error: '邀请码无效' },
        { status: 400 }
      );
    }

    const code = invitation[0];

    // 检查邀请码是否过期
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return NextResponse.json(
        { success: false, error: '邀请码已过期' },
        { status: 400 }
      );
    }

    // 检查邀请码使用次数
    if (code.maxUsage && code.maxUsage > 0 && (code.usageCount ?? 0) >= code.maxUsage) {
      return NextResponse.json(
        { success: false, error: '邀请码已达使用上限' },
        { status: 400 }
      );
    }

    // 检查邮箱是否已订阅
    const existing = await db
      .select()
      .from(subscribers)
      .where(eq(subscribers.email, email))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].isActive) {
        return NextResponse.json(
          { success: false, error: '该邮箱已订阅' },
          { status: 400 }
        );
      }
      // 重新激活订阅
      await db
        .update(subscribers)
        .set({
          isActive: true,
          name: name || existing[0].name,
          invitationCodeId: code.id,
          unsubscribedAt: null,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(subscribers.id, existing[0].id));
    } else {
      // 创建新订阅
      await db.insert(subscribers).values({
        id: crypto.randomUUID().slice(0, 16),
        email,
        name: name || null,
        invitationCodeId: code.id,
        isActive: true,
      });
    }

    // 更新邀请码使用次数
    await db
      .update(invitationCodes)
      .set({
        usageCount: sql`${invitationCodes.usageCount} + 1`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(invitationCodes.id, code.id));

    return NextResponse.json({
      success: true,
      message: '订阅成功！您将收到每周的行业情报周报。',
    });
  } catch (error) {
    console.error('[Subscribe] Error:', error);
    return NextResponse.json(
      { success: false, error: '订阅失败，请稍后重试' },
      { status: 500 }
    );
  }
}

// DELETE /api/subscribe - 取消订阅
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const token = searchParams.get('token');

    if (!email || !token) {
      return NextResponse.json(
        { success: false, error: '参数错误' },
        { status: 400 }
      );
    }

    // 验证 token（使用简单的 hash 验证）
    const expectedToken = crypto
      .createHash('sha256')
      .update(email + process.env.ADMIN_PASSWORD)
      .digest('hex')
      .slice(0, 16);

    if (token !== expectedToken) {
      return NextResponse.json(
        { success: false, error: '无效的取消订阅链接' },
        { status: 400 }
      );
    }

    // 取消订阅
    const result = await db
      .update(subscribers)
      .set({
        isActive: false,
        unsubscribedAt: new Date().toISOString(),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(subscribers.email, email));

    return NextResponse.json({
      success: true,
      message: '您已成功取消订阅',
    });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.json(
      { success: false, error: '取消订阅失败' },
      { status: 500 }
    );
  }
}
