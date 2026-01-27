/**
 * TOOL EXECUTOR
 *
 * Executes scout tools and tracks costs/timing.
 */

import Anthropic from '@anthropic-ai/sdk';
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
  VisionAnalyzeInput,
  ExtractTableInput,
  SafeFormFillInput,
  PaginateInput,
  InfiniteScrollInput,
  ClickNavigateInput,
  ExtractPdfInput,
  CompareScreenshotsInput,
  GenerateComparisonInput,
} from './types';
import { searchBrave } from './braveSearch';
import { browserVisit, browserScreenshot, cleanupBrowserSandbox } from './e2bBrowser';
import { runCode, cleanupCodeSandbox } from './e2bCode';
import {
  analyzeScreenshot,
  extractTableFromScreenshot,
  compareScreenshots,
} from './visionAnalysis';
import {
  safeFormFill,
  handlePagination,
  handleInfiniteScroll,
  clickAndNavigate,
  extractPdf,
} from './e2bBrowserEnhanced';
import { generateComparisonTable } from './comparisonTable';
import { logger } from '@/lib/logger';

// Lazy-initialized Anthropic client for vision tools
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

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

      // === NEW ENHANCED TOOLS ===

      case 'vision_analyze': {
        const visionInput = input as VisionAnalyzeInput;
        output = await analyzeScreenshot(getAnthropicClient(), visionInput);
        costIncurred = 0.05; // Vision API cost
        break;
      }

      case 'extract_table': {
        const tableInput = input as ExtractTableInput;
        output = await extractTableFromScreenshot(getAnthropicClient(), tableInput);
        costIncurred = 0.05; // Vision API cost
        break;
      }

      case 'safe_form_fill': {
        const formInput = input as SafeFormFillInput;
        output = await safeFormFill(formInput);
        costIncurred = 0.03; // E2B + Puppeteer
        break;
      }

      case 'paginate': {
        const paginateInput = input as PaginateInput;
        output = await handlePagination(paginateInput);
        costIncurred = 0.04; // E2B + multiple pages
        break;
      }

      case 'infinite_scroll': {
        const scrollInput = input as InfiniteScrollInput;
        output = await handleInfiniteScroll(scrollInput);
        costIncurred = 0.04; // E2B + scrolling
        break;
      }

      case 'click_navigate': {
        const clickInput = input as ClickNavigateInput;
        output = await clickAndNavigate(clickInput);
        costIncurred = 0.02; // E2B + Puppeteer
        break;
      }

      case 'extract_pdf': {
        const pdfInput = input as ExtractPdfInput;
        output = await extractPdf(pdfInput);
        costIncurred = 0.02; // E2B + PDF parsing
        break;
      }

      case 'compare_screenshots': {
        const compareInput = input as CompareScreenshotsInput;
        output = await compareScreenshots(
          getAnthropicClient(),
          compareInput.urls,
          compareInput.comparisonPrompt
        );
        costIncurred = 0.1; // Multiple screenshots + Vision
        break;
      }

      case 'generate_comparison': {
        const comparisonInput = input as GenerateComparisonInput;
        output = generateComparisonTable(comparisonInput);
        costIncurred = 0.001; // Local computation only
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
    // === CORE TOOLS ===
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

    // === VISION & AI ANALYSIS TOOLS ===
    {
      name: 'vision_analyze',
      description:
        'Analyze a webpage screenshot with Claude Vision AI. Perfect for extracting data from charts, graphs, images, complex layouts that are hard to scrape. Returns AI analysis of visual content.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to analyze',
          },
          prompt: {
            type: 'string',
            description:
              'What to look for or extract (e.g., "extract all prices", "describe the chart")',
          },
          fullPage: {
            type: 'boolean',
            description: 'Capture full page screenshot (default false)',
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
        required: ['url', 'prompt'],
      },
    },
    {
      name: 'extract_table',
      description:
        'Extract a table from a webpage screenshot using Claude Vision. Returns structured headers and rows. Ideal for pricing tables, comparison charts, data grids.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL containing the table',
          },
          tableDescription: {
            type: 'string',
            description:
              'Description of the table to find (e.g., "pricing table", "features comparison")',
          },
        },
        required: ['url', 'tableDescription'],
      },
    },
    {
      name: 'compare_screenshots',
      description:
        'Compare multiple webpage screenshots with Claude Vision. Great for price comparison, feature comparison across competitors. Max 4 URLs.',
      input_schema: {
        type: 'object',
        properties: {
          urls: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of URLs to compare (max 4)',
          },
          comparisonPrompt: {
            type: 'string',
            description: 'What to compare (e.g., "compare prices", "compare features")',
          },
        },
        required: ['urls', 'comparisonPrompt'],
      },
    },

    // === SAFE INTERACTIVE BROWSER TOOLS ===
    {
      name: 'safe_form_fill',
      description:
        'Safely fill and submit search/filter forms. ONLY works with search, filter, quote, and estimate forms. BLOCKED: login, signup, payment, checkout forms. Use for things like real estate filters, flight search, job filters.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL with the form',
          },
          sessionId: {
            type: 'string',
            description: 'Session ID for rate limiting',
          },
          formSelector: {
            type: 'string',
            description: 'CSS selector for the form (default: first form)',
          },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                selector: {
                  type: 'string',
                  description: 'CSS selector for the input',
                },
                value: {
                  type: 'string',
                  description: 'Value to fill',
                },
                type: {
                  type: 'string',
                  enum: ['text', 'select', 'checkbox', 'radio'],
                  description: 'Input type (default: text)',
                },
              },
              required: ['selector', 'value'],
            },
            description: 'Array of fields to fill',
          },
          submitSelector: {
            type: 'string',
            description: 'CSS selector for submit button',
          },
          waitForSelector: {
            type: 'string',
            description: 'CSS selector to wait for after submission',
          },
        },
        required: ['url', 'sessionId', 'fields'],
      },
    },
    {
      name: 'paginate',
      description:
        'Navigate through paginated results and extract content from each page. Great for search results, listings, catalogs.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Starting URL',
          },
          sessionId: {
            type: 'string',
            description: 'Session ID for rate limiting',
          },
          nextButtonSelector: {
            type: 'string',
            description: 'CSS selector for the next page button',
          },
          contentSelector: {
            type: 'string',
            description: 'CSS selector for content to extract from each page',
          },
          maxPages: {
            type: 'number',
            description: 'Maximum pages to visit (default 5, max 10)',
          },
        },
        required: ['url', 'sessionId', 'nextButtonSelector', 'contentSelector'],
      },
    },
    {
      name: 'infinite_scroll',
      description:
        'Handle infinite scroll pages by scrolling and loading more content. For social feeds, product listings, etc.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to scroll',
          },
          sessionId: {
            type: 'string',
            description: 'Session ID for rate limiting',
          },
          contentSelector: {
            type: 'string',
            description: 'CSS selector for the content container',
          },
          maxScrolls: {
            type: 'number',
            description: 'Maximum number of scrolls (default 10)',
          },
          scrollDelay: {
            type: 'number',
            description: 'Delay between scrolls in ms (default 1000)',
          },
        },
        required: ['url', 'sessionId', 'contentSelector'],
      },
    },
    {
      name: 'click_navigate',
      description:
        'Click on an element and extract the resulting page content. Useful for expanding details, navigating tabs, modal dialogs.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Starting URL',
          },
          sessionId: {
            type: 'string',
            description: 'Session ID for rate limiting',
          },
          clickSelector: {
            type: 'string',
            description: 'CSS selector for element to click',
          },
          waitForSelector: {
            type: 'string',
            description: 'CSS selector to wait for after clicking',
          },
          extractContent: {
            type: 'boolean',
            description: 'Extract page content after clicking (default true)',
          },
        },
        required: ['url', 'sessionId', 'clickSelector'],
      },
    },

    // === DOCUMENT TOOLS ===
    {
      name: 'extract_pdf',
      description:
        'Download and extract text from a PDF document. Returns the text content and page count.',
      input_schema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'URL of the PDF file',
          },
          sessionId: {
            type: 'string',
            description: 'Session ID for rate limiting',
          },
        },
        required: ['url', 'sessionId'],
      },
    },

    // === DATA ORGANIZATION TOOLS ===
    {
      name: 'generate_comparison',
      description:
        'Generate a formatted comparison table from collected research data. Use after gathering data from multiple sources.',
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title for the comparison table',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Item name (e.g., product name, company name)',
                },
                source: {
                  type: 'string',
                  description: 'Source of the data',
                },
                sourceUrl: {
                  type: 'string',
                  description: 'URL where data was found',
                },
                attributes: {
                  type: 'object',
                  description: 'Key-value pairs of attributes to compare',
                },
              },
              required: ['name', 'attributes'],
            },
            description: 'Array of items to compare',
          },
          sortBy: {
            type: 'string',
            description: 'Attribute key to sort by',
          },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Sort order (default: asc)',
          },
          highlightBest: {
            type: 'array',
            items: { type: 'string' },
            description: 'Attribute keys where best values should be highlighted',
          },
        },
        required: ['title', 'items'],
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
  const validTools: ScoutToolName[] = [
    // Core tools
    'brave_search',
    'browser_visit',
    'run_code',
    'screenshot',
    // Vision & AI tools
    'vision_analyze',
    'extract_table',
    'compare_screenshots',
    // Safe interactive tools
    'safe_form_fill',
    'paginate',
    'infinite_scroll',
    'click_navigate',
    // Document tools
    'extract_pdf',
    // Data organization tools
    'generate_comparison',
  ];

  if (!validTools.includes(name as ScoutToolName)) {
    return null;
  }

  return {
    tool: name as ScoutToolName,
    input: input as unknown as ScoutToolInput,
  };
}
