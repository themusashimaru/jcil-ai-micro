/**
 * Tests for Resume Generator Type Definitions
 *
 * Tests type structures, constants, and presets
 */

import { describe, it, expect } from 'vitest';
import {
  CLASSIC_PRESET,
  MODERN_PRESET,
  MINIMAL_PRESET,
  TEMPLATE_PRESETS,
  ATS_REQUIREMENTS,
  REVISION_PATTERNS,
} from './types';
import type {
  ContactInfo,
  WorkExperience,
  Education,
  SkillCategory,
  Certification,
  AdditionalSection,
  ResumeTemplate,
  FontFamily,
  ResumeFormatting,
  TargetJob,
  ExtractedKeywords,
  ATSOptimization,
  ResumeData,
  ResumeGeneratorStep,
  ResumeGeneratorState,
  RevisionCategory,
  RevisionCommand,
} from './types';

// ============================================================================
// PRESET TESTS
// ============================================================================

describe('CLASSIC_PRESET', () => {
  it('should have template set to classic', () => {
    expect(CLASSIC_PRESET.template).toBe('classic');
  });

  it('should use Times New Roman font', () => {
    expect(CLASSIC_PRESET.fonts.primary).toBe('Times New Roman');
    expect(CLASSIC_PRESET.fonts.header).toBe('Times New Roman');
  });

  it('should have standard 1-inch margins', () => {
    expect(CLASSIC_PRESET.margins).toEqual({ top: 1, bottom: 1, left: 1, right: 1 });
  });

  it('should have correct section order', () => {
    expect(CLASSIC_PRESET.sectionOrder).toContain('summary');
    expect(CLASSIC_PRESET.sectionOrder).toContain('experience');
    expect(CLASSIC_PRESET.sectionOrder).toContain('education');
    expect(CLASSIC_PRESET.sectionOrder).toContain('skills');
  });

  it('should not have colors defined', () => {
    expect(CLASSIC_PRESET.colors).toBeUndefined();
  });
});

describe('MODERN_PRESET', () => {
  it('should have template set to modern', () => {
    expect(MODERN_PRESET.template).toBe('modern');
  });

  it('should use Calibri font', () => {
    expect(MODERN_PRESET.fonts.primary).toBe('Calibri');
  });

  it('should have tighter margins than classic', () => {
    expect(MODERN_PRESET.margins.top).toBeLessThan(CLASSIC_PRESET.margins.top);
  });

  it('should have colors defined', () => {
    expect(MODERN_PRESET.colors).toBeDefined();
    expect(MODERN_PRESET.colors?.primary).toBeDefined();
    expect(MODERN_PRESET.colors?.text).toBeDefined();
    expect(MODERN_PRESET.colors?.muted).toBeDefined();
  });
});

describe('MINIMAL_PRESET', () => {
  it('should have template set to minimal', () => {
    expect(MINIMAL_PRESET.template).toBe('minimal');
  });

  it('should use Arial font', () => {
    expect(MINIMAL_PRESET.fonts.primary).toBe('Arial');
  });

  it('should have the tightest margins', () => {
    expect(MINIMAL_PRESET.margins.top).toBeLessThanOrEqual(MODERN_PRESET.margins.top);
  });

  it('should have a more compact section order (no summary)', () => {
    expect(MINIMAL_PRESET.sectionOrder).not.toContain('summary');
  });

  it('should have smaller font sizes', () => {
    expect(MINIMAL_PRESET.fonts.sizes.body).toBeLessThanOrEqual(MODERN_PRESET.fonts.sizes.body);
    expect(MINIMAL_PRESET.fonts.sizes.name).toBeLessThanOrEqual(MODERN_PRESET.fonts.sizes.name);
  });
});

describe('TEMPLATE_PRESETS', () => {
  it('should contain all three presets', () => {
    expect(TEMPLATE_PRESETS.classic).toBe(CLASSIC_PRESET);
    expect(TEMPLATE_PRESETS.modern).toBe(MODERN_PRESET);
    expect(TEMPLATE_PRESETS.minimal).toBe(MINIMAL_PRESET);
  });

  it('should have keys matching ResumeTemplate type', () => {
    const keys = Object.keys(TEMPLATE_PRESETS);
    expect(keys).toContain('classic');
    expect(keys).toContain('modern');
    expect(keys).toContain('minimal');
  });
});

// ============================================================================
// ATS REQUIREMENTS TESTS
// ============================================================================

describe('ATS_REQUIREMENTS', () => {
  it('should require single column layout', () => {
    expect(ATS_REQUIREMENTS.layout.singleColumn).toBe(true);
    expect(ATS_REQUIREMENTS.layout.noTables).toBe(true);
    expect(ATS_REQUIREMENTS.layout.noGraphics).toBe(true);
  });

  it('should include standard safe fonts', () => {
    expect(ATS_REQUIREMENTS.safeFonts).toContain('Calibri');
    expect(ATS_REQUIREMENTS.safeFonts).toContain('Arial');
    expect(ATS_REQUIREMENTS.safeFonts).toContain('Times New Roman');
    expect(ATS_REQUIREMENTS.safeFonts).toContain('Garamond');
    expect(ATS_REQUIREMENTS.safeFonts).toContain('Georgia');
    expect(ATS_REQUIREMENTS.safeFonts).toContain('Helvetica');
  });

  it('should have font size min/max', () => {
    expect(ATS_REQUIREMENTS.fontSizes.min).toBe(10);
    expect(ATS_REQUIREMENTS.fontSizes.max).toBe(24);
  });

  it('should have standard section names', () => {
    expect(ATS_REQUIREMENTS.standardSectionNames.summary).toContain('Professional Summary');
    expect(ATS_REQUIREMENTS.standardSectionNames.experience).toContain('Professional Experience');
    expect(ATS_REQUIREMENTS.standardSectionNames.education).toContain('Education');
    expect(ATS_REQUIREMENTS.standardSectionNames.skills).toContain('Skills');
  });

  it('should list safe bullet characters', () => {
    expect(ATS_REQUIREMENTS.safeBullets).toContain('•');
    expect(ATS_REQUIREMENTS.safeBullets).toContain('-');
  });

  it('should list acceptable date formats', () => {
    expect(ATS_REQUIREMENTS.dateFormats.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// REVISION PATTERNS TESTS
// ============================================================================

describe('REVISION_PATTERNS', () => {
  it('should contain margin-related patterns', () => {
    expect(REVISION_PATTERNS.margins).toContain('widen margins');
    expect(REVISION_PATTERNS.margins).toContain('narrow margins');
  });

  it('should contain font-related patterns', () => {
    expect(REVISION_PATTERNS.fonts.length).toBeGreaterThan(0);
  });

  it('should contain layout-related patterns', () => {
    expect(REVISION_PATTERNS.layout.length).toBeGreaterThan(0);
  });

  it('should contain content-related patterns', () => {
    expect(REVISION_PATTERNS.content.length).toBeGreaterThan(0);
  });

  it('should contain spacing-related patterns', () => {
    expect(REVISION_PATTERNS.spacing.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// TYPE STRUCTURE ASSERTIONS
// ============================================================================

describe('ContactInfo type structure', () => {
  it('should require fullName and email', () => {
    const contact: ContactInfo = { fullName: 'John', email: 'john@test.com' };
    expect(contact.fullName).toBe('John');
    expect(contact.email).toBe('john@test.com');
  });

  it('should accept optional fields', () => {
    const contact: ContactInfo = {
      fullName: 'Jane',
      email: 'jane@test.com',
      phone: '555-1234',
      location: 'NYC',
      linkedin: 'linkedin.com/in/jane',
      website: 'jane.dev',
    };
    expect(contact.phone).toBe('555-1234');
  });
});

describe('WorkExperience type structure', () => {
  it('should require company, title, startDate, and bullets', () => {
    const exp: WorkExperience = {
      company: 'TechCo',
      title: 'Engineer',
      startDate: 'Jan 2020',
      bullets: ['Did something impactful'],
    };
    expect(exp.bullets).toHaveLength(1);
  });
});

describe('Education type structure', () => {
  it('should require institution and degree', () => {
    const edu: Education = { institution: 'MIT', degree: 'BS CS' };
    expect(edu.institution).toBe('MIT');
  });
});

describe('SkillCategory type structure', () => {
  it('should require items array', () => {
    const skill: SkillCategory = { items: ['TypeScript', 'React'] };
    expect(skill.items).toHaveLength(2);
  });

  it('should accept optional category label', () => {
    const skill: SkillCategory = { category: 'Languages', items: ['Python'] };
    expect(skill.category).toBe('Languages');
  });
});

describe('Certification type structure', () => {
  it('should require name', () => {
    const cert: Certification = { name: 'AWS SA' };
    expect(cert.name).toBe('AWS SA');
  });
});

describe('AdditionalSection type structure', () => {
  it('should require title and items', () => {
    const section: AdditionalSection = { title: 'Projects', items: ['Project A'] };
    expect(section.title).toBe('Projects');
  });
});

describe('ResumeFormatting type structure', () => {
  it('should require all formatting fields', () => {
    const formatting: ResumeFormatting = {
      template: 'modern',
      sectionOrder: ['summary', 'experience'],
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      fonts: {
        primary: 'Calibri',
        header: 'Calibri',
        sizes: { name: 22, sectionHeader: 12, body: 11, contact: 10 },
      },
      spacing: { lineHeight: 1.15, sectionGap: 14, paragraphGap: 6, bulletIndent: 16 },
    };
    expect(formatting.template).toBe('modern');
    expect(formatting.margins.top).toBe(1);
  });
});

describe('ResumeData type structure', () => {
  it('should compose all resume content types', () => {
    const data: ResumeData = {
      contact: { fullName: 'Test', email: 'test@test.com' },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };
    expect(data.contact.fullName).toBe('Test');
    expect(data.formatting.template).toBe('modern');
  });

  it('should accept all optional fields', () => {
    const data: ResumeData = {
      id: 'uuid-123',
      userId: 'user-456',
      createdAt: new Date(),
      updatedAt: new Date(),
      contact: { fullName: 'Test', email: 'test@test.com' },
      summary: 'A summary',
      experience: [],
      education: [],
      skills: [],
      certifications: [],
      additionalSections: [],
      formatting: MODERN_PRESET,
      ats: { score: 85, suggestions: ['Good resume'] },
    };
    expect(data.ats?.score).toBe(85);
  });
});

describe('ResumeGeneratorState type structure', () => {
  it('should have required state fields', () => {
    const state: ResumeGeneratorState = {
      step: 'welcome',
      questionsAsked: [],
      resumeData: {
        contact: { fullName: '', email: '' },
        experience: [],
        education: [],
        skills: [],
        formatting: MODERN_PRESET,
      },
      revisionHistory: [],
    };
    expect(state.step).toBe('welcome');
  });
});

describe('Type alias assertions', () => {
  it('ResumeTemplate should be a valid union', () => {
    const templates: ResumeTemplate[] = ['classic', 'modern', 'minimal'];
    expect(templates).toHaveLength(3);
  });

  it('FontFamily should include standard fonts', () => {
    const fonts: FontFamily[] = [
      'Calibri',
      'Arial',
      'Times New Roman',
      'Garamond',
      'Georgia',
      'Helvetica',
    ];
    expect(fonts).toHaveLength(6);
  });

  it('ResumeGeneratorStep should cover all steps', () => {
    const steps: ResumeGeneratorStep[] = [
      'welcome',
      'choose_path',
      'uploading',
      'parsing',
      'gathering_contact',
      'gathering_target_job',
      'gathering_experience',
      'gathering_education',
      'gathering_skills',
      'gathering_additional',
      'style_selection',
      'generating',
      'reviewing',
      'revising',
      'complete',
    ];
    expect(steps).toHaveLength(15);
  });

  it('RevisionCategory should cover categories', () => {
    const cats: RevisionCategory[] = ['margins', 'fonts', 'spacing', 'layout', 'content', 'style'];
    expect(cats).toHaveLength(6);
  });

  it('RevisionCommand should accept correct structure', () => {
    const cmd: RevisionCommand = { category: 'fonts', action: 'change', value: 'Arial' };
    expect(cmd.category).toBe('fonts');
  });

  it('TargetJob should accept all fields', () => {
    const job: TargetJob = { title: 'Engineer', company: 'TechCo', jobDescription: 'Build things' };
    expect(job.title).toBe('Engineer');
  });

  it('ExtractedKeywords should accept all arrays', () => {
    const kw: ExtractedKeywords = { required: ['a'], preferred: ['b'], found: ['a'], missing: [] };
    expect(kw.required).toHaveLength(1);
  });

  it('ATSOptimization should accept all optional fields', () => {
    const opt: ATSOptimization = {
      targetJob: { title: 'Dev' },
      extractedKeywords: { required: [], preferred: [], found: [], missing: [] },
      score: 90,
      suggestions: ['Great!'],
    };
    expect(opt.score).toBe(90);
  });
});
