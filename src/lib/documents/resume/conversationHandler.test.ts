/**
 * Tests for Resume Conversation Handler
 *
 * Tests progress tracking, prompts, state management, document generation, and revision handling
 */

vi.mock('./generateDocx', () => ({
  generateResumeDocx: vi.fn().mockResolvedValue(Buffer.from('mock-docx')),
  generateResumeFilename: vi.fn((name: string, fmt: string) => `${name}_resume.${fmt}`),
}));

vi.mock('./generatePdf', () => ({
  generateResumePdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf')),
}));

import { describe, it, expect, vi } from 'vitest';
import {
  getProgressChecklist,
  getResumeSystemPrompt,
  getWelcomeMessage,
  getContactPrompt,
  getStepPrompt,
  createInitialState,
  getNextStep,
  applyTemplate,
  generateResumeDocuments,
  parseRevisionRequest,
  formatProgressAsMarkdown,
} from './conversationHandler';
import type { ResumeGeneratorState } from './types';
import { MODERN_PRESET, CLASSIC_PRESET } from './types';

// ============================================================================
// getProgressChecklist
// ============================================================================

describe('getProgressChecklist', () => {
  it('should return all progress items', () => {
    const state = createInitialState();
    const progress = getProgressChecklist(state);

    expect(progress.items).toHaveLength(7);
    expect(progress.totalSteps).toBe(7);
  });

  it('should mark welcome step correctly', () => {
    const state = createInitialState();
    const progress = getProgressChecklist(state);

    expect(progress.percentComplete).toBe(0);
  });

  it('should mark steps as in_progress for current step', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_contact',
    };
    const progress = getProgressChecklist(state);

    const contactItem = progress.items.find((i) => i.id === 'contact');
    expect(contactItem?.status).toBe('in_progress');
  });

  it('should mark earlier steps as completed', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_experience',
    };
    const progress = getProgressChecklist(state);

    const contactItem = progress.items.find((i) => i.id === 'contact');
    const targetItem = progress.items.find((i) => i.id === 'target');
    expect(contactItem?.status).toBe('completed');
    expect(targetItem?.status).toBe('completed');
  });

  it('should mark later steps as pending', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_contact',
    };
    const progress = getProgressChecklist(state);

    const experienceItem = progress.items.find((i) => i.id === 'experience');
    expect(experienceItem?.status).toBe('pending');
  });

  it('should calculate percent complete correctly', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'generating',
    };
    const progress = getProgressChecklist(state);

    // All items before 'generating' should be complete
    expect(progress.percentComplete).toBeGreaterThan(50);
  });
});

// ============================================================================
// PROMPT FUNCTIONS
// ============================================================================

describe('getResumeSystemPrompt', () => {
  it('should return a non-empty system prompt', () => {
    const prompt = getResumeSystemPrompt();
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should mention ATS optimization', () => {
    const prompt = getResumeSystemPrompt();
    expect(prompt.toLowerCase()).toContain('ats');
  });

  it('should mention action verbs', () => {
    const prompt = getResumeSystemPrompt();
    expect(prompt.toLowerCase()).toContain('action verb');
  });
});

describe('getWelcomeMessage', () => {
  it('should return a non-empty welcome message', () => {
    const msg = getWelcomeMessage();
    expect(msg.length).toBeGreaterThan(50);
  });

  it('should mention upload and fresh start options', () => {
    const msg = getWelcomeMessage();
    expect(msg.toLowerCase()).toContain('upload');
    expect(msg.toLowerCase()).toContain('fresh');
  });
});

describe('getContactPrompt', () => {
  it('should ask for name when no existing contact', () => {
    const prompt = getContactPrompt();
    expect(prompt.toLowerCase()).toContain('name');
  });

  it('should show existing contact when provided', () => {
    const prompt = getContactPrompt({
      fullName: 'John Doe',
      email: 'john@test.com',
    });
    expect(prompt).toContain('John Doe');
    expect(prompt).toContain('john@test.com');
  });

  it('should show "Not provided" for missing optional fields', () => {
    const prompt = getContactPrompt({
      fullName: 'Jane',
    });
    expect(prompt).toContain('Not provided');
  });
});

describe('getStepPrompt', () => {
  it('should return welcome message for welcome step', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('welcome', state);
    expect(prompt).toContain('Welcome');
  });

  it('should return experience prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('gathering_experience', state);
    expect(prompt.toLowerCase()).toContain('experience');
  });

  it('should mention position count when experience exists', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_experience',
      resumeData: {
        ...createInitialState().resumeData,
        experience: [{ company: 'Co', title: 'Dev', startDate: 'Jan 2020', bullets: [] }],
      },
    };
    const prompt = getStepPrompt('gathering_experience', state);
    expect(prompt).toContain('1 position');
  });

  it('should return education prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('gathering_education', state);
    expect(prompt.toLowerCase()).toContain('education');
  });

  it('should return skills prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('gathering_skills', state);
    expect(prompt.toLowerCase()).toContain('skills');
  });

  it('should return style selection prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('style_selection', state);
    expect(prompt).toContain('Modern');
    expect(prompt).toContain('Classic');
    expect(prompt).toContain('Minimal');
  });

  it('should return generating prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('generating', state);
    expect(prompt.toLowerCase()).toContain('generating');
  });

  it('should return reviewing prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('reviewing', state);
    expect(prompt.toLowerCase()).toContain('review');
  });

  it('should return complete prompt', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('complete', state);
    expect(prompt.toLowerCase()).toContain('complete');
  });

  it('should return empty string for unknown step', () => {
    const state = createInitialState();
    const prompt = getStepPrompt('unknown_step' as unknown as 'welcome', state);
    expect(prompt).toBe('');
  });
});

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

describe('createInitialState', () => {
  it('should create state at welcome step', () => {
    const state = createInitialState();
    expect(state.step).toBe('welcome');
  });

  it('should have empty questions asked', () => {
    const state = createInitialState();
    expect(state.questionsAsked).toEqual([]);
  });

  it('should have empty revision history', () => {
    const state = createInitialState();
    expect(state.revisionHistory).toEqual([]);
  });

  it('should use MODERN_PRESET formatting', () => {
    const state = createInitialState();
    expect(state.resumeData.formatting).toBe(MODERN_PRESET);
  });

  it('should have empty contact info', () => {
    const state = createInitialState();
    expect(state.resumeData.contact?.fullName).toBe('');
    expect(state.resumeData.contact?.email).toBe('');
  });
});

describe('getNextStep', () => {
  it('should advance welcome to choose_path', () => {
    expect(getNextStep('welcome')).toBe('choose_path');
  });

  it('should advance choose_path to gathering_contact', () => {
    expect(getNextStep('choose_path')).toBe('gathering_contact');
  });

  it('should advance gathering_contact to gathering_target_job', () => {
    expect(getNextStep('gathering_contact')).toBe('gathering_target_job');
  });

  it('should advance gathering_experience to gathering_education', () => {
    expect(getNextStep('gathering_experience')).toBe('gathering_education');
  });

  it('should advance style_selection to generating', () => {
    expect(getNextStep('style_selection')).toBe('generating');
  });

  it('should advance generating to reviewing', () => {
    expect(getNextStep('generating')).toBe('reviewing');
  });

  it('should keep complete at complete', () => {
    expect(getNextStep('complete')).toBe('complete');
  });

  it('should loop revising back to reviewing', () => {
    expect(getNextStep('revising')).toBe('reviewing');
  });
});

// ============================================================================
// TEMPLATE APPLICATION
// ============================================================================

describe('applyTemplate', () => {
  it('should apply modern template', () => {
    const result = applyTemplate('modern');
    expect(result.template).toBe('modern');
    expect(result.fonts.primary).toBe('Calibri');
  });

  it('should apply classic template', () => {
    const result = applyTemplate('classic');
    expect(result.template).toBe('classic');
    expect(result.fonts.primary).toBe('Times New Roman');
  });

  it('should apply minimal template', () => {
    const result = applyTemplate('minimal');
    expect(result.template).toBe('minimal');
    expect(result.fonts.primary).toBe('Arial');
  });

  it('should override with custom formatting', () => {
    const result = applyTemplate('modern', {
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
    expect(result.margins.top).toBe(0.5);
    expect(result.template).toBe('modern');
  });

  it('should set template name from the template param, not currentFormatting', () => {
    const result = applyTemplate('classic', { template: 'modern' } as never);
    expect(result.template).toBe('classic');
  });
});

// ============================================================================
// DOCUMENT GENERATION
// ============================================================================

describe('generateResumeDocuments', () => {
  it('should generate both docx and pdf', async () => {
    const data = {
      contact: { fullName: 'Test User', email: 'test@test.com' },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };

    const result = await generateResumeDocuments(data);
    expect(result.docx).toBeInstanceOf(Buffer);
    expect(result.pdf).toBeInstanceOf(Buffer);
    expect(result.docxFilename).toContain('.docx');
    expect(result.pdfFilename).toContain('.pdf');
  });

  it('should use contact name for filenames', async () => {
    const data = {
      contact: { fullName: 'Alice Bob', email: 'alice@test.com' },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };

    const result = await generateResumeDocuments(data);
    expect(result.docxFilename).toContain('Alice Bob');
  });

  it('should fall back to "resume" when fullName is empty', async () => {
    const data = {
      contact: { fullName: '', email: 'test@test.com' },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };

    const result = await generateResumeDocuments(data);
    expect(result.docxFilename).toContain('resume');
  });
});

// ============================================================================
// REVISION HANDLING
// ============================================================================

describe('parseRevisionRequest', () => {
  it('should widen margins', () => {
    const changes = parseRevisionRequest('widen margins please', MODERN_PRESET);
    expect(changes.margins?.left).toBeGreaterThan(MODERN_PRESET.margins.left);
    expect(changes.margins?.right).toBeGreaterThan(MODERN_PRESET.margins.right);
  });

  it('should narrow margins', () => {
    const changes = parseRevisionRequest('narrow margins', MODERN_PRESET);
    expect(changes.margins?.left).toBeLessThan(MODERN_PRESET.margins.left);
  });

  it('should not exceed maximum margin', () => {
    const wideFormatting = {
      ...MODERN_PRESET,
      margins: { ...MODERN_PRESET.margins, left: 1.5, right: 1.5 },
    };
    const changes = parseRevisionRequest('widen margins', wideFormatting);
    expect(changes.margins?.left).toBeLessThanOrEqual(1.5);
  });

  it('should not go below minimum margin', () => {
    const narrowFormatting = {
      ...MODERN_PRESET,
      margins: { ...MODERN_PRESET.margins, left: 0.5, right: 0.5 },
    };
    const changes = parseRevisionRequest('narrow margins', narrowFormatting);
    expect(changes.margins?.left).toBeGreaterThanOrEqual(0.5);
  });

  it('should change to Arial font', () => {
    const changes = parseRevisionRequest('use arial font', MODERN_PRESET);
    expect(changes.fonts?.primary).toBe('Arial');
  });

  it('should change to Times New Roman font', () => {
    const changes = parseRevisionRequest('use times new roman', MODERN_PRESET);
    expect(changes.fonts?.primary).toBe('Times New Roman');
  });

  it('should change to Calibri font', () => {
    const changes = parseRevisionRequest('use calibri', CLASSIC_PRESET);
    expect(changes.fonts?.primary).toBe('Calibri');
  });

  it('should make name larger', () => {
    const changes = parseRevisionRequest('make the name larger', MODERN_PRESET);
    expect(changes.fonts?.sizes?.name).toBeGreaterThan(MODERN_PRESET.fonts.sizes.name);
  });

  it('should make name smaller', () => {
    const changes = parseRevisionRequest('make name smaller', MODERN_PRESET);
    expect(changes.fonts?.sizes?.name).toBeLessThan(MODERN_PRESET.fonts.sizes.name);
  });

  it('should not exceed max name size', () => {
    const largeNameFormatting = {
      ...MODERN_PRESET,
      fonts: { ...MODERN_PRESET.fonts, sizes: { ...MODERN_PRESET.fonts.sizes, name: 28 } },
    };
    const changes = parseRevisionRequest('make name larger', largeNameFormatting);
    expect(changes.fonts?.sizes?.name).toBeLessThanOrEqual(28);
  });

  it('should move education above experience', () => {
    const changes = parseRevisionRequest('put education above experience', MODERN_PRESET);
    if (changes.sectionOrder) {
      const eduIndex = changes.sectionOrder.indexOf('education');
      const expIndex = changes.sectionOrder.indexOf('experience');
      expect(eduIndex).toBeLessThan(expIndex);
    }
  });

  it('should move skills to top', () => {
    const changes = parseRevisionRequest('put skills at top', MODERN_PRESET);
    if (changes.sectionOrder) {
      expect(changes.sectionOrder.indexOf('skills')).toBeLessThanOrEqual(1);
    }
  });

  it('should return empty changes for unrecognized request', () => {
    const changes = parseRevisionRequest('random gibberish text', MODERN_PRESET);
    expect(Object.keys(changes)).toHaveLength(0);
  });

  it('should handle "more whitespace" as widen margins', () => {
    const changes = parseRevisionRequest('more whitespace please', MODERN_PRESET);
    expect(changes.margins).toBeDefined();
  });

  it('should handle "traditional" as Times font', () => {
    const changes = parseRevisionRequest('use a traditional font', MODERN_PRESET);
    expect(changes.fonts?.primary).toBe('Times New Roman');
  });
});

// ============================================================================
// FORMAT PROGRESS AS MARKDOWN
// ============================================================================

describe('formatProgressAsMarkdown', () => {
  it('should include progress percentage', () => {
    const state = createInitialState();
    const progress = getProgressChecklist(state);
    const md = formatProgressAsMarkdown(progress);

    expect(md).toContain('0% complete');
  });

  it('should use check mark for completed items', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_experience',
    };
    const progress = getProgressChecklist(state);
    const md = formatProgressAsMarkdown(progress);

    expect(md).toContain('✓');
  });

  it('should use arrow for in-progress items', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_contact',
    };
    const progress = getProgressChecklist(state);
    const md = formatProgressAsMarkdown(progress);

    expect(md).toContain('→');
  });

  it('should use circle for pending items', () => {
    const state = createInitialState();
    const progress = getProgressChecklist(state);
    const md = formatProgressAsMarkdown(progress);

    expect(md).toContain('○');
  });

  it('should bold in-progress items', () => {
    const state: ResumeGeneratorState = {
      ...createInitialState(),
      step: 'gathering_skills',
    };
    const progress = getProgressChecklist(state);
    const md = formatProgressAsMarkdown(progress);

    expect(md).toContain('**Skills**');
  });
});
