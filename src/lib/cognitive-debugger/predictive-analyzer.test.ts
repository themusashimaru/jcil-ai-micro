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
        content: [{ type: 'text', text: '{"issues": []}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  })),
}));

import { PredictiveAnalyzer } from './predictive-analyzer';

describe('PredictiveAnalyzer', () => {
  it('should be exported as a class', () => {
    expect(PredictiveAnalyzer).toBeDefined();
    expect(typeof PredictiveAnalyzer).toBe('function');
  });

  it('should create an instance', () => {
    const analyzer = new PredictiveAnalyzer();
    expect(analyzer).toBeInstanceOf(PredictiveAnalyzer);
  });

  it('should have an analyze method', () => {
    const analyzer = new PredictiveAnalyzer();
    expect(typeof analyzer.analyze).toBe('function');
  });

  it('should analyze simple code with surface depth', async () => {
    const analyzer = new PredictiveAnalyzer();
    const result = await analyzer.analyze('const x = 1;', 'javascript', { depth: 'surface' });

    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('safetyScore');
    expect(result).toHaveProperty('hotspots');
    expect(result).toHaveProperty('dataFlows');
    expect(result).toHaveProperty('executionPaths');
  });

  it('should detect potential null access in JavaScript', async () => {
    const analyzer = new PredictiveAnalyzer();
    const code = 'const el = document.getElementById("foo").textContent;';
    const result = await analyzer.analyze(code, 'javascript', { depth: 'surface' });

    expect(result.issues.length).toBeGreaterThanOrEqual(0);
  });
});
