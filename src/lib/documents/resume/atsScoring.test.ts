/**
 * Tests for ATS Scoring and Keyword Analysis
 *
 * Tests extractKeywordsFromJobDescription, scoreResumeForATS,
 * getATSOptimizationReport, and createATSOptimization
 */

import { describe, it, expect } from 'vitest';
import {
  extractKeywordsFromJobDescription,
  scoreResumeForATS,
  getATSOptimizationReport,
  createATSOptimization,
} from './atsScoring';
import type { ATSScore } from './atsScoring';
import type { ResumeData } from './types';
import { MODERN_PRESET } from './types';

// ============================================================================
// FIXTURES
// ============================================================================

const completeResume: ResumeData = {
  contact: {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    location: 'San Francisco, CA',
  },
  summary:
    'Experienced software engineer with expertise in python and react development. Achieved 30% improvement in system performance.',
  experience: [
    {
      company: 'TechCo',
      title: 'Senior Engineer',
      startDate: 'Jan 2020',
      endDate: 'Present',
      bullets: [
        'Led development of microservices architecture serving 1 million users',
        'Implemented CI/CD pipeline reducing deployment time by 40%',
        'Managed team of 5 engineers delivering features on schedule',
      ],
    },
    {
      company: 'StartupInc',
      title: 'Software Developer',
      startDate: 'Jan 2017',
      endDate: 'Dec 2019',
      bullets: [
        'Developed REST APIs using python and django',
        'Built frontend applications with react and typescript',
      ],
    },
  ],
  education: [
    {
      institution: 'MIT',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      graduationDate: '2017',
    },
  ],
  skills: [
    { category: 'Programming', items: ['python', 'typescript', 'javascript'] },
    { category: 'Frameworks', items: ['react', 'django', 'node.js'] },
  ],
  certifications: [{ name: 'AWS Solutions Architect', issuer: 'Amazon' }],
  formatting: MODERN_PRESET,
};

const incompleteResume: ResumeData = {
  contact: {
    fullName: '',
    email: '',
  },
  experience: [],
  education: [],
  skills: [],
  formatting: MODERN_PRESET,
};

const resumeWithWeakBullets: ResumeData = {
  ...completeResume,
  experience: [
    {
      company: 'Co',
      title: 'Dev',
      startDate: 'Jan 2020',
      bullets: [
        'Responsible for writing code',
        'Worked on various projects',
        'Helped with team tasks',
        'Was involved in deployments',
      ],
    },
  ],
};

// ============================================================================
// extractKeywordsFromJobDescription
// ============================================================================

describe('extractKeywordsFromJobDescription', () => {
  it('should extract technical skills from job description', () => {
    const desc =
      'Looking for a developer with experience in React and Python. Must have SQL knowledge.';
    const keywords = extractKeywordsFromJobDescription(desc);

    const allKeywords = [...keywords.required, ...keywords.preferred];
    expect(allKeywords.some((k) => k.toLowerCase() === 'react')).toBe(true);
    expect(allKeywords.some((k) => k.toLowerCase() === 'python')).toBe(true);
    expect(allKeywords.some((k) => k.toLowerCase() === 'sql')).toBe(true);
  });

  it('should distinguish required from preferred keywords', () => {
    const desc = 'Must have experience with Python. Nice to have: React and Vue.';
    const keywords = extractKeywordsFromJobDescription(desc);

    expect(keywords.required.some((k) => k.toLowerCase() === 'python')).toBe(true);
  });

  it('should extract years of experience requirements', () => {
    const desc = 'Required: 5+ years of experience in software development.';
    const keywords = extractKeywordsFromJobDescription(desc);

    expect(keywords.required.some((k) => k.includes('5'))).toBe(true);
  });

  it('should extract degree requirements', () => {
    const desc = "Bachelor's degree in Computer Science required. Master's degree preferred.";
    const keywords = extractKeywordsFromJobDescription(desc);

    const allRequired = keywords.required.map((k) => k.toLowerCase());
    expect(allRequired.some((k) => k.includes('bachelor'))).toBe(true);
  });

  it('should handle empty job description', () => {
    const keywords = extractKeywordsFromJobDescription('');
    expect(keywords.required).toEqual([]);
    expect(keywords.preferred).toEqual([]);
  });

  it('should deduplicate keywords', () => {
    const desc = 'Python Python Python. Must have Python. Experience with Python required.';
    const keywords = extractKeywordsFromJobDescription(desc);

    const allPython = [...keywords.required, ...keywords.preferred].filter(
      (k) => k.toLowerCase() === 'python'
    );
    expect(allPython.length).toBeLessThanOrEqual(1);
  });

  it('should extract cloud and tool keywords', () => {
    const desc = 'Experience with AWS, Docker, and Kubernetes. Proficiency in Git and Jira.';
    const keywords = extractKeywordsFromJobDescription(desc);

    const allKeywords = [...keywords.required, ...keywords.preferred].map((k) => k.toLowerCase());
    expect(allKeywords).toContain('aws');
    expect(allKeywords).toContain('docker');
  });

  it('should initialize found and missing as empty arrays', () => {
    const keywords = extractKeywordsFromJobDescription('Some job description with react');
    expect(keywords.found).toEqual([]);
    expect(keywords.missing).toEqual([]);
  });
});

// ============================================================================
// scoreResumeForATS
// ============================================================================

describe('scoreResumeForATS', () => {
  it('should return a score between 0 and 100', () => {
    const score = scoreResumeForATS(completeResume);
    expect(score.overall).toBeGreaterThanOrEqual(0);
    expect(score.overall).toBeLessThanOrEqual(100);
  });

  it('should have all four breakdown categories', () => {
    const score = scoreResumeForATS(completeResume);
    expect(score.breakdown.formatting).toBeDefined();
    expect(score.breakdown.keywords).toBeDefined();
    expect(score.breakdown.structure).toBeDefined();
    expect(score.breakdown.content).toBeDefined();
  });

  it('should score a complete resume higher than an incomplete one', () => {
    const completeScore = scoreResumeForATS(completeResume);
    const incompleteScore = scoreResumeForATS(incompleteResume);

    expect(completeScore.overall).toBeGreaterThan(incompleteScore.overall);
  });

  it('should report structural issues for missing email', () => {
    const score = scoreResumeForATS(incompleteResume);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('email'))).toBe(true);
  });

  it('should report structural issues for missing name', () => {
    const score = scoreResumeForATS(incompleteResume);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('name'))).toBe(true);
  });

  it('should report structural issues for no experience', () => {
    const score = scoreResumeForATS(incompleteResume);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('experience'))).toBe(true);
  });

  it('should warn about weak action verbs', () => {
    const score = scoreResumeForATS(resumeWithWeakBullets);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('action verb'))).toBe(true);
  });

  it('should flag very long bullet points', () => {
    const resumeWithLongBullets: ResumeData = {
      ...completeResume,
      experience: [
        {
          company: 'Co',
          title: 'Role',
          startDate: 'Jan 2020',
          bullets: ['A'.repeat(250)],
        },
      ],
    };

    const score = scoreResumeForATS(resumeWithLongBullets);
    expect(score.issues.some((i) => i.message.includes('too long'))).toBe(true);
  });

  it('should warn about non-ATS-safe fonts', () => {
    const resumeWithBadFont: ResumeData = {
      ...completeResume,
      formatting: {
        ...MODERN_PRESET,
        fonts: {
          ...MODERN_PRESET.fonts,
          primary: 'Comic Sans' as unknown as 'Calibri',
        },
      },
    };

    const score = scoreResumeForATS(resumeWithBadFont);
    expect(score.issues.some((i) => i.category === 'Formatting')).toBe(true);
  });

  it('should warn about font too small', () => {
    const resumeWithSmallFont: ResumeData = {
      ...completeResume,
      formatting: {
        ...MODERN_PRESET,
        fonts: {
          ...MODERN_PRESET.fonts,
          sizes: { ...MODERN_PRESET.fonts.sizes, body: 8 },
        },
      },
    };

    const score = scoreResumeForATS(resumeWithSmallFont);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('too small'))).toBe(true);
  });

  it('should warn about narrow margins', () => {
    const resumeWithNarrowMargins: ResumeData = {
      ...completeResume,
      formatting: {
        ...MODERN_PRESET,
        margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 },
      },
    };

    const score = scoreResumeForATS(resumeWithNarrowMargins);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('margin'))).toBe(true);
  });

  it('should do keyword analysis when target job is provided', () => {
    const targetJob = {
      title: 'Senior React Developer',
      jobDescription: 'Must have experience with React and TypeScript. Python required.',
    };

    const score = scoreResumeForATS(completeResume, targetJob);
    expect(score.breakdown.keywords).toBeDefined();
  });

  it('should include suggestions', () => {
    const score = scoreResumeForATS(completeResume);
    expect(score.suggestions.length).toBeGreaterThan(0);
  });

  it('should handle resume with no skills section', () => {
    const noSkills: ResumeData = {
      ...completeResume,
      skills: [],
    };
    const score = scoreResumeForATS(noSkills);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('skills'))).toBe(true);
  });

  it('should handle resume with no education', () => {
    const noEdu: ResumeData = {
      ...completeResume,
      education: [],
    };
    const score = scoreResumeForATS(noEdu);
    expect(score.issues.some((i) => i.message.toLowerCase().includes('education'))).toBe(true);
  });
});

// ============================================================================
// getATSOptimizationReport
// ============================================================================

describe('getATSOptimizationReport', () => {
  it('should return a markdown-formatted string', () => {
    const score = scoreResumeForATS(completeResume);
    const report = getATSOptimizationReport(score);

    expect(report).toContain('## ATS Compatibility Score');
    expect(report).toContain('### Score Breakdown');
  });

  it('should include score breakdown', () => {
    const score = scoreResumeForATS(completeResume);
    const report = getATSOptimizationReport(score);

    expect(report).toContain('Formatting');
    expect(report).toContain('Keywords');
    expect(report).toContain('Structure');
    expect(report).toContain('Content');
  });

  it('should include issues section when there are issues', () => {
    const score = scoreResumeForATS(incompleteResume);
    const report = getATSOptimizationReport(score);

    expect(report).toContain('### Issues Found');
  });

  it('should include suggestions', () => {
    const score = scoreResumeForATS(completeResume);
    const report = getATSOptimizationReport(score);

    expect(report).toContain('### Suggestions');
  });

  it('should handle score with no issues', () => {
    const mockScore: ATSScore = {
      overall: 95,
      breakdown: { formatting: 100, keywords: 100, structure: 100, content: 80 },
      issues: [],
      suggestions: ['Your resume is well-optimized!'],
    };

    const report = getATSOptimizationReport(mockScore);
    expect(report).not.toContain('### Issues Found');
    expect(report).toContain('well-optimized');
  });

  it('should display fix suggestions for issues', () => {
    const mockScore: ATSScore = {
      overall: 60,
      breakdown: { formatting: 80, keywords: 50, structure: 60, content: 50 },
      issues: [
        { severity: 'error', category: 'Structure', message: 'Missing email', fix: 'Add email' },
      ],
      suggestions: [],
    };

    const report = getATSOptimizationReport(mockScore);
    expect(report).toContain('Add email');
  });
});

// ============================================================================
// createATSOptimization
// ============================================================================

describe('createATSOptimization', () => {
  it('should create optimization object with score', () => {
    const optimization = createATSOptimization(completeResume);
    expect(optimization.score).toBeDefined();
    expect(typeof optimization.score).toBe('number');
  });

  it('should include suggestions', () => {
    const optimization = createATSOptimization(completeResume);
    expect(optimization.suggestions).toBeDefined();
    expect(Array.isArray(optimization.suggestions)).toBe(true);
  });

  it('should extract keywords when target job is provided', () => {
    const targetJob = {
      title: 'Developer',
      jobDescription: 'Experience with react and python required.',
    };

    const optimization = createATSOptimization(completeResume, targetJob);
    expect(optimization.targetJob).toBe(targetJob);
    expect(optimization.extractedKeywords).toBeDefined();
    expect(optimization.extractedKeywords?.found.length).toBeGreaterThanOrEqual(0);
  });

  it('should not extract keywords without target job', () => {
    const optimization = createATSOptimization(completeResume);
    expect(optimization.extractedKeywords).toBeUndefined();
  });

  it('should populate found keywords for matching skills', () => {
    const targetJob = {
      title: 'Python Developer',
      jobDescription: 'Must have python experience. React preferred.',
    };

    const optimization = createATSOptimization(completeResume, targetJob);
    expect(optimization.extractedKeywords?.found.length).toBeGreaterThan(0);
  });

  it('should populate missing keywords for non-matching required skills', () => {
    const targetJob = {
      title: 'Rust Developer',
      jobDescription: 'Must have experience with Rust. Proficient in Kotlin required.',
    };

    const optimization = createATSOptimization(completeResume, targetJob);
    expect(optimization.extractedKeywords?.missing.length).toBeGreaterThan(0);
  });
});
