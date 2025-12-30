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
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { Industry } from '@/lib/db/schema';

interface IndustriesTableProps {
  industries: Industry[];
}

export function IndustriesTable({ industries }: IndustriesTableProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    name: string;
    description: string;
    icon: string;
    color: string;
    keywords: string;
  } | null>(null);

  const handleEdit = (industry: Industry) => {
    setEditingId(industry.id);
    setEditData({
      name: industry.name,
      description: industry.description || '',
      icon: industry.icon || '',
      color: industry.color || '#3B82F6',
      keywords: ((industry.keywords as string[]) || []).join(', '),
    });
  };

  const handleSave = async () => {
    if (!editingId || !editData) return;

    try {
      const response = await fetch(`/api/admin/industries/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editData.name,
          description: editData.description,
          icon: editData.icon,
          color: editData.color,
          keywords: editData.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        toast.success('保存成功');
        setEditingId(null);
        router.refresh();
      } else {
        toast.error('保存失败');
      }
    } catch (error) {
      toast.error('网络错误');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/industries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (response.ok) {
        toast.success(isActive ? '已隐藏' : '已显示');
        router.refresh();
      } else {
        toast.error('操作失败');
      }
    } catch (error) {
      toast.error('网络错误');
    }
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">排序</TableHead>
            <TableHead className="w-16">图标</TableHead>
            <TableHead>名称</TableHead>
            <TableHead>关键词</TableHead>
            <TableHead className="w-24">颜色</TableHead>
            <TableHead className="w-20">显示</TableHead>
            <TableHead className="w-16">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {industries.map((industry) => (
            <TableRow key={industry.id}>
              <TableCell className="text-muted-foreground">
                {industry.sortOrder}
              </TableCell>
              <TableCell>
                <span className="text-2xl">{industry.icon}</span>
              </TableCell>
              <TableCell>
                <div>
                  <div className="font-medium">{industry.name}</div>
                  <div className="text-xs text-muted-foreground">{industry.slug}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {((industry.keywords as string[]) || []).slice(0, 3).map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                  {((industry.keywords as string[]) || []).length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{((industry.keywords as string[]) || []).length - 3}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: industry.color || '#3B82F6' }}
                />
              </TableCell>
              <TableCell>
                <Switch
                  checked={industry.isActive ?? true}
                  onCheckedChange={() =>
                    handleToggleActive(industry.id, industry.isActive ?? true)
                  }
                />
              </TableCell>
              <TableCell>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(industry)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>编辑行业</DialogTitle>
                    </DialogHeader>
                    {editData && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">名称</label>
                            <Input
                              value={editData.name}
                              onChange={(e) =>
                                setEditData({ ...editData, name: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">图标</label>
                            <Input
                              value={editData.icon}
                              onChange={(e) =>
                                setEditData({ ...editData, icon: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">描述</label>
                          <Input
                            value={editData.description}
                            onChange={(e) =>
                              setEditData({ ...editData, description: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">关键词（逗号分隔）</label>
                          <Input
                            value={editData.keywords}
                            onChange={(e) =>
                              setEditData({ ...editData, keywords: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">颜色</label>
                          <div className="flex gap-2">
                            <Input
                              type="color"
                              value={editData.color}
                              onChange={(e) =>
                                setEditData({ ...editData, color: e.target.value })
                              }
                              className="w-16 h-10 p-1"
                            />
                            <Input
                              value={editData.color}
                              onChange={(e) =>
                                setEditData({ ...editData, color: e.target.value })
                              }
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <Button onClick={handleSave} className="w-full">
                          保存
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
