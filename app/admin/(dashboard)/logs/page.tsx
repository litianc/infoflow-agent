import { db } from '@/lib/db';
import { collectLogs, sources } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { RelativeTime } from '@/components/ui/relative-time';

async function getCollectLogs(limit = 50) {
  const logs = await db
    .select({
      log: collectLogs,
      source: {
        id: sources.id,
        name: sources.name,
      },
    })
    .from(collectLogs)
    .leftJoin(sources, eq(collectLogs.sourceId, sources.id))
    .orderBy(desc(collectLogs.startedAt))
    .limit(limit);

  return logs;
}

async function getStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [totalResult, todayResult, successResult] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(collectLogs),
    db
      .select({ count: sql<number>`count(*)` })
      .from(collectLogs)
      .where(sql`${collectLogs.startedAt} >= ${todayStr}`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(collectLogs)
      .where(eq(collectLogs.status, 'success')),
  ]);

  const total = totalResult[0]?.count || 0;
  const todayCount = todayResult[0]?.count || 0;
  const successCount = successResult[0]?.count || 0;

  return {
    total,
    today: todayCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
  };
}

export default async function LogsPage() {
  const [logs, stats] = await Promise.all([getCollectLogs(), getStats()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">采集日志</h1>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总采集次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              今日采集
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.today}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* 日志列表 */}
      <Card>
        <CardHeader>
          <CardTitle>最近采集记录</CardTitle>
          <CardDescription>显示最近 50 条采集日志</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">状态</TableHead>
                <TableHead>数据源</TableHead>
                <TableHead className="w-24">采集数量</TableHead>
                <TableHead className="w-32">开始时间</TableHead>
                <TableHead className="w-24">耗时</TableHead>
                <TableHead>错误信息</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((item) => {
                  const startTime = item.log.startedAt
                    ? new Date(item.log.startedAt)
                    : null;
                  const endTime = item.log.finishedAt
                    ? new Date(item.log.finishedAt)
                    : null;
                  const duration =
                    startTime && endTime
                      ? Math.round((endTime.getTime() - startTime.getTime()) / 1000)
                      : null;

                  return (
                    <TableRow key={item.log.id}>
                      <TableCell>
                        {item.log.status === 'success' ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.source?.name || '未知来源'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {item.log.articlesCount} 篇
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <RelativeTime date={item.log.startedAt} fallback="-" />
                      </TableCell>
                      <TableCell className="text-sm">
                        {duration !== null ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {duration}秒
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {item.log.errorMessage ? (
                          <span className="text-sm text-red-500 line-clamp-1">
                            {item.log.errorMessage}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    暂无采集记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
