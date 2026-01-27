/**
 * SCOUT TOOLS
 *
 * Tools that scouts can use to gather information:
 * - brave_search: Quick web search
 * - browser_visit: Full page visit via E2B + Puppeteer
 * - run_code: Execute code via E2B sandbox
 * - screenshot: Capture page screenshot
 *
 * ENHANCED TOOLS:
 * - vision_analyze: Analyze screenshots with Claude Vision
 * - extract_table: Extract tables from screenshots
 * - safe_form_fill: Fill search/filter forms safely
 * - paginate: Navigate through paginated results
 * - infinite_scroll: Handle infinite scroll pages
 * - click_navigate: Click and extract resulting page
 * - extract_pdf: Download and extract PDF text
 * - compare_screenshots: Compare multiple screenshots
 * - generate_comparison: Create comparison tables
 */

// Types
export * from './types';

// Safety Framework
export * from './safety';

// Core Tools
export { searchBrave, formatSearchResults } from './braveSearch';
export { browserVisit, browserScreenshot, cleanupBrowserSandbox } from './e2bBrowser';
export { runCode, cleanupCodeSandbox, CODE_SNIPPETS } from './e2bCode';

// Vision & Analysis Tools
export {
  analyzeScreenshot,
  extractTableFromScreenshot,
  compareScreenshots,
} from './visionAnalysis';

// Enhanced Browser Tools
export {
  safeFormFill,
  handlePagination,
  handleInfiniteScroll,
  clickAndNavigate,
  extractPdf,
} from './e2bBrowserEnhanced';

// Comparison Table Generator
export { generateComparisonTable, parseComparisonData } from './comparisonTable';

// Tool Executor
export {
  executeScoutTool,
  executeManyTools,
  cleanupAllSandboxes,
  getClaudeToolDefinitions,
  parseClaudeToolCall,
} from './executor';
