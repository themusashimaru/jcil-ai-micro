/**
 * AI CODE REVIEWER
 *
 * Uses AI to perform comprehensive code reviews on PRs.
 * Analyzes changes for bugs, security issues, and best practices.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  PRInfo,
  FileDiff,
  CodeReviewResult,
  ReviewComment,
  ReviewOptions,
  ReviewSeverity,
} from './types';
import { logger } from '@/lib/logger';

const log = logger('CodeReview');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Fetch PR information from GitHub
 */
export async function fetchPRInfo(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string
): Promise<PRInfo | null> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    return {
      number: data.number,
      title: data.title,
      description: data.body || '',
      author: data.user?.login || 'unknown',
      baseBranch: data.base?.ref || 'main',
      headBranch: data.head?.ref || 'unknown',
      filesChanged: data.changed_files || 0,
      additions: data.additions || 0,
      deletions: data.deletions || 0,
      url: data.html_url,
    };
  } catch (error) {
    log.error('Error fetching PR info', error as Error);
    return null;
  }
}

/**
 * Fetch PR diff from GitHub
 */
export async function fetchPRDiff(
  owner: string,
  repo: string,
  prNumber: number,
  githubToken: string
): Promise<FileDiff[]> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) return [];

    const files = await response.json();

    return files.map(
      (file: {
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
        previous_filename?: string;
      }) => ({
        filename: file.filename,
        status: file.status as FileDiff['status'],
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch || '',
        previousFilename: file.previous_filename,
      })
    );
  } catch (error) {
    log.error('Error fetching PR diff', error as Error);
    return [];
  }
}

/**
 * Perform AI code review on a PR
 */
export async function reviewPR(
  prInfo: PRInfo,
  diffs: FileDiff[],
  options: ReviewOptions = {}
): Promise<CodeReviewResult> {
  const {
    focusAreas = ['security', 'performance', 'style', 'best-practices'],
    maxComments = 20,
    includeLineComments = true,
    strictMode = false,
  } = options;

  log.info('Reviewing PR', { prNumber: prInfo.number, title: prInfo.title });

  // Build the diff summary
  let diffContent = '';
  for (const file of diffs) {
    if (!file.patch) continue;

    diffContent += `\n\n### File: ${file.filename} (${file.status})\n`;
    diffContent += `+${file.additions} -${file.deletions}\n`;
    diffContent += '```diff\n';
    diffContent += file.patch.slice(0, 3000); // Limit per file
    if (file.patch.length > 3000) diffContent += '\n... (truncated)';
    diffContent += '\n```';
  }

  // Limit total content
  if (diffContent.length > 15000) {
    diffContent = diffContent.slice(0, 15000) + '\n\n... (remaining files truncated)';
  }

  const systemPrompt = `You are an expert code reviewer performing a thorough review of a pull request.

## Review Focus Areas
${focusAreas.map((area) => `- ${area}`).join('\n')}

## Review Guidelines
1. Look for bugs, logic errors, and potential runtime issues
2. Check for security vulnerabilities (injection, XSS, auth issues, etc.)
3. Evaluate performance implications
4. Assess code style and readability
5. Verify best practices are followed
6. Check for proper error handling
${strictMode ? '7. Be strict and thorough - flag any potential issues' : '7. Be balanced - focus on significant issues'}

## Output Format
Return a JSON object with:
{
  "summary": "Brief overall assessment (2-3 sentences)",
  "overallRating": "approve" | "request-changes" | "comment",
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "suggestion" | "praise",
      "category": "bug" | "security" | "performance" | "style" | "best-practice" | "documentation" | "general",
      "message": "Description of the issue",
      "suggestion": "Optional code suggestion"
    }
  ],
  "securityConcerns": ["List of security issues if any"],
  "performanceConcerns": ["List of performance issues if any"],
  "recommendations": ["General recommendations for improvement"]
}

Be specific and actionable. Include line numbers when possible.
Limit to ${maxComments} most important comments.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Review this Pull Request:

## PR Info
- **Title**: ${prInfo.title}
- **Author**: ${prInfo.author}
- **Base Branch**: ${prInfo.baseBranch} ← ${prInfo.headBranch}
- **Files Changed**: ${prInfo.filesChanged}
- **Lines**: +${prInfo.additions} / -${prInfo.deletions}

## Description
${prInfo.description || 'No description provided'}

## Changes
${diffContent}

Return ONLY valid JSON, no markdown formatting.`,
        },
      ],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      }
    }

    // Parse the response
    try {
      const jsonStr = content
        .replace(/```json?\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      const review = JSON.parse(jsonStr);

      // Calculate statistics
      const comments = (review.comments || []) as ReviewComment[];
      const statistics = {
        criticalIssues: comments.filter((c: ReviewComment) => c.severity === 'critical').length,
        warnings: comments.filter((c: ReviewComment) => c.severity === 'warning').length,
        suggestions: comments.filter((c: ReviewComment) => c.severity === 'suggestion').length,
        praises: comments.filter((c: ReviewComment) => c.severity === 'praise').length,
      };

      // Filter out line comments if not requested
      const finalComments = includeLineComments
        ? comments
        : comments.filter((c: ReviewComment) => !c.line);

      return {
        summary: review.summary || 'Review completed.',
        overallRating: review.overallRating || 'comment',
        comments: finalComments.slice(0, maxComments),
        statistics,
        securityConcerns: review.securityConcerns || [],
        performanceConcerns: review.performanceConcerns || [],
        recommendations: review.recommendations || [],
      };
    } catch (parseError) {
      log.error('Parse error', parseError as Error);
      return createFallbackReview(content);
    }
  } catch (error) {
    log.error('API error', error as Error);
    throw error;
  }
}

/**
 * Create a fallback review from unparseable content
 */
function createFallbackReview(content: string): CodeReviewResult {
  return {
    summary: 'Review completed. See comments below for details.',
    overallRating: 'comment',
    comments: [
      {
        file: 'general',
        severity: 'suggestion',
        category: 'general',
        message: content.slice(0, 500),
      },
    ],
    statistics: {
      criticalIssues: 0,
      warnings: 0,
      suggestions: 1,
      praises: 0,
    },
    securityConcerns: [],
    performanceConcerns: [],
    recommendations: [],
  };
}

/**
 * Format review result as markdown
 */
export function formatReviewAsMarkdown(review: CodeReviewResult, prInfo: PRInfo): string {
  const severityEmoji: Record<ReviewSeverity, string> = {
    critical: '🔴',
    warning: '🟠',
    suggestion: '🟡',
    praise: '🟢',
  };

  const ratingEmoji: Record<string, string> = {
    approve: '✅',
    'request-changes': '❌',
    comment: '💬',
  };

  let md = `# Code Review: ${prInfo.title}\n\n`;
  md += `**PR #${prInfo.number}** by @${prInfo.author}\n\n`;

  // Overall rating
  md += `## ${ratingEmoji[review.overallRating]} Overall: ${review.overallRating.replace('-', ' ').toUpperCase()}\n\n`;
  md += `${review.summary}\n\n`;

  // Statistics
  md += `### Statistics\n`;
  md += `- 🔴 Critical Issues: ${review.statistics.criticalIssues}\n`;
  md += `- 🟠 Warnings: ${review.statistics.warnings}\n`;
  md += `- 🟡 Suggestions: ${review.statistics.suggestions}\n`;
  md += `- 🟢 Positive Notes: ${review.statistics.praises}\n\n`;

  // Security concerns
  if (review.securityConcerns.length > 0) {
    md += `### 🛡️ Security Concerns\n`;
    review.securityConcerns.forEach((concern) => {
      md += `- ${concern}\n`;
    });
    md += '\n';
  }

  // Performance concerns
  if (review.performanceConcerns.length > 0) {
    md += `### ⚡ Performance Concerns\n`;
    review.performanceConcerns.forEach((concern) => {
      md += `- ${concern}\n`;
    });
    md += '\n';
  }

  // Comments by file
  if (review.comments.length > 0) {
    md += `### 📝 Comments\n\n`;

    // Group by file
    const byFile = new Map<string, typeof review.comments>();
    for (const comment of review.comments) {
      if (!byFile.has(comment.file)) {
        byFile.set(comment.file, []);
      }
      byFile.get(comment.file)!.push(comment);
    }

    for (const [file, comments] of byFile) {
      md += `#### \`${file}\`\n\n`;
      for (const comment of comments) {
        md += `${severityEmoji[comment.severity]} `;
        if (comment.line) md += `**Line ${comment.line}**: `;
        md += `${comment.message}\n`;
        if (comment.suggestion) {
          md += `\n> 💡 Suggestion:\n> ${comment.suggestion}\n`;
        }
        md += '\n';
      }
    }
  }

  // Recommendations
  if (review.recommendations.length > 0) {
    md += `### 💡 Recommendations\n`;
    review.recommendations.forEach((rec) => {
      md += `- ${rec}\n`;
    });
  }

  return md;
}

/**
 * Post review comments to GitHub PR
 */
export async function postReviewToGitHub(
  owner: string,
  repo: string,
  prNumber: number,
  review: CodeReviewResult,
  githubToken: string
): Promise<boolean> {
  try {
    // Map our rating to GitHub's event
    const event =
      review.overallRating === 'approve'
        ? 'APPROVE'
        : review.overallRating === 'request-changes'
          ? 'REQUEST_CHANGES'
          : 'COMMENT';

    // Create the review
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          body:
            `## AI Code Review\n\n${review.summary}\n\n` +
            `**Rating**: ${review.overallRating.toUpperCase()}\n` +
            `**Issues Found**: ${review.statistics.criticalIssues} critical, ${review.statistics.warnings} warnings\n\n` +
            (review.recommendations.length > 0
              ? `### Recommendations\n${review.recommendations.map((r) => `- ${r}`).join('\n')}\n`
              : '') +
            `\n---\n*This review was generated by AI. Please verify all suggestions.*`,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    log.error('Error posting to GitHub', error as Error);
    return false;
  }
}
