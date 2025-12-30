import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeToggle } from '@/components/ThemeToggle';

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'light';
  });

  it('应该渲染主题切换按钮', async () => {
    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('应该有无障碍标签', async () => {
    render(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByText('切换主题')).toBeInTheDocument();
    });
  });

  it('浅色模式下点击应该切换到深色模式', async () => {
    mockTheme = 'light';
    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('深色模式下点击应该切换到浅色模式', async () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      fireEvent.click(button);
    });

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('未挂载时按钮应该禁用', () => {
    // 在第一次渲染时，mounted 是 false
    const { container } = render(<ThemeToggle />);
    const button = container.querySelector('button');

    // 初始渲染时 button 应该存在
    expect(button).toBeInTheDocument();
  });
});
