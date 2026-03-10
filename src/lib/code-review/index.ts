/**
 * AI CODE REVIEW
 *
 * Automated code review for GitHub Pull Requests.
 * Uses Claude to analyze changes and provide feedback.
 *
 * Features:
 * - Fetch and parse PR diffs from GitHub
 * - AI-powered code analysis
 * - Bug, security, and performance detection
 * - Style and best practice recommendations
 * - Post reviews back to GitHub
 */

export * from './types';
export {
  fetchPRInfo,
  fetchPRDiff,
  reviewPR,
  formatReviewAsMarkdown,
  postReviewToGitHub,
} from './reviewer';
