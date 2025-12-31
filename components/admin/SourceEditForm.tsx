'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ArrowLeft, Rss } from 'lucide-react';
import { toast } from 'sonner';
import type { Source, Industry, SourceConfig } from '@/lib/db/schema';

interface SourceEditFormProps {
  source: Source;
  industries: Industry[];
}

export function SourceEditForm({ source, industries }: SourceEditFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // 解析现有配置
  const existingConfig = (source.config || {}) as SourceConfig;

  const [name, setName] = useState(source.name);
  const [url, setUrl] = useState(source.url);
  const [industryId, setIndustryId] = useState(source.industryId || '');
  const [tier, setTier] = useState(String(source.tier || 2));
  const [rssUrl, setRssUrl] = useState(existingConfig.rssUrl || '');
  const [dateSelector, setDateSelector] = useState(existingConfig.dateSelector || '');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入数据源名称');
      return;
    }
    if (!url.trim()) {
      toast.error('请输入URL');
      return;
    }

    setIsSaving(true);
    try {
      const config: SourceConfig = {
        ...existingConfig,
        rssUrl: rssUrl.trim() || undefined,
        dateSelector: dateSelector.trim() || undefined,
      };

      const response = await fetch(`/api/admin/sources/${source.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          industryId: industryId || null,
          tier: parseInt(tier),
          config,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('保存成功');
        router.push('/admin/sources');
        router.refresh();
      } else {
        toast.error(data.error?.message || '保存失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          编辑: {source.name}
          {rssUrl && (
            <Badge variant="secondary" className="ml-2">
              <Rss className="h-3 w-3 mr-1" />
              RSS
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">数据源名称</Label>
          <Input
            id="name"
            placeholder="例如：中国IDC圈"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="url">网站URL</Label>
          <Input
            id="url"
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>所属行业</Label>
            <Select value={industryId} onValueChange={setIndustryId}>
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
            <Label>优先级</Label>
            <Select value={tier} onValueChange={setTier}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tier 1 - 权威来源</SelectItem>
                <SelectItem value="2">Tier 2 - 专业媒体</SelectItem>
                <SelectItem value="3">Tier 3 - 一般来源</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="rssUrl">
            RSS Feed URL
            {rssUrl && <Badge variant="secondary" className="ml-2">已配置</Badge>}
          </Label>
          <Input
            id="rssUrl"
            type="url"
            placeholder="https://example.com/rss（可选，优先使用 RSS 采集）"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            配置 RSS Feed 可提高采集质量和日期准确性
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateSelector">日期选择器（可选）</Label>
          <Input
            id="dateSelector"
            placeholder="例如：#pubtime_baidu 或 .date"
            value={dateSelector}
            onChange={(e) => setDateSelector(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            用于从文章页面提取发布日期的 CSS 选择器
          </p>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
