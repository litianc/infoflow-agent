'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExternalLink, Star, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Article, Industry, Source } from '@/lib/db/schema';

interface ArticlesTableProps {
  articles: Article[];
  industries: Industry[];
  sources: { id: string; name: string; industry: { name: string } | null }[];
  currentPage: number;
  totalPages: number;
  selectedIndustry?: string;
  selectedSource?: string;
}

export function ArticlesTable({
  articles,
  industries,
  sources,
  currentPage,
  totalPages,
  selectedIndustry,
  selectedSource,
}: ArticlesTableProps) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleFilter = (type: 'industry' | 'source', value: string) => {
    const params = new URLSearchParams();
    if (type === 'industry' && value !== 'all') {
      params.set('industry', value);
    } else if (selectedIndustry && type !== 'industry') {
      params.set('industry', selectedIndustry);
    }
    if (type === 'source' && value !== 'all') {
      params.set('source', value);
    } else if (selectedSource && type !== 'source') {
      params.set('source', selectedSource);
    }

    router.push(`/admin/articles?${params.toString()}`);
  };

  const handleToggleFeatured = async (id: string, isFeatured: boolean) => {
    setLoadingId(id);
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !isFeatured }),
      });

      if (response.ok) {
        toast.success(isFeatured ? '已取消推荐' : '已设为推荐');
        router.refresh();
      }
    } catch (error) {
      toast.error('操作失败');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这篇文章吗？')) return;

    setLoadingId(id);
    try {
      const response = await fetch(`/api/admin/articles/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('已删除');
        router.refresh();
      }
    } catch (error) {
      toast.error('删除失败');
    } finally {
      setLoadingId(null);
    }
  };

  const priorityColor = {
    '高': 'destructive',
    '中': 'secondary',
    '低': 'outline',
  };

  return (
    <div className="space-y-4">
      {/* 筛选器 */}
      <div className="flex gap-4">
        <Select
          value={selectedIndustry || 'all'}
          onValueChange={(value) => handleFilter('industry', value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="选择行业" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部行业</SelectItem>
            {industries.map((industry) => (
              <SelectItem key={industry.id} value={industry.id}>
                {industry.icon} {industry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={selectedSource || 'all'}
          onValueChange={(value) => handleFilter('source', value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="选择来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            {sources.map((source) => (
              <SelectItem key={source.id} value={source.id}>
                {source.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 表格 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">推荐</TableHead>
              <TableHead>标题</TableHead>
              <TableHead className="w-24">评分</TableHead>
              <TableHead className="w-20">优先级</TableHead>
              <TableHead className="w-28">发布时间</TableHead>
              <TableHead className="w-20">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {articles.length > 0 ? (
              articles.map((article) => (
                <TableRow key={article.id}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleToggleFeatured(article.id, article.isFeatured ?? false)
                      }
                      disabled={loadingId === article.id}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          article.isFeatured
                            ? 'fill-yellow-500 text-yellow-500'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-md">
                      <div className="font-medium line-clamp-1">{article.title}</div>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center"
                      >
                        查看原文
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{article.score}</span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        priorityColor[article.priority as keyof typeof priorityColor] as
                          | 'destructive'
                          | 'secondary'
                          | 'outline'
                      }
                    >
                      {article.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {article.publishDate
                      ? format(new Date(article.publishDate), 'MM-dd HH:mm')
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(article.id)}
                      disabled={loadingId === article.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  暂无文章
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          {currentPage > 1 && (
            <Link
              href={`/admin/articles?page=${currentPage - 1}${selectedIndustry ? `&industry=${selectedIndustry}` : ''}${selectedSource ? `&source=${selectedSource}` : ''}`}
            >
              <Button variant="outline" size="sm">
                上一页
              </Button>
            </Link>
          )}
          <span className="text-sm text-muted-foreground">
            第 {currentPage} / {totalPages} 页
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/admin/articles?page=${currentPage + 1}${selectedIndustry ? `&industry=${selectedIndustry}` : ''}${selectedSource ? `&source=${selectedSource}` : ''}`}
            >
              <Button variant="outline" size="sm">
                下一页
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
