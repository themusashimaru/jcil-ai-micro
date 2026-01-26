/**
 * TOOL EXECUTOR
 *
 * Executes scout tools and tracks costs/timing.
 */

import type {
  ScoutToolCall,
  ScoutToolResult,
  ScoutToolName,
  ScoutToolInput,
  ScoutToolOutput,
  BraveSearchInput,
  BrowserVisitInput,
  RunCodeInput,
  ScreenshotInput,
} from './types';
import { searchBrave } from './braveSearch';
import { browserVisit, browserScreenshot, cleanupBrowserSandbox } from './e2bBrowser';
import { runCode, cleanupCodeSandbox } from './e2bCode';
import { logger } from '@/lib/logger';

const log = logger('ToolExecutor');

/**
 * Execute a single scout tool
 */
export async function executeScoutTool(call: ScoutToolCall): Promise<ScoutToolResult> {
  const startTime = Date.now();
  const { tool, input } = call;

  log.info('Executing tool', { tool, inputKeys: Object.keys(input) });

  try {
    let output;
    let costIncurred = 0;

    switch (tool) {
      case 'brave_search': {
        const searchInput = input as BraveSearchInput;
        output = await searchBrave(searchInput);
        costIncurred = 0.005; // Fixed Brave cost
        break;
      }

      case 'browser_visit': {
        const visitInput = input as BrowserVisitInput;
        output = await browserVisit(visitInput);
        costIncurred = 0.02; // E2B + Puppeteer estimate
        break;
      }

      case 'run_code': {
        const codeInput = input as RunCodeInput;
        output = await runCode(codeInput);
        costIncurred = 0.01; // E2B execution estimate
        break;
      }

      case 'screenshot': {
        const screenshotInput = input as ScreenshotInput;
        output = await browserScreenshot(screenshotInput);
        costIncurred = 0.03; // E2B + Puppeteer + storage estimate
        break;
      }

      default:
        throw new Error(`Unknown tool: ${tool}`);
    }

    const timeElapsed = Date.now() - startTime;

    log.info('Tool execution complete', {
      tool,
      success: output.success,
      timeMs: timeElapsed,
      cost: costIncurred,
    });

    return {
      tool,
      success: output.success,
      output,
      costIncurred,
      timeElapsed,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Tool execution failed', { tool, error: errMsg });

    return {
      tool,
      success: false,
      output: { success: false, error: errMsg } as ScoutToolOutput,
      costIncurred: 0,
      timeElapsed: Date.now() - startTime,
    };
  }
}

/**
 * Execute multiple tools (optionally in parallel)
 */
export async function executeManyTools(
  calls: ScoutToolCall[],
  options: {
    parallel?: boolean;
    maxConcurrent?: number;
  } = {}
): Promise<ScoutToolResult[]> {
  const { parallel = false, maxConcurrent = 5 } = options;

  if (!parallel) {
    // Sequential execution
    const results: ScoutToolResult[] = [];
    for (const call of calls) {
      results.push(await executeScoutTool(call));
    }
    return results;
  }

  // Parallel execution with concurrency limit
  const results: ScoutToolResult[] = [];

  for (let i = 0; i < calls.length; i += maxConcurrent) {
    const batch = calls.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch.map((call) => executeScoutTool(call)));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Clean up all sandboxes
 */
export async function cleanupAllSandboxes(): Promise<void> {
  log.info('Cleaning up all sandboxes');
  await Promise.all([cleanupBrowserSandbox(), cleanupCodeSandbox()]);
}

/**
 * Get Claude tool definitions for tool use
 */
export function getClaudeToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: object;
}> {
  return [
    {
      name: 'brave_search',
      description:
        'Search the web using Brave Search API. Returns snippets and links. Best for quick fact-finding.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query',
          },
          count: {
            type: 'number',
            description: 'Number of results (default 10, max 20)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'browser_visit',
      description:
        'Visit a URL with a full browser (Puppeteer). Can extract rendered content from JavaScript-heavy pages. Use when you need actual page content, not just search snippets.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to visit',
          },
          selector: {
            type: 'string',
            description: 'CSS selector to extract specific content (optional)',
          },
          waitFor: {
            type: 'string',
            description: 'CSS selector to wait for before extraction (optional)',
          },
          extractText: {
            type: 'boolean',
            description: 'Extract all text content (default true)',
          },
          extractLinks: {
            type: 'boolean',
            description: 'Extract all links on the page',
          },
          extractStructured: {
            type: 'boolean',
            description: 'Try to extract structured data like prices, JSON-LD',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'run_code',
      description:
        'Execute Python or JavaScript code in a sandbox. Useful for data processing, calculations, web scraping with BeautifulSoup, etc. Python has pandas, numpy, requests, beautifulsoup4 installed.',
      input_schema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The code to execute',
          },
          language: {
            type: 'string',
            enum: ['python', 'javascript'],
            description: 'Programming language',
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default 30000)',
          },
        },
        required: ['code', 'language'],
      },
    },
    {
      name: 'screenshot',
      description: 'Take a screenshot of a webpage. Returns base64-encoded image.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to screenshot',
          },
          fullPage: {
            type: 'boolean',
            description: 'Capture full page (default false)',
          },
          width: {
            type: 'number',
            description: 'Viewport width (default 1280)',
          },
          height: {
            type: 'number',
            description: 'Viewport height (default 800)',
          },
        },
        required: ['url'],
      },
    },
  ];
}

/**
 * Parse a Claude tool call into our format
 */
export function parseClaudeToolCall(
  name: string,
  input: Record<string, unknown>
): ScoutToolCall | null {
  const validTools: ScoutToolName[] = ['brave_search', 'browser_visit', 'run_code', 'screenshot'];

  if (!validTools.includes(name as ScoutToolName)) {
    return null;
  }

  return {
    tool: name as ScoutToolName,
    input: input as unknown as ScoutToolInput,
  };
}
