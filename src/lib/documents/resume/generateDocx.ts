/**
 * Resume DOCX Generator
 *
 * Generates professional, ATS-friendly Word documents with perfect formatting.
 * Uses single-column layout, standard fonts, and proper section headers.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  TabStopType,
  TabStopPosition,
} from 'docx';
import type {
  ResumeData,
  ResumeFormatting,
  WorkExperience,
  Education,
  SkillCategory,
  Certification,
  AdditionalSection,
} from './types';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert points to twips (1 point = 20 twips)
 */
function ptToTwip(pt: number): number {
  return pt * 20;
}

/**
 * Convert points to half-points (for font sizes in docx)
 */
function ptToHalfPt(pt: number): number {
  return pt * 2;
}

/**
 * Get font name compatible with docx library
 */
function getFontName(font: string): string {
  // Map our font names to exact docx-compatible names
  const fontMap: Record<string, string> = {
    Calibri: 'Calibri',
    Arial: 'Arial',
    'Times New Roman': 'Times New Roman',
    Garamond: 'Garamond',
    Georgia: 'Georgia',
    Helvetica: 'Helvetica',
  };
  return fontMap[font] || 'Calibri';
}

// ============================================================================
// SECTION GENERATORS
// ============================================================================

/**
 * Create the name header (centered, large font)
 */
function createNameHeader(name: string, formatting: ResumeFormatting): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: ptToTwip(4) },
    children: [
      new TextRun({
        text: name.toUpperCase(),
        bold: true,
        size: ptToHalfPt(formatting.fonts.sizes.name),
        font: getFontName(formatting.fonts.header),
        color: formatting.colors?.primary?.replace('#', '') || '000000',
      }),
    ],
  });
}

/**
 * Create the contact line (centered, smaller font)
 */
function createContactLine(
  contact: ResumeData['contact'],
  formatting: ResumeFormatting
): Paragraph {
  const parts: string[] = [];

  if (contact.location) parts.push(contact.location);
  if (contact.phone) parts.push(contact.phone);
  if (contact.email) parts.push(contact.email);
  if (contact.linkedin) parts.push(contact.linkedin.replace('https://', '').replace('www.', ''));
  if (contact.website) parts.push(contact.website.replace('https://', '').replace('www.', ''));

  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: ptToTwip(formatting.spacing.sectionGap) },
    children: [
      new TextRun({
        text: parts.join('  |  '),
        size: ptToHalfPt(formatting.fonts.sizes.contact),
        font: getFontName(formatting.fonts.primary),
        color: formatting.colors?.muted?.replace('#', '') || '666666',
      }),
    ],
  });
}

/**
 * Create a section header with bottom border
 */
function createSectionHeader(title: string, formatting: ResumeFormatting): Paragraph {
  return new Paragraph({
    spacing: {
      before: ptToTwip(formatting.spacing.sectionGap),
      after: ptToTwip(4),
    },
    border: {
      bottom: {
        color: formatting.colors?.primary?.replace('#', '') || '000000',
        space: 1,
        size: 6,
        style: BorderStyle.SINGLE,
      },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: ptToHalfPt(formatting.fonts.sizes.sectionHeader),
        font: getFontName(formatting.fonts.header),
        color: formatting.colors?.primary?.replace('#', '') || '000000',
      }),
    ],
  });
}

/**
 * Create summary paragraph
 */
function createSummary(summary: string, formatting: ResumeFormatting): Paragraph[] {
  return [
    createSectionHeader('Professional Summary', formatting),
    new Paragraph({
      spacing: { after: ptToTwip(formatting.spacing.paragraphGap) },
      children: [
        new TextRun({
          text: summary,
          size: ptToHalfPt(formatting.fonts.sizes.body),
          font: getFontName(formatting.fonts.primary),
        }),
      ],
    }),
  ];
}

/**
 * Create experience section
 */
function createExperienceSection(
  experience: WorkExperience[],
  formatting: ResumeFormatting
): Paragraph[] {
  const paragraphs: Paragraph[] = [createSectionHeader('Professional Experience', formatting)];

  experience.forEach((job, index) => {
    // Job title and company on same line with dates right-aligned
    const dateText = job.endDate
      ? `${job.startDate} - ${job.endDate}`
      : `${job.startDate} - Present`;

    // Title line: Company | Title
    paragraphs.push(
      new Paragraph({
        spacing: {
          before: index > 0 ? ptToTwip(formatting.spacing.paragraphGap * 1.5) : 0,
          after: ptToTwip(2),
        },
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
          },
        ],
        children: [
          new TextRun({
            text: job.company,
            bold: true,
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
          new TextRun({
            text: job.location ? `, ${job.location}` : '',
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
          new TextRun({
            text: '\t',
          }),
          new TextRun({
            text: dateText,
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
            color: formatting.colors?.muted?.replace('#', '') || '666666',
          }),
        ],
      })
    );

    // Job title line
    paragraphs.push(
      new Paragraph({
        spacing: { after: ptToTwip(4) },
        children: [
          new TextRun({
            text: job.title,
            italics: true,
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
        ],
      })
    );

    // Bullet points
    job.bullets.forEach((bullet) => {
      paragraphs.push(
        new Paragraph({
          spacing: { after: ptToTwip(2) },
          indent: { left: ptToTwip(formatting.spacing.bulletIndent) },
          children: [
            new TextRun({
              text: '•  ',
              size: ptToHalfPt(formatting.fonts.sizes.body),
              font: getFontName(formatting.fonts.primary),
            }),
            new TextRun({
              text: bullet,
              size: ptToHalfPt(formatting.fonts.sizes.body),
              font: getFontName(formatting.fonts.primary),
            }),
          ],
        })
      );
    });
  });

  return paragraphs;
}

/**
 * Create education section
 */
function createEducationSection(education: Education[], formatting: ResumeFormatting): Paragraph[] {
  const paragraphs: Paragraph[] = [createSectionHeader('Education', formatting)];

  education.forEach((edu, index) => {
    // Institution and degree
    paragraphs.push(
      new Paragraph({
        spacing: {
          before: index > 0 ? ptToTwip(formatting.spacing.paragraphGap) : 0,
          after: ptToTwip(2),
        },
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
          },
        ],
        children: [
          new TextRun({
            text: edu.institution,
            bold: true,
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
          new TextRun({
            text: '\t',
          }),
          new TextRun({
            text: edu.graduationDate || '',
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
            color: formatting.colors?.muted?.replace('#', '') || '666666',
          }),
        ],
      })
    );

    // Degree line
    const degreeText = edu.field ? `${edu.degree} in ${edu.field}` : edu.degree;
    const extras: string[] = [];
    if (edu.gpa) extras.push(`GPA: ${edu.gpa}`);
    if (edu.honors?.length) extras.push(edu.honors.join(', '));

    paragraphs.push(
      new Paragraph({
        spacing: { after: ptToTwip(2) },
        children: [
          new TextRun({
            text: degreeText,
            italics: true,
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
          ...(extras.length
            ? [
                new TextRun({
                  text: `  |  ${extras.join('  |  ')}`,
                  size: ptToHalfPt(formatting.fonts.sizes.body),
                  font: getFontName(formatting.fonts.primary),
                  color: formatting.colors?.muted?.replace('#', '') || '666666',
                }),
              ]
            : []),
        ],
      })
    );
  });

  return paragraphs;
}

/**
 * Create skills section
 */
function createSkillsSection(skills: SkillCategory[], formatting: ResumeFormatting): Paragraph[] {
  const paragraphs: Paragraph[] = [createSectionHeader('Skills', formatting)];

  skills.forEach((category) => {
    if (category.category) {
      // With category label
      paragraphs.push(
        new Paragraph({
          spacing: { after: ptToTwip(2) },
          children: [
            new TextRun({
              text: `${category.category}: `,
              bold: true,
              size: ptToHalfPt(formatting.fonts.sizes.body),
              font: getFontName(formatting.fonts.primary),
            }),
            new TextRun({
              text: category.items.join(', '),
              size: ptToHalfPt(formatting.fonts.sizes.body),
              font: getFontName(formatting.fonts.primary),
            }),
          ],
        })
      );
    } else {
      // No category, just list skills
      paragraphs.push(
        new Paragraph({
          spacing: { after: ptToTwip(2) },
          children: [
            new TextRun({
              text: category.items.join('  •  '),
              size: ptToHalfPt(formatting.fonts.sizes.body),
              font: getFontName(formatting.fonts.primary),
            }),
          ],
        })
      );
    }
  });

  return paragraphs;
}

/**
 * Create certifications section
 */
function createCertificationsSection(
  certifications: Certification[],
  formatting: ResumeFormatting
): Paragraph[] {
  const paragraphs: Paragraph[] = [createSectionHeader('Certifications', formatting)];

  certifications.forEach((cert) => {
    const parts = [cert.name];
    if (cert.issuer) parts.push(cert.issuer);
    if (cert.date) parts.push(cert.date);

    paragraphs.push(
      new Paragraph({
        spacing: { after: ptToTwip(2) },
        indent: { left: ptToTwip(formatting.spacing.bulletIndent) },
        children: [
          new TextRun({
            text: '•  ',
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
          new TextRun({
            text: parts.join(' - '),
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
        ],
      })
    );
  });

  return paragraphs;
}

/**
 * Create additional section (Projects, Publications, etc.)
 */
function createAdditionalSection(
  section: AdditionalSection,
  formatting: ResumeFormatting
): Paragraph[] {
  const paragraphs: Paragraph[] = [createSectionHeader(section.title, formatting)];

  section.items.forEach((item) => {
    paragraphs.push(
      new Paragraph({
        spacing: { after: ptToTwip(2) },
        indent: { left: ptToTwip(formatting.spacing.bulletIndent) },
        children: [
          new TextRun({
            text: '•  ',
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
          new TextRun({
            text: item,
            size: ptToHalfPt(formatting.fonts.sizes.body),
            font: getFontName(formatting.fonts.primary),
          }),
        ],
      })
    );
  });

  return paragraphs;
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a professional resume DOCX
 */
export async function generateResumeDocx(data: ResumeData): Promise<Buffer> {
  const {
    contact,
    summary,
    experience,
    education,
    skills,
    certifications,
    additionalSections,
    formatting,
  } = data;

  // Build document sections based on sectionOrder
  const children: Paragraph[] = [];

  // Always start with name and contact
  children.push(createNameHeader(contact.fullName, formatting));
  children.push(createContactLine(contact, formatting));

  // Add sections in order
  for (const section of formatting.sectionOrder) {
    switch (section) {
      case 'summary':
        if (summary) {
          children.push(...createSummary(summary, formatting));
        }
        break;

      case 'experience':
        if (experience.length > 0) {
          children.push(...createExperienceSection(experience, formatting));
        }
        break;

      case 'education':
        if (education.length > 0) {
          children.push(...createEducationSection(education, formatting));
        }
        break;

      case 'skills':
        if (skills.length > 0) {
          children.push(...createSkillsSection(skills, formatting));
        }
        break;

      case 'certifications':
        if (certifications && certifications.length > 0) {
          children.push(...createCertificationsSection(certifications, formatting));
        }
        break;

      default:
        // Check additional sections
        const additionalSection = additionalSections?.find(
          (s) => s.title.toLowerCase() === section.toLowerCase()
        );
        if (additionalSection) {
          children.push(...createAdditionalSection(additionalSection, formatting));
        }
        break;
    }
  }

  // Create the document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(formatting.margins.top),
              bottom: convertInchesToTwip(formatting.margins.bottom),
              left: convertInchesToTwip(formatting.margins.left),
              right: convertInchesToTwip(formatting.margins.right),
            },
          },
        },
        children,
      },
    ],
  });

  // Generate buffer
  return await Packer.toBuffer(doc);
}

/**
 * Generate filename for the resume
 */
export function generateResumeFilename(name: string, format: 'docx' | 'pdf'): string {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${cleanName}_resume_${timestamp}.${format}`;
}
