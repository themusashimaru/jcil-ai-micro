/**
 * Tests for Resume DOCX Generator (resume/ subdirectory version)
 *
 * Tests generateResumeDocx and generateResumeFilename with mocked docx library
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
    AlignmentType: { CENTER: 'CENTER', LEFT: 'LEFT' },
    BorderStyle: { SINGLE: 'SINGLE' },
    TabStopPosition: { MAX: 9026 },
    TabStopType: { RIGHT: 'RIGHT' },
    Packer: mockPacker,
    convertInchesToTwip: vi.fn((inches: number) => inches * 1440),
  };
});

import { describe, it, expect, vi } from 'vitest';
import { generateResumeDocx, generateResumeFilename } from './generateDocx';
import type { ResumeData } from './types';
import { MODERN_PRESET, CLASSIC_PRESET, MINIMAL_PRESET } from './types';

const sampleData: ResumeData = {
  contact: {
    fullName: 'John Doe',
    email: 'john@example.com',
    phone: '555-1234',
    location: 'New York, NY',
    linkedin: 'https://linkedin.com/in/johndoe',
    website: 'https://www.johndoe.dev',
  },
  summary: 'Experienced software engineer specializing in full-stack development.',
  experience: [
    {
      company: 'TechCo',
      title: 'Senior Engineer',
      location: 'NYC, NY',
      startDate: 'Jan 2020',
      endDate: 'Present',
      bullets: [
        'Led a team of 5 engineers to deliver features on time',
        'Implemented CI/CD reducing deployment time by 40%',
      ],
    },
    {
      company: 'StartupInc',
      title: 'Developer',
      startDate: 'Mar 2017',
      endDate: 'Dec 2019',
      bullets: ['Built REST APIs in Python'],
    },
  ],
  education: [
    {
      institution: 'MIT',
      degree: 'Bachelor of Science',
      field: 'Computer Science',
      graduationDate: '2017',
      gpa: '3.9',
      honors: ['Magna Cum Laude', "Dean's List"],
    },
  ],
  skills: [
    { category: 'Languages', items: ['TypeScript', 'Python', 'Java'] },
    { items: ['Docker', 'AWS', 'Git'] },
  ],
  certifications: [{ name: 'AWS SA', issuer: 'Amazon', date: '2023' }, { name: 'CSM' }],
  additionalSections: [
    { title: 'Projects', items: ['Open source contributor', 'Built a SaaS platform'] },
  ],
  formatting: MODERN_PRESET,
};

describe('generateResumeDocx (resume/ version)', () => {
  it('should generate a buffer', async () => {
    const buffer = await generateResumeDocx(sampleData);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle minimal resume data', async () => {
    const minimal: ResumeData = {
      contact: { fullName: 'Test', email: 'test@test.com' },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };
    const buffer = await generateResumeDocx(minimal);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with only summary', async () => {
    const data: ResumeData = {
      contact: { fullName: 'Test', email: 'test@test.com' },
      summary: 'A brief summary.',
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle different template presets', async () => {
    const classicData = { ...sampleData, formatting: CLASSIC_PRESET };
    const minimalData = { ...sampleData, formatting: MINIMAL_PRESET };

    const classicBuffer = await generateResumeDocx(classicData);
    const minimalBuffer = await generateResumeDocx(minimalData);

    expect(classicBuffer).toBeInstanceOf(Buffer);
    expect(minimalBuffer).toBeInstanceOf(Buffer);
  });

  it('should handle experience without location', async () => {
    const data: ResumeData = {
      ...sampleData,
      experience: [
        { company: 'RemoteCo', title: 'Dev', startDate: 'Jan 2024', bullets: ['Worked remotely'] },
      ],
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle education without optional fields', async () => {
    const data: ResumeData = {
      ...sampleData,
      education: [{ institution: 'University', degree: 'BA' }],
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle skills without categories', async () => {
    const data: ResumeData = {
      ...sampleData,
      skills: [{ items: ['Skill1', 'Skill2', 'Skill3'] }],
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle certifications section', async () => {
    const data: ResumeData = {
      ...sampleData,
      formatting: {
        ...MODERN_PRESET,
        sectionOrder: ['certifications'],
      },
      certifications: [{ name: 'Cert A', issuer: 'Org', date: '2024' }, { name: 'Cert B' }],
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle additional sections', async () => {
    const data: ResumeData = {
      ...sampleData,
      formatting: {
        ...MODERN_PRESET,
        sectionOrder: ['projects'],
      },
      additionalSections: [{ title: 'Projects', items: ['Project A', 'Project B'] }],
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle contact info without optional fields', async () => {
    const data: ResumeData = {
      ...sampleData,
      contact: { fullName: 'Just Name', email: 'name@test.com' },
    };
    const buffer = await generateResumeDocx(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle contact info with all fields', async () => {
    const buffer = await generateResumeDocx(sampleData);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('generateResumeFilename', () => {
  it('should generate a docx filename with cleaned name', () => {
    const filename = generateResumeFilename('John Doe', 'docx');
    expect(filename).toContain('john_doe');
    expect(filename).toContain('_resume_');
    expect(filename).toMatch(/\.docx$/);
  });

  it('should generate a pdf filename', () => {
    const filename = generateResumeFilename('Jane Smith', 'pdf');
    expect(filename).toContain('jane_smith');
    expect(filename).toMatch(/\.pdf$/);
  });

  it('should remove special characters', () => {
    const filename = generateResumeFilename("José O'Brien-González!", 'docx');
    expect(filename).not.toMatch(/[!@#$%^&*()]/);
  });

  it('should include a date timestamp', () => {
    const filename = generateResumeFilename('Test', 'docx');
    // Should match YYYY-MM-DD pattern
    expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('should handle empty name', () => {
    const filename = generateResumeFilename('', 'docx');
    expect(filename).toContain('_resume_');
    expect(filename).toMatch(/\.docx$/);
  });

  it('should convert name to lowercase', () => {
    const filename = generateResumeFilename('UPPERCASE NAME', 'pdf');
    expect(filename).toContain('uppercase_name');
  });
});
