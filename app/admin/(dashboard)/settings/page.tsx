'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, Clock, Play } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [lastCronRun, setLastCronRun] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    collectInterval: 'daily',
    collectConcurrency: 5,
    scheduleEnabled: true,
    llmEnabled: true,
    llmModel: 'GLM-4.5-Air',
    llmApiKey: '',
    llmApiBase: 'https://open.bigmodel.cn/api/paas/v4',
    scoreWeights: {
      relevance: 40,
      timeliness: 25,
      impact: 20,
      credibility: 15,
    },
  });

  // 从数据库加载设置
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        const data = await response.json();
        if (data.success && data.data) {
          setSettings(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setIsFetching(false);
      }
    };
    fetchSettings();
  }, []);

  // 测试定时采集
  const handleTestCron = async () => {
    setIsTesting(true);
    try {
      const response = await fetch('/api/cron/collect');
      const data = await response.json();
      if (data.success) {
        toast.success(`采集完成：${data.data?.totalArticles || 0} 篇新文章`);
        setLastCronRun(new Date().toISOString());
      } else {
        toast.error(data.error || '采集失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('保存成功');
      } else {
        toast.error('保存失败');
      }
    } catch (error) {
      toast.error('网络错误');
    } finally {
      setIsLoading(false);
    }
  };

  const totalWeight =
    settings.scoreWeights.relevance +
    settings.scoreWeights.timeliness +
    settings.scoreWeights.impact +
    settings.scoreWeights.credibility;

  if (isFetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系统设置</h1>

      {/* 定时采集 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            定时采集
          </CardTitle>
          <CardDescription>
            配置自动采集任务，部署到 Vercel 后每天早8点自动执行
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用定时采集</Label>
              <p className="text-sm text-muted-foreground">
                开启后将按照设定的频率自动采集数据
              </p>
            </div>
            <Switch
              checked={settings.scheduleEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, scheduleEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>采集频率</Label>
              <Select
                value={settings.collectInterval}
                onValueChange={(value) =>
                  setSettings({ ...settings, collectInterval: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">每小时</SelectItem>
                  <SelectItem value="daily">每天（早8点）</SelectItem>
                  <SelectItem value="weekly">每周</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>并发数</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={settings.collectConcurrency}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    collectConcurrency: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {lastCronRun ? (
                <>
                  <Badge variant="outline">上次运行</Badge>
                  {new Date(lastCronRun).toLocaleString('zh-CN')}
                </>
              ) : (
                <span>尚未运行过定时任务</span>
              )}
            </div>
            <Button
              variant="outline"
              onClick={handleTestCron}
              disabled={isTesting}
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  执行中...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  立即执行
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LLM 配置 */}
      <Card>
        <CardHeader>
          <CardTitle>LLM 配置</CardTitle>
          <CardDescription>配置用于生成摘要和分析的大语言模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>启用 LLM</Label>
              <p className="text-sm text-muted-foreground">
                用于生成文章摘要和智能分析
              </p>
            </div>
            <Switch
              checked={settings.llmEnabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, llmEnabled: checked })
              }
            />
          </div>

          {settings.llmEnabled && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>模型</Label>
                  <Input
                    value={settings.llmModel}
                    onChange={(e) =>
                      setSettings({ ...settings, llmModel: e.target.value })
                    }
                    placeholder="GLM-4.5-Air"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Base URL</Label>
                  <Input
                    value={settings.llmApiBase}
                    onChange={(e) =>
                      setSettings({ ...settings, llmApiBase: e.target.value })
                    }
                    placeholder="https://api.example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={settings.llmApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, llmApiKey: e.target.value })
                  }
                  placeholder="sk-xxxxxxxx"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 评分权重 */}
      <Card>
        <CardHeader>
          <CardTitle>评分权重</CardTitle>
          <CardDescription>
            配置四维评分的权重比例（总和应为 100）
            <span
              className={`ml-2 font-medium ${
                totalWeight === 100 ? 'text-green-500' : 'text-red-500'
              }`}
            >
              当前总和: {totalWeight}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>相关性</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.scoreWeights.relevance}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    scoreWeights: {
                      ...settings.scoreWeights,
                      relevance: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>时效性</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.scoreWeights.timeliness}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    scoreWeights: {
                      ...settings.scoreWeights,
                      timeliness: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>影响力</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.scoreWeights.impact}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    scoreWeights: {
                      ...settings.scoreWeights,
                      impact: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>可信度</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.scoreWeights.credibility}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    scoreWeights: {
                      ...settings.scoreWeights,
                      credibility: parseInt(e.target.value) || 0,
                    },
                  })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 保存按钮 */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isLoading || totalWeight !== 100}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存设置
        </Button>
      </div>
    </div>
  );
}
