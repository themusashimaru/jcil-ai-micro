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
 * 48 tools total — all with real implementations that extend Claude's native capabilities.
 * Consolidated 2026-03-25: removed 48 redundant tools (document formatters, text analysis,
 * Claude-calling-Claude tools) that duplicated Claude Opus 4.6's native abilities.
 * Only tools that use real libraries or external APIs are retained.
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
  // fix_error, refactor_code removed 2026-03-25 — Claude does this natively
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
  {
    name: 'excel_advanced',
    file: 'excel-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'Advanced Excel operations via SheetJS',
    dependencies: ['sheetjs'],
  },
  {
    name: 'create_presentation',
    file: 'presentation-tool.ts',
    status: 'active',
    category: 'document',
    tier: 'extended',
    description: 'PowerPoint presentation generation via pptxgenjs',
    dependencies: ['pptxgenjs'],
  },
  // email_template, document_template, mail_merge removed 2026-03-25 — Claude writes these natively
  { name: 'calendar_event', file: 'calendar-event-tool.ts', status: 'active', category: 'document', tier: 'extended', description: 'Create calendar events as downloadable .ics files', dependencies: [] },

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
  // ray_tracing removed 2026-03-25 — niche, Claude can explain ray tracing natively
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
  // analyze_text_nlp removed 2026-03-25 — Claude IS an NLP model

  // =========================================================================
  // SCIENTIFIC — Science, math tools (real library-backed)
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
  // analyze_sequence, sequence_analyze, medical_calc removed 2026-03-25 — niche, not core to platform
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
