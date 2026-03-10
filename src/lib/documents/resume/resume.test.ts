/**
 * Resume Generator Tests
 *
 * Tests document generation, ATS scoring, and conversation handling.
 */

import { describe, it, expect } from 'vitest';
import { generateResumeDocx, generateResumeFilename } from './generateDocx';
import { generateResumePdf } from './generatePdf';
import { generateResumeDocuments } from './conversationHandler';
import { scoreResumeForATS, extractKeywordsFromJobDescription } from './atsScoring';
import type { ResumeData } from './types';
import { MODERN_PRESET, CLASSIC_PRESET, MINIMAL_PRESET } from './types';

// Sample resume data for testing
const sampleResumeData: ResumeData = {
  contact: {
    fullName: 'Matthew Moser',
    email: 'm.moser338@gmail.com',
    phone: '555-562-6858',
    location: 'Boston, MA',
  },
  summary:
    'Experienced luxury retail professional with 10+ years in high-end jewelry and watch sales. Proven track record of building client relationships and exceeding sales targets.',
  experience: [
    {
      company: 'Cartier',
      title: 'Sales Advisor',
      location: 'Boston, MA',
      startDate: 'Jan 2019',
      endDate: 'Present',
      bullets: [
        'Managed portfolio of 200+ high-net-worth clients with average transaction value of $15,000',
        'Consistently exceeded quarterly sales targets by 20%, ranking in top 5% of sales team',
        'Developed expertise in luxury timepieces and fine jewelry collections',
      ],
    },
    {
      company: 'Van Cleef & Arpels',
      title: 'Sales Associate',
      location: 'Boston, MA',
      startDate: 'Jan 2014',
      endDate: 'Dec 2018',
      bullets: [
        'Cultivated relationships with affluent clientele in luxury jewelry market',
        'Achieved 115% of annual sales goal through personalized client service',
        'Trained new team members on product knowledge and sales techniques',
      ],
    },
  ],
  education: [
    {
      institution: 'Boston University',
      degree: 'Master of Business Administration',
      graduationDate: '2013',
    },
    {
      institution: 'Boston University',
      degree: 'Bachelor of Science',
      field: 'Engineering',
      graduationDate: '2011',
    },
  ],
  skills: [
    {
      category: 'Sales',
      items: ['Client Relationship Management', 'Luxury Sales', 'Product Knowledge'],
    },
    {
      category: 'Technical',
      items: ['Python Programming', 'CRM Systems'],
    },
    {
      category: 'Languages',
      items: ['English (Native)', 'Italian (Fluent)'],
    },
  ],
  certifications: [
    { name: 'GIA Diamond Graduate', issuer: 'Gemological Institute of America' },
    { name: 'Google Python Professional Certificate', issuer: 'Google' },
    { name: 'Brazilian Jiu-Jitsu Black Belt' },
  ],
  formatting: MODERN_PRESET,
};

describe('Resume Document Generation', () => {
  describe('generateResumeDocx', () => {
    it('should generate a Word document buffer', async () => {
      const buffer = await generateResumeDocx(sampleResumeData);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Check for DOCX magic bytes (PK ZIP signature)
      expect(buffer[0]).toBe(0x50); // P
      expect(buffer[1]).toBe(0x4b); // K
    });

    it('should generate different filenames', () => {
      const filename1 = generateResumeFilename('John Doe', 'docx');
      const filename2 = generateResumeFilename('Jane Smith', 'pdf');

      expect(filename1).toContain('john_doe');
      expect(filename1).toContain('.docx');
      expect(filename2).toContain('jane_smith');
      expect(filename2).toContain('.pdf');
    });
  });

  describe('generateResumePdf', () => {
    it('should generate a PDF document buffer', async () => {
      const buffer = await generateResumePdf(sampleResumeData);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);

      // Check for PDF magic bytes
      const header = buffer.toString('utf-8', 0, 4);
      expect(header).toBe('%PDF');
    });
  });

  describe('generateResumeDocuments', () => {
    it('should generate both Word and PDF documents', async () => {
      const result = await generateResumeDocuments(sampleResumeData);

      expect(result.docx).toBeInstanceOf(Buffer);
      expect(result.pdf).toBeInstanceOf(Buffer);
      expect(result.docxFilename).toContain('.docx');
      expect(result.pdfFilename).toContain('.pdf');

      // Both should have content
      expect(result.docx.length).toBeGreaterThan(0);
      expect(result.pdf.length).toBeGreaterThan(0);
    });
  });
});

describe('Template Presets', () => {
  it('should generate with MODERN_PRESET', async () => {
    const data = { ...sampleResumeData, formatting: MODERN_PRESET };
    const buffer = await generateResumeDocx(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate with CLASSIC_PRESET', async () => {
    const data = { ...sampleResumeData, formatting: CLASSIC_PRESET };
    const buffer = await generateResumeDocx(data);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should generate with MINIMAL_PRESET', async () => {
    const data = { ...sampleResumeData, formatting: MINIMAL_PRESET };
    const buffer = await generateResumeDocx(data);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('ATS Scoring', () => {
  it('should score a well-formatted resume highly', () => {
    const score = scoreResumeForATS(sampleResumeData);

    expect(score.overall).toBeGreaterThan(50);
    expect(score.breakdown.formatting).toBeGreaterThan(0);
    expect(score.breakdown.structure).toBeGreaterThan(0);
    expect(score.breakdown.content).toBeGreaterThan(0);
  });

  it('should identify issues with incomplete resumes', () => {
    const incompleteResume: ResumeData = {
      contact: {
        fullName: 'Test User',
        email: '',
      },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };

    const score = scoreResumeForATS(incompleteResume);

    expect(score.issues.length).toBeGreaterThan(0);
    expect(score.issues.some((i) => i.category === 'Structure')).toBe(true);
  });

  it('should extract keywords from job descriptions', () => {
    const jobDescription = `
      We are looking for a Software Engineer with experience in TypeScript and React.
      Must have 3+ years of experience with Python. Experience with AWS is preferred.
    `;

    const keywords = extractKeywordsFromJobDescription(jobDescription);

    expect(keywords.required.length + keywords.preferred.length).toBeGreaterThan(0);
  });
});

describe('Edge Cases', () => {
  it('should handle minimal resume data', async () => {
    const minimalData: ResumeData = {
      contact: {
        fullName: 'Test User',
        email: 'test@example.com',
      },
      experience: [],
      education: [],
      skills: [],
      formatting: MODERN_PRESET,
    };

    const docx = await generateResumeDocx(minimalData);
    const pdf = await generateResumePdf(minimalData);

    expect(docx.length).toBeGreaterThan(0);
    expect(pdf.length).toBeGreaterThan(0);
  });

  it('should handle special characters in names', async () => {
    const dataWithSpecialChars: ResumeData = {
      ...sampleResumeData,
      contact: {
        ...sampleResumeData.contact,
        fullName: "José María O'Brien-González",
      },
    };

    const docx = await generateResumeDocx(dataWithSpecialChars);
    expect(docx.length).toBeGreaterThan(0);
  });

  it('should handle very long bullet points', async () => {
    const dataWithLongBullets: ResumeData = {
      ...sampleResumeData,
      experience: [
        {
          company: 'Test Company',
          title: 'Test Role',
          startDate: 'Jan 2020',
          endDate: 'Present',
          bullets: [
            'A'.repeat(500), // Very long bullet point
          ],
        },
      ],
    };

    const docx = await generateResumeDocx(dataWithLongBullets);
    expect(docx.length).toBeGreaterThan(0);
  });
});
