/**
 * Tests for Resume Generator Index Module
 *
 * Verifies that all expected exports are available from the barrel file
 */

import { describe, it, expect } from 'vitest';

// Import everything the module claims to export
import {
  // Types (re-exported from types.ts)
  CLASSIC_PRESET,
  MODERN_PRESET,
  MINIMAL_PRESET,
  TEMPLATE_PRESETS,
  ATS_REQUIREMENTS,
  REVISION_PATTERNS,

  // Document generation
  generateResumeDocx,
  generateResumeFilename,
  generateResumePdf,

  // Conversation handling
  getProgressChecklist,
  formatProgressAsMarkdown,
  getResumeSystemPrompt,
  getWelcomeMessage,
  getStepPrompt,
  createInitialState,
  getNextStep,
  applyTemplate,
  generateResumeDocuments,
  parseRevisionRequest,

  // ATS scoring
  extractKeywordsFromJobDescription,
  scoreResumeForATS,
  getATSOptimizationReport,
  createATSOptimization,
} from './index';

describe('resume/index exports', () => {
  // ==========================================
  // TYPE CONSTANTS
  // ==========================================

  it('should export CLASSIC_PRESET', () => {
    expect(CLASSIC_PRESET).toBeDefined();
    expect(CLASSIC_PRESET.template).toBe('classic');
  });

  it('should export MODERN_PRESET', () => {
    expect(MODERN_PRESET).toBeDefined();
    expect(MODERN_PRESET.template).toBe('modern');
  });

  it('should export MINIMAL_PRESET', () => {
    expect(MINIMAL_PRESET).toBeDefined();
    expect(MINIMAL_PRESET.template).toBe('minimal');
  });

  it('should export TEMPLATE_PRESETS', () => {
    expect(TEMPLATE_PRESETS).toBeDefined();
    expect(Object.keys(TEMPLATE_PRESETS)).toHaveLength(3);
  });

  it('should export ATS_REQUIREMENTS', () => {
    expect(ATS_REQUIREMENTS).toBeDefined();
    expect(ATS_REQUIREMENTS.safeFonts).toBeDefined();
  });

  it('should export REVISION_PATTERNS', () => {
    expect(REVISION_PATTERNS).toBeDefined();
    expect(REVISION_PATTERNS.margins).toBeDefined();
  });

  // ==========================================
  // DOCUMENT GENERATION
  // ==========================================

  it('should export generateResumeDocx as a function', () => {
    expect(typeof generateResumeDocx).toBe('function');
  });

  it('should export generateResumeFilename as a function', () => {
    expect(typeof generateResumeFilename).toBe('function');
  });

  it('should export generateResumePdf as a function', () => {
    expect(typeof generateResumePdf).toBe('function');
  });

  // ==========================================
  // CONVERSATION HANDLING
  // ==========================================

  it('should export getProgressChecklist as a function', () => {
    expect(typeof getProgressChecklist).toBe('function');
  });

  it('should export formatProgressAsMarkdown as a function', () => {
    expect(typeof formatProgressAsMarkdown).toBe('function');
  });

  it('should export getResumeSystemPrompt as a function', () => {
    expect(typeof getResumeSystemPrompt).toBe('function');
  });

  it('should export getWelcomeMessage as a function', () => {
    expect(typeof getWelcomeMessage).toBe('function');
  });

  it('should export getStepPrompt as a function', () => {
    expect(typeof getStepPrompt).toBe('function');
  });

  it('should export createInitialState as a function', () => {
    expect(typeof createInitialState).toBe('function');
  });

  it('should export getNextStep as a function', () => {
    expect(typeof getNextStep).toBe('function');
  });

  it('should export applyTemplate as a function', () => {
    expect(typeof applyTemplate).toBe('function');
  });

  it('should export generateResumeDocuments as a function', () => {
    expect(typeof generateResumeDocuments).toBe('function');
  });

  it('should export parseRevisionRequest as a function', () => {
    expect(typeof parseRevisionRequest).toBe('function');
  });

  // ==========================================
  // ATS SCORING
  // ==========================================

  it('should export extractKeywordsFromJobDescription as a function', () => {
    expect(typeof extractKeywordsFromJobDescription).toBe('function');
  });

  it('should export scoreResumeForATS as a function', () => {
    expect(typeof scoreResumeForATS).toBe('function');
  });

  it('should export getATSOptimizationReport as a function', () => {
    expect(typeof getATSOptimizationReport).toBe('function');
  });

  it('should export createATSOptimization as a function', () => {
    expect(typeof createATSOptimization).toBe('function');
  });
});

describe('resume/index integration', () => {
  it('should allow creating initial state and getting progress', () => {
    const state = createInitialState();
    const progress = getProgressChecklist(state);
    expect(progress.items.length).toBeGreaterThan(0);
    expect(progress.percentComplete).toBe(0);
  });

  it('should allow advancing through steps', () => {
    let step = 'welcome' as const;
    step = getNextStep(step) as typeof step;
    expect(step).toBe('choose_path');
  });

  it('should allow formatting progress as markdown', () => {
    const state = createInitialState();
    const progress = getProgressChecklist(state);
    const md = formatProgressAsMarkdown(progress);
    expect(md).toContain('Resume Builder Progress');
  });

  it('should allow generating a filename', () => {
    const filename = generateResumeFilename('Test User', 'docx');
    expect(filename).toContain('test_user');
    expect(filename).toMatch(/\.docx$/);
  });

  it('should allow extracting keywords from job description', () => {
    const keywords = extractKeywordsFromJobDescription(
      'Experience with Python and React required.'
    );
    const allKw = [...keywords.required, ...keywords.preferred];
    expect(allKw.length).toBeGreaterThan(0);
  });
});
