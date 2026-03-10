/**
 * Tests for Resume DOCX Generator (the top-level documents/ version)
 *
 * Tests generateResumeDocx with mocked docx library
 */

vi.mock('docx', () => {
  const mockPacker = {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('PK-mock-resume-docx')),
  };

  class MockDocument {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockParagraph {
    constructor(public options: Record<string, unknown>) {}
  }
  class MockTextRun {
    constructor(public options: Record<string, unknown>) {}
  }

  return {
    Document: MockDocument,
    Paragraph: MockParagraph,
    TextRun: MockTextRun,
    HeadingLevel: { HEADING_2: 'HEADING_2' },
    AlignmentType: { CENTER: 'CENTER', LEFT: 'LEFT' },
    BorderStyle: { SINGLE: 'SINGLE' },
    TabStopPosition: { MAX: 9026 },
    TabStopType: { RIGHT: 'RIGHT' },
    Packer: mockPacker,
  };
});

import { describe, it, expect, vi } from 'vitest';
import { generateResumeDocx } from './resumeGenerator';
import type { ResumeDocument } from './types';

const minimalResume: ResumeDocument = {
  type: 'resume',
  name: 'Test User',
  contact: { email: 'test@example.com' },
  experience: [],
  education: [],
};

const fullResume: ResumeDocument = {
  type: 'resume',
  name: 'Jane Smith',
  contact: {
    phone: '555-123-4567',
    email: 'jane@example.com',
    linkedin: 'linkedin.com/in/janesmith',
    website: 'janesmith.dev',
    location: 'San Francisco, CA',
  },
  summary: 'Experienced software engineer with 10+ years in full-stack development.',
  experience: [
    {
      title: 'Senior Engineer',
      company: 'TechCo',
      location: 'SF, CA',
      startDate: 'Jan 2020',
      endDate: 'Present',
      bullets: ['Led a team of 5 engineers', 'Delivered features on time'],
    },
    {
      title: 'Engineer',
      company: 'StartupInc',
      startDate: 'Mar 2015',
      endDate: 'Dec 2019',
      bullets: ['Built REST APIs'],
    },
  ],
  education: [
    {
      degree: 'BS Computer Science',
      school: 'Stanford',
      location: 'Palo Alto, CA',
      graduationDate: 'June 2015',
      gpa: '3.9',
      honors: ['Magna Cum Laude'],
    },
  ],
  skills: ['TypeScript', 'React', 'Node.js'],
  certifications: [
    { name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2023' },
    { name: 'Certified Scrum Master' },
  ],
};

describe('generateResumeDocx (top-level)', () => {
  it('should generate a buffer from minimal resume', async () => {
    const buffer = await generateResumeDocx(minimalResume);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate a buffer from full resume', async () => {
    const buffer = await generateResumeDocx(fullResume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with no contact info except email', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      contact: { email: 'only-email@example.com' },
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with summary', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      summary: 'A brief professional summary.',
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with skills', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      skills: ['Python', 'Java', 'SQL'],
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with certifications that have no issuer', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      certifications: [{ name: 'Self-Taught Certificate' }],
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with custom font format', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      format: {
        fontFamily: 'Georgia',
        fontSize: 12,
        primaryColor: '#ff0000',
      },
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle experience entries without endDate (current job)', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      experience: [
        {
          title: 'Current Role',
          company: 'Current Inc',
          startDate: 'Jan 2024',
          bullets: ['Doing work'],
        },
      ],
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle education without optional fields', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      education: [{ degree: 'BA Arts', school: 'University' }],
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle education with honors', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      education: [
        {
          degree: 'BS',
          school: 'MIT',
          honors: ["Dean's List", 'Summa Cum Laude'],
        },
      ],
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle certifications with dates', async () => {
    const resume: ResumeDocument = {
      ...minimalResume,
      certifications: [
        { name: 'Cert A', issuer: 'Org A', date: '2023' },
        { name: 'Cert B', date: '2024' },
      ],
    };
    const buffer = await generateResumeDocx(resume);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});
