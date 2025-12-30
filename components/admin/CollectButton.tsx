'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface CollectResult {
  sourceId: string;
  sourceName: string;
  status: 'success' | 'failed';
  articlesCount: number;
  error?: string;
}

interface CollectResponse {
  success: boolean;
  data?: {
    totalSources: number;
    successCount: number;
    failedCount: number;
    totalArticles: number;
    results: CollectResult[];
  };
  error?: {
    message: string;
  };
}

export function CollectButton() {
  const router = useRouter();
  const [isCollecting, setIsCollecting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<CollectResponse['data'] | null>(null);

  const handleCollect = async () => {
    setIsCollecting(true);
    setResults(null);

    try {
      const response = await fetch('/api/admin/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data: CollectResponse = await response.json();

      if (data.success && data.data) {
        setResults(data.data);
        setShowResults(true);
        toast.success(
          `采集完成：成功 ${data.data.successCount}/${data.data.totalSources}，共 ${data.data.totalArticles} 篇文章`
        );
        router.refresh();
      } else {
        toast.error(data.error?.message || '采集失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setIsCollecting(false);
    }
  };

  return (
    <>
      <Button onClick={handleCollect} disabled={isCollecting}>
        {isCollecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            采集中...
          </>
        ) : (
          <>
            <Play className="mr-2 h-4 w-4" />
            立即采集
          </>
        )}
      </Button>

      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>采集结果</DialogTitle>
            <DialogDescription>
              {results && (
                <span className="flex items-center gap-2 mt-2">
                  成功 {results.successCount}/{results.totalSources} 个数据源，
                  共采集 {results.totalArticles} 篇新文章
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {results && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {/* 进度条 */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>成功率</span>
                  <span>
                    {Math.round((results.successCount / results.totalSources) * 100)}%
                  </span>
                </div>
                <Progress
                  value={(results.successCount / results.totalSources) * 100}
                />
              </div>

              {/* 结果列表 */}
              <div className="divide-y rounded-lg border">
                {results.results.map((result) => (
                  <div
                    key={result.sourceId}
                    className="flex items-center justify-between p-3"
                  >
                    <div className="flex items-center gap-3">
                      {result.status === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">{result.sourceName}</div>
                        {result.error && (
                          <div className="text-xs text-red-500 line-clamp-1">
                            {result.error}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={result.status === 'success' ? 'secondary' : 'destructive'}
                    >
                      {result.status === 'success'
                        ? `${result.articlesCount} 篇`
                        : '失败'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
