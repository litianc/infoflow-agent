'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Loader2, Plus, Trash2, Copy, Mail, Ticket, Users, RefreshCw, Send, History } from 'lucide-react';
import { toast } from 'sonner';

interface NewsletterLog {
  id: string;
  subject: string;
  recipientCount: number;
  successCount: number;
  failedCount: number;
  status: string;
  sentAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface InvitationCode {
  id: string;
  code: string;
  name: string | null;
  maxUsage: number;
  usageCount: number;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  subscribedAt: string;
  unsubscribedAt: string | null;
  invitation: {
    id: string;
    code: string;
    name: string | null;
  } | null;
}

export default function NewsletterPage() {
  const [invitations, setInvitations] = useState<InvitationCode[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [newsletterLogs, setNewsletterLogs] = useState<NewsletterLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [newCode, setNewCode] = useState({ name: '', maxUsage: 0, expiresAt: '' });
  const [sendForm, setSendForm] = useState({ subject: `行业情报周报 - ${new Date().toLocaleDateString('zh-CN')}`, daysRange: 7 });

  // 加载数据
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [invRes, subRes, logsRes] = await Promise.all([
        fetch('/api/admin/invitations'),
        fetch('/api/admin/subscribers'),
        fetch('/api/admin/newsletter/send'),
      ]);
      const invData = await invRes.json();
      const subData = await subRes.json();
      const logsData = await logsRes.json();

      if (invData.success) setInvitations(invData.data);
      if (subData.success) setSubscribers(subData.data);
      if (logsData.success) setNewsletterLogs(logsData.data);
    } catch (error) {
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 发送周报
  const handleSendNewsletter = async () => {
    if (!sendForm.subject) {
      toast.error('请输入邮件主题');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sendForm),
      });
      const data = await response.json();

      if (data.success) {
        toast.success(`发送完成！成功: ${data.data.successCount}, 失败: ${data.data.failedCount}`);
        setSendDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || '发送失败');
      }
    } catch (error) {
      toast.error('发送失败');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 创建邀请码
  const handleCreateCode = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCode.name || null,
          maxUsage: newCode.maxUsage || 0,
          expiresAt: newCode.expiresAt || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('邀请码创建成功');
        setCreateDialogOpen(false);
        setNewCode({ name: '', maxUsage: 0, expiresAt: '' });
        fetchData();
      } else {
        toast.error(data.error?.message || '创建失败');
      }
    } catch (error) {
      toast.error('创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  // 切换邀请码状态
  const toggleCodeStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      if (response.ok) {
        setInvitations(invitations.map(inv =>
          inv.id === id ? { ...inv, isActive } : inv
        ));
        toast.success(isActive ? '邀请码已启用' : '邀请码已禁用');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 删除邀请码
  const deleteCode = async (id: string) => {
    if (!confirm('确定要删除这个邀请码吗？')) return;
    try {
      const response = await fetch(`/api/admin/invitations?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setInvitations(invitations.filter(inv => inv.id !== id));
        toast.success('邀请码已删除');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  // 复制邀请码
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('已复制到剪贴板');
  };

  // 切换订阅者状态
  const toggleSubscriberStatus = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/admin/subscribers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });
      if (response.ok) {
        setSubscribers(subscribers.map(sub =>
          sub.id === id ? { ...sub, isActive } : sub
        ));
        toast.success(isActive ? '已恢复订阅' : '已取消订阅');
      }
    } catch (error) {
      toast.error('操作失败');
    }
  };

  // 删除订阅者
  const deleteSubscriber = async (id: string) => {
    if (!confirm('确定要删除这个订阅者吗？')) return;
    try {
      const response = await fetch(`/api/admin/subscribers?id=${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSubscribers(subscribers.filter(sub => sub.id !== id));
        toast.success('订阅者已删除');
      }
    } catch (error) {
      toast.error('删除失败');
    }
  };

  const activeSubscribers = subscribers.filter(s => s.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">周报管理</h1>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">邀请码总数</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invitations.length}</div>
            <p className="text-xs text-muted-foreground">
              {invitations.filter(i => i.isActive).length} 个有效
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">订阅者总数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscribers.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeSubscribers} 个活跃
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">周报状态</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscribers}</div>
            <p className="text-xs text-muted-foreground">
              可发送邮件数
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">发送周报</TabsTrigger>
          <TabsTrigger value="invitations">邀请码管理</TabsTrigger>
          <TabsTrigger value="subscribers">订阅者列表</TabsTrigger>
        </TabsList>

        {/* 发送周报 */}
        <TabsContent value="send">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  发送新周报
                </CardTitle>
                <CardDescription>向所有活跃订阅者发送周报邮件</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>邮件主题</Label>
                  <Input
                    value={sendForm.subject}
                    onChange={(e) => setSendForm({ ...sendForm, subject: e.target.value })}
                    placeholder="请输入邮件主题"
                  />
                </div>
                <div className="space-y-2">
                  <Label>文章时间范围（天）</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={sendForm.daysRange}
                    onChange={(e) => setSendForm({ ...sendForm, daysRange: parseInt(e.target.value) || 7 })}
                  />
                  <p className="text-xs text-muted-foreground">选取最近多少天内的文章</p>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">
                      将发送给 <strong>{activeSubscribers}</strong> 位订阅者
                    </span>
                  </div>
                  <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" disabled={activeSubscribers === 0}>
                        <Mail className="h-4 w-4 mr-2" />
                        发送周报
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>确认发送</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-muted-foreground">
                          即将向 <strong>{activeSubscribers}</strong> 位订阅者发送周报邮件。
                        </p>
                        <p className="text-muted-foreground mt-2">
                          主题: <strong>{sendForm.subject}</strong>
                        </p>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
                          取消
                        </Button>
                        <Button onClick={handleSendNewsletter} disabled={isSending}>
                          {isSending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          确认发送
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  发送历史
                </CardTitle>
                <CardDescription>最近的周报发送记录</CardDescription>
              </CardHeader>
              <CardContent>
                {newsletterLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    暂无发送记录
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newsletterLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{log.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.sentAt ? new Date(log.sentAt).toLocaleString('zh-CN') : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={log.status === 'completed' ? 'default' : 'secondary'}>
                            {log.status === 'completed' ? '已完成' : log.status === 'sending' ? '发送中' : log.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            成功 {log.successCount} / 失败 {log.failedCount}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 邀请码管理 */}
        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>邀请码</CardTitle>
                  <CardDescription>管理用户订阅周报所需的邀请码</CardDescription>
                </div>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      创建邀请码
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>创建新邀请码</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>备注名称</Label>
                        <Input
                          placeholder="可选，如：内部测试"
                          value={newCode.name}
                          onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>最大使用次数</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0 表示无限制"
                          value={newCode.maxUsage || ''}
                          onChange={(e) => setNewCode({ ...newCode, maxUsage: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>过期时间</Label>
                        <Input
                          type="datetime-local"
                          value={newCode.expiresAt}
                          onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">留空表示永不过期</p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        取消
                      </Button>
                      <Button onClick={handleCreateCode} disabled={isCreating}>
                        {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        创建
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : invitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无邀请码，点击上方按钮创建
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邀请码</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead>使用情况</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>过期时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono bg-muted px-2 py-1 rounded">
                              {inv.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(inv.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{inv.name || '-'}</TableCell>
                        <TableCell>
                          {inv.usageCount}
                          {inv.maxUsage > 0 ? ` / ${inv.maxUsage}` : ' / ∞'}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={inv.isActive}
                            onCheckedChange={(checked) => toggleCodeStatus(inv.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {inv.expiresAt
                            ? new Date(inv.expiresAt).toLocaleString('zh-CN')
                            : '永不过期'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => deleteCode(inv.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 订阅者列表 */}
        <TabsContent value="subscribers">
          <Card>
            <CardHeader>
              <CardTitle>订阅者列表</CardTitle>
              <CardDescription>管理已订阅周报的用户</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : subscribers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  暂无订阅者
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>邮箱</TableHead>
                      <TableHead>称呼</TableHead>
                      <TableHead>邀请码</TableHead>
                      <TableHead>订阅时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell>{sub.email}</TableCell>
                        <TableCell>{sub.name || '-'}</TableCell>
                        <TableCell>
                          {sub.invitation ? (
                            <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                              {sub.invitation.code}
                            </code>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(sub.subscribedAt).toLocaleString('zh-CN')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sub.isActive ? 'default' : 'secondary'}>
                            {sub.isActive ? '已订阅' : '已取消'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={sub.isActive}
                              onCheckedChange={(checked) => toggleSubscriberStatus(sub.id, checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => deleteSubscriber(sub.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
