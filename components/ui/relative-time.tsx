'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface RelativeTimeProps {
  date: string | null;
  fallback?: string;
}

export function RelativeTime({ date, fallback = '未知时间' }: RelativeTimeProps) {
  const [displayText, setDisplayText] = useState<string | null>(null);

  useEffect(() => {
    if (date) {
      const formattedDate = formatDistanceToNow(new Date(date), {
        addSuffix: true,
        locale: zhCN,
      });
      setDisplayText(formattedDate);
    }
  }, [date]);

  if (!date) {
    return <span>{fallback}</span>;
  }

  // Use suppressHydrationWarning since content intentionally differs
  return (
    <span suppressHydrationWarning>
      {displayText || fallback}
    </span>
  );
}
