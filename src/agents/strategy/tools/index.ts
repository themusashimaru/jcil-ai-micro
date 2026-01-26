/**
 * SCOUT TOOLS
 *
 * Tools that scouts can use to gather information:
 * - brave_search: Quick web search
 * - browser_visit: Full page visit via E2B + Puppeteer
 * - run_code: Execute code via E2B sandbox
 * - screenshot: Capture page screenshot
 */

// Types
export * from './types';

// Tools
export { searchBrave, formatSearchResults } from './braveSearch';
export { browserVisit, browserScreenshot, cleanupBrowserSandbox } from './e2bBrowser';
export { runCode, cleanupCodeSandbox, CODE_SNIPPETS } from './e2bCode';

// Tool Executor
export {
  executeScoutTool,
  executeManyTools,
  cleanupAllSandboxes,
  getClaudeToolDefinitions,
  parseClaudeToolCall,
} from './executor';
