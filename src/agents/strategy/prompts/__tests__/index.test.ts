/**
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest';

import {
  getPrompts,
  getAvailableModes,
  STRATEGY_PROMPTS,
  RESEARCH_PROMPTS,
  QUICK_RESEARCH_PROMPTS,
  QUICK_STRATEGY_PROMPTS,
  DEEP_WRITER_PROMPTS,
  QUICK_WRITER_PROMPTS,
} from '../index';
import type { PromptSet } from '../types';

// ---------------------------------------------------------------------------
// PromptSet Shape Validator
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS: (keyof PromptSet)[] = [
  'name',
  'intake',
  'intakeOpening',
  'architect',
  'qualityControl',
  'projectManager',
  'scout',
  'synthesizer',
  'synthesis',
];

function validatePromptSet(set: PromptSet, label: string) {
  describe(`${label} — shape`, () => {
    for (const field of REQUIRED_FIELDS) {
      it(`should have a non-empty "${field}" field`, () => {
        expect(typeof set[field]).toBe('string');
        expect((set[field] as string).length).toBeGreaterThan(0);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// getAvailableModes
// ---------------------------------------------------------------------------

describe('getAvailableModes', () => {
  it('should return an array of strings', () => {
    const modes = getAvailableModes();
    expect(Array.isArray(modes)).toBe(true);
    expect(modes.length).toBeGreaterThan(0);
    for (const m of modes) {
      expect(typeof m).toBe('string');
    }
  });

  it('should include all 6 registered modes', () => {
    const modes = getAvailableModes();
    expect(modes).toContain('strategy');
    expect(modes).toContain('research');
    expect(modes).toContain('quick-research');
    expect(modes).toContain('quick-strategy');
    expect(modes).toContain('deep-writer');
    expect(modes).toContain('quick-writer');
  });

  it('should have exactly 6 modes', () => {
    expect(getAvailableModes()).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// getPrompts
// ---------------------------------------------------------------------------

describe('getPrompts', () => {
  it('should return STRATEGY_PROMPTS for "strategy"', () => {
    expect(getPrompts('strategy')).toBe(STRATEGY_PROMPTS);
  });

  it('should return RESEARCH_PROMPTS for "research"', () => {
    expect(getPrompts('research')).toBe(RESEARCH_PROMPTS);
  });

  it('should return QUICK_RESEARCH_PROMPTS for "quick-research"', () => {
    expect(getPrompts('quick-research')).toBe(QUICK_RESEARCH_PROMPTS);
  });

  it('should return QUICK_STRATEGY_PROMPTS for "quick-strategy"', () => {
    expect(getPrompts('quick-strategy')).toBe(QUICK_STRATEGY_PROMPTS);
  });

  it('should return DEEP_WRITER_PROMPTS for "deep-writer"', () => {
    expect(getPrompts('deep-writer')).toBe(DEEP_WRITER_PROMPTS);
  });

  it('should return QUICK_WRITER_PROMPTS for "quick-writer"', () => {
    expect(getPrompts('quick-writer')).toBe(QUICK_WRITER_PROMPTS);
  });

  it('should default to STRATEGY_PROMPTS for unknown mode', () => {
    expect(getPrompts('nonexistent')).toBe(STRATEGY_PROMPTS);
  });

  it('should default to STRATEGY_PROMPTS for empty string', () => {
    expect(getPrompts('')).toBe(STRATEGY_PROMPTS);
  });
});

// ---------------------------------------------------------------------------
// Individual Prompt Set Names
// ---------------------------------------------------------------------------

describe('Prompt set names', () => {
  it('STRATEGY_PROMPTS should have name containing "Strategy"', () => {
    expect(STRATEGY_PROMPTS.name).toContain('Strategy');
  });

  it('RESEARCH_PROMPTS should have name containing "Research"', () => {
    expect(RESEARCH_PROMPTS.name).toContain('Research');
  });

  it('QUICK_RESEARCH_PROMPTS should have name containing "Research"', () => {
    expect(QUICK_RESEARCH_PROMPTS.name).toContain('Research');
  });

  it('QUICK_STRATEGY_PROMPTS should have name containing "Strategy"', () => {
    expect(QUICK_STRATEGY_PROMPTS.name).toContain('Strategy');
  });

  it('DEEP_WRITER_PROMPTS should have name containing "Writer"', () => {
    expect(DEEP_WRITER_PROMPTS.name).toContain('Writer');
  });

  it('QUICK_WRITER_PROMPTS should have name containing "Writer"', () => {
    expect(QUICK_WRITER_PROMPTS.name).toContain('Writer');
  });
});

// ---------------------------------------------------------------------------
// Validate each PromptSet has all required fields (9 fields × 6 sets = 54)
// ---------------------------------------------------------------------------

validatePromptSet(STRATEGY_PROMPTS, 'STRATEGY_PROMPTS');
validatePromptSet(RESEARCH_PROMPTS, 'RESEARCH_PROMPTS');
validatePromptSet(QUICK_RESEARCH_PROMPTS, 'QUICK_RESEARCH_PROMPTS');
validatePromptSet(QUICK_STRATEGY_PROMPTS, 'QUICK_STRATEGY_PROMPTS');
validatePromptSet(DEEP_WRITER_PROMPTS, 'DEEP_WRITER_PROMPTS');
validatePromptSet(QUICK_WRITER_PROMPTS, 'QUICK_WRITER_PROMPTS');

// ---------------------------------------------------------------------------
// Ethical boundaries — every prompt set should include guardrails
// ---------------------------------------------------------------------------

describe('Ethical guardrails', () => {
  const allSets: [string, PromptSet][] = [
    ['STRATEGY_PROMPTS', STRATEGY_PROMPTS],
    ['RESEARCH_PROMPTS', RESEARCH_PROMPTS],
    ['QUICK_RESEARCH_PROMPTS', QUICK_RESEARCH_PROMPTS],
    ['QUICK_STRATEGY_PROMPTS', QUICK_STRATEGY_PROMPTS],
    ['DEEP_WRITER_PROMPTS', DEEP_WRITER_PROMPTS],
    ['QUICK_WRITER_PROMPTS', QUICK_WRITER_PROMPTS],
  ];

  for (const [label, set] of allSets) {
    it(`${label} intake should contain ethical boundaries`, () => {
      const lower = set.intake.toLowerCase();
      // Should mention at least one safety/ethical concept
      const hasEthics =
        lower.includes('ethic') ||
        lower.includes('refuse') ||
        lower.includes('boundaries') ||
        lower.includes('harm') ||
        lower.includes('safety');
      expect(hasEthics).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Prompt lengths — ensure no trivial stubs
// ---------------------------------------------------------------------------

describe('Prompt lengths (no stubs)', () => {
  const allSets: [string, PromptSet][] = [
    ['STRATEGY', STRATEGY_PROMPTS],
    ['RESEARCH', RESEARCH_PROMPTS],
    ['QUICK_RESEARCH', QUICK_RESEARCH_PROMPTS],
    ['QUICK_STRATEGY', QUICK_STRATEGY_PROMPTS],
    ['DEEP_WRITER', DEEP_WRITER_PROMPTS],
    ['QUICK_WRITER', QUICK_WRITER_PROMPTS],
  ];

  for (const [label, set] of allSets) {
    it(`${label} intake should be >200 chars`, () => {
      expect(set.intake.length).toBeGreaterThan(200);
    });

    it(`${label} architect should be >200 chars`, () => {
      expect(set.architect.length).toBeGreaterThan(200);
    });

    it(`${label} scout should be >200 chars`, () => {
      expect(set.scout.length).toBeGreaterThan(200);
    });

    it(`${label} synthesis should be >200 chars`, () => {
      expect(set.synthesis.length).toBeGreaterThan(200);
    });
  }
});
