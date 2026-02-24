import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"failures": []}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

import { IntentFailureMapper } from './intent-failure-mapper';

describe('IntentFailureMapper', () => {
  it('should be exported as a class', () => {
    expect(IntentFailureMapper).toBeDefined();
    expect(typeof IntentFailureMapper).toBe('function');
  });

  it('should create an instance', () => {
    const mapper = new IntentFailureMapper();
    expect(mapper).toBeInstanceOf(IntentFailureMapper);
  });

  it('should have a mapIntentToFailures method', () => {
    const mapper = new IntentFailureMapper();
    expect(typeof mapper.mapIntentToFailures).toBe('function');
  });
});
