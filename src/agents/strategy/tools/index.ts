/**
 * SCOUT TOOLS - v2.0
 *
 * CORE TOOLS (13 hardcoded):
 * 1. brave_search: Quick web search via Brave API
 * 2. browser_visit: Full page visit via E2B + Puppeteer
 * 3. run_code: Execute code via E2B sandbox
 * 4. screenshot: Capture page screenshot
 * 5. vision_analyze: Analyze screenshots with Claude Vision
 * 6. extract_table: Extract tables from screenshots
 * 7. compare_screenshots: Compare multiple screenshots side-by-side
 * 8. safe_form_fill: Fill search/filter forms safely (blocked: login, signup, payment)
 * 9. paginate: Navigate through paginated results
 * 10. infinite_scroll: Handle infinite scroll pages
 * 11. click_navigate: Click and extract resulting page
 * 12. extract_pdf: Download and extract PDF text
 * 13. generate_comparison: Create comparison tables
 *
 * DYNAMIC TOOLS (extension mechanism):
 * - create_custom_tool: Create new tools when the 13 aren't sufficient
 * - execute_custom_tool: Execute previously created custom tools
 *
 * SAFETY FRAMEWORK:
 * - Comprehensive URL blocklists (government, adult, extremist, hostile nations)
 * - Form safety (no login, signup, payment)
 * - Rate limiting (per session, per domain)
 * - Output sanitization (remove sensitive data)
 * - AI safety prompts (forwarded to all agents)
 */

// Types
export * from './types';

// Safety Framework (comprehensive)
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

// Tool Executor (includes safety checks)
export {
  executeScoutTool,
  executeManyTools,
  cleanupAllSandboxes,
  getClaudeToolDefinitions,
  parseClaudeToolCall,
  setSessionId,
} from './executor';

// Dynamic Tool Creation System
export {
  generateDynamicTool,
  executeDynamicTool,
  cleanupDynamicSandbox,
  registerDynamicTool,
  getDynamicTools,
  getDynamicToolById,
  clearDynamicTools,
  getDynamicToolCreationDefinition,
  validateToolPurpose,
  validateToolCode,
  type DynamicToolRequest,
  type DynamicToolDefinition,
  type DynamicToolResult,
} from './dynamicTools';
