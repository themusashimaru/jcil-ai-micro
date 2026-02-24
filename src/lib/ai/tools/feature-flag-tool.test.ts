import { describe, it, expect } from 'vitest';
import { executeFeatureFlag, isFeatureFlagAvailable, featureFlagTool } from './feature-flag-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'feature_flag', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeFeatureFlag(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('featureFlagTool metadata', () => {
  it('should have correct name', () => {
    expect(featureFlagTool.name).toBe('feature_flag');
  });

  it('should require operation', () => {
    expect(featureFlagTool.parameters.required).toContain('operation');
  });
});

describe('isFeatureFlagAvailable', () => {
  it('should return true', () => {
    expect(isFeatureFlagAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Design operation
// -------------------------------------------------------------------
describe('executeFeatureFlag - design', () => {
  it('should design a boolean feature flag', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'Dark Mode', type: 'boolean' },
    });
    expect(result.flag.key).toBe('dark_mode');
    expect(result.flag.type).toBe('boolean');
    expect(result.flag.name).toBe('Dark Mode');
  });

  it('should design a percentage rollout flag', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'New Checkout', type: 'percentage' },
    });
    expect(result.flag.type).toBe('percentage');
    expect(result.flag.percentage).toBeDefined();
  });

  it('should design an AB test flag', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'Button Color Test', type: 'ab_test' },
    });
    expect(result.flag.type).toBe('ab_test');
    expect(result.flag.variants).toBeDefined();
  });

  it('should design a user segment flag', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'Premium Feature', type: 'user_segment' },
    });
    expect(result.flag.type).toBe('user_segment');
  });

  it('should design a multivariate flag', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'Pricing Test', type: 'multivariate' },
    });
    expect(result.flag.type).toBe('multivariate');
  });

  it('should normalize flag key from name', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'My Feature! 2.0' },
    });
    expect(result.flag.key).toBe('my_feature_20');
  });

  it('should default to boolean type when not specified', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'Simple Flag' },
    });
    expect(result.flag.type).toBe('boolean');
  });

  it('should use default config when none provided', async () => {
    const result = await getResult({ operation: 'design' });
    // Uses built-in default: "New Checkout Flow" / percentage
    expect(result.flag.type).toBe('percentage');
    expect(result.flag.key).toBeDefined();
  });

  it('should include implementation code', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'Test Feature', type: 'boolean' },
    });
    expect(result.implementation).toBeDefined();
    expect(result.implementation).toContain('isEnabled');
  });

  it('should include lifecycle and best practices', async () => {
    const result = await getResult({
      operation: 'design',
      config: { name: 'My Flag', type: 'boolean' },
    });
    expect(result.lifecycle).toBeDefined();
    expect(result.lifecycle.length).toBeGreaterThan(0);
    expect(result.bestPractices).toBeDefined();
    expect(result.bestPractices.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// SDK generation
// -------------------------------------------------------------------
describe('executeFeatureFlag - sdk', () => {
  it('should generate TypeScript SDK', async () => {
    const result = await getResult({ operation: 'sdk', language: 'typescript' });
    expect(result).toBeDefined();
  });

  it('should generate Python SDK', async () => {
    const result = await getResult({ operation: 'sdk', language: 'python' });
    expect(result).toBeDefined();
  });

  it('should default to TypeScript', async () => {
    const result = await getResult({ operation: 'sdk' });
    expect(result).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Rollout strategy
// -------------------------------------------------------------------
describe('executeFeatureFlag - rollout_strategy', () => {
  it('should generate rollout strategy', async () => {
    const result = await getResult({
      operation: 'rollout_strategy',
      config: {
        flagKey: 'test_flag',
        startPercentage: 5,
        endPercentage: 100,
        steps: 4,
        interval: '1 day',
      },
    });
    expect(result).toBeDefined();
  });

  it('should use default config when none provided', async () => {
    const result = await getResult({ operation: 'rollout_strategy' });
    expect(result).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Evaluate rules
// -------------------------------------------------------------------
describe('executeFeatureFlag - evaluate_rules', () => {
  it('should evaluate targeting rules', async () => {
    const result = await getResult({
      operation: 'evaluate_rules',
      context: {
        userId: 'user123',
        attributes: { plan: 'premium', country: 'US', age: 25 },
        rules: [{ attribute: 'plan', operator: 'equals', value: 'premium', result: true }],
      },
    });
    expect(result).toBeDefined();
  });

  it('should use default context when none provided', async () => {
    const result = await getResult({ operation: 'evaluate_rules' });
    expect(result).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeFeatureFlag - errors', () => {
  it('should handle unknown operation', async () => {
    const res = await executeFeatureFlag(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeFeatureFlag({
      id: 'my-id',
      name: 'feature_flag',
      arguments: { operation: 'design', config: { name: 'Test' } },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
