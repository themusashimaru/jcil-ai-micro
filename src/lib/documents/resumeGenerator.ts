/**
 * RESUME GENERATOR
 * Creates professional Word documents from JSON resume data
 *
 * Uses docx library to generate .docx files
 * ATS-friendly format with clean, professional styling
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  TabStopPosition,
  TabStopType,
  Packer,
} from 'docx';
import type { ResumeDocument } from './types';

// Default styling
const DEFAULT_FONT = 'Calibri';
const DEFAULT_HEADER_COLOR = '1e3a5f'; // Navy blue
const SECTION_SPACING = 200; // Space between sections

/**
 * Generate a Word document from resume JSON
 */
export async function generateResumeDocx(resume: ResumeDocument): Promise<Buffer> {
  const fontFamily = resume.format?.fontFamily || DEFAULT_FONT;
  const baseFontSize = (resume.format?.fontSize || 11) * 2; // Convert pt to half-pt
  const primaryColor = resume.format?.primaryColor?.replace('#', '') || DEFAULT_HEADER_COLOR;

  const children: Paragraph[] = [];

  // ========================================
  // HEADER - Name
  // ========================================
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: resume.name.toUpperCase(),
          bold: true,
          size: 36, // 18pt
          font: fontFamily,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    })
  );

  // ========================================
  // CONTACT INFO
  // ========================================
  const contactParts: string[] = [];
  if (resume.contact.phone) contactParts.push(resume.contact.phone);
  if (resume.contact.email) contactParts.push(resume.contact.email);
  if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);
  if (resume.contact.website) contactParts.push(resume.contact.website);
  if (resume.contact.location) contactParts.push(resume.contact.location);

  if (contactParts.length > 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactParts.join(' | '),
            size: baseFontSize - 2,
            font: fontFamily,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: SECTION_SPACING },
      })
    );
  }

  // ========================================
  // PROFESSIONAL SUMMARY
  // ========================================
  if (resume.summary) {
    children.push(createSectionHeader('PROFESSIONAL SUMMARY', fontFamily, primaryColor));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.summary,
            size: baseFontSize,
            font: fontFamily,
          }),
        ],
        spacing: { after: SECTION_SPACING },
      })
    );
  }

  // ========================================
  // PROFESSIONAL EXPERIENCE
  // ========================================
  if (resume.experience && resume.experience.length > 0) {
    children.push(createSectionHeader('PROFESSIONAL EXPERIENCE', fontFamily, primaryColor));

    for (const exp of resume.experience) {
      // Company Name, Location | Dates (Company BOLD, dates right-aligned)
      const locationText = exp.location ? ` ${exp.location}` : '';
      const dateText = exp.endDate ? `${exp.startDate}-${exp.endDate}` : exp.startDate;

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${exp.company},`,
              bold: true,
              size: baseFontSize,
              font: fontFamily,
            }),
            new TextRun({
              text: locationText,
              size: baseFontSize,
              font: fontFamily,
            }),
            new TextRun({
              text: '\t',
            }),
            new TextRun({
              text: dateText,
              size: baseFontSize,
              font: fontFamily,
            }),
          ],
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: TabStopPosition.MAX,
            },
          ],
          spacing: { before: 120 },
        })
      );

      // Job Title (italic)
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: exp.title,
              italics: true,
              size: baseFontSize,
              font: fontFamily,
            }),
          ],
          spacing: { after: 50 },
        })
      );

      // Bullet points
      for (const bullet of exp.bullets) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: bullet,
                size: baseFontSize,
                font: fontFamily,
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 30 },
          })
        );
      }
    }

    // Add spacing after experience section
    children.push(
      new Paragraph({
        spacing: { after: SECTION_SPACING - 100 },
      })
    );
  }

  // ========================================
  // EDUCATION
  // ========================================
  if (resume.education && resume.education.length > 0) {
    children.push(createSectionHeader('EDUCATION', fontFamily, primaryColor));

    for (const edu of resume.education) {
      // Degree
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: edu.degree,
              bold: true,
              size: baseFontSize,
              font: fontFamily,
            }),
          ],
          spacing: { before: 100 },
        })
      );

      // School, Location | Graduation Date
      const locationText = edu.location ? `, ${edu.location}` : '';
      const gradText = edu.graduationDate || '';

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${edu.school}${locationText}`,
              size: baseFontSize,
              font: fontFamily,
            }),
            ...(gradText
              ? [
                  new TextRun({ text: '\t' }),
                  new TextRun({
                    text: gradText,
                    size: baseFontSize,
                    font: fontFamily,
                  }),
                ]
              : []),
          ],
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: TabStopPosition.MAX,
            },
          ],
          spacing: { after: 30 },
        })
      );

      // GPA if present
      if (edu.gpa) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `GPA: ${edu.gpa}`,
                size: baseFontSize,
                font: fontFamily,
              }),
            ],
            spacing: { after: 30 },
          })
        );
      }

      // Honors
      if (edu.honors && edu.honors.length > 0) {
        for (const honor of edu.honors) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: honor,
                  size: baseFontSize,
                  font: fontFamily,
                  italics: true,
                }),
              ],
              bullet: { level: 0 },
              spacing: { after: 30 },
            })
          );
        }
      }
    }

    children.push(
      new Paragraph({
        spacing: { after: SECTION_SPACING - 100 },
      })
    );
  }

  // ========================================
  // SKILLS
  // ========================================
  if (resume.skills && resume.skills.length > 0) {
    children.push(createSectionHeader('SKILLS', fontFamily, primaryColor));
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.skills.join(' | '),
            size: baseFontSize,
            font: fontFamily,
          }),
        ],
        spacing: { after: SECTION_SPACING },
      })
    );
  }

  // ========================================
  // CERTIFICATIONS
  // ========================================
  if (resume.certifications && resume.certifications.length > 0) {
    children.push(createSectionHeader('CERTIFICATIONS', fontFamily, primaryColor));

    for (const cert of resume.certifications) {
      const certText = cert.issuer
        ? `${cert.name} - ${cert.issuer}`
        : cert.name;
      const dateText = cert.date || '';

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: certText,
              size: baseFontSize,
              font: fontFamily,
            }),
            ...(dateText
              ? [
                  new TextRun({ text: '\t' }),
                  new TextRun({
                    text: dateText,
                    size: baseFontSize,
                    font: fontFamily,
                  }),
                ]
              : []),
          ],
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: TabStopPosition.MAX,
            },
          ],
          bullet: { level: 0 },
          spacing: { after: 30 },
        })
      );
    }
  }

  // ========================================
  // CREATE DOCUMENT
  // ========================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Create a section header with underline
 */
function createSectionHeader(
  text: string,
  fontFamily: string,
  color: string
): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        font: fontFamily,
        color,
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    border: {
      bottom: {
        color,
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    spacing: { before: 200, after: 100 },
  });
}
