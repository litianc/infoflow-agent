import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ArticleCardProps {
  id: string;
  title: string;
  summary: string | null;
  publishDate: string | null;
  score: number;
  priority: string;
  source?: {
    name: string;
    tier: number;
  } | null;
  industry?: {
    name: string;
    slug: string;
    color: string;
  } | null;
}

export function ArticleCard({
  id,
  title,
  summary,
  publishDate,
  score,
  priority,
  source,
  industry,
}: ArticleCardProps) {
  const priorityColor = {
    '高': 'destructive',
    '中': 'secondary',
    '低': 'outline',
  }[priority] || 'secondary';

  const formattedDate = publishDate
    ? formatDistanceToNow(new Date(publishDate), {
        addSuffix: true,
        locale: zhCN,
      })
    : '未知时间';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/article/${id}`} className="flex-1">
            <CardTitle className="text-base font-medium leading-tight hover:text-primary transition-colors line-clamp-2">
              {title}
            </CardTitle>
          </Link>
          <Badge variant={priorityColor as 'destructive' | 'secondary' | 'outline'} className="shrink-0">
            {priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {summary && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {summary}
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-2">
            {source && <span>{source.name}</span>}
            {industry && (
              <>
                <span>·</span>
                <Link
                  href={`/industry/${industry.slug}`}
                  className="hover:text-foreground transition-colors"
                  style={{ color: industry.color }}
                >
                  {industry.name}
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span>{formattedDate}</span>
            <span>·</span>
            <span>评分 {score}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
