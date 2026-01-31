/**
 * WEB CAPTURE TOOL
 *
 * Capture screenshots and generate PDFs from web pages using Puppeteer.
 * Enhanced capabilities beyond basic screenshot tool.
 *
 * Capabilities:
 * - Full page screenshots
 * - Element-specific screenshots
 * - PDF generation from pages
 * - Execute JavaScript on pages
 * - Extract page metadata
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded puppeteer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteer: any = null;

async function initPuppeteer(): Promise<boolean> {
  if (puppeteer) return true;
  try {
    puppeteer = await import('puppeteer-core');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const webCaptureTool: UnifiedTool = {
  name: 'capture_webpage',
  description: `Capture web pages as screenshots or PDFs with advanced options.

Operations:
- screenshot: Capture page as PNG/JPEG image
- pdf: Generate PDF from web page
- metadata: Extract page title, description, OpenGraph tags
- execute_js: Run JavaScript on the page and return result

Screenshot options:
- Full page or viewport only
- Custom viewport size
- Specific element selector
- Image format (PNG/JPEG)
- Quality settings

PDF options:
- Page size (A4, Letter, etc.)
- Orientation (portrait/landscape)
- Margins
- Background graphics

Note: Requires Chrome/Chromium browser to be available.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['screenshot', 'pdf', 'metadata', 'execute_js'],
        description: 'Web capture operation to perform',
      },
      url: {
        type: 'string',
        description: 'URL of the web page to capture',
      },
      full_page: {
        type: 'boolean',
        description: 'For screenshot: capture full scrollable page (default: true)',
      },
      selector: {
        type: 'string',
        description: 'For screenshot: CSS selector for specific element to capture',
      },
      viewport_width: {
        type: 'number',
        description: 'Viewport width in pixels (default: 1280)',
      },
      viewport_height: {
        type: 'number',
        description: 'Viewport height in pixels (default: 800)',
      },
      format: {
        type: 'string',
        enum: ['png', 'jpeg', 'webp'],
        description: 'For screenshot: image format (default: png)',
      },
      quality: {
        type: 'number',
        description: 'For JPEG/WebP: quality 0-100 (default: 80)',
      },
      page_size: {
        type: 'string',
        enum: ['A4', 'Letter', 'Legal', 'Tabloid', 'A3'],
        description: 'For PDF: page size (default: A4)',
      },
      landscape: {
        type: 'boolean',
        description: 'For PDF: landscape orientation (default: false)',
      },
      javascript: {
        type: 'string',
        description: 'For execute_js: JavaScript code to run on the page',
      },
      wait_for: {
        type: 'string',
        description: 'CSS selector to wait for before capture',
      },
      wait_time: {
        type: 'number',
        description: 'Additional wait time in milliseconds',
      },
    },
    required: ['operation', 'url'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isWebCaptureAvailable(): boolean {
  // Check if Chrome/Chromium is likely available
  return true; // Will fail gracefully if browser not found
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeWebCapture(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    url: string;
    full_page?: boolean;
    selector?: string;
    viewport_width?: number;
    viewport_height?: number;
    format?: string;
    quality?: number;
    page_size?: string;
    landscape?: boolean;
    javascript?: string;
    wait_for?: string;
    wait_time?: number;
  };

  if (!args.operation || !args.url) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation and URL are required' }),
      isError: true,
    };
  }

  // Validate URL
  try {
    new URL(args.url);
  } catch {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Invalid URL provided' }),
      isError: true,
    };
  }

  try {
    const initialized = await initPuppeteer();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize Puppeteer' }),
        isError: true,
      };
    }

    // Try to find Chrome
    const executablePath = findChrome();
    if (!executablePath) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          error: 'Chrome/Chromium browser not found',
          hint: 'Install Chrome or set CHROME_PATH environment variable',
        }),
        isError: true,
      };
    }

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Set viewport
      await page.setViewport({
        width: args.viewport_width || 1280,
        height: args.viewport_height || 800,
      });

      // Navigate to URL
      await page.goto(args.url, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait for selector if specified
      if (args.wait_for) {
        await page.waitForSelector(args.wait_for, { timeout: 10000 });
      }

      // Additional wait time
      if (args.wait_time) {
        await new Promise((resolve) => setTimeout(resolve, args.wait_time));
      }

      let result: Record<string, unknown>;

      switch (args.operation) {
        case 'screenshot': {
          const format = args.format || 'png';
          const screenshotOptions: Record<string, unknown> = {
            type: format as 'png' | 'jpeg' | 'webp',
            fullPage: args.full_page !== false,
            encoding: 'base64',
          };

          if (format !== 'png' && args.quality) {
            screenshotOptions.quality = args.quality;
          }

          let screenshot: string;

          if (args.selector) {
            const element = await page.$(args.selector);
            if (!element) {
              return {
                toolCallId: toolCall.id,
                content: JSON.stringify({ error: `Element not found: ${args.selector}` }),
                isError: true,
              };
            }
            screenshot = await element.screenshot(screenshotOptions);
          } else {
            screenshot = await page.screenshot(screenshotOptions);
          }

          result = {
            operation: 'screenshot',
            url: args.url,
            format,
            full_page: args.full_page !== false,
            image_base64: screenshot,
          };
          break;
        }

        case 'pdf': {
          const pdfOptions: Record<string, unknown> = {
            format: args.page_size || 'A4',
            landscape: args.landscape || false,
            printBackground: true,
          };

          const pdfBuffer = await page.pdf(pdfOptions);
          const pdfBase64 = pdfBuffer.toString('base64');

          result = {
            operation: 'pdf',
            url: args.url,
            page_size: args.page_size || 'A4',
            landscape: args.landscape || false,
            pdf_base64: pdfBase64,
            size_bytes: pdfBuffer.length,
          };
          break;
        }

        case 'metadata': {
          const metadata = await page.evaluate(() => {
            const getMeta = (name: string): string | null => {
              const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
              return el?.getAttribute('content') || null;
            };

            return {
              title: document.title,
              description: getMeta('description'),
              og_title: getMeta('og:title'),
              og_description: getMeta('og:description'),
              og_image: getMeta('og:image'),
              og_url: getMeta('og:url'),
              twitter_card: getMeta('twitter:card'),
              twitter_title: getMeta('twitter:title'),
              canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
              language: document.documentElement.lang,
            };
          });

          result = {
            operation: 'metadata',
            url: args.url,
            metadata,
          };
          break;
        }

        case 'execute_js': {
          if (!args.javascript) {
            return {
              toolCallId: toolCall.id,
              content: JSON.stringify({ error: 'JavaScript code required for execute_js' }),
              isError: true,
            };
          }

          const jsResult = await page.evaluate(args.javascript);

          result = {
            operation: 'execute_js',
            url: args.url,
            result: jsResult,
          };
          break;
        }

        default:
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
            isError: true,
          };
      }

      return {
        toolCallId: toolCall.id,
        content: JSON.stringify(result),
        isError: false,
      };
    } finally {
      await browser.close();
    }
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Web capture failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Helper to find Chrome executable
function findChrome(): string | null {
  const paths = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];

  for (const p of paths) {
    if (p) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        if (fs.existsSync(p)) {
          return p;
        }
      } catch {
        // Continue checking
      }
    }
  }

  return null;
}
