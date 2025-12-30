'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Industry, Source, SourceConfig } from '@/lib/db/schema';

interface SourceFormProps {
  source?: Source;
  industries: Industry[];
}

export function SourceForm({ source, industries }: SourceFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: source?.name || '',
    url: source?.url || '',
    industryId: source?.industryId || '',
    tier: source?.tier?.toString() || '2',
    articleContainer: (source?.config as SourceConfig)?.articleContainer || '',
    titleSelector: (source?.config as SourceConfig)?.titleSelector || '',
    linkSelector: (source?.config as SourceConfig)?.linkSelector || '',
    dateSelector: (source?.config as SourceConfig)?.dateSelector || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error('请填写名称和URL');
      return;
    }

    setIsLoading(true);

    try {
      const config: SourceConfig = {
        scraperType: 'generic',
        listUrl: formData.url,
        articleContainer: formData.articleContainer || undefined,
        titleSelector: formData.titleSelector || undefined,
        linkSelector: formData.linkSelector || undefined,
        dateSelector: formData.dateSelector || undefined,
      };

      const body = {
        name: formData.name,
        url: formData.url,
        industryId: formData.industryId || null,
        tier: parseInt(formData.tier),
        config,
      };

      const url = source ? `/api/admin/sources/${source.id}` : '/api/admin/sources';
      const method = source ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(source ? '更新成功' : '创建成功');
        router.push('/admin/sources');
        router.refresh();
      } else {
        toast.error(data.error?.message || '操作失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">数据源名称 *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：36氪"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">网站URL *</Label>
              <Input
                id="url"
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                placeholder="https://example.com/news"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="industry">所属行业</Label>
              <Select
                value={formData.industryId}
                onValueChange={(value) => setFormData({ ...formData, industryId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择行业" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((industry) => (
                    <SelectItem key={industry.id} value={industry.id}>
                      {industry.icon} {industry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier">优先级</Label>
              <Select
                value={formData.tier}
                onValueChange={(value) => setFormData({ ...formData, tier: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tier 1 - 官方/权威</SelectItem>
                  <SelectItem value="2">Tier 2 - 专业媒体</SelectItem>
                  <SelectItem value="3">Tier 3 - 自媒体/其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>爬虫配置（可选）</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="articleContainer">文章列表选择器</Label>
              <Input
                id="articleContainer"
                value={formData.articleContainer}
                onChange={(e) =>
                  setFormData({ ...formData, articleContainer: e.target.value })
                }
                placeholder="例如：.article-list .item"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titleSelector">标题选择器</Label>
              <Input
                id="titleSelector"
                value={formData.titleSelector}
                onChange={(e) =>
                  setFormData({ ...formData, titleSelector: e.target.value })
                }
                placeholder="例如：h2 a"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="linkSelector">链接选择器</Label>
              <Input
                id="linkSelector"
                value={formData.linkSelector}
                onChange={(e) =>
                  setFormData({ ...formData, linkSelector: e.target.value })
                }
                placeholder="例如：a[href]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateSelector">日期选择器</Label>
              <Input
                id="dateSelector"
                value={formData.dateSelector}
                onChange={(e) =>
                  setFormData({ ...formData, dateSelector: e.target.value })
                }
                placeholder="例如：.date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {source ? '保存修改' : '创建数据源'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
