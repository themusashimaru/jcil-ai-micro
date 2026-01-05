/**
 * CODE REVIEW TYPES
 *
 * Type definitions for AI-powered code review.
 */

export interface PRInfo {
  number: number;
  title: string;
  description: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  url: string;
}

export interface FileDiff {
  filename: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  previousFilename?: string;
}

export type ReviewSeverity = 'critical' | 'warning' | 'suggestion' | 'praise';

export interface ReviewComment {
  file: string;
  line?: number;
  severity: ReviewSeverity;
  category: 'bug' | 'security' | 'performance' | 'style' | 'best-practice' | 'documentation' | 'general';
  message: string;
  suggestion?: string;
}

export interface CodeReviewResult {
  summary: string;
  overallRating: 'approve' | 'request-changes' | 'comment';
  comments: ReviewComment[];
  statistics: {
    criticalIssues: number;
    warnings: number;
    suggestions: number;
    praises: number;
  };
  securityConcerns: string[];
  performanceConcerns: string[];
  recommendations: string[];
}

export interface ReviewOptions {
  focusAreas?: ('security' | 'performance' | 'style' | 'best-practices')[];
  maxComments?: number;
  includeLineComments?: boolean;
  strictMode?: boolean;
}
