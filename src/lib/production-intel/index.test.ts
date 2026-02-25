import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                correlation: true,
                confidence: 0.8,
                explanation: 'The deployment introduced a breaking change',
                suggestedFix: 'Revert the change to line 42',
                affectedArea: 'authentication',
              }),
            },
          ],
        }),
      },
    })),
  };
});

import { ProductionIntelligence, getProductionIntelligence } from './index';
import type {
  ProductionError,
  Deployment,
  ProductionMetric,
  ProductionInsight,
  ProductionContext,
} from './index';

// ----- Test data factories -----
function makeError(overrides: Partial<ProductionError> = {}): ProductionError {
  return {
    id: 'err_1',
    message: 'TypeError: Cannot read property of undefined',
    timestamp: new Date(),
    count: 10,
    affectedUsers: 5,
    severity: 'high',
    firstSeen: new Date(),
    lastSeen: new Date(),
    ...overrides,
  };
}

function makeDeployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    id: 'dep_1',
    commit: 'abc123',
    branch: 'main',
    author: 'dev',
    message: 'Add auth feature',
    timestamp: new Date(Date.now() - 3600000),
    changedFiles: ['src/auth.ts'],
    status: 'success',
    ...overrides,
  };
}

function makeMetric(overrides: Partial<ProductionMetric> = {}): ProductionMetric {
  return {
    name: 'response_time',
    value: 250,
    unit: 'ms',
    trend: 'stable',
    ...overrides,
  };
}

function makeContext(overrides: Partial<ProductionContext> = {}): ProductionContext {
  return {
    errors: [makeError()],
    deployments: [makeDeployment()],
    metrics: [makeMetric()],
    timeRange: {
      start: new Date(Date.now() - 86400000),
      end: new Date(),
    },
    ...overrides,
  };
}

describe('ProductionIntelligence', () => {
  let intel: ProductionIntelligence;

  beforeEach(() => {
    vi.clearAllMocks();
    intel = new ProductionIntelligence();
  });

  // ----- Type exports -----
  describe('Type exports', () => {
    it('should export ProductionError shape', () => {
      const err: ProductionError = makeError();
      expect(err.id).toBe('err_1');
    });

    it('should export Deployment shape', () => {
      const dep: Deployment = makeDeployment();
      expect(dep.status).toBe('success');
    });

    it('should export ProductionMetric shape', () => {
      const m: ProductionMetric = makeMetric({ anomaly: true });
      expect(m.anomaly).toBe(true);
    });

    it('should export ProductionInsight shape', () => {
      const insight: ProductionInsight = {
        type: 'error_spike',
        title: 'Spike',
        description: 'Errors spiked',
        severity: 'high',
        affectedArea: 'api',
        confidence: 0.9,
      };
      expect(insight.type).toBe('error_spike');
    });
  });

  // ----- Singleton -----
  describe('getProductionIntelligence', () => {
    it('should return a ProductionIntelligence instance', () => {
      const instance = getProductionIntelligence();
      expect(instance).toBeInstanceOf(ProductionIntelligence);
    });

    it('should return the same instance', () => {
      const a = getProductionIntelligence();
      const b = getProductionIntelligence();
      expect(a).toBe(b);
    });
  });

  // ----- detectErrorSpikes -----
  describe('error spike detection', () => {
    it('should detect error spike when latest count >> average', async () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);
      const twoHoursAgo = new Date(now.getTime() - 7200000);

      const errors: ProductionError[] = [
        makeError({ timestamp: twoHoursAgo, count: 2 }),
        makeError({ timestamp: hourAgo, count: 3 }),
        makeError({ timestamp: now, count: 50 }), // spike
      ];

      const context = makeContext({ errors });
      const insights = await intel.analyzeProduction(context);
      const spikes = insights.filter((i) => i.type === 'error_spike');
      expect(spikes.length).toBeGreaterThan(0);
    });

    it('should not detect spike when errors are normal', async () => {
      const now = new Date();
      const errors = [
        makeError({ timestamp: new Date(now.getTime() - 3600000), count: 5 }),
        makeError({ timestamp: now, count: 5 }),
      ];

      const context = makeContext({ errors, deployments: [] });
      const insights = await intel.analyzeProduction(context);
      const spikes = insights.filter((i) => i.type === 'error_spike');
      expect(spikes).toHaveLength(0);
    });
  });

  // ----- detectRegressions -----
  describe('regression detection', () => {
    it('should correlate errors with deployments', async () => {
      vi.resetModules();
      vi.doMock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: {
            create: vi.fn().mockResolvedValue({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    correlation: true,
                    confidence: 0.8,
                    explanation: 'The deployment introduced a breaking change',
                    suggestedFix: 'Revert the change',
                    affectedArea: 'authentication',
                  }),
                },
              ],
            }),
          },
        })),
      }));

      const { ProductionIntelligence: ProdIntel } = await import('./index');
      const i = new ProdIntel();

      const deployTime = new Date(Date.now() - 1000);
      const deployment = makeDeployment({ timestamp: deployTime });
      const error = makeError({
        firstSeen: new Date(deployTime.getTime() + 100),
        count: 10,
      });

      const context = makeContext({
        errors: [error],
        deployments: [deployment],
      });

      const insights = await i.analyzeProduction(context);
      const regressions = insights.filter((ins: ProductionInsight) => ins.type === 'regression');
      expect(regressions.length).toBeGreaterThan(0);
      expect(regressions[0].relatedDeployment).toBeDefined();
    });

    it('should skip errors that predate the deployment', async () => {
      const deployment = makeDeployment({ timestamp: new Date() });
      const error = makeError({
        firstSeen: new Date(Date.now() - 86400000), // day before
        count: 10,
      });

      const context = makeContext({
        errors: [error],
        deployments: [deployment],
      });

      const insights = await intel.analyzeProduction(context);
      const regressions = insights.filter((i) => i.type === 'regression');
      expect(regressions).toHaveLength(0);
    });
  });

  // ----- analyzePerformance -----
  describe('performance analysis', () => {
    it('should flag anomalous metrics', async () => {
      const metrics: ProductionMetric[] = [
        makeMetric({ name: 'p99_latency', value: 1500, unit: 'ms', anomaly: true }),
      ];

      const context = makeContext({ metrics, errors: [], deployments: [] });
      const insights = await intel.analyzeProduction(context);
      const perfIssues = insights.filter((i) => i.type === 'performance');
      expect(perfIssues.length).toBeGreaterThan(0);
      expect(perfIssues[0].severity).toBe('critical');
    });

    it('should flag error-related anomalies as high severity', async () => {
      const metrics: ProductionMetric[] = [
        makeMetric({ name: 'error_rate', value: 15, unit: '%', trend: 'up', anomaly: true }),
      ];

      const context = makeContext({ metrics, errors: [], deployments: [] });
      const insights = await intel.analyzeProduction(context);
      const perfIssues = insights.filter((i) => i.type === 'performance');
      expect(perfIssues.some((p) => p.severity === 'high')).toBe(true);
    });

    it('should not flag non-anomalous metrics', async () => {
      const metrics = [makeMetric({ anomaly: false })];
      const context = makeContext({ metrics, errors: [], deployments: [] });
      const insights = await intel.analyzeProduction(context);
      const perfIssues = insights.filter((i) => i.type === 'performance');
      expect(perfIssues).toHaveLength(0);
    });
  });

  // ----- generatePredictions -----
  describe('AI predictions', () => {
    it('should include AI-generated predictions', async () => {
      vi.resetModules();
      vi.doMock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: {
            create: vi
              .fn()
              .mockResolvedValueOnce({
                content: [
                  { type: 'text', text: JSON.stringify({ correlation: false, confidence: 0.2 }) },
                ],
              })
              .mockResolvedValueOnce({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify([
                      {
                        type: 'prediction',
                        title: 'Memory issue',
                        description: 'Memory usage trending up',
                        severity: 'medium',
                        affectedArea: 'server',
                        confidence: 0.7,
                      },
                    ]),
                  },
                ],
              }),
          },
        })),
      }));

      const { ProductionIntelligence: ProdIntel } = await import('./index');
      const i = new ProdIntel();
      const insights = await i.analyzeProduction(makeContext());
      const predictions = insights.filter((ins: ProductionInsight) => ins.type === 'prediction');
      expect(predictions.length).toBeGreaterThan(0);
    });

    it('should filter low-confidence predictions', async () => {
      vi.resetModules();
      vi.doMock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: {
            create: vi.fn().mockResolvedValue({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify([
                    {
                      type: 'prediction',
                      title: 'Low',
                      description: 'Low confidence',
                      severity: 'low',
                      affectedArea: 'x',
                      confidence: 0.3,
                    },
                  ]),
                },
              ],
            }),
          },
        })),
      }));

      const { ProductionIntelligence: ProdIntel } = await import('./index');
      const i = new ProdIntel();
      const insights = await i.analyzeProduction(makeContext({ errors: [], deployments: [] }));
      const predictions = insights.filter((ins: ProductionInsight) => ins.type === 'prediction');
      expect(predictions).toHaveLength(0);
    });
  });

  // ----- generateProductionFix -----
  describe('generateProductionFix', () => {
    it('should generate a fix for a production error', async () => {
      vi.resetModules();
      vi.doMock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: {
            create: vi.fn().mockResolvedValue({
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    diagnosis: 'Null reference in user handler',
                    fix: 'if (user) { user.name }',
                    testing: 'Add unit test for null user case',
                    rollbackPlan: 'Revert commit abc123',
                  }),
                },
              ],
            }),
          },
        })),
      }));

      const { ProductionIntelligence: ProdIntel } = await import('./index');
      const i = new ProdIntel();
      const fix = await i.generateProductionFix(makeError(), 'const name = user.name;');
      expect(fix.diagnosis).toBeDefined();
      expect(fix.fix).toBeDefined();
      expect(fix.testing).toBeDefined();
      expect(fix.rollbackPlan).toBeDefined();
    });

    it('should return fallback on parse error', async () => {
      vi.resetModules();
      vi.doMock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: {
            create: vi.fn().mockResolvedValue({
              content: [{ type: 'text', text: 'not json' }],
            }),
          },
        })),
      }));

      const { ProductionIntelligence: ProdIntel } = await import('./index');
      const i = new ProdIntel();
      const fix = await i.generateProductionFix(makeError());
      expect(fix.diagnosis).toBe('Unable to diagnose');
      expect(fix.rollbackPlan).toContain('Revert');
    });
  });

  // ----- generateHealthReport -----
  describe('generateHealthReport', () => {
    it('should generate a markdown health report', async () => {
      const report = await intel.generateHealthReport(makeContext());
      expect(report).toContain('Production Health Report');
      expect(report).toContain('Summary');
      expect(report).toContain('Metrics');
    });

    it('should include insight details when issues exist', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({ correlation: false, confidence: 0.2 }),
                  },
                ],
              }),
            },
          }) as never
      );

      const i = new ProductionIntelligence();
      const context = makeContext({
        metrics: [makeMetric({ name: 'p99_latency', value: 2000, unit: 'ms', anomaly: true })],
      });
      const report = await i.generateHealthReport(context);
      expect(report).toContain('Issues & Insights');
    });
  });

  // ----- Sorting -----
  describe('insight sorting', () => {
    it('should sort insights by severity (critical first)', async () => {
      const context = makeContext({
        metrics: [
          makeMetric({ name: 'p99', value: 2000, unit: 'ms', anomaly: true }),
          makeMetric({ name: 'error_rate', value: 10, unit: '%', trend: 'up', anomaly: true }),
        ],
      });
      const insights = await intel.analyzeProduction(context);
      if (insights.length > 1) {
        const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 1; i < insights.length; i++) {
          expect(severityOrder[insights[i - 1].severity]).toBeLessThanOrEqual(
            severityOrder[insights[i].severity]
          );
        }
      }
    });
  });
});
