import { describe, it, expect } from 'vitest';
import {
  CLAUDE_OPUS_46,
  CLAUDE_SONNET_46,
  CLAUDE_HAIKU_45,
  MODEL_CONFIGS,
  DEFAULT_LIMITS,
  BRAVE_COST_PER_QUERY,
  FORENSIC_INTAKE_PROMPT,
  MASTER_ARCHITECT_PROMPT,
  QUALITY_CONTROL_PROMPT,
  PROJECT_MANAGER_PROMPT,
  SCOUT_PROMPT,
  FINAL_SYNTHESIS_PROMPT,
  SYNTHESIZER_PROMPT,
} from './constants';

describe('Model IDs', () => {
  it('should have default Opus model ID', () => {
    expect(CLAUDE_OPUS_46).toContain('opus');
  });

  it('should have default Sonnet model ID', () => {
    expect(CLAUDE_SONNET_46).toContain('sonnet');
  });

  it('should have default Haiku model ID', () => {
    expect(CLAUDE_HAIKU_45).toContain('haiku');
  });
});

describe('MODEL_CONFIGS', () => {
  it('should have opus, sonnet, and haiku configs', () => {
    expect(MODEL_CONFIGS).toHaveProperty('opus');
    expect(MODEL_CONFIGS).toHaveProperty('sonnet');
    expect(MODEL_CONFIGS).toHaveProperty('haiku');
  });

  it('should have correct fields for each config', () => {
    for (const key of ['opus', 'sonnet', 'haiku']) {
      const config = MODEL_CONFIGS[key];
      expect(config).toHaveProperty('id');
      expect(config).toHaveProperty('tier');
      expect(config).toHaveProperty('costPerMillionInput');
      expect(config).toHaveProperty('costPerMillionOutput');
      expect(config).toHaveProperty('maxTokens');
      expect(config).toHaveProperty('description');
    }
  });

  it('should have opus as the most expensive', () => {
    expect(MODEL_CONFIGS.opus.costPerMillionInput).toBeGreaterThan(
      MODEL_CONFIGS.sonnet.costPerMillionInput
    );
    expect(MODEL_CONFIGS.sonnet.costPerMillionInput).toBeGreaterThan(
      MODEL_CONFIGS.haiku.costPerMillionInput
    );
  });

  it('should have positive maxTokens', () => {
    for (const key of ['opus', 'sonnet', 'haiku']) {
      expect(MODEL_CONFIGS[key].maxTokens).toBeGreaterThan(0);
    }
  });
});

describe('DEFAULT_LIMITS', () => {
  it('should have all required fields', () => {
    expect(DEFAULT_LIMITS).toHaveProperty('maxBudget');
    expect(DEFAULT_LIMITS).toHaveProperty('maxScouts');
    expect(DEFAULT_LIMITS).toHaveProperty('maxSearches');
    expect(DEFAULT_LIMITS).toHaveProperty('maxTimeMinutes');
    expect(DEFAULT_LIMITS).toHaveProperty('maxDepth');
    expect(DEFAULT_LIMITS).toHaveProperty('maxConcurrentCalls');
    expect(DEFAULT_LIMITS).toHaveProperty('batchDelayMs');
    expect(DEFAULT_LIMITS).toHaveProperty('minConfidenceScore');
    expect(DEFAULT_LIMITS).toHaveProperty('maxErrorRate');
  });

  it('should have reasonable maxBudget', () => {
    expect(DEFAULT_LIMITS.maxBudget).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxBudget).toBeLessThanOrEqual(100);
  });

  it('should have maxScouts between 1 and 1000', () => {
    expect(DEFAULT_LIMITS.maxScouts).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxScouts).toBeLessThanOrEqual(1000);
  });

  it('should have confidence score between 0 and 1', () => {
    expect(DEFAULT_LIMITS.minConfidenceScore).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.minConfidenceScore).toBeLessThanOrEqual(1);
  });

  it('should have error rate between 0 and 1', () => {
    expect(DEFAULT_LIMITS.maxErrorRate).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxErrorRate).toBeLessThanOrEqual(1);
  });
});

describe('BRAVE_COST_PER_QUERY', () => {
  it('should be a positive number', () => {
    expect(BRAVE_COST_PER_QUERY).toBeGreaterThan(0);
  });

  it('should be less than $1', () => {
    expect(BRAVE_COST_PER_QUERY).toBeLessThan(1);
  });
});

describe('System Prompts', () => {
  it('should have non-empty FORENSIC_INTAKE_PROMPT', () => {
    expect(FORENSIC_INTAKE_PROMPT.length).toBeGreaterThan(100);
  });

  it('should have non-empty MASTER_ARCHITECT_PROMPT', () => {
    expect(MASTER_ARCHITECT_PROMPT.length).toBeGreaterThan(100);
  });

  it('should have non-empty QUALITY_CONTROL_PROMPT', () => {
    expect(QUALITY_CONTROL_PROMPT.length).toBeGreaterThan(100);
  });

  it('should have non-empty PROJECT_MANAGER_PROMPT', () => {
    expect(PROJECT_MANAGER_PROMPT.length).toBeGreaterThan(100);
  });

  it('should have non-empty SCOUT_PROMPT', () => {
    expect(SCOUT_PROMPT.length).toBeGreaterThan(100);
  });

  it('should have non-empty FINAL_SYNTHESIS_PROMPT', () => {
    expect(FINAL_SYNTHESIS_PROMPT.length).toBeGreaterThan(100);
  });

  it('should have non-empty SYNTHESIZER_PROMPT', () => {
    expect(SYNTHESIZER_PROMPT.length).toBeGreaterThan(100);
  });

  it('should include ethical boundaries in intake prompt', () => {
    expect(FORENSIC_INTAKE_PROMPT.toLowerCase()).toContain('ethical');
  });
});
