/**
 * Resume Generator - Type Definitions
 *
 * Data models for resume content, formatting, and ATS optimization.
 * These types ensure consistent, professional resume generation.
 */

// ============================================================================
// RESUME CONTENT TYPES
// ============================================================================

export interface ContactInfo {
  fullName: string;
  email: string;
  phone?: string;
  location?: string; // City, State
  linkedin?: string;
  website?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  location?: string;
  startDate: string; // "Jan 2020"
  endDate?: string; // "Present" or "Dec 2023"
  bullets: string[]; // Achievement bullet points
}

export interface Education {
  id: string;
  institution: string;
  degree: string; // "Bachelor of Science"
  field: string; // "Computer Science"
  graduationDate?: string;
  gpa?: string;
  honors?: string[];
}

export interface SkillCategory {
  category?: string; // "Technical", "Languages", etc.
  items: string[];
}

export interface Certification {
  name: string;
  issuer?: string;
  date?: string;
}

export interface AdditionalSection {
  title: string; // "Projects", "Publications", etc.
  items: string[];
}

// ============================================================================
// FORMATTING TYPES
// ============================================================================

export type ResumeTemplate = 'classic' | 'modern' | 'minimal';

export type FontFamily =
  | 'Calibri'
  | 'Arial'
  | 'Times New Roman'
  | 'Garamond'
  | 'Georgia'
  | 'Helvetica';

export interface Margins {
  top: number; // inches (0.5 - 1.5)
  bottom: number;
  left: number;
  right: number;
}

export interface FontSizes {
  name: number; // 18-24pt
  sectionHeader: number; // 11-14pt
  body: number; // 10-12pt
  contact: number; // 9-11pt
}

export interface Fonts {
  primary: FontFamily;
  header: FontFamily;
  sizes: FontSizes;
}

export interface Spacing {
  lineHeight: number; // 1.0 - 1.5
  sectionGap: number; // pts between sections
  paragraphGap: number; // pts between paragraphs
  bulletIndent: number; // pts for bullet indentation
}

export interface Colors {
  primary: string; // Header/accent color (hex)
  text: string; // Body text
  muted: string; // Secondary text
}

export interface ResumeFormatting {
  template: ResumeTemplate;
  sectionOrder: string[]; // ['summary', 'experience', 'education', 'skills']
  margins: Margins;
  fonts: Fonts;
  spacing: Spacing;
  colors?: Colors; // Only for modern template
}

// ============================================================================
// ATS OPTIMIZATION TYPES
// ============================================================================

export interface TargetJob {
  title: string;
  company?: string;
  jobDescription?: string;
}

export interface ExtractedKeywords {
  required: string[];
  preferred: string[];
  found: string[];
  missing: string[];
}

export interface ATSOptimization {
  targetJob?: TargetJob;
  extractedKeywords?: ExtractedKeywords;
  score?: number; // 0-100
  suggestions?: string[];
}

// ============================================================================
// MAIN RESUME DATA TYPE
// ============================================================================

export interface ResumeData {
  // Meta
  id?: string;
  userId?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Content
  contact: ContactInfo;
  summary?: string;
  experience: WorkExperience[];
  education: Education[];
  skills: SkillCategory[];
  certifications?: Certification[];
  additionalSections?: AdditionalSection[];

  // Formatting
  formatting: ResumeFormatting;

  // ATS
  ats?: ATSOptimization;
}

// ============================================================================
// TEMPLATE PRESETS
// ============================================================================

export const CLASSIC_PRESET: ResumeFormatting = {
  template: 'classic',
  sectionOrder: ['summary', 'experience', 'education', 'skills', 'certifications'],
  margins: { top: 1, bottom: 1, left: 1, right: 1 },
  fonts: {
    primary: 'Times New Roman',
    header: 'Times New Roman',
    sizes: { name: 20, sectionHeader: 12, body: 11, contact: 10 },
  },
  spacing: { lineHeight: 1.15, sectionGap: 12, paragraphGap: 6, bulletIndent: 18 },
};

export const MODERN_PRESET: ResumeFormatting = {
  template: 'modern',
  sectionOrder: ['summary', 'experience', 'education', 'skills', 'certifications'],
  margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 },
  fonts: {
    primary: 'Calibri',
    header: 'Calibri',
    sizes: { name: 22, sectionHeader: 12, body: 11, contact: 10 },
  },
  spacing: { lineHeight: 1.15, sectionGap: 14, paragraphGap: 6, bulletIndent: 16 },
  colors: { primary: '#2563eb', text: '#1f2937', muted: '#6b7280' },
};

export const MINIMAL_PRESET: ResumeFormatting = {
  template: 'minimal',
  sectionOrder: ['experience', 'education', 'skills'],
  margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
  fonts: {
    primary: 'Arial',
    header: 'Arial',
    sizes: { name: 18, sectionHeader: 11, body: 10, contact: 9 },
  },
  spacing: { lineHeight: 1.1, sectionGap: 10, paragraphGap: 4, bulletIndent: 14 },
};

export const TEMPLATE_PRESETS: Record<ResumeTemplate, ResumeFormatting> = {
  classic: CLASSIC_PRESET,
  modern: MODERN_PRESET,
  minimal: MINIMAL_PRESET,
};

// ============================================================================
// ATS REQUIREMENTS
// ============================================================================

export const ATS_REQUIREMENTS = {
  // Layout constraints for ATS compatibility
  layout: {
    singleColumn: true,
    noTables: true,
    noTextBoxes: true,
    noGraphics: true,
    noHeaders: true,
    noFooters: true,
  },

  // Safe fonts that ATS can parse
  safeFonts: ['Calibri', 'Arial', 'Times New Roman', 'Garamond', 'Georgia', 'Helvetica'] as const,

  // Font size limits
  fontSizes: {
    min: 10,
    max: 24,
  },

  // Standard section names ATS recognizes
  standardSectionNames: {
    summary: ['Summary', 'Professional Summary', 'Profile', 'About'],
    experience: ['Experience', 'Work Experience', 'Employment History', 'Professional Experience'],
    education: ['Education', 'Academic Background', 'Academic History'],
    skills: ['Skills', 'Technical Skills', 'Core Competencies', 'Key Skills'],
    certifications: ['Certifications', 'Licenses', 'Licenses & Certifications'],
  },

  // Safe bullet characters
  safeBullets: ['•', '-', '*'],

  // Standard date formats
  dateFormats: ['Jan 2020', 'January 2020', '01/2020', '2020'],
} as const;

// ============================================================================
// CONVERSATION STATE
// ============================================================================

export type ResumeGeneratorStep =
  | 'welcome'
  | 'choose_path' // Upload or fresh
  | 'uploading'
  | 'parsing'
  | 'gathering_contact'
  | 'gathering_target_job'
  | 'gathering_experience'
  | 'gathering_education'
  | 'gathering_skills'
  | 'gathering_additional'
  | 'style_selection'
  | 'generating'
  | 'reviewing'
  | 'revising'
  | 'complete';

export interface ResumeGeneratorState {
  step: ResumeGeneratorStep;
  currentQuestion?: string;
  questionsAsked: string[];
  resumeData: Partial<ResumeData>;
  generatedDocuments?: {
    wordUrl: string;
    pdfUrl: string;
    generatedAt: Date;
  };
  revisionHistory: {
    request: string;
    changesApplied: string[];
    timestamp: Date;
  }[];
}

// ============================================================================
// REVISION COMMANDS
// ============================================================================

export type RevisionCategory = 'margins' | 'fonts' | 'spacing' | 'layout' | 'content' | 'style';

export interface RevisionCommand {
  category: RevisionCategory;
  action: string;
  value?: string | number;
}

// Common revision patterns the AI should recognize
export const REVISION_PATTERNS = {
  margins: [
    'widen margins',
    'narrow margins',
    'set margins to',
    'more whitespace',
    'less whitespace',
    'fit on one page',
  ],
  fonts: [
    'change font to',
    'use a modern font',
    'use a traditional font',
    'increase font size',
    'decrease font size',
    'make name bigger',
    'make name smaller',
  ],
  layout: [
    'move education above',
    'move experience above',
    'put skills at the top',
    'remove the summary',
    'add a section for',
    'reorder sections',
  ],
  content: [
    'rewrite the summary',
    'add more keywords',
    'make bullets more impactful',
    'quantify achievements',
    'shorten the resume',
    'expand on',
  ],
  spacing: ['add more space between', 'reduce spacing', 'tighten up', 'more room between sections'],
} as const;
