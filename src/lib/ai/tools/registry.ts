/**
 * TOOL REGISTRY — Source of truth for all tool metadata
 *
 * Every tool file in this directory must have an entry here.
 * Status determines whether the tool is available to users:
 *   - 'active':  Real implementation, available in production
 *   - 'beta':    Partially working or needs more testing, shown with beta badge
 *   - 'planned': Not yet implemented, hidden from users
 *
 * Last updated: 2026-02-22
 */

export type ToolStatus = 'active' | 'beta' | 'planned';

export type ToolCategory =
  | 'core'
  | 'web'
  | 'code'
  | 'document'
  | 'media'
  | 'data'
  | 'scientific'
  | 'security';

/**
 * Loading tier determines when a tool is included in a request:
 *   - 'core':       Always loaded (essential for most conversations)
 *   - 'extended':   Loaded when message context suggests relevance
 *   - 'specialist': Loaded only when message explicitly mentions the domain
 */
export type ToolTier = 'core' | 'extended' | 'specialist';

export interface ToolRegistryEntry {
  /** Tool name as registered with Claude (matches tool.name) */
  name: string;
  /** File path relative to tools/ directory */
  file: string;
  /** Current implementation status */
  status: ToolStatus;
  /** Functional category */
  category: ToolCategory;
  /** Loading tier for smart tool selection */
  tier: ToolTier;
  /** One-line description of what the tool does */
  description: string;
  /** External libraries or APIs required */
  dependencies: string[];
}

/**
 * Master registry of all tools.
 * 70 tools total — all with real implementations.
 * Consolidated 2026-03-17: removed redundant screenshot, capture_webpage,
 * create_spreadsheet (use excel_advanced), and parallel_research (agent pattern).
 */
export const TOOL_REGISTRY: ToolRegistryEntry[] = [
  // =========================================================================
  // CORE — Essential API-backed tools
  // =========================================================================
  {
    name: 'web_search',
    file: 'web-search.ts',
    status: 'active',
    category: 'core',
    tier: 'core',
    description: 'Web search via Anthropic native server tool (web_search_20260209)',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'fetch_url',
    file: 'fetch-url.ts',
    status: 'active',
    category: 'core',
    tier: 'core',
    description: 'Fetch and parse content from URLs',
    dependencies: [],
  },
  {
    name: 'run_code',
    file: 'run-code.ts',
    status: 'active',
    category: 'core',
    tier: 'core',
    description: 'Execute code in E2B sandboxed environment',
    dependencies: ['E2B'],
  },
  {
    name: 'analyze_image',
    file: 'vision-analyze.ts',
    status: 'active',
    category: 'core',
    tier: 'core',
    description: 'Analyze images using Claude vision capabilities',
    dependencies: ['Anthropic API'],
  },
  // parallel_research removed 2026-03-17 — agent pattern replaced by skills
  {
    name: 'create_and_run_tool',
    file: 'dynamic-tool.ts',
    status: 'active',
    category: 'core',
    tier: 'core',
    description: 'Create and execute tools dynamically at runtime',
    dependencies: [],
  },

  // =========================================================================
  // WEB — Browser, scraping, capture tools
  // =========================================================================
  {
    name: 'browser_visit',
    file: 'browser-visit.ts',
    status: 'active',
    category: 'web',
    tier: 'extended',
    description: 'Visit and interact with web pages via Puppeteer',
    dependencies: ['puppeteer'],
  },
  // screenshot removed 2026-03-17 — use browser_visit with action=screenshot
  // capture_webpage removed 2026-03-17 — redundant with browser_visit
  {
    name: 'youtube_transcript',
    file: 'youtube-transcript.ts',
    status: 'active',
    category: 'web',
    tier: 'extended',
    description: 'Extract transcripts from YouTube videos',
    dependencies: [],
  },
  {
    name: 'github',
    file: 'github-tool.ts',
    status: 'active',
    category: 'web',
    tier: 'extended',
    description: 'Search and interact with GitHub repos, code, and issues',
    dependencies: ['GitHub API'],
  },
  {
    name: 'http_request',
    file: 'http-request-tool.ts',
    status: 'active',
    category: 'web',
    tier: 'extended',
    description:
      'Make HTTP requests to external APIs and webhooks (GET, POST, PUT, DELETE with auth)',
    dependencies: [],
  },
  {
    name: 'shorten_link',
    file: 'link-shorten-tool.ts',
    status: 'active',
    category: 'web',
    tier: 'extended',
    description: 'Shorten URLs',
    dependencies: [],
  },

  {
    name: 'desktop_sandbox',
    file: 'desktop-sandbox-tool.ts',
    status: 'active',
    category: 'web',
    tier: 'extended',
    description: 'Full virtual Linux desktop with GUI for computer-use (E2B Desktop)',
    dependencies: ['@e2b/desktop'],
  },

  // =========================================================================
  // CODE — Development and code-related tools
  // =========================================================================
  {
    name: 'fix_error',
    file: 'error-fixer-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'AI-powered error analysis and fix suggestions',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'refactor_code',
    file: 'refactor-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'AI-powered code refactoring suggestions',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'format_code',
    file: 'prettier-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'Format code using Prettier',
    dependencies: ['prettier'],
  },
  {
    name: 'diff_compare',
    file: 'diff-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'Compare and diff text content',
    dependencies: ['diff'],
  },
  {
    name: 'query_data_sql',
    file: 'sql-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'Run SQL queries in-browser via SQL.js',
    dependencies: ['sql.js'],
  },

  {
    name: 'sandbox_files',
    file: 'sandbox-files-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'Upload, download, and manage files in E2B sandbox',
    dependencies: ['E2B'],
  },
  {
    name: 'sandbox_test_runner',
    file: 'sandbox-test-runner-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'Run tests, linting, type-checking, and builds in isolated E2B sandbox',
    dependencies: ['E2B'],
  },
  {
    name: 'sandbox_template',
    file: 'sandbox-template-tool.ts',
    status: 'active',
    category: 'code',
    tier: 'extended',
    description: 'Create specialized sandboxes from pre-configured templates',
    dependencies: ['E2B'],
  },

  // =========================================================================
  // DOCUMENT — Document creation and manipulation
  // =========================================================================
  {
    name: 'create_document',
    file: 'document-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Generate formatted documents (Markdown, HTML)',
    dependencies: [],
  },
  {
    name: 'extract_pdf',
    file: 'extract-pdf.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Extract text and data from PDF files',
    dependencies: [],
  },
  {
    name: 'extract_table',
    file: 'extract-table.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Extract tabular data from documents and web pages',
    dependencies: [],
  },
  {
    name: 'pdf_manipulate',
    file: 'pdf-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Create and manipulate PDF documents',
    dependencies: ['pdf-lib'],
  },
  // create_spreadsheet removed 2026-03-17 — use excel_advanced (superset)
  {
    name: 'excel_advanced',
    file: 'excel-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Advanced Excel operations via SheetJS',
    dependencies: ['sheetjs'],
  },

  // =========================================================================
  // MEDIA — Image, audio, video processing
  // =========================================================================
  {
    name: 'transform_image',
    file: 'image-transform-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'extended',
    description: 'Resize, compress, convert, and watermark images',
    dependencies: ['sharp'],
  },
  {
    name: 'transcribe_audio',
    file: 'audio-transcribe.ts',
    status: 'active',
    category: 'media',
    tier: 'extended',
    description: 'Transcribe audio using Whisper',
    dependencies: ['Whisper API'],
  },
  {
    name: 'media_process',
    file: 'media-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'extended',
    description:
      'Process audio/video via FFmpeg (convert, trim, effects). For transcription use transcribe_audio',
    dependencies: ['@ffmpeg/ffmpeg'],
  },
  {
    name: 'image_metadata',
    file: 'exif-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'specialist',
    description: 'Read and analyze EXIF/image metadata',
    dependencies: ['exifr'],
  },
  {
    name: 'ocr_extract_text',
    file: 'ocr-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'extended',
    description: 'Extract text from images via Tesseract.js OCR',
    dependencies: ['tesseract.js'],
  },
  {
    name: 'create_chart',
    file: 'chart-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'extended',
    description: 'Create data visualizations and charts',
    dependencies: [],
  },
  {
    name: 'graphics_3d',
    file: 'graphics-3d-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'specialist',
    description: '3D mesh generation and export (OBJ, STL, GLTF formats)',
    dependencies: [],
  },
  {
    name: 'hough_vision',
    file: 'hough-vision-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'specialist',
    description:
      'Computer vision: edge detection, Hough transforms, corner detection (pure TypeScript)',
    dependencies: [],
  },
  {
    name: 'ray_tracing',
    file: 'ray-tracing-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'specialist',
    description: 'Educational ray tracing: ray intersection tests and ASCII scene rendering',
    dependencies: [],
  },

  {
    name: 'e2b_visualize',
    file: 'e2b-chart-tool.ts',
    status: 'active',
    category: 'media',
    tier: 'extended',
    description: 'Generate charts/visualizations via matplotlib/seaborn/plotly in E2B sandbox',
    dependencies: ['E2B'],
  },

  // =========================================================================
  // DATA — Data generation, validation, conversion
  // =========================================================================
  {
    name: 'generate_fake_data',
    file: 'faker-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Generate realistic test data via Faker.js',
    dependencies: ['@faker-js/faker'],
  },
  {
    name: 'validate_data',
    file: 'validator-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Validate data formats (email, URL, UUID, etc.)',
    dependencies: ['validator'],
  },
  {
    name: 'convert_file',
    file: 'file-convert-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'extended',
    description: 'Convert between file formats',
    dependencies: [],
  },
  {
    name: 'generate_qr_code',
    file: 'qr-code-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Generate QR codes',
    dependencies: ['qrcode'],
  },
  {
    name: 'generate_barcode',
    file: 'barcode-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Generate barcodes (EAN, UPC, Code128, etc.)',
    dependencies: ['jsbarcode'],
  },
  {
    name: 'zip_files',
    file: 'zip-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Create and extract ZIP archives',
    dependencies: ['jszip'],
  },
  {
    name: 'search_index',
    file: 'search-index-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Build and query full-text search indexes',
    dependencies: ['lunr'],
  },
  {
    name: 'analyze_text_nlp',
    file: 'nlp-tool.ts',
    status: 'active',
    category: 'data',
    tier: 'specialist',
    description: 'Natural language processing analysis',
    dependencies: ['natural'],
  },

  // =========================================================================
  // SCIENTIFIC — Science, math, bio tools
  // =========================================================================
  {
    name: 'geo_calculate',
    file: 'geospatial-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'Geospatial calculations (distance, area, buffers)',
    dependencies: ['@turf/turf'],
  },
  {
    name: 'analyze_sequence',
    file: 'dna-bio-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'DNA/protein sequence analysis',
    dependencies: [],
  },
  {
    name: 'signal_process',
    file: 'signal-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'Digital signal processing (FFT, filters)',
    dependencies: ['fft-js'],
  },
  {
    name: 'sequence_analyze',
    file: 'sequence-analyze-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'Mathematical sequence analysis and pattern detection',
    dependencies: [],
  },
  {
    name: 'medical_calc',
    file: 'medical-calc-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'Medical and clinical calculators',
    dependencies: [],
  },
  {
    name: 'solve_constraints',
    file: 'constraint-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'Constraint satisfaction problem solver',
    dependencies: ['logic-solver'],
  },
  {
    name: 'parse_grammar',
    file: 'parser-tool.ts',
    status: 'active',
    category: 'scientific',
    tier: 'specialist',
    description: 'Parse text using formal grammars',
    dependencies: ['nearley'],
  },

  // =========================================================================
  // SECURITY — Crypto, validation, security tools
  // =========================================================================
  {
    name: 'crypto_toolkit',
    file: 'crypto-tool.ts',
    status: 'active',
    category: 'security',
    tier: 'specialist',
    description: 'Cryptographic operations (hash, encrypt, sign, JWS/JWE)',
    dependencies: ['jose'],
  },
  {
    name: 'phone_validate',
    file: 'phone-tool.ts',
    status: 'active',
    category: 'security',
    tier: 'specialist',
    description: 'Phone number validation and formatting',
    dependencies: ['libphonenumber-js'],
  },
  {
    name: 'check_accessibility',
    file: 'accessibility-tool.ts',
    status: 'active',
    category: 'security',
    tier: 'specialist',
    description: 'WCAG accessibility checking via static HTML analysis and contrast calculation',
    dependencies: [],
  },

  // =========================================================================
  // DOCUMENT — Presentation, email, templates, mail merge
  // =========================================================================
  {
    name: 'create_presentation',
    file: 'presentation-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'PowerPoint presentation generation via pptxgenjs',
    dependencies: ['pptxgenjs'],
  },
  {
    name: 'create_email_template',
    file: 'email-template-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Responsive HTML email template generation',
    dependencies: [],
  },
  {
    name: 'document_template',
    file: 'document-templates-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Business document templates (invoice, contract, proposal, etc.)',
    dependencies: [],
  },
  {
    name: 'mail_merge',
    file: 'mail-merge-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Batch document generation with template variable substitution',
    dependencies: [],
  },

  // =========================================================================
  // EVERYDAY — Practical daily-use tools (added 2026-03-19)
  // =========================================================================
  { name: 'calendar_event', file: 'calendar-event-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Create calendar events as downloadable .ics files', dependencies: [] },
  { name: 'budget_calculator', file: 'budget-calc-tool.ts', status: 'active', category: 'data', tier: 'extended', description: 'Financial calculator: loans, savings, budgets, debt payoff', dependencies: [] },
  { name: 'draft_email', file: 'email-draft-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Draft and format professional emails with tone control', dependencies: [] },
  { name: 'build_resume', file: 'resume-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Build ATS-friendly resumes and cover letters', dependencies: [] },
  { name: 'generate_invoice', file: 'invoice-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Generate professional invoices with tax and discounts', dependencies: [] },
  { name: 'meal_planner', file: 'meal-planner-tool.ts', status: 'active', category: 'data', tier: 'extended', description: 'Create meal plans with categorized grocery lists', dependencies: [] },
  { name: 'create_flashcards', file: 'flashcard-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Create study flashcard sets (Anki, CSV, Markdown)', dependencies: [] },
  { name: 'plan_trip', file: 'trip-planner-tool.ts', status: 'active', category: 'data', tier: 'extended', description: 'Build travel itineraries with packing lists and budgets', dependencies: [] },

  // =========================================================================
  // PRODUCTIVITY & PLANNING — Business and personal planning tools (added 2026-03-19)
  // =========================================================================
  { name: 'project_timeline', file: 'project-timeline-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Project timeline and Gantt chart generator', dependencies: [] },
  { name: 'decision_matrix', file: 'decision-matrix-tool.ts', status: 'active', category: 'data', tier: 'extended', description: 'Weighted decision matrix for comparing options', dependencies: [] },
  { name: 'plan_event', file: 'event-planner-tool.ts', status: 'active', category: 'data', tier: 'extended', description: 'Event planner with timeline, vendors, and budget', dependencies: [] },
  { name: 'content_calendar', file: 'content-calendar-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Social media content calendar across platforms', dependencies: [] },
  { name: 'create_sop', file: 'sop-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Standard operating procedure document generator', dependencies: [] },

  // =========================================================================
  // BUSINESS & STRATEGY — Executive and management tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_swot_analysis', file: 'swot-analysis-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'SWOT analysis with strategic recommendations and action plans', dependencies: [] },
  { name: 'create_business_canvas', file: 'business-canvas-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Business Model Canvas with all 9 building blocks', dependencies: [] },
  { name: 'create_okr_plan', file: 'okr-planner-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'OKR plans with objectives, key results, and progress tracking', dependencies: [] },
  { name: 'create_meeting_minutes', file: 'meeting-minutes-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Structured meeting minutes with agenda, decisions, and action items', dependencies: [] },
  { name: 'create_raci_matrix', file: 'raci-matrix-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'RACI matrices for project task assignment and accountability', dependencies: [] },
  { name: 'create_risk_assessment', file: 'risk-assessment-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Risk registers with likelihood/impact scoring and heat maps', dependencies: [] },
  { name: 'create_proposal', file: 'proposal-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Business proposals and RFP responses with scope, pricing, and timeline', dependencies: [] },

  // =========================================================================
  // EDUCATION — Teaching and assessment tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_lesson_plan', file: 'lesson-plan-tool.ts', status: 'active', category: 'document', tier: 'extended', description: "Bloom's taxonomy-aligned lesson plans with activities and assessments", dependencies: [] },
  { name: 'create_rubric', file: 'rubric-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Scoring rubrics with criteria, performance levels, and grade scales', dependencies: [] },
  { name: 'create_quiz', file: 'quiz-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Quizzes with multiple choice, short answer, true/false, and essay questions', dependencies: [] },
  { name: 'create_training_manual', file: 'training-manual-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Employee training manuals with modules, exercises, and assessments', dependencies: [] },

  // =========================================================================
  // LEGAL & COMPLIANCE — Contract and policy tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_contract', file: 'contract-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Contracts and NDAs with customizable clauses and signature blocks', dependencies: [] },
  { name: 'create_policy_document', file: 'policy-document-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Company policy documents (AUP, privacy, code of conduct) with sections', dependencies: [] },

  // =========================================================================
  // HR & MANAGEMENT — People management tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_performance_review', file: 'performance-review-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Employee performance reviews with competency ratings and goals', dependencies: [] },
  { name: 'create_job_description', file: 'job-description-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Professional job descriptions with qualifications and EEO statements', dependencies: [] },

  // =========================================================================
  // MARKETING & COMMUNICATIONS — PR and content tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_press_release', file: 'press-release-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'AP-style press releases with datelines, quotes, and media contacts', dependencies: [] },
  { name: 'create_case_study', file: 'case-study-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Customer success case studies with metrics and testimonials', dependencies: [] },

  // =========================================================================
  // NONPROFIT & GRANTS — Fundraising tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_grant_proposal', file: 'grant-proposal-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Grant proposals with executive summary, budget, and timeline', dependencies: [] },

  // =========================================================================
  // REAL ESTATE — Property tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_property_listing', file: 'property-listing-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'MLS-quality property listings with features, schools, and agent contact', dependencies: [] },

  // =========================================================================
  // HEALTHCARE — Clinical tools (added 2026-03-19)
  // =========================================================================
  { name: 'create_care_plan', file: 'care-plan-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Patient care plans with goals, interventions, and medications', dependencies: [] },

  // =========================================================================
  // SCRIPTURE & MINISTRY — Christian mission tools (added 2026-03-19)
  // =========================================================================
  { name: 'scripture_reference', file: 'scripture-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Bible cross-reference study sheets with word studies', dependencies: [] },
  { name: 'sermon_outline', file: 'sermon-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Structured sermon and Bible lesson outlines', dependencies: [] },
  { name: 'prayer_journal', file: 'prayer-journal-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Structured prayer journal entries (ACTS framework)', dependencies: [] },
  { name: 'daily_devotional', file: 'devotional-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Daily devotional readings with scripture and application', dependencies: [] },
  { name: 'small_group_guide', file: 'small-group-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Small group Bible study discussion guides (OIA method)', dependencies: [] },
  { name: 'create_church_budget', file: 'church-budget-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Church budget reports with income, expenses, missions giving, and building fund', dependencies: [] },

  // =========================================================================
  // ORCHESTRATION — Agent spawning and parallel execution
  // =========================================================================
  { name: 'spawn_agents', file: 'spawn-agent-tool.ts', status: 'active', category: 'core', tier: 'core', description: 'Spawn parallel sub-agents for concurrent task execution', dependencies: ['@anthropic-ai/sdk'] },
];

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

/** Get all tools with a given status */
export function getToolsByStatus(status: ToolStatus): ToolRegistryEntry[] {
  return TOOL_REGISTRY.filter((t) => t.status === status);
}

/** Get all tools in a category */
export function getToolsByCategory(category: ToolCategory): ToolRegistryEntry[] {
  return TOOL_REGISTRY.filter((t) => t.category === category);
}

/** Get all tools in a tier */
export function getToolsByTier(tier: ToolTier): ToolRegistryEntry[] {
  return TOOL_REGISTRY.filter((t) => t.tier === tier);
}

/** Check if a tool name is in the registry */
export function isRegisteredTool(name: string): boolean {
  return TOOL_REGISTRY.some((t) => t.name === name);
}

/** Get registry entry by tool name */
export function getToolEntry(name: string): ToolRegistryEntry | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

/** Get summary stats */
export function getRegistryStats(): {
  total: number;
  active: number;
  beta: number;
  planned: number;
  byCategory: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  let active = 0;
  let beta = 0;
  let planned = 0;

  for (const tool of TOOL_REGISTRY) {
    byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
    if (tool.status === 'active') active++;
    else if (tool.status === 'beta') beta++;
    else planned++;
  }

  return { total: TOOL_REGISTRY.length, active, beta, planned, byCategory };
}
