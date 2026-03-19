/**
 * LAZY TOOL LOADER
 *
 * Central registry that maps tool names to lazy-loading functions.
 * Executors are loaded via dynamic import() only when Claude actually calls a tool.
 * Tool definitions (schemas) are loaded once per server lifetime and cached.
 *
 * IMPORTANT: All import() calls use static string literals so webpack can
 * analyze and bundle the tool modules. DO NOT use variable import paths or
 * webpackIgnore — it breaks tool loading on Vercel serverless functions.
 *
 * This replaces:
 * 1. The 55 static imports at the top of route.ts
 * 2. The 90+ case switch statement in route.ts
 * 3. The parallel initializeTools() in index.ts
 *
 * Benefits:
 * - Cold start only imports the tools actually used per request
 * - Adding new tools = adding one entry here + one tool file
 * - No switch statement to maintain
 *
 * Last updated: 2026-03-09
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { TOOL_REGISTRY, type ToolRegistryEntry, type ToolTier } from './registry';
import { logger } from '@/lib/logger';

const log = logger('ToolLoader');

// ============================================================================
// TYPES
// ============================================================================

/** A tool module must export these three members */
interface ToolModule {
  /** The tool definition (name, description, parameters) */
  tool: UnifiedTool;
  /** Execute the tool */
  execute: (call: UnifiedToolCall) => Promise<UnifiedToolResult>;
  /** Check if the tool's dependencies are available */
  checkAvailability: () => boolean | Promise<boolean>;
}

/** Maps tool name → module path (relative to tools/) and export names */
interface ToolLoaderEntry {
  /** File path for dynamic import (relative to this directory) */
  importPath: string;
  /** Name of the tool definition export (e.g., 'chartTool') */
  toolExport: string;
  /** Name of the executor export (e.g., 'executeChart') */
  executorExport: string;
  /** Name of the availability check export (e.g., 'isChartAvailable') */
  availabilityExport: string;
}

// ============================================================================
// STATIC IMPORT MAP
// ============================================================================

/**
 * Static import functions for each tool module.
 * Each entry uses a string literal so webpack can analyze and bundle the modules.
 * DO NOT refactor this to use variables or template literals — it will break
 * tool loading on Vercel serverless functions (modules won't be included in
 * the bundle and import() will fail with MODULE_NOT_FOUND).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_IMPORTERS: Record<string, () => Promise<any>> = {
  // Core API tools
  web_search: () => import('./web-search'),
  fetch_url: () => import('./fetch-url'),
  run_code: () => import('./run-code'),
  analyze_image: () => import('./vision-analyze'),
  // parallel_research removed — agent pattern replaced by skills
  create_and_run_tool: () => import('./dynamic-tool'),

  // Web tools
  browser_visit: () => import('./browser-visit'),
  // screenshot removed — use browser_visit action=screenshot
  desktop_sandbox: () => import('./desktop-sandbox-tool'),
  // capture_webpage removed — redundant with browser_visit
  youtube_transcript: () => import('./youtube-transcript'),
  github: () => import('./github-tool'),
  http_request: () => import('./http-request-tool'),
  shorten_link: () => import('./link-shorten-tool'),

  // Sandbox tools
  sandbox_files: () => import('./sandbox-files-tool'),
  sandbox_test_runner: () => import('./sandbox-test-runner-tool'),
  sandbox_template: () => import('./sandbox-template-tool'),

  // Code tools
  fix_error: () => import('./error-fixer-tool'),
  refactor_code: () => import('./refactor-tool'),
  format_code: () => import('./prettier-tool'),
  diff_compare: () => import('./diff-tool'),
  query_data_sql: () => import('./sql-tool'),

  // Document tools
  create_document: () => import('./document-tool'),
  extract_pdf: () => import('./extract-pdf'),
  extract_table: () => import('./extract-table'),
  pdf_manipulate: () => import('./pdf-tool'),
  // create_spreadsheet removed — use excel_advanced
  excel_advanced: () => import('./excel-tool'),

  // Media tools
  transform_image: () => import('./image-transform-tool'),
  transcribe_audio: () => import('./audio-transcribe'),
  media_process: () => import('./media-tool'),
  image_metadata: () => import('./exif-tool'),
  ocr_extract_text: () => import('./ocr-tool'),
  create_chart: () => import('./chart-tool'),
  e2b_visualize: () => import('./e2b-chart-tool'),
  graphics_3d: () => import('./graphics-3d-tool'),
  hough_vision: () => import('./hough-vision-tool'),
  ray_tracing: () => import('./ray-tracing-tool'),

  // Data tools
  generate_fake_data: () => import('./faker-tool'),
  validate_data: () => import('./validator-tool'),
  convert_file: () => import('./file-convert-tool'),
  generate_qr_code: () => import('./qr-code-tool'),
  generate_barcode: () => import('./barcode-tool'),
  zip_files: () => import('./zip-tool'),
  search_index: () => import('./search-index-tool'),
  analyze_text_nlp: () => import('./nlp-tool'),

  // Scientific tools
  geo_calculate: () => import('./geospatial-tool'),
  analyze_sequence: () => import('./dna-bio-tool'),
  signal_process: () => import('./signal-tool'),
  sequence_analyze: () => import('./sequence-analyze-tool'),
  medical_calc: () => import('./medical-calc-tool'),
  solve_constraints: () => import('./constraint-tool'),
  parse_grammar: () => import('./parser-tool'),

  // Security tools
  crypto_toolkit: () => import('./crypto-tool'),
  phone_validate: () => import('./phone-tool'),
  check_accessibility: () => import('./accessibility-tool'),

  // Document template tools
  create_presentation: () => import('./presentation-tool'),
  create_email_template: () => import('./email-template-tool'),
  document_template: () => import('./document-templates-tool'),
  mail_merge: () => import('./mail-merge-tool'),

  // Everyday & lifestyle tools
  calendar_event: () => import('./calendar-event-tool'),
  budget_calculator: () => import('./budget-calc-tool'),
  draft_email: () => import('./email-draft-tool'),
  build_resume: () => import('./resume-tool'),
  generate_invoice: () => import('./invoice-tool'),
  meal_planner: () => import('./meal-planner-tool'),
  create_flashcards: () => import('./flashcard-tool'),
  plan_trip: () => import('./trip-planner-tool'),

  // Productivity & planning tools
  project_timeline: () => import('./project-timeline-tool'),
  decision_matrix: () => import('./decision-matrix-tool'),
  plan_event: () => import('./event-planner-tool'),
  content_calendar: () => import('./content-calendar-tool'),
  create_sop: () => import('./sop-tool'),

  // Business & strategy tools
  create_swot_analysis: () => import('./swot-analysis-tool'),
  create_business_canvas: () => import('./business-canvas-tool'),
  create_okr_plan: () => import('./okr-planner-tool'),
  create_meeting_minutes: () => import('./meeting-minutes-tool'),
  create_raci_matrix: () => import('./raci-matrix-tool'),
  create_risk_assessment: () => import('./risk-assessment-tool'),
  create_proposal: () => import('./proposal-tool'),

  // Education tools
  create_lesson_plan: () => import('./lesson-plan-tool'),
  create_rubric: () => import('./rubric-tool'),
  create_quiz: () => import('./quiz-tool'),
  create_training_manual: () => import('./training-manual-tool'),

  // Legal & compliance tools
  create_contract: () => import('./contract-tool'),
  create_policy_document: () => import('./policy-document-tool'),

  // HR & management tools
  create_performance_review: () => import('./performance-review-tool'),
  create_job_description: () => import('./job-description-tool'),

  // Marketing & communications tools
  create_press_release: () => import('./press-release-tool'),
  create_case_study: () => import('./case-study-tool'),

  // Nonprofit & grants tools
  create_grant_proposal: () => import('./grant-proposal-tool'),

  // Real estate tools
  create_property_listing: () => import('./property-listing-tool'),

  // Healthcare tools
  create_care_plan: () => import('./care-plan-tool'),

  // Scripture & ministry tools
  create_church_budget: () => import('./church-budget-tool'),
  scripture_reference: () => import('./scripture-tool'),
  sermon_outline: () => import('./sermon-tool'),
  prayer_journal: () => import('./prayer-journal-tool'),
  daily_devotional: () => import('./devotional-tool'),
  small_group_guide: () => import('./small-group-tool'),

  // Orchestration tools
  spawn_agents: () => import('./spawn-agent-tool'),
};

// ============================================================================
// TOOL LOADER REGISTRY
// ============================================================================

/**
 * Maps each tool name to its export names for extracting tool/executor/availability
 * from the dynamically imported module.
 */
const TOOL_LOADER_MAP: Record<string, ToolLoaderEntry> = {
  // Core API tools
  web_search: {
    importPath: './web-search',
    toolExport: 'webSearchTool',
    executorExport: 'executeWebSearch',
    availabilityExport: 'isWebSearchAvailable',
  },
  fetch_url: {
    importPath: './fetch-url',
    toolExport: 'fetchUrlTool',
    executorExport: 'executeFetchUrl',
    availabilityExport: 'isFetchUrlAvailable',
  },
  run_code: {
    importPath: './run-code',
    toolExport: 'runCodeTool',
    executorExport: 'executeRunCode',
    availabilityExport: 'isRunCodeAvailable',
  },
  analyze_image: {
    importPath: './vision-analyze',
    toolExport: 'visionAnalyzeTool',
    executorExport: 'executeVisionAnalyze',
    availabilityExport: 'isVisionAnalyzeAvailable',
  },
  // parallel_research removed — agent pattern replaced by skills
  create_and_run_tool: {
    importPath: './dynamic-tool',
    toolExport: 'dynamicToolTool',
    executorExport: 'executeDynamicTool',
    availabilityExport: 'isDynamicToolAvailable',
  },

  // Web tools
  browser_visit: {
    importPath: './browser-visit',
    toolExport: 'browserVisitTool',
    executorExport: 'executeBrowserVisitTool',
    availabilityExport: 'isBrowserVisitAvailable',
  },
  // screenshot removed — use browser_visit action=screenshot
  desktop_sandbox: {
    importPath: './desktop-sandbox-tool',
    toolExport: 'desktopSandboxTool',
    executorExport: 'executeDesktopSandbox',
    availabilityExport: 'isDesktopSandboxAvailable',
  },
  // capture_webpage removed — redundant with browser_visit
  youtube_transcript: {
    importPath: './youtube-transcript',
    toolExport: 'youtubeTranscriptTool',
    executorExport: 'executeYouTubeTranscript',
    availabilityExport: 'isYouTubeTranscriptAvailable',
  },
  github: {
    importPath: './github-tool',
    toolExport: 'githubTool',
    executorExport: 'executeGitHub',
    availabilityExport: 'isGitHubAvailable',
  },
  http_request: {
    importPath: './http-request-tool',
    toolExport: 'httpRequestTool',
    executorExport: 'executeHttpRequest',
    availabilityExport: 'isHttpRequestAvailable',
  },
  shorten_link: {
    importPath: './link-shorten-tool',
    toolExport: 'linkShortenTool',
    executorExport: 'executeLinkShorten',
    availabilityExport: 'isLinkShortenAvailable',
  },

  // Sandbox tools
  sandbox_files: {
    importPath: './sandbox-files-tool',
    toolExport: 'sandboxFilesTool',
    executorExport: 'executeSandboxFiles',
    availabilityExport: 'isSandboxFilesAvailable',
  },
  sandbox_test_runner: {
    importPath: './sandbox-test-runner-tool',
    toolExport: 'sandboxTestRunnerTool',
    executorExport: 'executeSandboxTestRunner',
    availabilityExport: 'isSandboxTestRunnerAvailable',
  },
  sandbox_template: {
    importPath: './sandbox-template-tool',
    toolExport: 'sandboxTemplateTool',
    executorExport: 'executeSandboxTemplate',
    availabilityExport: 'isSandboxTemplateAvailable',
  },

  // Code tools
  fix_error: {
    importPath: './error-fixer-tool',
    toolExport: 'errorFixerTool',
    executorExport: 'executeErrorFixer',
    availabilityExport: 'isErrorFixerAvailable',
  },
  refactor_code: {
    importPath: './refactor-tool',
    toolExport: 'refactorTool',
    executorExport: 'executeRefactor',
    availabilityExport: 'isRefactorAvailable',
  },
  format_code: {
    importPath: './prettier-tool',
    toolExport: 'prettierTool',
    executorExport: 'executePrettier',
    availabilityExport: 'isPrettierAvailable',
  },
  diff_compare: {
    importPath: './diff-tool',
    toolExport: 'diffTool',
    executorExport: 'executeDiff',
    availabilityExport: 'isDiffAvailable',
  },
  query_data_sql: {
    importPath: './sql-tool',
    toolExport: 'sqlTool',
    executorExport: 'executeSQL',
    availabilityExport: 'isSQLAvailable',
  },

  // Document tools
  create_document: {
    importPath: './document-tool',
    toolExport: 'documentTool',
    executorExport: 'executeDocument',
    availabilityExport: 'isDocumentAvailable',
  },
  extract_pdf: {
    importPath: './extract-pdf',
    toolExport: 'extractPdfTool',
    executorExport: 'executeExtractPdf',
    availabilityExport: 'isExtractPdfAvailable',
  },
  extract_table: {
    importPath: './extract-table',
    toolExport: 'extractTableTool',
    executorExport: 'executeExtractTable',
    availabilityExport: 'isExtractTableAvailable',
  },
  pdf_manipulate: {
    importPath: './pdf-tool',
    toolExport: 'pdfTool',
    executorExport: 'executePDF',
    availabilityExport: 'isPDFAvailable',
  },
  // create_spreadsheet removed — use excel_advanced
  excel_advanced: {
    importPath: './excel-tool',
    toolExport: 'excelTool',
    executorExport: 'executeExcel',
    availabilityExport: 'isExcelAvailable',
  },

  // Media tools
  transform_image: {
    importPath: './image-transform-tool',
    toolExport: 'imageTransformTool',
    executorExport: 'executeImageTransform',
    availabilityExport: 'isImageTransformAvailable',
  },
  transcribe_audio: {
    importPath: './audio-transcribe',
    toolExport: 'audioTranscribeTool',
    executorExport: 'executeAudioTranscribe',
    availabilityExport: 'isAudioTranscribeAvailable',
  },
  media_process: {
    importPath: './media-tool',
    toolExport: 'mediaTool',
    executorExport: 'executeMedia',
    availabilityExport: 'isMediaAvailable',
  },
  image_metadata: {
    importPath: './exif-tool',
    toolExport: 'exifTool',
    executorExport: 'executeExif',
    availabilityExport: 'isExifAvailable',
  },
  ocr_extract_text: {
    importPath: './ocr-tool',
    toolExport: 'ocrTool',
    executorExport: 'executeOCR',
    availabilityExport: 'isOCRAvailable',
  },
  create_chart: {
    importPath: './chart-tool',
    toolExport: 'chartTool',
    executorExport: 'executeChart',
    availabilityExport: 'isChartAvailable',
  },
  e2b_visualize: {
    importPath: './e2b-chart-tool',
    toolExport: 'e2bChartTool',
    executorExport: 'executeE2BChart',
    availabilityExport: 'isE2BChartAvailable',
  },
  graphics_3d: {
    importPath: './graphics-3d-tool',
    toolExport: 'graphics3dTool',
    executorExport: 'executeGraphics3D',
    availabilityExport: 'isGraphics3DAvailable',
  },
  hough_vision: {
    importPath: './hough-vision-tool',
    toolExport: 'houghVisionTool',
    executorExport: 'executeHoughVision',
    availabilityExport: 'isHoughVisionAvailable',
  },
  ray_tracing: {
    importPath: './ray-tracing-tool',
    toolExport: 'rayTracingTool',
    executorExport: 'executeRayTracing',
    availabilityExport: 'isRayTracingAvailable',
  },

  // Data tools
  generate_fake_data: {
    importPath: './faker-tool',
    toolExport: 'fakerTool',
    executorExport: 'executeFaker',
    availabilityExport: 'isFakerAvailable',
  },
  validate_data: {
    importPath: './validator-tool',
    toolExport: 'validatorTool',
    executorExport: 'executeValidator',
    availabilityExport: 'isValidatorAvailable',
  },
  convert_file: {
    importPath: './file-convert-tool',
    toolExport: 'fileConvertTool',
    executorExport: 'executeFileConvert',
    availabilityExport: 'isFileConvertAvailable',
  },
  generate_qr_code: {
    importPath: './qr-code-tool',
    toolExport: 'qrCodeTool',
    executorExport: 'executeQRCode',
    availabilityExport: 'isQRCodeAvailable',
  },
  generate_barcode: {
    importPath: './barcode-tool',
    toolExport: 'barcodeTool',
    executorExport: 'executeBarcode',
    availabilityExport: 'isBarcodeAvailable',
  },
  zip_files: {
    importPath: './zip-tool',
    toolExport: 'zipTool',
    executorExport: 'executeZip',
    availabilityExport: 'isZipAvailable',
  },
  search_index: {
    importPath: './search-index-tool',
    toolExport: 'searchIndexTool',
    executorExport: 'executeSearchIndex',
    availabilityExport: 'isSearchIndexAvailable',
  },
  analyze_text_nlp: {
    importPath: './nlp-tool',
    toolExport: 'nlpTool',
    executorExport: 'executeNLP',
    availabilityExport: 'isNLPAvailable',
  },

  // Scientific tools
  geo_calculate: {
    importPath: './geospatial-tool',
    toolExport: 'geospatialTool',
    executorExport: 'executeGeospatial',
    availabilityExport: 'isGeospatialAvailable',
  },
  analyze_sequence: {
    importPath: './dna-bio-tool',
    toolExport: 'dnaBioTool',
    executorExport: 'executeDnaBio',
    availabilityExport: 'isDnaBioAvailable',
  },
  signal_process: {
    importPath: './signal-tool',
    toolExport: 'signalTool',
    executorExport: 'executeSignal',
    availabilityExport: 'isSignalAvailable',
  },
  sequence_analyze: {
    importPath: './sequence-analyze-tool',
    toolExport: 'sequenceAnalyzeTool',
    executorExport: 'executeSequenceAnalyze',
    availabilityExport: 'isSequenceAnalyzeAvailable',
  },
  medical_calc: {
    importPath: './medical-calc-tool',
    toolExport: 'medicalCalcTool',
    executorExport: 'executeMedicalCalc',
    availabilityExport: 'isMedicalCalcAvailable',
  },
  solve_constraints: {
    importPath: './constraint-tool',
    toolExport: 'constraintTool',
    executorExport: 'executeConstraint',
    availabilityExport: 'isConstraintAvailable',
  },
  parse_grammar: {
    importPath: './parser-tool',
    toolExport: 'parserTool',
    executorExport: 'executeParser',
    availabilityExport: 'isParserAvailable',
  },

  // Security tools
  crypto_toolkit: {
    importPath: './crypto-tool',
    toolExport: 'cryptoTool',
    executorExport: 'executeCryptoTool',
    availabilityExport: 'isCryptoToolAvailable',
  },
  phone_validate: {
    importPath: './phone-tool',
    toolExport: 'phoneTool',
    executorExport: 'executePhone',
    availabilityExport: 'isPhoneAvailable',
  },
  check_accessibility: {
    importPath: './accessibility-tool',
    toolExport: 'accessibilityTool',
    executorExport: 'executeAccessibility',
    availabilityExport: 'isAccessibilityAvailable',
  },

  // Document tools
  create_presentation: {
    importPath: './presentation-tool',
    toolExport: 'presentationTool',
    executorExport: 'executePresentation',
    availabilityExport: 'isPresentationAvailable',
  },
  create_email_template: {
    importPath: './email-template-tool',
    toolExport: 'emailTemplateTool',
    executorExport: 'executeEmailTemplate',
    availabilityExport: 'isEmailTemplateAvailable',
  },
  document_template: {
    importPath: './document-templates-tool',
    toolExport: 'documentTemplatesTool',
    executorExport: 'executeDocumentTemplate',
    availabilityExport: 'isDocumentTemplateAvailable',
  },
  mail_merge: {
    importPath: './mail-merge-tool',
    toolExport: 'mailMergeTool',
    executorExport: 'executeMailMerge',
    availabilityExport: 'isMailMergeAvailable',
  },

  // Everyday & lifestyle tools
  calendar_event: { importPath: './calendar-event-tool', toolExport: 'calendarEventTool', executorExport: 'executeCalendarEvent', availabilityExport: 'isCalendarEventAvailable' },
  budget_calculator: { importPath: './budget-calc-tool', toolExport: 'budgetCalcTool', executorExport: 'executeBudgetCalc', availabilityExport: 'isBudgetCalcAvailable' },
  draft_email: { importPath: './email-draft-tool', toolExport: 'emailDraftTool', executorExport: 'executeEmailDraft', availabilityExport: 'isEmailDraftAvailable' },
  build_resume: { importPath: './resume-tool', toolExport: 'resumeTool', executorExport: 'executeResume', availabilityExport: 'isResumeAvailable' },
  generate_invoice: { importPath: './invoice-tool', toolExport: 'invoiceTool', executorExport: 'executeInvoice', availabilityExport: 'isInvoiceAvailable' },
  meal_planner: { importPath: './meal-planner-tool', toolExport: 'mealPlannerTool', executorExport: 'executeMealPlanner', availabilityExport: 'isMealPlannerAvailable' },
  create_flashcards: { importPath: './flashcard-tool', toolExport: 'flashcardTool', executorExport: 'executeFlashcard', availabilityExport: 'isFlashcardAvailable' },
  plan_trip: { importPath: './trip-planner-tool', toolExport: 'tripPlannerTool', executorExport: 'executeTripPlanner', availabilityExport: 'isTripPlannerAvailable' },

  // Productivity & planning tools
  project_timeline: { importPath: './project-timeline-tool', toolExport: 'projectTimelineTool', executorExport: 'executeProjectTimeline', availabilityExport: 'isProjectTimelineAvailable' },
  decision_matrix: { importPath: './decision-matrix-tool', toolExport: 'decisionMatrixTool', executorExport: 'executeDecisionMatrix', availabilityExport: 'isDecisionMatrixAvailable' },
  plan_event: { importPath: './event-planner-tool', toolExport: 'eventPlannerTool', executorExport: 'executeEventPlanner', availabilityExport: 'isEventPlannerAvailable' },
  content_calendar: { importPath: './content-calendar-tool', toolExport: 'contentCalendarTool', executorExport: 'executeContentCalendar', availabilityExport: 'isContentCalendarAvailable' },
  create_sop: { importPath: './sop-tool', toolExport: 'sopTool', executorExport: 'executeSop', availabilityExport: 'isSopAvailable' },

  // Business & strategy tools
  create_swot_analysis: { importPath: './swot-analysis-tool', toolExport: 'swotAnalysisTool', executorExport: 'executeSwotAnalysis', availabilityExport: 'isSwotAnalysisAvailable' },
  create_business_canvas: { importPath: './business-canvas-tool', toolExport: 'businessCanvasTool', executorExport: 'executeBusinessCanvas', availabilityExport: 'isBusinessCanvasAvailable' },
  create_okr_plan: { importPath: './okr-planner-tool', toolExport: 'okrPlannerTool', executorExport: 'executeOkrPlanner', availabilityExport: 'isOkrPlannerAvailable' },
  create_meeting_minutes: { importPath: './meeting-minutes-tool', toolExport: 'meetingMinutesTool', executorExport: 'executeMeetingMinutes', availabilityExport: 'isMeetingMinutesAvailable' },
  create_raci_matrix: { importPath: './raci-matrix-tool', toolExport: 'raciMatrixTool', executorExport: 'executeRaciMatrix', availabilityExport: 'isRaciMatrixAvailable' },
  create_risk_assessment: { importPath: './risk-assessment-tool', toolExport: 'riskAssessmentTool', executorExport: 'executeRiskAssessment', availabilityExport: 'isRiskAssessmentAvailable' },
  create_proposal: { importPath: './proposal-tool', toolExport: 'proposalTool', executorExport: 'executeProposal', availabilityExport: 'isProposalAvailable' },

  // Education tools
  create_lesson_plan: { importPath: './lesson-plan-tool', toolExport: 'lessonPlanTool', executorExport: 'executeLessonPlan', availabilityExport: 'isLessonPlanAvailable' },
  create_rubric: { importPath: './rubric-tool', toolExport: 'rubricTool', executorExport: 'executeRubric', availabilityExport: 'isRubricAvailable' },
  create_quiz: { importPath: './quiz-tool', toolExport: 'quizTool', executorExport: 'executeQuiz', availabilityExport: 'isQuizAvailable' },
  create_training_manual: { importPath: './training-manual-tool', toolExport: 'trainingManualTool', executorExport: 'executeTrainingManual', availabilityExport: 'isTrainingManualAvailable' },

  // Legal & compliance tools
  create_contract: { importPath: './contract-tool', toolExport: 'contractTool', executorExport: 'executeContract', availabilityExport: 'isContractAvailable' },
  create_policy_document: { importPath: './policy-document-tool', toolExport: 'policyDocumentTool', executorExport: 'executePolicyDocument', availabilityExport: 'isPolicyDocumentAvailable' },

  // HR & management tools
  create_performance_review: { importPath: './performance-review-tool', toolExport: 'performanceReviewTool', executorExport: 'executePerformanceReview', availabilityExport: 'isPerformanceReviewAvailable' },
  create_job_description: { importPath: './job-description-tool', toolExport: 'jobDescriptionTool', executorExport: 'executeJobDescription', availabilityExport: 'isJobDescriptionAvailable' },

  // Marketing & communications tools
  create_press_release: { importPath: './press-release-tool', toolExport: 'pressReleaseTool', executorExport: 'executePressRelease', availabilityExport: 'isPressReleaseAvailable' },
  create_case_study: { importPath: './case-study-tool', toolExport: 'caseStudyTool', executorExport: 'executeCaseStudy', availabilityExport: 'isCaseStudyAvailable' },

  // Nonprofit & grants tools
  create_grant_proposal: { importPath: './grant-proposal-tool', toolExport: 'grantProposalTool', executorExport: 'executeGrantProposal', availabilityExport: 'isGrantProposalAvailable' },

  // Real estate tools
  create_property_listing: { importPath: './property-listing-tool', toolExport: 'propertyListingTool', executorExport: 'executePropertyListing', availabilityExport: 'isPropertyListingAvailable' },

  // Healthcare tools
  create_care_plan: { importPath: './care-plan-tool', toolExport: 'carePlanTool', executorExport: 'executeCarePlan', availabilityExport: 'isCarePlanAvailable' },

  // Scripture & ministry tools
  create_church_budget: { importPath: './church-budget-tool', toolExport: 'churchBudgetTool', executorExport: 'executeChurchBudget', availabilityExport: 'isChurchBudgetAvailable' },
  scripture_reference: { importPath: './scripture-tool', toolExport: 'scriptureTool', executorExport: 'executeScripture', availabilityExport: 'isScriptureAvailable' },
  sermon_outline: { importPath: './sermon-tool', toolExport: 'sermonTool', executorExport: 'executeSermon', availabilityExport: 'isSermonAvailable' },
  prayer_journal: { importPath: './prayer-journal-tool', toolExport: 'prayerJournalTool', executorExport: 'executePrayerJournal', availabilityExport: 'isPrayerJournalAvailable' },
  daily_devotional: { importPath: './devotional-tool', toolExport: 'devotionalTool', executorExport: 'executeDevotional', availabilityExport: 'isDevotionalAvailable' },
  small_group_guide: { importPath: './small-group-tool', toolExport: 'smallGroupTool', executorExport: 'executeSmallGroup', availabilityExport: 'isSmallGroupAvailable' },

  // Orchestration tools
  spawn_agents: { importPath: './spawn-agent-tool', toolExport: 'spawnAgentTool', executorExport: 'executeSpawnAgent', availabilityExport: 'isSpawnAgentAvailable' },
};

// ============================================================================
// MODULE CACHE
// ============================================================================

/**
 * Cache for loaded tool modules.
 * Once a tool file is dynamically imported, we cache the extracted
 * { tool, execute, checkAvailability } so we don't re-parse exports on every call.
 */
const moduleCache = new Map<string, ToolModule>();

/**
 * Dynamically import a tool module and cache it.
 * Uses TOOL_IMPORTERS (static import map) so webpack bundles all tool files.
 */
async function loadToolModule(toolName: string): Promise<ToolModule | null> {
  // Check cache first
  const cached = moduleCache.get(toolName);
  if (cached) return cached;

  const entry = TOOL_LOADER_MAP[toolName];
  if (!entry) return null;

  const importer = TOOL_IMPORTERS[toolName];
  if (!importer) return null;

  // Static import path — webpack can analyze and bundle the module
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await importer();

  const toolModule: ToolModule = {
    tool: mod[entry.toolExport],
    execute: mod[entry.executorExport],
    checkAvailability: mod[entry.availabilityExport],
  };

  moduleCache.set(toolName, toolModule);
  return toolModule;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all tool names that have loader entries.
 */
export function getRegisteredToolNames(): string[] {
  return Object.keys(TOOL_LOADER_MAP);
}

/**
 * Check if a tool name has a loader entry.
 */
export function hasToolLoader(toolName: string): boolean {
  return toolName in TOOL_LOADER_MAP;
}

/**
 * Per-tier cached tool definitions with TTL to avoid re-running availability
 * checks on every request within the same server instance.
 */
const cachedToolDefsByTier = new Map<string, { tools: UnifiedTool[]; timestamp: number }>();
const TOOL_DEFS_TTL_MS = 60_000; // 1 minute

/**
 * Load available tool definitions for sending to Claude.
 * Only includes tools that are:
 * 1. In the loader map
 * 2. In the registry as 'active' or 'beta'
 * 3. Pass their availability check
 * 4. Match the requested tiers (defaults to all tiers)
 *
 * Results are cached per tier combination for 1 minute to avoid
 * re-running availability checks on every request.
 *
 * @param tiers - Which tiers to include. Defaults to all tiers.
 */
export async function loadAvailableToolDefinitions(tiers?: ToolTier[]): Promise<UnifiedTool[]> {
  const tierKey = tiers ? tiers.sort().join(',') : 'all';

  // Return cached definitions if still fresh
  const cached = cachedToolDefsByTier.get(tierKey);
  if (cached && Date.now() - cached.timestamp < TOOL_DEFS_TTL_MS) {
    return cached.tools;
  }

  const tools: UnifiedTool[] = [];

  // Only load tools that are active or beta in the registry
  let activeTools = TOOL_REGISTRY.filter(
    (entry: ToolRegistryEntry) => entry.status === 'active' || entry.status === 'beta'
  );

  // Filter by tier if specified
  if (tiers) {
    activeTools = activeTools.filter((entry: ToolRegistryEntry) => tiers.includes(entry.tier));
  }

  // Load tool modules in parallel for faster initialization
  const loadPromises = activeTools
    .filter((entry: ToolRegistryEntry) => entry.name in TOOL_LOADER_MAP)
    .map(async (entry: ToolRegistryEntry) => {
      try {
        const mod = await loadToolModule(entry.name);
        if (!mod) return null;

        const available = await mod.checkAvailability();
        if (!available) return null;

        return mod.tool;
      } catch (err) {
        log.error('Tool failed to load — skipping', {
          tool: entry.name,
          file: entry.file,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    });

  const results = await Promise.all(loadPromises);
  for (const tool of results) {
    if (tool) tools.push(tool);
  }

  // Cache the result
  cachedToolDefsByTier.set(tierKey, { tools, timestamp: Date.now() });

  return tools;
}

/**
 * Execute a tool by name.
 * Dynamically imports the tool module only when called.
 *
 * @returns Result, or null if tool not found in the loader.
 */
export async function executeToolByName(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult | null> {
  const mod = await loadToolModule(toolCall.name);
  if (!mod) return null; // Not a built-in tool (might be MCP/Composio)

  return mod.execute(toolCall);
}

/**
 * Clear the module cache and definitions cache (for testing).
 */
export function clearToolModuleCache(): void {
  moduleCache.clear();
  cachedToolDefsByTier.clear();
}
