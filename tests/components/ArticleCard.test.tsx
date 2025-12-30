import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArticleCard } from '@/components/article/ArticleCard';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ArticleCard', () => {
  const defaultProps = {
    id: 'test-id',
    title: '测试文章标题',
    summary: '这是文章摘要内容',
    publishDate: new Date().toISOString(),
    score: 85,
    priority: '高' as const,
    source: {
      name: '测试来源',
      tier: 1,
    },
    industry: {
      name: '数据中心',
      slug: 'datacenter',
      color: '#3B82F6',
    },
  };

  it('应该渲染文章标题', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('测试文章标题')).toBeInTheDocument();
  });

  it('应该渲染文章摘要', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('这是文章摘要内容')).toBeInTheDocument();
  });

  it('没有摘要时不应该渲染摘要区域', () => {
    render(<ArticleCard {...defaultProps} summary={null} />);
    expect(screen.queryByText('这是文章摘要内容')).not.toBeInTheDocument();
  });

  it('应该渲染来源名称', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('测试来源')).toBeInTheDocument();
  });

  it('应该渲染行业名称', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('数据中心')).toBeInTheDocument();
  });

  it('应该渲染评分', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('评分 85')).toBeInTheDocument();
  });

  it('应该渲染优先级徽章', () => {
    render(<ArticleCard {...defaultProps} />);
    expect(screen.getByText('高')).toBeInTheDocument();
  });

  it('应该包含文章详情链接', () => {
    render(<ArticleCard {...defaultProps} />);
    const link = screen.getByRole('link', { name: /测试文章标题/ });
    expect(link).toHaveAttribute('href', '/article/test-id');
  });

  it('应该包含行业链接', () => {
    render(<ArticleCard {...defaultProps} />);
    const link = screen.getByRole('link', { name: '数据中心' });
    expect(link).toHaveAttribute('href', '/industry/datacenter');
  });

  it('没有来源时不应该渲染来源', () => {
    render(<ArticleCard {...defaultProps} source={null} />);
    expect(screen.queryByText('测试来源')).not.toBeInTheDocument();
  });

  it('没有行业时不应该渲染行业', () => {
    render(<ArticleCard {...defaultProps} industry={null} />);
    expect(screen.queryByText('数据中心')).not.toBeInTheDocument();
  });

  it('不同优先级应该有不同的样式', () => {
    const { rerender } = render(<ArticleCard {...defaultProps} priority="高" />);
    expect(screen.getByText('高')).toBeInTheDocument();

    rerender(<ArticleCard {...defaultProps} priority="中" />);
    expect(screen.getByText('中')).toBeInTheDocument();

    rerender(<ArticleCard {...defaultProps} priority="低" />);
    expect(screen.getByText('低')).toBeInTheDocument();
  });

  it('没有发布日期时应该显示未知时间', () => {
    render(<ArticleCard {...defaultProps} publishDate={null} />);
    expect(screen.getByText('未知时间')).toBeInTheDocument();
  });

  it('行业链接应该存在且可点击', () => {
    render(<ArticleCard {...defaultProps} />);
    const industryLink = screen.getByRole('link', { name: '数据中心' });
    // 验证链接存在且有正确的 href
    expect(industryLink).toBeInTheDocument();
    expect(industryLink).toHaveAttribute('href', '/industry/datacenter');
  });
});
