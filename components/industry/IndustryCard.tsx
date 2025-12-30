import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface IndustryCardProps {
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  articleCount: number;
  todayCount?: number;
}

export function IndustryCard({
  name,
  slug,
  description,
  icon,
  color,
  articleCount,
  todayCount = 0,
}: IndustryCardProps) {
  return (
    <Link href={`/industry/${slug}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{icon || '📰'}</span>
              <CardTitle className="text-lg group-hover:text-primary transition-colors">
                {name}
              </CardTitle>
            </div>
            {todayCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                +{todayCount} 今日
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {description || '暂无描述'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{articleCount} 篇文章</span>
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color || '#3B82F6' }}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
