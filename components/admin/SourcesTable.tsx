'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Pencil, Trash2, Play, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { Industry } from '@/lib/db/schema';

interface Source {
  id: string;
  name: string;
  url: string;
  industryId: string | null;
  tier: number | null;
  isActive: boolean | null;
  lastCollectedAt: string | null;
  successCount: number | null;
  errorCount: number | null;
  lastError: string | null;
  industry: { id: string; name: string; slug: string } | null;
}

interface SourcesTableProps {
  sources: Source[];
  industries: Industry[];
}

export function SourcesTable({ sources, industries }: SourcesTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleToggleActive = async (id: string, isActive: boolean) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/admin/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(isActive ? '已禁用' : '已启用');
        router.refresh();
      } else {
        toast.error('操作失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个数据源吗？')) return;

    setLoadingId(id);
    try {
      const response = await fetch(`/api/admin/sources/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('已删除');
        router.refresh();
      } else {
        toast.error('删除失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setLoadingId(null);
    }
  };

  const getStatusBadge = (source: Source) => {
    if (!source.isActive) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    if (source.errorCount && source.errorCount > 0) {
      return <Badge variant="destructive">异常</Badge>;
    }
    return <Badge variant="default">正常</Badge>;
  };

  const tierLabels: Record<number, string> = {
    1: 'T1',
    2: 'T2',
    3: 'T3',
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">状态</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>行业</TableHead>
            <TableHead className="w-16">等级</TableHead>
            <TableHead>最后采集</TableHead>
            <TableHead className="w-20">启用</TableHead>
            <TableHead className="w-16">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.length > 0 ? (
            sources.map((source) => (
              <TableRow key={source.id}>
                <TableCell>{getStatusBadge(source)}</TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{source.name}</div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                    >
                      {new URL(source.url).hostname}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </TableCell>
                <TableCell>
                  {source.industry ? (
                    <Badge variant="outline">{source.industry.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {tierLabels[source.tier || 2] || 'T2'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {source.lastCollectedAt ? (
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(source.lastCollectedAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={source.isActive ?? false}
                    onCheckedChange={() =>
                      handleToggleActive(source.id, source.isActive ?? false)
                    }
                    disabled={loadingId === source.id}
                  />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/admin/sources/${source.id}`)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(source.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                暂无数据源，点击右上角添加
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
