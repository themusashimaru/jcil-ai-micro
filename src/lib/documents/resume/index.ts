/**
 * Resume Generator Module
 *
 * Complete resume building system with:
 * - Conversational guidance
 * - Professional document generation (Word + PDF)
 * - ATS optimization and scoring
 * - Progress tracking
 */

// Types
export * from './types';

// Document generation
export { generateResumeDocx, generateResumeFilename } from './generateDocx';
export { generateResumePdf } from './generatePdf';

// Conversation handling
export {
  // Progress tracking
  getProgressChecklist,
  formatProgressAsMarkdown,
  type ProgressItem,
  type ResumeProgress,

  // Prompts
  getResumeSystemPrompt,
  getWelcomeMessage,
  getStepPrompt,

  // State management
  createInitialState,
  getNextStep,
  applyTemplate,

  // Document generation
  generateResumeDocuments,
  type GeneratedDocuments,

  // Revision handling
  parseRevisionRequest,
} from './conversationHandler';

// ATS scoring
export {
  extractKeywordsFromJobDescription,
  scoreResumeForATS,
  getATSOptimizationReport,
  createATSOptimization,
  type ATSScore,
  type ATSIssue,
} from './atsScoring';
