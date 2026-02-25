/**
 * Tests for Resume PDF Generator (resume/ subdirectory)
 *
 * Tests generateResumePdf with mocked PDFKit
 */

vi.mock('pdfkit', () => {
  class SimpleEmitter {
    private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
    on(event: string, fn: (...args: unknown[]) => void) {
      (this._listeners[event] ??= []).push(fn);
      return this;
    }
    emit(event: string, ...args: unknown[]) {
      this._listeners[event]?.forEach((fn) => fn(...args));
      return true;
    }
  }

  class MockPDFDocument extends SimpleEmitter {
    page = {
      width: 612,
      height: 792,
    };
    y = 72;

    constructor(public options?: Record<string, unknown>) {
      super();
    }
    font() {
      return this;
    }
    fontSize() {
      return this;
    }
    fillColor() {
      return this;
    }
    strokeColor() {
      return this;
    }
    lineWidth() {
      return this;
    }
    text(_text: string, _x?: number, _y?: number, _opts?: unknown) {
      return this;
    }
    moveDown(n: number = 1) {
      this.y += n * 12;
      return this;
    }
    moveTo() {
      return this;
    }
    lineTo() {
      return this;
    }
    stroke() {
      return this;
    }
    rect() {
      return this;
    }
    fill() {
      return this;
    }
    addPage() {
      this.y = 72;
      return this;
    }
    widthOfString() {
      return 100;
    }
    heightOfString() {
      return 20;
    }
    end() {
      this.emit('data', Buffer.from('%PDF-resume-mock'));
      this.emit('end');
    }
  }

  return { default: MockPDFDocument };
});

import { describe, it, expect, vi } from 'vitest';
import { generateResumePdf } from './generatePdf';
import type { ResumeData } from './types';
import { MODERN_PRESET, CLASSIC_PRESET, MINIMAL_PRESET } from './types';

const sampleData: ResumeData = {
  contact: {
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-9876',
    location: 'San Francisco, CA',
    linkedin: 'https://linkedin.com/in/janesmith',
    website: 'https://www.janesmith.dev',
  },
  summary: 'Full-stack engineer with 8 years of experience building scalable applications.',
  experience: [
    {
      company: 'BigTech',
      title: 'Staff Engineer',
      location: 'SF, CA',
      startDate: 'Jan 2021',
      endDate: 'Present',
      bullets: [
        'Led architecture of microservices platform serving 5M users',
        'Reduced infrastructure costs by 35% through optimization',
      ],
    },
    {
      company: 'Startup',
      title: 'Engineer',
      startDate: 'Jun 2016',
      endDate: 'Dec 2020',
      bullets: ['Built core product features'],
    },
  ],
  education: [
    {
      institution: 'Stanford University',
      degree: 'Master of Science',
      field: 'Computer Science',
      graduationDate: '2016',
      gpa: '3.95',
      honors: ['Phi Beta Kappa'],
    },
    {
      institution: 'UC Berkeley',
      degree: 'Bachelor of Science',
      field: 'EECS',
      graduationDate: '2014',
    },
  ],
  skills: [
    { category: 'Frontend', items: ['React', 'TypeScript', 'CSS'] },
    { items: ['Docker', 'AWS'] },
  ],
  certifications: [
    { name: 'AWS SA Pro', issuer: 'Amazon', date: '2023' },
    { name: 'GCP Professional' },
  ],
  additionalSections: [{ title: 'Publications', items: ['Paper on distributed systems'] }],
  formatting: MODERN_PRESET,
};

describe('generateResumePdf', () => {
  it('should generate a PDF buffer', async () => {
    const buffer = await generateResumePdf(sampleData);
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
    const buffer = await generateResumePdf(minimal);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle resume with only summary', async () => {
    const data: ResumeData = {
      contact: { fullName: 'Test', email: 'test@test.com' },
      summary: 'A professional summary.',
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle classic preset', async () => {
    const data = { ...sampleData, formatting: CLASSIC_PRESET };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle minimal preset', async () => {
    const data = { ...sampleData, formatting: MINIMAL_PRESET };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle experience without location', async () => {
    const data: ResumeData = {
      ...sampleData,
      experience: [
        { company: 'Remote Co', title: 'Dev', startDate: 'Jan 2024', bullets: ['Worked remotely'] },
      ],
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle experience with endDate', async () => {
    const data: ResumeData = {
      ...sampleData,
      experience: [
        {
          company: 'OldCo',
          title: 'Junior Dev',
          startDate: 'Jan 2015',
          endDate: 'Dec 2017',
          bullets: ['Learned a lot'],
        },
      ],
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle education without optional fields', async () => {
    const data: ResumeData = {
      ...sampleData,
      education: [{ institution: 'University', degree: 'BA' }],
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle education with gpa and honors', async () => {
    const data: ResumeData = {
      ...sampleData,
      education: [
        {
          institution: 'MIT',
          degree: 'BS',
          field: 'CS',
          gpa: '4.0',
          honors: ['Summa Cum Laude'],
        },
      ],
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle skills with categories', async () => {
    const buffer = await generateResumePdf(sampleData);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle skills without categories', async () => {
    const data: ResumeData = {
      ...sampleData,
      skills: [{ items: ['Skill1', 'Skill2'] }],
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle certifications section', async () => {
    const data: ResumeData = {
      ...sampleData,
      formatting: {
        ...MODERN_PRESET,
        sectionOrder: ['certifications'],
      },
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle additional sections', async () => {
    const data: ResumeData = {
      ...sampleData,
      formatting: {
        ...MODERN_PRESET,
        sectionOrder: ['publications'],
      },
      additionalSections: [{ title: 'Publications', items: ['Paper A', 'Paper B'] }],
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle contact without optional fields', async () => {
    const data: ResumeData = {
      ...sampleData,
      contact: { fullName: 'Simple Name', email: 'simple@test.com' },
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('should handle contact with linkedin without https prefix', async () => {
    const data: ResumeData = {
      ...sampleData,
      contact: {
        fullName: 'Test',
        email: 'test@test.com',
        linkedin: 'linkedin.com/in/test',
      },
    };
    const buffer = await generateResumePdf(data);
    expect(buffer).toBeInstanceOf(Buffer);
  });
});
