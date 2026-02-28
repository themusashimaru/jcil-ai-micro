/**
 * @vitest-environment node
 */

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
} from '../constants';

// ---------------------------------------------------------------------------
// Model IDs
// ---------------------------------------------------------------------------

describe('Model IDs', () => {
  it('should have a valid Opus model ID', () => {
    expect(CLAUDE_OPUS_46).toContain('claude');
    expect(typeof CLAUDE_OPUS_46).toBe('string');
  });

  it('should have a valid Sonnet model ID', () => {
    expect(CLAUDE_SONNET_46).toContain('claude');
    expect(typeof CLAUDE_SONNET_46).toBe('string');
  });

  it('should have a valid Haiku model ID', () => {
    expect(CLAUDE_HAIKU_45).toContain('claude');
    expect(typeof CLAUDE_HAIKU_45).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// MODEL_CONFIGS
// ---------------------------------------------------------------------------

describe('MODEL_CONFIGS', () => {
  it('should define opus, sonnet, and haiku configs', () => {
    expect(MODEL_CONFIGS.opus).toBeDefined();
    expect(MODEL_CONFIGS.sonnet).toBeDefined();
    expect(MODEL_CONFIGS.haiku).toBeDefined();
  });

  it('should have valid opus config', () => {
    expect(MODEL_CONFIGS.opus.id).toBe(CLAUDE_OPUS_46);
    expect(MODEL_CONFIGS.opus.tier).toBe('opus');
    expect(MODEL_CONFIGS.opus.costPerMillionInput).toBeGreaterThan(0);
    expect(MODEL_CONFIGS.opus.costPerMillionOutput).toBeGreaterThan(0);
    expect(MODEL_CONFIGS.opus.maxTokens).toBeGreaterThan(0);
    expect(MODEL_CONFIGS.opus.description).toBeTruthy();
  });

  it('should have valid sonnet config', () => {
    expect(MODEL_CONFIGS.sonnet.id).toBe(CLAUDE_SONNET_46);
    expect(MODEL_CONFIGS.sonnet.tier).toBe('sonnet');
    expect(MODEL_CONFIGS.sonnet.costPerMillionInput).toBeGreaterThan(0);
  });

  it('should have valid haiku config', () => {
    expect(MODEL_CONFIGS.haiku.id).toBe(CLAUDE_HAIKU_45);
    expect(MODEL_CONFIGS.haiku.tier).toBe('haiku');
    expect(MODEL_CONFIGS.haiku.costPerMillionInput).toBeGreaterThan(0);
  });

  it('should have haiku as cheapest tier', () => {
    expect(MODEL_CONFIGS.haiku.costPerMillionInput).toBeLessThan(
      MODEL_CONFIGS.sonnet.costPerMillionInput
    );
    expect(MODEL_CONFIGS.sonnet.costPerMillionInput).toBeLessThan(
      MODEL_CONFIGS.opus.costPerMillionInput
    );
  });

  it('should have output cost >= input cost for each tier', () => {
    for (const config of Object.values(MODEL_CONFIGS)) {
      expect(config.costPerMillionOutput).toBeGreaterThanOrEqual(config.costPerMillionInput);
    }
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_LIMITS
// ---------------------------------------------------------------------------

describe('DEFAULT_LIMITS', () => {
  it('should have positive maxBudget', () => {
    expect(DEFAULT_LIMITS.maxBudget).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxBudget).toBeLessThanOrEqual(100); // reasonable cap
  });

  it('should have positive maxScouts', () => {
    expect(DEFAULT_LIMITS.maxScouts).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxScouts).toBeLessThanOrEqual(1000);
  });

  it('should have positive maxSearches', () => {
    expect(DEFAULT_LIMITS.maxSearches).toBeGreaterThan(0);
  });

  it('should have positive maxTimeMinutes', () => {
    expect(DEFAULT_LIMITS.maxTimeMinutes).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxTimeMinutes).toBeLessThanOrEqual(60);
  });

  it('should have positive maxDepth', () => {
    expect(DEFAULT_LIMITS.maxDepth).toBeGreaterThan(0);
  });

  it('should have positive maxConcurrentCalls', () => {
    expect(DEFAULT_LIMITS.maxConcurrentCalls).toBeGreaterThan(0);
  });

  it('should have positive batchDelayMs', () => {
    expect(DEFAULT_LIMITS.batchDelayMs).toBeGreaterThanOrEqual(0);
  });

  it('should have minConfidenceScore between 0 and 1', () => {
    expect(DEFAULT_LIMITS.minConfidenceScore).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.minConfidenceScore).toBeLessThanOrEqual(1);
  });

  it('should have maxErrorRate between 0 and 1', () => {
    expect(DEFAULT_LIMITS.maxErrorRate).toBeGreaterThan(0);
    expect(DEFAULT_LIMITS.maxErrorRate).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// BRAVE_COST_PER_QUERY
// ---------------------------------------------------------------------------

describe('BRAVE_COST_PER_QUERY', () => {
  it('should be a positive number', () => {
    expect(BRAVE_COST_PER_QUERY).toBeGreaterThan(0);
  });

  it('should be less than $1 per query', () => {
    expect(BRAVE_COST_PER_QUERY).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// System Prompts
// ---------------------------------------------------------------------------

describe('FORENSIC_INTAKE_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof FORENSIC_INTAKE_PROMPT).toBe('string');
    expect(FORENSIC_INTAKE_PROMPT.length).toBeGreaterThan(100);
  });

  it('should contain ethical boundaries', () => {
    expect(FORENSIC_INTAKE_PROMPT).toContain('ETHICAL BOUNDARIES');
  });

  it('should mention human trafficking as blocked', () => {
    expect(FORENSIC_INTAKE_PROMPT).toContain('trafficking');
  });

  it('should contain output format instructions', () => {
    expect(FORENSIC_INTAKE_PROMPT).toContain('OUTPUT FORMAT');
    expect(FORENSIC_INTAKE_PROMPT).toContain('intakeComplete');
  });
});

describe('MASTER_ARCHITECT_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof MASTER_ARCHITECT_PROMPT).toBe('string');
    expect(MASTER_ARCHITECT_PROMPT.length).toBeGreaterThan(100);
  });

  it('should mention agent hierarchy', () => {
    expect(MASTER_ARCHITECT_PROMPT).toContain('AGENT HIERARCHY');
  });

  it('should list scout tools', () => {
    expect(MASTER_ARCHITECT_PROMPT).toContain('brave_search');
    expect(MASTER_ARCHITECT_PROMPT).toContain('browser_visit');
    expect(MASTER_ARCHITECT_PROMPT).toContain('run_code');
  });

  it('should contain safety restrictions', () => {
    expect(MASTER_ARCHITECT_PROMPT).toContain('SAFETY RESTRICTIONS');
  });

  it('should block sanctioned nations', () => {
    expect(MASTER_ARCHITECT_PROMPT).toContain('North Korea');
    expect(MASTER_ARCHITECT_PROMPT).toContain('Iran');
  });
});

describe('QUALITY_CONTROL_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof QUALITY_CONTROL_PROMPT).toBe('string');
    expect(QUALITY_CONTROL_PROMPT.length).toBeGreaterThan(100);
  });
});

describe('PROJECT_MANAGER_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof PROJECT_MANAGER_PROMPT).toBe('string');
    expect(PROJECT_MANAGER_PROMPT.length).toBeGreaterThan(100);
  });
});

describe('SCOUT_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof SCOUT_PROMPT).toBe('string');
    expect(SCOUT_PROMPT.length).toBeGreaterThan(100);
  });

  it('should contain tool usage instructions', () => {
    expect(SCOUT_PROMPT).toContain('brave_search');
  });
});

describe('FINAL_SYNTHESIS_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof FINAL_SYNTHESIS_PROMPT).toBe('string');
    expect(FINAL_SYNTHESIS_PROMPT.length).toBeGreaterThan(100);
  });

  it('should mention output format', () => {
    expect(FINAL_SYNTHESIS_PROMPT).toContain('recommendation');
  });
});

describe('SYNTHESIZER_PROMPT', () => {
  it('should be a non-empty string', () => {
    expect(typeof SYNTHESIZER_PROMPT).toBe('string');
    expect(SYNTHESIZER_PROMPT.length).toBeGreaterThan(100);
  });
});
