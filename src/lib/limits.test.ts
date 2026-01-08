/**
 * USAGE LIMITS TESTS
 *
 * Tests for token and image usage limits by subscription tier
 */

import { describe, it, expect } from 'vitest';
import {
  getTokenLimit,
  getImageLimit,
  formatTokenCount,
  getTokenLimitWarningMessage,
  getImageLimitWarningMessage,
} from './limits';
import type { TokenUsageResult, ImageUsageResult } from './limits';

describe('getTokenLimit', () => {
  it('returns correct limit for free tier', () => {
    expect(getTokenLimit('free')).toBe(10_000);
  });

  it('returns correct limit for plus tier', () => {
    expect(getTokenLimit('plus')).toBe(1_000_000);
  });

  it('returns correct limit for basic tier (legacy)', () => {
    expect(getTokenLimit('basic')).toBe(1_000_000);
  });

  it('returns correct limit for pro tier', () => {
    expect(getTokenLimit('pro')).toBe(3_000_000);
  });

  it('returns correct limit for executive tier', () => {
    expect(getTokenLimit('executive')).toBe(5_000_000);
  });

  it('returns free tier limit for unknown plans', () => {
    expect(getTokenLimit('unknown')).toBe(10_000);
    expect(getTokenLimit('')).toBe(10_000);
  });
});

describe('getImageLimit', () => {
  it('returns correct limit for free tier', () => {
    expect(getImageLimit('free')).toBe(5);
  });

  it('returns correct limit for plus tier', () => {
    expect(getImageLimit('plus')).toBe(20);
  });

  it('returns correct limit for pro tier', () => {
    expect(getImageLimit('pro')).toBe(50);
  });

  it('returns correct limit for executive tier', () => {
    expect(getImageLimit('executive')).toBe(100);
  });

  it('returns free tier limit for unknown plans', () => {
    expect(getImageLimit('unknown')).toBe(5);
  });
});

describe('formatTokenCount', () => {
  it('formats millions correctly', () => {
    expect(formatTokenCount(1_000_000)).toBe('1.0M');
    expect(formatTokenCount(3_500_000)).toBe('3.5M');
  });

  it('formats thousands correctly', () => {
    expect(formatTokenCount(1_000)).toBe('1K');
    expect(formatTokenCount(10_000)).toBe('10K');
    expect(formatTokenCount(500_000)).toBe('500K');
  });

  it('formats small numbers correctly', () => {
    expect(formatTokenCount(100)).toBe('100');
    expect(formatTokenCount(999)).toBe('999');
  });

  it('handles zero', () => {
    expect(formatTokenCount(0)).toBe('0');
  });
});

describe('getTokenLimitWarningMessage', () => {
  it('returns null when under 80%', () => {
    const usage: TokenUsageResult = {
      used: 500_000,
      limit: 1_000_000,
      remaining: 500_000,
      warn: false,
      stop: false,
      percentage: 50,
    };
    expect(getTokenLimitWarningMessage(usage)).toBeNull();
  });

  it('returns warning at 80%', () => {
    const usage: TokenUsageResult = {
      used: 800_000,
      limit: 1_000_000,
      remaining: 200_000,
      warn: true,
      stop: false,
      percentage: 80,
    };
    const message = getTokenLimitWarningMessage(usage);
    expect(message).toContain('80%');
    expect(message).toContain('200K remaining');
  });

  it('returns stop message at limit', () => {
    const usage: TokenUsageResult = {
      used: 1_000_001,
      limit: 1_000_000,
      remaining: 0,
      warn: false,
      stop: true,
      percentage: 100,
    };
    const message = getTokenLimitWarningMessage(usage);
    expect(message).toContain('reached your monthly token limit');
  });

  it('returns free trial message for free users', () => {
    const usage: TokenUsageResult = {
      used: 10_001,
      limit: 10_000,
      remaining: 0,
      warn: false,
      stop: true,
      percentage: 100,
    };
    const message = getTokenLimitWarningMessage(usage, true);
    expect(message).toContain('free trial tokens');
    expect(message).toContain('50% OFF');
  });

  it('returns free trial warning for free users at 80%', () => {
    const usage: TokenUsageResult = {
      used: 8_000,
      limit: 10_000,
      remaining: 2_000,
      warn: true,
      stop: false,
      percentage: 80,
    };
    const message = getTokenLimitWarningMessage(usage, true);
    expect(message).toContain('almost out of free trial');
    expect(message).toContain('2K remaining');
  });
});

describe('getImageLimitWarningMessage', () => {
  it('returns null when under 80%', () => {
    const usage: ImageUsageResult = {
      used: 10,
      limit: 50,
      remaining: 40,
      warn: false,
      stop: false,
      percentage: 20,
    };
    expect(getImageLimitWarningMessage(usage)).toBeNull();
  });

  it('returns warning at 80%', () => {
    const usage: ImageUsageResult = {
      used: 40,
      limit: 50,
      remaining: 10,
      warn: true,
      stop: false,
      percentage: 80,
    };
    const message = getImageLimitWarningMessage(usage);
    expect(message).toContain('80%');
    expect(message).toContain('10 images remaining');
  });

  it('returns stop message at limit', () => {
    const usage: ImageUsageResult = {
      used: 51,
      limit: 50,
      remaining: 0,
      warn: false,
      stop: true,
      percentage: 102,
    };
    const message = getImageLimitWarningMessage(usage);
    expect(message).toContain('reached your monthly limit');
  });

  it('returns unavailable message when limit is 0', () => {
    const usage: ImageUsageResult = {
      used: 0,
      limit: 0,
      remaining: 0,
      warn: false,
      stop: true,
      percentage: 0,
    };
    const message = getImageLimitWarningMessage(usage);
    expect(message).toContain('not available on your current plan');
  });
});
