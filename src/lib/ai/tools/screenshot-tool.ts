/**
 * SCREENSHOT TOOL
 *
 * Captures screenshots of any URL using Puppeteer in E2B sandbox.
 * Saves to storage and returns URL for viewing.
 *
 * Features:
 * - Full page or viewport screenshots
 * - Custom viewport sizes
 * - Wait for page load
 * - Handles JavaScript-heavy sites
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { isUrlSafe } from './safety';

const log = logger('ScreenshotTool');

// ============================================================================
// E2B LAZY LOADING
// ============================================================================

let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;

async function initE2B(): Promise<boolean> {
  if (e2bAvailable !== null) {
    return e2bAvailable;
  }

  try {
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - screenshot tool disabled');
      e2bAvailable = false;
      return false;
    }

    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    log.info('E2B screenshot tool available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B for screenshot', { error: (error as Error).message });
    e2bAvailable = false;
    return false;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCREENSHOT_TIMEOUT_MS = 30000;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const screenshotTool: UnifiedTool = {
  name: 'screenshot',
  description: `Capture a screenshot of any webpage. Use this when:
- User wants to see what a website looks like
- You need to show the visual appearance of a page
- Comparing website designs
- Capturing the current state of a web application
- User asks "show me what X website looks like"

Returns a base64 image that can be displayed or analyzed.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to screenshot',
      },
      full_page: {
        type: 'boolean',
        description:
          'Capture the full scrollable page (true) or just the viewport (false). Default: false',
        default: false,
      },
      width: {
        type: 'number',
        description: 'Viewport width in pixels. Default: 1280',
        default: 1280,
      },
      height: {
        type: 'number',
        description: 'Viewport height in pixels. Default: 720',
        default: 720,
      },
      wait_for: {
        type: 'string',
        description: 'CSS selector to wait for before capturing. Optional.',
      },
      delay_ms: {
        type: 'number',
        description: 'Additional delay in milliseconds after page load. Default: 1000',
        default: 1000,
      },
    },
    required: ['url'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeScreenshot(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'screenshot') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  // Initialize E2B
  const available = await initE2B();
  if (!available || !Sandbox) {
    return {
      toolCallId: id,
      content: 'Screenshot tool is not available. E2B sandbox service is not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const url = args.url as string;
  const fullPage = args.full_page === true;
  const width = (args.width as number) || 1280;
  const height = (args.height as number) || 720;
  const waitFor = args.wait_for as string | undefined;
  const delayMs = (args.delay_ms as number) || 1000;

  if (!url) {
    return {
      toolCallId: id,
      content: 'No URL provided',
      isError: true,
    };
  }

  // Safety check
  const safetyCheck = isUrlSafe(url);
  if (!safetyCheck.safe) {
    return {
      toolCallId: id,
      content: `Cannot screenshot this URL: ${safetyCheck.reason}`,
      isError: true,
    };
  }

  log.info('Taking screenshot', { url, fullPage, width, height });

  let sandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;

  try {
    sandbox = await Sandbox.create({
      timeoutMs: SCREENSHOT_TIMEOUT_MS,
    });

    // Python code to capture screenshot using Playwright (installed in E2B)
    const pythonCode = `
import asyncio
import base64
from playwright.async_api import async_playwright

async def take_screenshot():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={'width': ${width}, 'height': ${height}},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()

        try:
            await page.goto('${url.replace(/'/g, "\\'")}', wait_until='networkidle', timeout=20000)
            ${waitFor ? `await page.wait_for_selector('${waitFor.replace(/'/g, "\\'")}', timeout=10000)` : ''}
            await asyncio.sleep(${delayMs / 1000})

            screenshot = await page.screenshot(full_page=${fullPage ? 'True' : 'False'}, type='png')
            b64_screenshot = base64.b64encode(screenshot).decode('utf-8')
            print("__SCREENSHOT__")
            print(b64_screenshot)
        finally:
            await browser.close()

asyncio.run(take_screenshot())
`;

    const execution = await sandbox.runCode(pythonCode);
    const stdout = execution.logs.stdout.join('\n');
    const stderr = execution.logs.stderr.join('\n');

    if (stderr && !stdout.includes('__SCREENSHOT__')) {
      log.error('Screenshot failed', { stderr });
      return {
        toolCallId: id,
        content: `Screenshot failed: ${stderr.slice(0, 500)}`,
        isError: true,
      };
    }

    if (!stdout.includes('__SCREENSHOT__')) {
      return {
        toolCallId: id,
        content: 'Screenshot capture failed - no output received',
        isError: true,
      };
    }

    // Extract base64 screenshot
    const b64Screenshot = stdout.split('__SCREENSHOT__')[1]?.trim();
    if (!b64Screenshot) {
      return {
        toolCallId: id,
        content: 'Screenshot capture failed - empty output',
        isError: true,
      };
    }

    log.info('Screenshot captured successfully', { url, size: b64Screenshot.length });

    // Return as a markdown image that can be rendered
    const content = `Screenshot of ${url}:\n\n![Screenshot](data:image/png;base64,${b64Screenshot})\n\n*Viewport: ${width}x${height}${fullPage ? ' (full page)' : ''}*`;

    return {
      toolCallId: id,
      content,
      isError: false,
    };
  } catch (error) {
    log.error('Screenshot execution failed', { error: (error as Error).message });
    return {
      toolCallId: id,
      content: `Screenshot failed: ${(error as Error).message}`,
      isError: true,
    };
  } finally {
    if (sandbox) {
      try {
        await sandbox.kill();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isScreenshotAvailable(): Promise<boolean> {
  return Boolean(process.env.E2B_API_KEY);
}
