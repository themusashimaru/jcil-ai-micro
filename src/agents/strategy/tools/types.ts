/**
 * SCOUT TOOLS - Type Definitions
 *
 * Tools that scouts can use to gather information:
 * - brave_search: Quick web search (existing)
 * - browser_visit: Full page visit via E2B + Puppeteer
 * - run_code: Execute code via E2B sandbox
 * - screenshot: Capture page screenshot via E2B + Puppeteer
 */

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export type ScoutToolName =
  // Core tools (4)
  | 'brave_search'
  | 'browser_visit'
  | 'run_code'
  | 'screenshot'
  // Vision & AI tools (3)
  | 'vision_analyze'
  | 'extract_table'
  | 'compare_screenshots'
  // Safe interactive tools (4)
  | 'safe_form_fill'
  | 'paginate'
  | 'infinite_scroll'
  | 'click_navigate'
  // Document tools (1)
  | 'extract_pdf'
  // Data organization tools (1)
  | 'generate_comparison'
  // Dynamic tool creation/execution (extension mechanism)
  | 'create_custom_tool'
  | 'execute_custom_tool';

export interface ScoutToolDefinition {
  name: ScoutToolName;
  description: string;
  costEstimate: number; // $ per use
  timeEstimate: number; // ms per use
  requiresE2B: boolean;
}

export const SCOUT_TOOLS: Record<ScoutToolName, ScoutToolDefinition> = {
  brave_search: {
    name: 'brave_search',
    description: 'Quick web search returning snippets and links',
    costEstimate: 0.005,
    timeEstimate: 1000,
    requiresE2B: false,
  },
  browser_visit: {
    name: 'browser_visit',
    description: 'Visit a URL with a full browser, extract rendered content',
    costEstimate: 0.02,
    timeEstimate: 5000,
    requiresE2B: true,
  },
  run_code: {
    name: 'run_code',
    description: 'Execute Python or Node.js code for data processing',
    costEstimate: 0.01,
    timeEstimate: 3000,
    requiresE2B: true,
  },
  screenshot: {
    name: 'screenshot',
    description: 'Capture a screenshot of a webpage',
    costEstimate: 0.03,
    timeEstimate: 5000,
    requiresE2B: true,
  },
  // New enhanced tools
  vision_analyze: {
    name: 'vision_analyze',
    description: 'Analyze a webpage screenshot with Claude Vision AI',
    costEstimate: 0.05,
    timeEstimate: 10000,
    requiresE2B: true,
  },
  extract_table: {
    name: 'extract_table',
    description: 'Extract tables from screenshots using Claude Vision',
    costEstimate: 0.05,
    timeEstimate: 10000,
    requiresE2B: true,
  },
  safe_form_fill: {
    name: 'safe_form_fill',
    description: 'Safely fill search/filter forms (no login, signup, or payment)',
    costEstimate: 0.03,
    timeEstimate: 8000,
    requiresE2B: true,
  },
  paginate: {
    name: 'paginate',
    description: 'Navigate through paginated results',
    costEstimate: 0.04,
    timeEstimate: 15000,
    requiresE2B: true,
  },
  infinite_scroll: {
    name: 'infinite_scroll',
    description: 'Load content from infinite scroll pages',
    costEstimate: 0.04,
    timeEstimate: 20000,
    requiresE2B: true,
  },
  click_navigate: {
    name: 'click_navigate',
    description: 'Click an element and extract the resulting page',
    costEstimate: 0.02,
    timeEstimate: 6000,
    requiresE2B: true,
  },
  extract_pdf: {
    name: 'extract_pdf',
    description: 'Download and extract text from PDF documents',
    costEstimate: 0.02,
    timeEstimate: 8000,
    requiresE2B: true,
  },
  compare_screenshots: {
    name: 'compare_screenshots',
    description: 'Compare multiple webpage screenshots with Claude Vision',
    costEstimate: 0.1,
    timeEstimate: 20000,
    requiresE2B: true,
  },
  generate_comparison: {
    name: 'generate_comparison',
    description: 'Generate a formatted comparison table from collected data',
    costEstimate: 0.001,
    timeEstimate: 100,
    requiresE2B: false,
  },
};

// =============================================================================
// TOOL INPUTS
// =============================================================================

export interface BraveSearchInput {
  query: string;
  count?: number;
}

export interface BrowserVisitInput {
  url: string;
  selector?: string; // CSS selector to extract specific content
  waitFor?: string; // CSS selector to wait for before extracting
  extractText?: boolean; // Extract all text content
  extractLinks?: boolean; // Extract all links
  extractStructured?: boolean; // Try to extract structured data (prices, etc.)
}

export interface RunCodeInput {
  code: string;
  language: 'python' | 'javascript';
  timeout?: number; // ms
}

export interface ScreenshotInput {
  url: string;
  fullPage?: boolean;
  width?: number;
  height?: number;
}

// New enhanced tool inputs
export interface VisionAnalyzeInput {
  url: string;
  prompt: string;
  fullPage?: boolean;
  width?: number;
  height?: number;
}

export interface ExtractTableInput {
  url: string;
  tableDescription: string;
}

export interface SafeFormFillInput {
  url: string;
  sessionId: string;
  formSelector?: string;
  fields: Array<{
    selector: string;
    value: string;
    type?: 'text' | 'select' | 'checkbox' | 'radio';
  }>;
  submitSelector?: string;
  waitForSelector?: string;
}

export interface PaginateInput {
  url: string;
  sessionId: string;
  nextButtonSelector: string;
  contentSelector: string;
  maxPages?: number;
}

export interface InfiniteScrollInput {
  url: string;
  sessionId: string;
  contentSelector: string;
  maxScrolls?: number;
  scrollDelay?: number;
}

export interface ClickNavigateInput {
  url: string;
  sessionId: string;
  clickSelector: string;
  waitForSelector?: string;
  extractContent?: boolean;
}

export interface ExtractPdfInput {
  url: string;
  sessionId: string;
}

export interface CompareScreenshotsInput {
  urls: string[];
  comparisonPrompt: string;
}

export interface GenerateComparisonInput {
  title: string;
  items: Array<{
    name: string;
    source?: string;
    sourceUrl?: string;
    attributes: Record<string, string | number | boolean | null>;
  }>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  highlightBest?: string[];
}

export type ScoutToolInput =
  | BraveSearchInput
  | BrowserVisitInput
  | RunCodeInput
  | ScreenshotInput
  | VisionAnalyzeInput
  | ExtractTableInput
  | SafeFormFillInput
  | PaginateInput
  | InfiniteScrollInput
  | ClickNavigateInput
  | ExtractPdfInput
  | CompareScreenshotsInput
  | GenerateComparisonInput;

// =============================================================================
// TOOL OUTPUTS
// =============================================================================

export interface BraveSearchOutput {
  success: boolean;
  results: Array<{
    title: string;
    url: string;
    description: string;
    snippet?: string;
  }>;
  error?: string;
}

export interface BrowserVisitOutput {
  success: boolean;
  url: string;
  title?: string;
  textContent?: string;
  links?: Array<{ text: string; href: string }>;
  structuredData?: Record<string, unknown>;
  error?: string;
}

export interface RunCodeOutput {
  success: boolean;
  stdout: string;
  stderr: string;
  result?: unknown;
  error?: string;
}

export interface ScreenshotOutput {
  success: boolean;
  imageBase64?: string;
  error?: string;
}

// New enhanced tool outputs
export interface VisionAnalyzeOutput {
  success: boolean;
  analysis?: string;
  extractedData?: Record<string, unknown>;
  error?: string;
}

export interface ExtractTableOutput {
  success: boolean;
  headers?: string[];
  rows?: string[][];
  rawText?: string;
  error?: string;
}

export interface SafeFormFillOutput {
  success: boolean;
  resultUrl?: string;
  resultContent?: string;
  error?: string;
}

export interface PaginateOutput {
  success: boolean;
  pages: Array<{
    pageNumber: number;
    url: string;
    content: string;
  }>;
  totalPages: number;
  error?: string;
}

export interface InfiniteScrollOutput {
  success: boolean;
  content: string;
  itemCount?: number;
  error?: string;
}

export interface ClickNavigateOutput {
  success: boolean;
  resultUrl?: string;
  content?: string;
  error?: string;
}

export interface ExtractPdfOutput {
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
}

export interface CompareScreenshotsOutput {
  success: boolean;
  analysis?: string;
  error?: string;
}

export interface GenerateComparisonOutput {
  success: boolean;
  table?: {
    title: string;
    headers: string[];
    rows: Array<{
      name: string;
      values: string[];
      highlights: boolean[];
      sourceUrl?: string;
    }>;
    summary: {
      bestOverall?: string;
      bestByAttribute: Record<string, string>;
    };
  };
  markdown?: string;
  error?: string;
}

export type ScoutToolOutput =
  | BraveSearchOutput
  | BrowserVisitOutput
  | RunCodeOutput
  | ScreenshotOutput
  | VisionAnalyzeOutput
  | ExtractTableOutput
  | SafeFormFillOutput
  | PaginateOutput
  | InfiniteScrollOutput
  | ClickNavigateOutput
  | ExtractPdfOutput
  | CompareScreenshotsOutput
  | GenerateComparisonOutput;

// =============================================================================
// TOOL CALL
// =============================================================================

export interface ScoutToolCall {
  tool: ScoutToolName;
  input: ScoutToolInput;
}

export interface ScoutToolResult {
  tool: ScoutToolName;
  success: boolean;
  output: ScoutToolOutput;
  costIncurred: number;
  timeElapsed: number;
}
