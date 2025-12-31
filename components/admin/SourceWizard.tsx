'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Industry } from '@/lib/db/schema';

interface PreviewArticle {
  title: string;
  url: string;
  date: string | null;
  summary: string | null;
}

interface DetectedConfig {
  articleContainer: string;
  titleSelector: string;
  linkSelector: string;
  dateSelector: string | null;
  summarySelector: string | null;
  rssUrl: string | null;
}

interface SourceWizardProps {
  industries: Industry[];
}

type Step = 'url' | 'preview' | 'config';

export function SourceWizard({ industries }: SourceWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Step 1: URL input
  const [url, setUrl] = useState('');

  // Step 2: Preview data
  const [preview, setPreview] = useState<PreviewArticle[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<number>>(new Set());
  const [detectedConfig, setDetectedConfig] = useState<DetectedConfig | null>(null);
  const [confidence, setConfidence] = useState(0);

  // Step 3: Configuration
  const [name, setName] = useState('');
  const [industryId, setIndustryId] = useState('');
  const [tier, setTier] = useState('2');
  const [rssUrl, setRssUrl] = useState('');

  // Step 1: Auto-detect URL
  const handleDetect = async () => {
    if (!url.trim()) {
      toast.error('请输入URL');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/auto-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (data.success) {
        setPreview(data.preview || []);
        setDetectedConfig(data.config);
        setConfidence(data.confidence);
        setSelectedArticles(new Set(data.preview?.map((_: PreviewArticle, i: number) => i) || []));

        // 设置检测到的 RSS URL
        if (data.config?.rssUrl) {
          setRssUrl(data.config.rssUrl);
        }

        // Auto-fill name from URL
        try {
          const urlObj = new URL(url);
          setName(urlObj.hostname.replace('www.', ''));
        } catch {
          // ignore
        }

        setStep('preview');
        const rssNote = data.config?.rssUrl ? '，检测到 RSS Feed' : '';
        toast.success(`成功识别到 ${data.preview?.length || 0} 篇文章${rssNote}`);
      } else {
        toast.error(data.error?.message || '识别失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Toggle article selection
  const toggleArticle = (index: number) => {
    const newSelected = new Set(selectedArticles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedArticles(newSelected);
  };

  // Step 3: Save source
  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('请输入数据源名称');
      return;
    }
    if (!industryId) {
      toast.error('请选择所属行业');
      return;
    }

    setIsSaving(true);
    try {
      // 合并 rssUrl 到配置中
      const finalConfig = {
        ...detectedConfig,
        rssUrl: rssUrl.trim() || null,
      };

      const response = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          industryId,
          tier: parseInt(tier),
          config: finalConfig,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('数据源添加成功');
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center justify-center space-x-4">
        <div className={`flex items-center ${step === 'url' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
            step === 'url' ? 'border-primary bg-primary text-primary-foreground' : 'border-green-500 bg-green-500 text-white'
          }`}>
            {step === 'url' ? '1' : <CheckCircle2 className="h-4 w-4" />}
          </div>
          <span className="ml-2 text-sm font-medium">输入URL</span>
        </div>
        <div className="w-12 h-0.5 bg-muted" />
        <div className={`flex items-center ${step === 'preview' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
            step === 'preview' ? 'border-primary bg-primary text-primary-foreground' :
            step === 'config' ? 'border-green-500 bg-green-500 text-white' : 'border-muted'
          }`}>
            {step === 'config' ? <CheckCircle2 className="h-4 w-4" /> : '2'}
          </div>
          <span className="ml-2 text-sm font-medium">预览结果</span>
        </div>
        <div className="w-12 h-0.5 bg-muted" />
        <div className={`flex items-center ${step === 'config' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
            step === 'config' ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'
          }`}>
            3
          </div>
          <span className="ml-2 text-sm font-medium">配置信息</span>
        </div>
      </div>

      {/* Step 1: URL Input */}
      {step === 'url' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              输入网站URL
            </CardTitle>
            <CardDescription>
              请输入新闻网站的首页或列表页URL，系统将自动识别文章结构
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="url">网站URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/news"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleDetect} disabled={isLoading || !url.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    识别中...
                  </>
                ) : (
                  <>
                    自动识别
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              识别结果预览
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              成功识别到 {preview.length} 篇文章
              <Badge variant={confidence > 0.7 ? 'default' : confidence > 0.5 ? 'secondary' : 'destructive'}>
                置信度: {Math.round(confidence * 100)}%
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {preview.map((article, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selectedArticles.has(index)}
                    onCheckedChange={() => toggleArticle(index)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{article.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      {article.date && <span>{article.date}</span>}
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground flex items-center gap-1"
                      >
                        查看原文 <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {confidence < 0.6 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-600 dark:text-yellow-400">识别准确度较低</p>
                  <p className="text-muted-foreground">
                    建议检查识别结果是否准确，如有问题可尝试其他URL
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('url')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                上一步
              </Button>
              <Button onClick={() => setStep('config')} disabled={selectedArticles.size === 0}>
                下一步
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Configuration */}
      {step === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle>配置数据源信息</CardTitle>
            <CardDescription>
              设置数据源的名称、所属行业和优先级
            </CardDescription>
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
                {rssUrl && <Badge variant="secondary" className="ml-2">已检测</Badge>}
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

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep('preview')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                上一步
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
                    保存并启用
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
