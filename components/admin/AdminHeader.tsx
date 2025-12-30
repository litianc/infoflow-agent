'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogOut, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export function AdminHeader() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/auth', { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        toast.success('已退出登录');
        router.push('/admin/login');
        router.refresh();
      }
    } catch (error) {
      toast.error('退出失败');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <span className="font-bold">行业情报平台 - 管理后台</span>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/" target="_blank">
            <Button variant="ghost" size="sm">
              查看前台
            </Button>
          </Link>
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
