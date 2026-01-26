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

export type ScoutToolName = 'brave_search' | 'browser_visit' | 'run_code' | 'screenshot';

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

export type ScoutToolInput = BraveSearchInput | BrowserVisitInput | RunCodeInput | ScreenshotInput;

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

export type ScoutToolOutput =
  | BraveSearchOutput
  | BrowserVisitOutput
  | RunCodeOutput
  | ScreenshotOutput;

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
