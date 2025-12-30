'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Rss,
  Building2,
  FileText,
  Settings,
  ScrollText,
  Mail,
} from 'lucide-react';

const menuItems = [
  {
    title: '仪表盘',
    href: '/admin',
    icon: LayoutDashboard,
  },
  {
    title: '数据源管理',
    href: '/admin/sources',
    icon: Rss,
  },
  {
    title: '行业管理',
    href: '/admin/industries',
    icon: Building2,
  },
  {
    title: '内容管理',
    href: '/admin/articles',
    icon: FileText,
  },
  {
    title: '采集日志',
    href: '/admin/logs',
    icon: ScrollText,
  },
  {
    title: '周报管理',
    href: '/admin/newsletter',
    icon: Mail,
  },
  {
    title: '系统设置',
    href: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-[calc(100vh-3.5rem)] border-r bg-background">
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
