/**
 * ATS Scoring and Keyword Analysis
 *
 * Analyzes resumes for ATS (Applicant Tracking System) compatibility
 * and provides optimization suggestions.
 */

import type { ResumeData, ATSOptimization, ExtractedKeywords, TargetJob } from './types';
import { ATS_REQUIREMENTS } from './types';

// ============================================================================
// KEYWORD EXTRACTION
// ============================================================================

/**
 * Common action verbs that ATS systems look for
 */
const STRONG_ACTION_VERBS = [
  'achieved',
  'administered',
  'analyzed',
  'built',
  'collaborated',
  'created',
  'delivered',
  'designed',
  'developed',
  'directed',
  'drove',
  'established',
  'executed',
  'expanded',
  'generated',
  'implemented',
  'improved',
  'increased',
  'initiated',
  'launched',
  'led',
  'managed',
  'optimized',
  'orchestrated',
  'organized',
  'pioneered',
  'planned',
  'produced',
  'reduced',
  'restructured',
  'scaled',
  'spearheaded',
  'streamlined',
  'strengthened',
  'supervised',
  'transformed',
  'upgraded',
];

/**
 * Common technical skill categories
 */
const SKILL_CATEGORIES = {
  programming: [
    'javascript',
    'typescript',
    'python',
    'java',
    'c++',
    'c#',
    'ruby',
    'go',
    'rust',
    'php',
    'swift',
    'kotlin',
  ],
  frameworks: [
    'react',
    'angular',
    'vue',
    'next.js',
    'node.js',
    'express',
    'django',
    'flask',
    'spring',
    'rails',
  ],
  databases: [
    'sql',
    'mysql',
    'postgresql',
    'mongodb',
    'redis',
    'elasticsearch',
    'dynamodb',
    'firebase',
  ],
  cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd'],
  tools: ['git', 'jira', 'figma', 'sketch', 'photoshop', 'slack', 'confluence', 'notion'],
  methodologies: ['agile', 'scrum', 'kanban', 'waterfall', 'devops', 'tdd', 'ci/cd'],
};

/**
 * Extract keywords from job description
 */
export function extractKeywordsFromJobDescription(jobDescription: string): ExtractedKeywords {
  const lowerDesc = jobDescription.toLowerCase();

  const required: string[] = [];
  const preferred: string[] = [];

  // Look for skills in the job description
  Object.values(SKILL_CATEGORIES)
    .flat()
    .forEach((skill) => {
      if (lowerDesc.includes(skill.toLowerCase())) {
        // Check if it's in a "required" context
        const requiredPatterns = [
          `must have ${skill}`,
          `required: ${skill}`,
          `${skill} required`,
          `${skill} is required`,
          `experience with ${skill}`,
          `proficient in ${skill}`,
        ];

        const isRequired = requiredPatterns.some((pattern) =>
          lowerDesc.includes(pattern.toLowerCase())
        );

        if (isRequired) {
          required.push(skill);
        } else {
          preferred.push(skill);
        }
      }
    });

  // Look for common requirements patterns
  const requirementPatterns = [
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /bachelor'?s?\s+degree/gi,
    /master'?s?\s+degree/gi,
    /mba/gi,
    /phd/gi,
    /certification/gi,
  ];

  requirementPatterns.forEach((pattern) => {
    const matches = jobDescription.match(pattern);
    if (matches) {
      matches.forEach((match) => required.push(match));
    }
  });

  return {
    required: [...new Set(required)],
    preferred: [...new Set(preferred)],
    found: [],
    missing: [],
  };
}

/**
 * Extract all text content from resume for analysis
 */
function extractResumeText(data: ResumeData): string {
  const parts: string[] = [];

  if (data.summary) {
    parts.push(data.summary);
  }

  data.experience.forEach((exp) => {
    parts.push(exp.title, exp.company);
    parts.push(...exp.bullets);
  });

  data.education.forEach((edu) => {
    parts.push(edu.degree, edu.field, edu.institution);
    if (edu.honors) parts.push(...edu.honors);
  });

  data.skills.forEach((skill) => {
    parts.push(...skill.items);
  });

  if (data.certifications) {
    data.certifications.forEach((cert) => {
      parts.push(cert.name);
      if (cert.issuer) parts.push(cert.issuer);
    });
  }

  if (data.additionalSections) {
    data.additionalSections.forEach((section) => {
      parts.push(...section.items);
    });
  }

  return parts.join(' ').toLowerCase();
}

// ============================================================================
// ATS SCORING
// ============================================================================

export interface ATSScore {
  overall: number;
  breakdown: {
    formatting: number;
    keywords: number;
    structure: number;
    content: number;
  };
  issues: ATSIssue[];
  suggestions: string[];
}

export interface ATSIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  fix?: string;
}

/**
 * Score a resume for ATS compatibility
 */
export function scoreResumeForATS(data: ResumeData, targetJob?: TargetJob): ATSScore {
  const issues: ATSIssue[] = [];
  const suggestions: string[] = [];
  let formattingScore = 100;
  let keywordScore = 100;
  let structureScore = 100;
  let contentScore = 100;

  // =========================================================================
  // FORMATTING CHECKS
  // =========================================================================

  // Check font usage
  const allowedFonts = ATS_REQUIREMENTS.safeFonts;
  if (!allowedFonts.includes(data.formatting.fonts.primary as (typeof allowedFonts)[number])) {
    issues.push({
      severity: 'warning',
      category: 'Formatting',
      message: `Font "${data.formatting.fonts.primary}" may not be ATS-compatible`,
      fix: 'Use standard fonts like Calibri, Arial, or Times New Roman',
    });
    formattingScore -= 10;
  }

  // Check font sizes
  if (data.formatting.fonts.sizes.body < ATS_REQUIREMENTS.fontSizes.min) {
    issues.push({
      severity: 'error',
      category: 'Formatting',
      message: 'Body text is too small (may be hard to parse)',
      fix: 'Increase body font size to at least 10pt',
    });
    formattingScore -= 15;
  }

  // Check margins
  if (data.formatting.margins.left < 0.5 || data.formatting.margins.right < 0.5) {
    issues.push({
      severity: 'warning',
      category: 'Formatting',
      message: 'Margins are very narrow (may cause parsing issues)',
      fix: 'Use margins of at least 0.5 inches',
    });
    formattingScore -= 5;
  }

  // =========================================================================
  // STRUCTURE CHECKS
  // =========================================================================

  // Check required sections
  if (!data.contact.email) {
    issues.push({
      severity: 'error',
      category: 'Structure',
      message: 'Missing email address',
      fix: 'Add your email address to contact information',
    });
    structureScore -= 20;
  }

  if (!data.contact.fullName) {
    issues.push({
      severity: 'error',
      category: 'Structure',
      message: 'Missing name',
      fix: 'Add your full name',
    });
    structureScore -= 20;
  }

  if (data.experience.length === 0) {
    issues.push({
      severity: 'error',
      category: 'Structure',
      message: 'No work experience listed',
      fix: 'Add your work experience with achievement-focused bullet points',
    });
    structureScore -= 25;
  }

  if (data.education.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'Structure',
      message: 'No education listed',
      fix: 'Add your educational background',
    });
    structureScore -= 10;
  }

  if (data.skills.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'Structure',
      message: 'No skills section',
      fix: 'Add a skills section with relevant technical skills',
    });
    structureScore -= 15;
  }

  // =========================================================================
  // CONTENT CHECKS
  // =========================================================================

  const resumeText = extractResumeText(data);

  // Check for action verbs in experience
  let actionVerbCount = 0;
  data.experience.forEach((exp) => {
    exp.bullets.forEach((bullet) => {
      const lowerBullet = bullet.toLowerCase();
      if (STRONG_ACTION_VERBS.some((verb) => lowerBullet.startsWith(verb))) {
        actionVerbCount++;
      }
    });
  });

  const totalBullets = data.experience.reduce((sum, exp) => sum + exp.bullets.length, 0);
  const actionVerbRatio = totalBullets > 0 ? actionVerbCount / totalBullets : 0;

  if (actionVerbRatio < 0.5) {
    issues.push({
      severity: 'warning',
      category: 'Content',
      message: "Many bullet points don't start with strong action verbs",
      fix: 'Start each bullet with action verbs like: Led, Developed, Implemented, Increased, etc.',
    });
    contentScore -= 15;
    suggestions.push('Start more bullet points with strong action verbs');
  }

  // Check for metrics/numbers
  const hasNumbers = /\d+%|\$\d+|\d+\s*(million|thousand|k|m|users|customers|clients)/i.test(
    resumeText
  );
  if (!hasNumbers) {
    issues.push({
      severity: 'info',
      category: 'Content',
      message: 'No quantified achievements found',
      fix: 'Add metrics like percentages, dollar amounts, or user counts to demonstrate impact',
    });
    contentScore -= 10;
    suggestions.push('Quantify your achievements with numbers and percentages');
  }

  // Check bullet point length
  data.experience.forEach((exp) => {
    exp.bullets.forEach((bullet, index) => {
      if (bullet.length > 200) {
        issues.push({
          severity: 'info',
          category: 'Content',
          message: `Bullet point ${index + 1} in "${exp.company}" is too long`,
          fix: 'Keep bullet points concise (under 2 lines)',
        });
        contentScore -= 2;
      }
    });
  });

  // =========================================================================
  // KEYWORD ANALYSIS (if target job provided)
  // =========================================================================

  if (targetJob?.jobDescription) {
    const keywords = extractKeywordsFromJobDescription(targetJob.jobDescription);

    keywords.required.forEach((keyword) => {
      if (resumeText.includes(keyword.toLowerCase())) {
        keywords.found.push(keyword);
      } else {
        keywords.missing.push(keyword);
      }
    });

    keywords.preferred.forEach((keyword) => {
      if (resumeText.includes(keyword.toLowerCase())) {
        keywords.found.push(keyword);
      }
    });

    const keywordMatchRate =
      keywords.required.length > 0
        ? keywords.found.filter((k) => keywords.required.includes(k)).length /
          keywords.required.length
        : 1;

    keywordScore = Math.round(keywordMatchRate * 100);

    if (keywords.missing.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'Keywords',
        message: `Missing required keywords: ${keywords.missing.join(', ')}`,
        fix: 'Add these skills/keywords if you have experience with them',
      });
      suggestions.push(
        `Consider adding these keywords: ${keywords.missing.slice(0, 5).join(', ')}`
      );
    }
  }

  // =========================================================================
  // CALCULATE OVERALL SCORE
  // =========================================================================

  const overall = Math.round(
    formattingScore * 0.2 + keywordScore * 0.3 + structureScore * 0.25 + contentScore * 0.25
  );

  // Add general suggestions
  if (overall >= 90) {
    suggestions.push('Your resume is well-optimized for ATS!');
  } else if (overall >= 70) {
    suggestions.push('Your resume is good but could use some improvements');
  } else {
    suggestions.push('Consider addressing the issues above to improve ATS compatibility');
  }

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown: {
      formatting: Math.max(0, Math.min(100, formattingScore)),
      keywords: Math.max(0, Math.min(100, keywordScore)),
      structure: Math.max(0, Math.min(100, structureScore)),
      content: Math.max(0, Math.min(100, contentScore)),
    },
    issues,
    suggestions,
  };
}

/**
 * Get ATS optimization suggestions based on score
 */
export function getATSOptimizationReport(score: ATSScore): string {
  const lines = [
    `## ATS Compatibility Score: ${score.overall}/100`,
    '',
    '### Score Breakdown',
    `- **Formatting:** ${score.breakdown.formatting}/100`,
    `- **Keywords:** ${score.breakdown.keywords}/100`,
    `- **Structure:** ${score.breakdown.structure}/100`,
    `- **Content:** ${score.breakdown.content}/100`,
    '',
  ];

  if (score.issues.length > 0) {
    lines.push('### Issues Found');
    score.issues.forEach((issue) => {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`${icon} **${issue.category}:** ${issue.message}`);
      if (issue.fix) {
        lines.push(`   → ${issue.fix}`);
      }
    });
    lines.push('');
  }

  if (score.suggestions.length > 0) {
    lines.push('### Suggestions');
    score.suggestions.forEach((suggestion) => {
      lines.push(`- ${suggestion}`);
    });
  }

  return lines.join('\n');
}

/**
 * Create ATSOptimization object for resume data
 */
export function createATSOptimization(data: ResumeData, targetJob?: TargetJob): ATSOptimization {
  const score = scoreResumeForATS(data, targetJob);

  let keywords: ExtractedKeywords | undefined;
  if (targetJob?.jobDescription) {
    keywords = extractKeywordsFromJobDescription(targetJob.jobDescription);
    const resumeText = extractResumeText(data);

    [...keywords.required, ...keywords.preferred].forEach((keyword) => {
      if (resumeText.includes(keyword.toLowerCase())) {
        keywords!.found.push(keyword);
      } else if (keywords!.required.includes(keyword)) {
        keywords!.missing.push(keyword);
      }
    });
  }

  return {
    targetJob,
    extractedKeywords: keywords,
    score: score.overall,
    suggestions: score.suggestions,
  };
}
