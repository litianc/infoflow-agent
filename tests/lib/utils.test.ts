import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (className utility)', () => {
  it('应该合并多个类名', () => {
    const result = cn('class1', 'class2', 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('应该处理条件类名', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', isActive && 'active', isDisabled && 'disabled');
    expect(result).toBe('base active');
  });

  it('应该合并 Tailwind 冲突类', () => {
    // tailwind-merge 应该处理冲突的类
    const result = cn('px-2', 'px-4');
    expect(result).toBe('px-4');
  });

  it('应该处理数组形式的类名', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('应该处理对象形式的类名', () => {
    const result = cn({ active: true, disabled: false, hidden: true });
    expect(result).toBe('active hidden');
  });

  it('应该处理空值和 undefined', () => {
    const result = cn('base', null, undefined, '', 'end');
    expect(result).toBe('base end');
  });

  it('应该正确合并背景色类', () => {
    const result = cn('bg-red-500', 'bg-blue-500');
    expect(result).toBe('bg-blue-500');
  });

  it('应该正确合并 padding 类', () => {
    const result = cn('p-2', 'p-4', 'px-6');
    expect(result).toBe('p-4 px-6');
  });
});
