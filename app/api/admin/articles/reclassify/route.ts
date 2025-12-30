import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { articles, industries } from '@/lib/db/schema';
import { eq, isNull, or } from 'drizzle-orm';
import { verifySession } from '@/lib/auth';
import { classifyArticleIndustry, isLLMAvailableAsync } from '@/lib/llm';

// POST /api/admin/articles/reclassify - 重新分类文章
export async function POST(request: NextRequest) {
  const isAuthenticated = await verifySession();
  if (!isAuthenticated) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未登录' } },
      { status: 401 }
    );
  }

  try {
    // 检查 LLM 是否可用
    const llmAvailable = await isLLMAvailableAsync();
    if (!llmAvailable) {
      return NextResponse.json({
        success: false,
        error: { code: 'LLM_UNAVAILABLE', message: 'LLM 服务未配置或不可用' },
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      mode = 'unclassified', // 'all' | 'unclassified' - 重新分类所有文章或只分类未分类的
      limit = 50, // 每次最多处理的文章数
    } = body;

    // 获取所有行业信息
    const allIndustries = await db
      .select({
        id: industries.id,
        name: industries.name,
        keywords: industries.keywords,
      })
      .from(industries)
      .where(eq(industries.isActive, true));

    if (allIndustries.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'NO_INDUSTRIES', message: '没有可用的行业分类' },
      }, { status: 400 });
    }

    // 获取需要分类的文章
    let articlesToClassify;
    if (mode === 'all') {
      articlesToClassify = await db
        .select({
          id: articles.id,
          title: articles.title,
          summary: articles.summary,
          industryId: articles.industryId,
        })
        .from(articles)
        .where(eq(articles.isDeleted, false))
        .limit(limit);
    } else {
      // 只获取未分类的文章
      articlesToClassify = await db
        .select({
          id: articles.id,
          title: articles.title,
          summary: articles.summary,
          industryId: articles.industryId,
        })
        .from(articles)
        .where(eq(articles.isDeleted, false))
        .limit(limit);

      // 过滤出没有行业分类的文章
      articlesToClassify = articlesToClassify.filter(a => !a.industryId);
    }

    if (articlesToClassify.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          processed: 0,
          classified: 0,
          failed: 0,
          message: mode === 'all' ? '没有文章需要处理' : '所有文章都已分类',
        },
      });
    }

    console.log(`[Reclassify] Processing ${articlesToClassify.length} articles in '${mode}' mode`);

    let classifiedCount = 0;
    let failedCount = 0;
    const results: { id: string; title: string; industryId: string | null; industryName: string | null }[] = [];

    for (const article of articlesToClassify) {
      try {
        // 使用标题和摘要进行分类
        const contentForClassification = article.summary
          ? `${article.title}\n${article.summary}`
          : article.title;

        const classifiedIndustryId = await classifyArticleIndustry(
          contentForClassification,
          allIndustries.map(ind => ({
            id: ind.id,
            name: ind.name,
            keywords: ind.keywords || [],
          }))
        );

        if (classifiedIndustryId) {
          // 更新文章的行业分类
          await db
            .update(articles)
            .set({ industryId: classifiedIndustryId })
            .where(eq(articles.id, article.id));

          const industry = allIndustries.find(i => i.id === classifiedIndustryId);
          results.push({
            id: article.id,
            title: article.title,
            industryId: classifiedIndustryId,
            industryName: industry?.name || null,
          });

          classifiedCount++;
          console.log(`[Reclassify] "${article.title}" -> ${industry?.name || classifiedIndustryId}`);
        } else {
          failedCount++;
          console.log(`[Reclassify] Failed to classify: ${article.title}`);
        }

        // 添加延迟避免 API 速率限制
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        failedCount++;
        console.error(`[Reclassify] Error classifying ${article.id}:`, error);
      }
    }

    // 重新验证页面缓存
    try {
      revalidatePath('/');
      revalidatePath('/industry/[slug]', 'page');
    } catch (error) {
      console.warn('[Reclassify] Failed to revalidate cache:', error);
    }

    console.log(`[Reclassify] Completed: ${classifiedCount} classified, ${failedCount} failed`);

    return NextResponse.json({
      success: true,
      data: {
        processed: articlesToClassify.length,
        classified: classifiedCount,
        failed: failedCount,
        results,
      },
    });
  } catch (error) {
    console.error('Reclassify error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'RECLASSIFY_ERROR', message: '重新分类失败' },
      },
      { status: 500 }
    );
  }
}
