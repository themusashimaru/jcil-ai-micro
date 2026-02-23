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
  | 'security'
  | 'devtools';

export interface ToolRegistryEntry {
  /** Tool name as registered with Claude (matches tool.name) */
  name: string;
  /** File path relative to tools/ directory */
  file: string;
  /** Current implementation status */
  status: ToolStatus;
  /** Functional category */
  category: ToolCategory;
  /** One-line description of what the tool does */
  description: string;
  /** External libraries or APIs required */
  dependencies: string[];
}

/**
 * Master registry of all tools.
 * 55 tools total — all with real implementations.
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
    description: 'Web search via Brave/Google API (native Anthropic server tool)',
    dependencies: ['Brave Search API'],
  },
  {
    name: 'fetch_url',
    file: 'fetch-url.ts',
    status: 'active',
    category: 'core',
    description: 'Fetch and parse content from URLs',
    dependencies: [],
  },
  {
    name: 'run_code',
    file: 'run-code.ts',
    status: 'active',
    category: 'core',
    description: 'Execute code in E2B sandboxed environment',
    dependencies: ['E2B'],
  },
  {
    name: 'analyze_image',
    file: 'vision-analyze.ts',
    status: 'active',
    category: 'core',
    description: 'Analyze images using Claude vision capabilities',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'parallel_research',
    file: 'mini-agent.ts',
    status: 'active',
    category: 'core',
    description: 'Orchestrate parallel sub-agent research tasks',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'create_and_run_tool',
    file: 'dynamic-tool.ts',
    status: 'active',
    category: 'core',
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
    description: 'Visit and interact with web pages via Puppeteer',
    dependencies: ['puppeteer'],
  },
  {
    name: 'screenshot',
    file: 'screenshot-tool.ts',
    status: 'active',
    category: 'web',
    description: 'Capture screenshots of web pages',
    dependencies: ['puppeteer'],
  },
  {
    name: 'capture_webpage',
    file: 'web-capture-tool.ts',
    status: 'active',
    category: 'web',
    description: 'Full-page capture and archival of web pages',
    dependencies: ['puppeteer'],
  },
  {
    name: 'youtube_transcript',
    file: 'youtube-transcript.ts',
    status: 'active',
    category: 'web',
    description: 'Extract transcripts from YouTube videos',
    dependencies: [],
  },
  {
    name: 'github',
    file: 'github-tool.ts',
    status: 'active',
    category: 'web',
    description: 'Search and interact with GitHub repos, code, and issues',
    dependencies: ['GitHub API'],
  },
  {
    name: 'http_request',
    file: 'http-request-tool.ts',
    status: 'active',
    category: 'web',
    description: 'Make HTTP requests to APIs and webhooks',
    dependencies: [],
  },
  {
    name: 'shorten_link',
    file: 'link-shorten-tool.ts',
    status: 'active',
    category: 'web',
    description: 'Shorten URLs',
    dependencies: [],
  },

  // =========================================================================
  // CODE — Development and code-related tools
  // =========================================================================
  {
    name: 'fix_error',
    file: 'error-fixer-tool.ts',
    status: 'active',
    category: 'code',
    description: 'AI-powered error analysis and fix suggestions',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'refactor_code',
    file: 'refactor-tool.ts',
    status: 'active',
    category: 'code',
    description: 'AI-powered code refactoring suggestions',
    dependencies: ['Anthropic API'],
  },
  {
    name: 'format_code',
    file: 'prettier-tool.ts',
    status: 'active',
    category: 'code',
    description: 'Format code using Prettier',
    dependencies: ['prettier'],
  },
  {
    name: 'diff_compare',
    file: 'diff-tool.ts',
    status: 'active',
    category: 'code',
    description: 'Compare and diff text content',
    dependencies: ['diff'],
  },
  {
    name: 'query_data_sql',
    file: 'sql-tool.ts',
    status: 'active',
    category: 'code',
    description: 'Run SQL queries in-browser via SQL.js',
    dependencies: ['sql.js'],
  },
  {
    name: 'feature_flag',
    file: 'feature-flag-tool.ts',
    status: 'active',
    category: 'code',
    description: 'Design feature flag systems with SDK generation and rollout strategies',
    dependencies: ['crypto'],
  },
  {
    name: 'migration_generator',
    file: 'migration-generator-tool.ts',
    status: 'active',
    category: 'code',
    description: 'Generate database migrations for Prisma, Knex, TypeORM, Sequelize',
    dependencies: [],
  },

  // =========================================================================
  // DOCUMENT — Document creation and manipulation
  // =========================================================================
  {
    name: 'create_document',
    file: 'document-tool.ts',
    status: 'active',
    category: 'document',
    description: 'Generate formatted documents (Markdown, HTML)',
    dependencies: [],
  },
  {
    name: 'extract_pdf',
    file: 'extract-pdf.ts',
    status: 'active',
    category: 'document',
    description: 'Extract text and data from PDF files',
    dependencies: [],
  },
  {
    name: 'extract_table',
    file: 'extract-table.ts',
    status: 'active',
    category: 'document',
    description: 'Extract tabular data from documents and web pages',
    dependencies: [],
  },
  {
    name: 'pdf_manipulate',
    file: 'pdf-tool.ts',
    status: 'active',
    category: 'document',
    description: 'Create and manipulate PDF documents',
    dependencies: ['pdf-lib'],
  },
  {
    name: 'create_spreadsheet',
    file: 'spreadsheet-tool.ts',
    status: 'active',
    category: 'document',
    description: 'Generate spreadsheet files',
    dependencies: [],
  },
  {
    name: 'excel_advanced',
    file: 'excel-tool.ts',
    status: 'active',
    category: 'document',
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
    description: 'Resize, compress, convert, and watermark images',
    dependencies: ['sharp'],
  },
  {
    name: 'transcribe_audio',
    file: 'audio-transcribe.ts',
    status: 'active',
    category: 'media',
    description: 'Transcribe audio using Whisper',
    dependencies: ['Whisper API'],
  },
  {
    name: 'audio_synth',
    file: 'audio-synth-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Synthesize audio and music via Tone.js',
    dependencies: ['tone'],
  },
  {
    name: 'media_process',
    file: 'media-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Process audio/video files via FFmpeg',
    dependencies: ['@ffmpeg/ffmpeg'],
  },
  {
    name: 'image_metadata',
    file: 'exif-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Read and analyze EXIF/image metadata',
    dependencies: ['exifr'],
  },
  {
    name: 'ocr_extract_text',
    file: 'ocr-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Extract text from images via Tesseract.js OCR',
    dependencies: ['tesseract.js'],
  },
  {
    name: 'create_chart',
    file: 'chart-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Create data visualizations and charts',
    dependencies: [],
  },
  {
    name: 'graphics_3d',
    file: 'graphics-3d-tool.ts',
    status: 'active',
    category: 'media',
    description: '3D graphics generation',
    dependencies: [],
  },
  {
    name: 'hough_vision',
    file: 'hough-vision-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Computer vision analysis (Hough transforms)',
    dependencies: [],
  },
  {
    name: 'ray_tracing',
    file: 'ray-tracing-tool.ts',
    status: 'active',
    category: 'media',
    description: 'Ray tracing renderer for 3D scenes',
    dependencies: [],
  },

  // =========================================================================
  // DATA — Data generation, validation, conversion
  // =========================================================================
  {
    name: 'generate_fake_data',
    file: 'faker-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Generate realistic test data via Faker.js',
    dependencies: ['@faker-js/faker'],
  },
  {
    name: 'validate_data',
    file: 'validator-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Validate data formats (email, URL, UUID, etc.)',
    dependencies: ['validator'],
  },
  {
    name: 'convert_file',
    file: 'file-convert-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Convert between file formats',
    dependencies: [],
  },
  {
    name: 'generate_qr_code',
    file: 'qr-code-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Generate QR codes',
    dependencies: ['qrcode'],
  },
  {
    name: 'generate_barcode',
    file: 'barcode-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Generate barcodes (EAN, UPC, Code128, etc.)',
    dependencies: ['jsbarcode'],
  },
  {
    name: 'zip_files',
    file: 'zip-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Create and extract ZIP archives',
    dependencies: ['jszip'],
  },
  {
    name: 'search_index',
    file: 'search-index-tool.ts',
    status: 'active',
    category: 'data',
    description: 'Build and query full-text search indexes',
    dependencies: ['lunr'],
  },
  {
    name: 'analyze_text_nlp',
    file: 'nlp-tool.ts',
    status: 'active',
    category: 'data',
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
    description: 'Geospatial calculations (distance, area, buffers)',
    dependencies: ['@turf/turf'],
  },
  {
    name: 'analyze_sequence',
    file: 'dna-bio-tool.ts',
    status: 'active',
    category: 'scientific',
    description: 'DNA/protein sequence analysis',
    dependencies: [],
  },
  {
    name: 'signal_process',
    file: 'signal-tool.ts',
    status: 'active',
    category: 'scientific',
    description: 'Digital signal processing (FFT, filters)',
    dependencies: ['fft-js'],
  },
  {
    name: 'sequence_analyze',
    file: 'sequence-analyze-tool.ts',
    status: 'active',
    category: 'scientific',
    description: 'Mathematical sequence analysis and pattern detection',
    dependencies: [],
  },
  {
    name: 'medical_calc',
    file: 'medical-calc-tool.ts',
    status: 'active',
    category: 'scientific',
    description: 'Medical and clinical calculators',
    dependencies: [],
  },
  {
    name: 'solve_constraints',
    file: 'constraint-tool.ts',
    status: 'active',
    category: 'scientific',
    description: 'Constraint satisfaction problem solver',
    dependencies: ['logic-solver'],
  },
  {
    name: 'parse_grammar',
    file: 'parser-tool.ts',
    status: 'active',
    category: 'scientific',
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
    description: 'Cryptographic operations (hash, encrypt, sign, JWS/JWE)',
    dependencies: ['jose'],
  },
  {
    name: 'phone_validate',
    file: 'phone-tool.ts',
    status: 'active',
    category: 'security',
    description: 'Phone number validation and formatting',
    dependencies: ['libphonenumber-js'],
  },
  {
    name: 'check_accessibility',
    file: 'accessibility-tool.ts',
    status: 'active',
    category: 'security',
    description: 'WCAG accessibility checking via axe-core',
    dependencies: ['axe-core'],
  },

  // =========================================================================
  // DEVTOOLS — ML serving (beta)
  // =========================================================================
  {
    name: 'ml_model_serving',
    file: 'ml-model-serving-tool.ts',
    status: 'beta',
    category: 'devtools',
    description: 'ML model serving infrastructure (registry is real, configs are templates)',
    dependencies: ['AWS SDK patterns'],
  },
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
