import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDashboardData } from '@/lib/db/admin-queries';
import { CollectButton } from '@/components/admin/CollectButton';
import {
  FileText,
  TrendingUp,
  Rss,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default async function AdminDashboardPage() {
  const dashboard = await getDashboardData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <CollectButton />
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">总文章数</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.stats.totalArticles}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">今日采集</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{dashboard.stats.todayArticles}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">活跃数据源</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboard.stats.activeSources}/{dashboard.stats.totalSources}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">异常数据源</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {dashboard.stats.failedSources}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 行业分布 */}
        <Card>
          <CardHeader>
            <CardTitle>行业文章分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.industryDistribution.map((item) => (
                <div key={item.industry} className="flex items-center">
                  <div className="w-24 text-sm truncate">{item.industry}</div>
                  <div className="flex-1 mx-3">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-16 text-sm text-right text-muted-foreground">
                    {item.count} 篇
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 最近采集记录 */}
        <Card>
          <CardHeader>
            <CardTitle>最近采集记录</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.recentCollections.length > 0 ? (
              <div className="space-y-3">
                {dashboard.recentCollections.map((log, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center space-x-3">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <div className="text-sm font-medium">{log.sourceName}</div>
                        <div className="text-xs text-muted-foreground">
                          {log.finishedAt
                            ? formatDistanceToNow(new Date(log.finishedAt), {
                                addSuffix: true,
                                locale: zhCN,
                              })
                            : '未知'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      {log.status === 'success' ? (
                        <Badge variant="secondary">{log.articlesCount} 篇</Badge>
                      ) : (
                        <Badge variant="destructive">失败</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>暂无采集记录</p>
                <p className="text-sm mt-1">添加数据源后运行采集任务</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
