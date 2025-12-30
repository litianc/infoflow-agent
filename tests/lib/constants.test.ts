import { describe, it, expect } from 'vitest';
import {
  INDUSTRY_COLORS,
  DEFAULT_INDUSTRIES,
  DEFAULT_SCORE_WEIGHTS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SOURCE_TIER_LABELS,
} from '@/lib/constants';

describe('INDUSTRY_COLORS', () => {
  it('应该包含所有行业的颜色配置', () => {
    const expectedIndustries = [
      'datacenter',
      'cloud',
      'ai-computing',
      'semiconductor',
      'network',
      'policy',
      'investment',
    ];

    expectedIndustries.forEach((industry) => {
      expect(INDUSTRY_COLORS).toHaveProperty(industry);
      expect(INDUSTRY_COLORS[industry as keyof typeof INDUSTRY_COLORS]).toMatch(
        /^#[0-9A-Fa-f]{6}$/
      );
    });
  });

  it('应该有 7 个行业颜色', () => {
    expect(Object.keys(INDUSTRY_COLORS)).toHaveLength(7);
  });
});

describe('DEFAULT_INDUSTRIES', () => {
  it('应该包含 7 个默认行业', () => {
    expect(DEFAULT_INDUSTRIES).toHaveLength(7);
  });

  it('每个行业应该有完整的属性', () => {
    DEFAULT_INDUSTRIES.forEach((industry) => {
      expect(industry).toHaveProperty('name');
      expect(industry).toHaveProperty('slug');
      expect(industry).toHaveProperty('description');
      expect(industry).toHaveProperty('icon');
      expect(industry).toHaveProperty('color');
      expect(industry).toHaveProperty('keywords');
      expect(industry).toHaveProperty('weight');
      expect(industry).toHaveProperty('sortOrder');
    });
  });

  it('slug 应该唯一', () => {
    const slugs = DEFAULT_INDUSTRIES.map((i) => i.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });

  it('sortOrder 应该从 1 开始递增', () => {
    const sortOrders = DEFAULT_INDUSTRIES.map((i) => i.sortOrder);
    expect(sortOrders).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('每个行业应该有至少 3 个关键词', () => {
    DEFAULT_INDUSTRIES.forEach((industry) => {
      expect(industry.keywords.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('应该包含数据中心行业', () => {
    const datacenter = DEFAULT_INDUSTRIES.find((i) => i.slug === 'datacenter');
    expect(datacenter).toBeDefined();
    expect(datacenter?.name).toBe('数据中心');
    expect(datacenter?.keywords).toContain('IDC');
  });
});

describe('DEFAULT_SCORE_WEIGHTS', () => {
  it('权重总和应该为 100', () => {
    const total =
      DEFAULT_SCORE_WEIGHTS.relevance +
      DEFAULT_SCORE_WEIGHTS.timeliness +
      DEFAULT_SCORE_WEIGHTS.impact +
      DEFAULT_SCORE_WEIGHTS.credibility;
    expect(total).toBe(100);
  });

  it('应该有四个维度', () => {
    expect(DEFAULT_SCORE_WEIGHTS).toHaveProperty('relevance');
    expect(DEFAULT_SCORE_WEIGHTS).toHaveProperty('timeliness');
    expect(DEFAULT_SCORE_WEIGHTS).toHaveProperty('impact');
    expect(DEFAULT_SCORE_WEIGHTS).toHaveProperty('credibility');
  });

  it('相关性权重应该最高', () => {
    expect(DEFAULT_SCORE_WEIGHTS.relevance).toBeGreaterThan(
      DEFAULT_SCORE_WEIGHTS.timeliness
    );
    expect(DEFAULT_SCORE_WEIGHTS.relevance).toBeGreaterThan(
      DEFAULT_SCORE_WEIGHTS.impact
    );
    expect(DEFAULT_SCORE_WEIGHTS.relevance).toBeGreaterThan(
      DEFAULT_SCORE_WEIGHTS.credibility
    );
  });

  it('每个权重应该是正数', () => {
    Object.values(DEFAULT_SCORE_WEIGHTS).forEach((weight) => {
      expect(weight).toBeGreaterThan(0);
    });
  });
});

describe('分页常量', () => {
  it('DEFAULT_PAGE_SIZE 应该是合理的值', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_PAGE_SIZE).toBeLessThanOrEqual(MAX_PAGE_SIZE);
  });

  it('MAX_PAGE_SIZE 应该大于 DEFAULT_PAGE_SIZE', () => {
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(MAX_PAGE_SIZE).toBeGreaterThan(DEFAULT_PAGE_SIZE);
  });
});

describe('SOURCE_TIER_LABELS', () => {
  it('应该有三个级别', () => {
    expect(Object.keys(SOURCE_TIER_LABELS)).toHaveLength(3);
  });

  it('每个级别应该有描述性标签', () => {
    expect(SOURCE_TIER_LABELS[1]).toContain('Tier 1');
    expect(SOURCE_TIER_LABELS[2]).toContain('Tier 2');
    expect(SOURCE_TIER_LABELS[3]).toContain('Tier 3');
  });

  it('Tier 1 应该表示权威来源', () => {
    expect(SOURCE_TIER_LABELS[1]).toMatch(/官方|权威/);
  });
});
