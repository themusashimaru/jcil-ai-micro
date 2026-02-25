/**
 * SKILLS INDEX BARREL EXPORT TESTS
 *
 * Tests for src/lib/skills/index.ts
 * Verifies that all public exports are accessible through the barrel export.
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return { default: vi.fn() };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import * as skillsIndex from './index';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('skills/index barrel exports', () => {
  it('exports SkillLoader class', () => {
    expect(skillsIndex.SkillLoader).toBeDefined();
    expect(typeof skillsIndex.SkillLoader).toBe('function');
  });

  it('exports getSkillTools function', () => {
    expect(typeof skillsIndex.getSkillTools).toBe('function');
  });

  it('exports executeSkillTool function', () => {
    expect(typeof skillsIndex.executeSkillTool).toBe('function');
  });

  it('exports isSkillTool function', () => {
    expect(typeof skillsIndex.isSkillTool).toBe('function');
  });

  it('exports buildSkillPrompt function', () => {
    expect(typeof skillsIndex.buildSkillPrompt).toBe('function');
  });

  it('exports getSkillLoader function', () => {
    expect(typeof skillsIndex.getSkillLoader).toBe('function');
  });

  it('exports clearSkillLoader function', () => {
    expect(typeof skillsIndex.clearSkillLoader).toBe('function');
  });
});
