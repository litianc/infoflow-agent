'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface RelativeTimeProps {
  date: string | null;
  fallback?: string;
}

export function RelativeTime({ date, fallback = '未知时间' }: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!date) {
    return <span>{fallback}</span>;
  }

  // Server-side and initial client render: show static date format
  if (!mounted) {
    const dateObj = new Date(date);
    return <span>{format(dateObj, 'MM-dd', { locale: zhCN })}</span>;
  }

  // Client-side after mount: show relative time
  const formattedDate = formatDistanceToNow(new Date(date), {
    addSuffix: true,
    locale: zhCN,
  });

  return <span>{formattedDate}</span>;
}
