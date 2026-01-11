/**
 * Resume PDF Generator
 *
 * Generates professional, ATS-friendly PDF documents with perfect formatting.
 * Uses PDFKit for precise control over layout, matching the DOCX output exactly.
 */

import PDFDocument from 'pdfkit';
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
// CONSTANTS
// ============================================================================

// Standard page dimensions (US Letter)
const PAGE_WIDTH = 612; // 8.5 inches * 72 points/inch
const PAGE_HEIGHT = 792; // 11 inches * 72 points/inch

// Font mapping for PDFKit (built-in fonts)
const FONT_MAP: Record<string, string> = {
  Calibri: 'Helvetica',
  Arial: 'Helvetica',
  'Times New Roman': 'Times-Roman',
  Garamond: 'Times-Roman',
  Georgia: 'Times-Roman',
  Helvetica: 'Helvetica',
};

const FONT_BOLD_MAP: Record<string, string> = {
  Calibri: 'Helvetica-Bold',
  Arial: 'Helvetica-Bold',
  'Times New Roman': 'Times-Bold',
  Garamond: 'Times-Bold',
  Georgia: 'Times-Bold',
  Helvetica: 'Helvetica-Bold',
};

const FONT_ITALIC_MAP: Record<string, string> = {
  Calibri: 'Helvetica-Oblique',
  Arial: 'Helvetica-Oblique',
  'Times New Roman': 'Times-Italic',
  Garamond: 'Times-Italic',
  Georgia: 'Times-Italic',
  Helvetica: 'Helvetica-Oblique',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert inches to points (1 inch = 72 points)
 */
function inchesToPt(inches: number): number {
  return inches * 72;
}

/**
 * Get the mapped font name for PDFKit
 */
function getFont(fontFamily: string, style: 'normal' | 'bold' | 'italic' = 'normal'): string {
  switch (style) {
    case 'bold':
      return FONT_BOLD_MAP[fontFamily] || 'Helvetica-Bold';
    case 'italic':
      return FONT_ITALIC_MAP[fontFamily] || 'Helvetica-Oblique';
    default:
      return FONT_MAP[fontFamily] || 'Helvetica';
  }
}

/**
 * Convert hex color to PDFKit format
 */
function hexToColor(hex: string): string {
  return hex.replace('#', '');
}

// ============================================================================
// PDF DOCUMENT BUILDER CLASS
// ============================================================================

class ResumePDFBuilder {
  private doc: PDFKit.PDFDocument;
  private formatting: ResumeFormatting;
  private y: number;
  private leftMargin: number;
  private rightMargin: number;
  private contentWidth: number;

  constructor(formatting: ResumeFormatting) {
    this.formatting = formatting;
    this.leftMargin = inchesToPt(formatting.margins.left);
    this.rightMargin = inchesToPt(formatting.margins.right);
    this.contentWidth = PAGE_WIDTH - this.leftMargin - this.rightMargin;

    this.doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: inchesToPt(formatting.margins.top),
        bottom: inchesToPt(formatting.margins.bottom),
        left: this.leftMargin,
        right: this.rightMargin,
      },
      bufferPages: true,
    });

    this.y = inchesToPt(formatting.margins.top);
  }

  /**
   * Add vertical space
   */
  private addSpace(points: number): void {
    this.y += points;
  }

  /**
   * Check if we need a page break and add one if necessary
   */
  private checkPageBreak(neededHeight: number): void {
    const bottomMargin = inchesToPt(this.formatting.margins.bottom);
    if (this.y + neededHeight > PAGE_HEIGHT - bottomMargin) {
      this.doc.addPage();
      this.y = inchesToPt(this.formatting.margins.top);
    }
  }

  /**
   * Add name header (centered, large font)
   */
  addNameHeader(name: string): void {
    const fontSize = this.formatting.fonts.sizes.name;
    const font = getFont(this.formatting.fonts.header, 'bold');
    const color = hexToColor(this.formatting.colors?.primary || '#000000');

    this.doc.font(font).fontSize(fontSize).fillColor(color);

    const textWidth = this.doc.widthOfString(name.toUpperCase());
    const x = this.leftMargin + (this.contentWidth - textWidth) / 2;

    this.doc.text(name.toUpperCase(), x, this.y, {
      lineBreak: false,
    });

    this.addSpace(fontSize + 4);
  }

  /**
   * Add contact line (centered)
   */
  addContactLine(contact: ResumeData['contact']): void {
    const parts: string[] = [];

    if (contact.location) parts.push(contact.location);
    if (contact.phone) parts.push(contact.phone);
    if (contact.email) parts.push(contact.email);
    if (contact.linkedin) parts.push(contact.linkedin.replace('https://', '').replace('www.', ''));
    if (contact.website) parts.push(contact.website.replace('https://', '').replace('www.', ''));

    const text = parts.join('  |  ');
    const fontSize = this.formatting.fonts.sizes.contact;
    const font = getFont(this.formatting.fonts.primary);
    const color = hexToColor(this.formatting.colors?.muted || '#666666');

    this.doc.font(font).fontSize(fontSize).fillColor(color);

    const textWidth = this.doc.widthOfString(text);
    const x = this.leftMargin + (this.contentWidth - textWidth) / 2;

    this.doc.text(text, x, this.y, {
      lineBreak: false,
    });

    this.addSpace(fontSize + this.formatting.spacing.sectionGap);
  }

  /**
   * Add section header with underline
   */
  addSectionHeader(title: string): void {
    this.addSpace(this.formatting.spacing.sectionGap);

    const fontSize = this.formatting.fonts.sizes.sectionHeader;
    const font = getFont(this.formatting.fonts.header, 'bold');
    const color = hexToColor(this.formatting.colors?.primary || '#000000');

    this.doc
      .font(font)
      .fontSize(fontSize)
      .fillColor(color)
      .text(title.toUpperCase(), this.leftMargin, this.y);

    this.addSpace(fontSize + 2);

    // Add underline
    this.doc
      .strokeColor(color)
      .lineWidth(0.5)
      .moveTo(this.leftMargin, this.y)
      .lineTo(this.leftMargin + this.contentWidth, this.y)
      .stroke();

    this.addSpace(6);
  }

  /**
   * Add summary paragraph
   */
  addSummary(summary: string): void {
    this.addSectionHeader('Professional Summary');

    const fontSize = this.formatting.fonts.sizes.body;
    const font = getFont(this.formatting.fonts.primary);
    const color = hexToColor(this.formatting.colors?.text || '#000000');

    this.doc.font(font).fontSize(fontSize).fillColor(color);

    const textHeight = this.doc.heightOfString(summary, {
      width: this.contentWidth,
      lineGap: this.formatting.spacing.lineHeight * fontSize - fontSize,
    });

    this.checkPageBreak(textHeight);

    this.doc.text(summary, this.leftMargin, this.y, {
      width: this.contentWidth,
      lineGap: this.formatting.spacing.lineHeight * fontSize - fontSize,
    });

    this.y = this.doc.y + this.formatting.spacing.paragraphGap;
  }

  /**
   * Add experience section
   */
  addExperience(experience: WorkExperience[]): void {
    this.addSectionHeader('Professional Experience');

    const fontSize = this.formatting.fonts.sizes.body;
    const textColor = hexToColor(this.formatting.colors?.text || '#000000');
    const mutedColor = hexToColor(this.formatting.colors?.muted || '#666666');

    experience.forEach((job, index) => {
      if (index > 0) {
        this.addSpace(this.formatting.spacing.paragraphGap * 1.5);
      }

      // Company and dates line
      const dateText = job.endDate
        ? `${job.startDate} - ${job.endDate}`
        : `${job.startDate} - Present`;

      const companyText = job.location ? `${job.company}, ${job.location}` : job.company;

      // Company (bold, left)
      this.doc
        .font(getFont(this.formatting.fonts.primary, 'bold'))
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(companyText, this.leftMargin, this.y, {
          lineBreak: false,
          continued: false,
        });

      // Dates (right-aligned, muted)
      const dateWidth = this.doc.widthOfString(dateText);
      this.doc
        .font(getFont(this.formatting.fonts.primary))
        .fillColor(mutedColor)
        .text(dateText, this.leftMargin + this.contentWidth - dateWidth, this.y, {
          lineBreak: false,
        });

      this.addSpace(fontSize + 2);

      // Job title (italic)
      this.doc
        .font(getFont(this.formatting.fonts.primary, 'italic'))
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(job.title, this.leftMargin, this.y);

      this.addSpace(fontSize + 4);

      // Bullet points
      const bulletIndent = this.formatting.spacing.bulletIndent;
      job.bullets.forEach((bullet) => {
        const bulletText = `•  ${bullet}`;
        const textHeight = this.doc.heightOfString(bulletText, {
          width: this.contentWidth - bulletIndent,
        });

        this.checkPageBreak(textHeight);

        this.doc
          .font(getFont(this.formatting.fonts.primary))
          .fillColor(textColor)
          .text(bulletText, this.leftMargin + bulletIndent, this.y, {
            width: this.contentWidth - bulletIndent,
          });

        this.y = this.doc.y + 2;
      });
    });
  }

  /**
   * Add education section
   */
  addEducation(education: Education[]): void {
    this.addSectionHeader('Education');

    const fontSize = this.formatting.fonts.sizes.body;
    const textColor = hexToColor(this.formatting.colors?.text || '#000000');
    const mutedColor = hexToColor(this.formatting.colors?.muted || '#666666');

    education.forEach((edu, index) => {
      if (index > 0) {
        this.addSpace(this.formatting.spacing.paragraphGap);
      }

      // Institution and date
      this.doc
        .font(getFont(this.formatting.fonts.primary, 'bold'))
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(edu.institution, this.leftMargin, this.y, {
          lineBreak: false,
        });

      if (edu.graduationDate) {
        const dateWidth = this.doc.widthOfString(edu.graduationDate);
        this.doc
          .font(getFont(this.formatting.fonts.primary))
          .fillColor(mutedColor)
          .text(edu.graduationDate, this.leftMargin + this.contentWidth - dateWidth, this.y, {
            lineBreak: false,
          });
      }

      this.addSpace(fontSize + 2);

      // Degree line
      const degreeText = edu.field ? `${edu.degree} in ${edu.field}` : edu.degree;
      const extras: string[] = [];
      if (edu.gpa) extras.push(`GPA: ${edu.gpa}`);
      if (edu.honors?.length) extras.push(edu.honors.join(', '));

      this.doc
        .font(getFont(this.formatting.fonts.primary, 'italic'))
        .fillColor(textColor)
        .text(degreeText, this.leftMargin, this.y, {
          lineBreak: false,
          continued: extras.length > 0,
        });

      if (extras.length > 0) {
        this.doc
          .font(getFont(this.formatting.fonts.primary))
          .fillColor(mutedColor)
          .text(`  |  ${extras.join('  |  ')}`, {
            lineBreak: false,
          });
      }

      this.addSpace(fontSize + 2);
    });
  }

  /**
   * Add skills section
   */
  addSkills(skills: SkillCategory[]): void {
    this.addSectionHeader('Skills');

    const fontSize = this.formatting.fonts.sizes.body;
    const textColor = hexToColor(this.formatting.colors?.text || '#000000');

    skills.forEach((category) => {
      if (category.category) {
        // With category label
        this.doc
          .font(getFont(this.formatting.fonts.primary, 'bold'))
          .fontSize(fontSize)
          .fillColor(textColor)
          .text(`${category.category}: `, this.leftMargin, this.y, {
            lineBreak: false,
            continued: true,
          });

        this.doc.font(getFont(this.formatting.fonts.primary)).text(category.items.join(', '));
      } else {
        // No category, just list skills
        this.doc
          .font(getFont(this.formatting.fonts.primary))
          .fontSize(fontSize)
          .fillColor(textColor)
          .text(category.items.join('  •  '), this.leftMargin, this.y);
      }

      this.y = this.doc.y + 2;
    });
  }

  /**
   * Add certifications section
   */
  addCertifications(certifications: Certification[]): void {
    this.addSectionHeader('Certifications');

    const fontSize = this.formatting.fonts.sizes.body;
    const textColor = hexToColor(this.formatting.colors?.text || '#000000');
    const bulletIndent = this.formatting.spacing.bulletIndent;

    certifications.forEach((cert) => {
      const parts = [cert.name];
      if (cert.issuer) parts.push(cert.issuer);
      if (cert.date) parts.push(cert.date);

      const text = `•  ${parts.join(' - ')}`;

      this.doc
        .font(getFont(this.formatting.fonts.primary))
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(text, this.leftMargin + bulletIndent, this.y, {
          width: this.contentWidth - bulletIndent,
        });

      this.y = this.doc.y + 2;
    });
  }

  /**
   * Add additional section
   */
  addAdditionalSection(section: AdditionalSection): void {
    this.addSectionHeader(section.title);

    const fontSize = this.formatting.fonts.sizes.body;
    const textColor = hexToColor(this.formatting.colors?.text || '#000000');
    const bulletIndent = this.formatting.spacing.bulletIndent;

    section.items.forEach((item) => {
      const text = `•  ${item}`;
      const textHeight = this.doc.heightOfString(text, {
        width: this.contentWidth - bulletIndent,
      });

      this.checkPageBreak(textHeight);

      this.doc
        .font(getFont(this.formatting.fonts.primary))
        .fontSize(fontSize)
        .fillColor(textColor)
        .text(text, this.leftMargin + bulletIndent, this.y, {
          width: this.contentWidth - bulletIndent,
        });

      this.y = this.doc.y + 2;
    });
  }

  /**
   * Generate the PDF buffer
   */
  async toBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      this.doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      this.doc.on('end', () => resolve(Buffer.concat(chunks)));
      this.doc.on('error', reject);

      this.doc.end();
    });
  }
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a professional resume PDF
 */
export async function generateResumePdf(data: ResumeData): Promise<Buffer> {
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

  const builder = new ResumePDFBuilder(formatting);

  // Always start with name and contact
  builder.addNameHeader(contact.fullName);
  builder.addContactLine(contact);

  // Add sections in order
  for (const section of formatting.sectionOrder) {
    switch (section) {
      case 'summary':
        if (summary) {
          builder.addSummary(summary);
        }
        break;

      case 'experience':
        if (experience.length > 0) {
          builder.addExperience(experience);
        }
        break;

      case 'education':
        if (education.length > 0) {
          builder.addEducation(education);
        }
        break;

      case 'skills':
        if (skills.length > 0) {
          builder.addSkills(skills);
        }
        break;

      case 'certifications':
        if (certifications && certifications.length > 0) {
          builder.addCertifications(certifications);
        }
        break;

      default:
        // Check additional sections
        const additionalSection = additionalSections?.find(
          (s) => s.title.toLowerCase() === section.toLowerCase()
        );
        if (additionalSection) {
          builder.addAdditionalSection(additionalSection);
        }
        break;
    }
  }

  return builder.toBuffer();
}
