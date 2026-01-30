/**
 * BROWSER VISIT TOOL
 *
 * Uses E2B Puppeteer to visit JavaScript-heavy pages and extract content.
 * This is the heavy-duty version of fetch_url for dynamic sites.
 *
 * Features:
 * - Full browser rendering (JavaScript execution)
 * - Screenshot capability
 * - Form interaction (search filters only - no login/payment)
 * - Link extraction
 * - Comprehensive safety rails (same as Deep Strategy agent)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import {
  isUrlSafe,
  canVisitPage,
  recordPageVisit,
  isDomainTrusted,
  sanitizeOutput,
  canExecuteTool,
  recordToolCost,
} from './safety';

const log = logger('BrowserVisitTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.03; // $0.03 per browser visit (E2B + compute)
const BROWSER_TIMEOUT_MS = 45000; // 45 seconds for page load + extraction
const MAX_CONTENT_LENGTH = 100000; // 100KB max

// E2B lazy loading
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;

// Browser sandbox pool
let browserSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 300000; // 5 minutes
const SANDBOX_IDLE_CLEANUP_MS = 180000; // 3 minutes idle cleanup

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const browserVisitTool: UnifiedTool = {
  name: 'browser_visit',
  description: `Visit a webpage using a full browser (with JavaScript). Use this when:
- fetch_url returned incomplete content (JavaScript-heavy site)
- You need to interact with a page (click, scroll, fill search forms)
- The site requires JavaScript to render content
- You need a screenshot of the page

This tool uses Puppeteer in a secure sandbox. It can:
- Render JavaScript-heavy pages (React, Vue, etc.)
- Extract content after JavaScript loads
- Take screenshots
- Click elements and extract resulting content
- Fill search/filter forms (NOT login or payment forms)

Safety: Cannot access government sites, adult content, login pages, or payment forms.
All the same restrictions as the Deep Strategy agent apply here.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to visit (must be http:// or https://)',
      },
      action: {
        type: 'string',
        description: 'What action to perform',
        enum: ['extract_content', 'screenshot', 'extract_links', 'click_and_extract'],
        default: 'extract_content',
      },
      wait_for: {
        type: 'string',
        description: 'CSS selector to wait for before extracting (optional)',
      },
      click_selector: {
        type: 'string',
        description: 'CSS selector of element to click (for click_and_extract action)',
      },
      scroll_to_bottom: {
        type: 'boolean',
        description: 'Whether to scroll to bottom to load more content',
        default: false,
      },
    },
    required: ['url'],
  },
};

// ============================================================================
// E2B INITIALIZATION
// ============================================================================

async function initE2B(): Promise<boolean> {
  if (e2bAvailable !== null) {
    return e2bAvailable;
  }

  try {
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - browser visit disabled');
      e2bAvailable = false;
      return false;
    }

    const e2bModule = await import('@e2b/code-interpreter');
    Sandbox = e2bModule.Sandbox;
    e2bAvailable = true;
    log.info('Browser visit available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B', { error: (error as Error).message });
    e2bAvailable = false;
    return false;
  }
}

/**
 * Get or create browser sandbox with Puppeteer installed
 */
async function getBrowserSandbox(): Promise<
  InstanceType<typeof import('@e2b/code-interpreter').Sandbox>
> {
  if (!Sandbox) {
    throw new Error('E2B not initialized');
  }

  const now = Date.now();

  // Cleanup idle sandbox
  if (browserSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await browserSandbox.kill();
    } catch {
      // Ignore
    }
    browserSandbox = null;
  }

  // Create new sandbox if needed
  if (!browserSandbox) {
    log.info('Creating browser sandbox');
    browserSandbox = await Sandbox.create({
      timeoutMs: SANDBOX_TIMEOUT_MS,
    });

    // Install Puppeteer (fire and forget with long timeout)
    browserSandbox.commands
      .run('npm install puppeteer', { timeoutMs: 120000 })
      .then(() => log.info('Puppeteer installed in sandbox'))
      .catch((err) => log.warn('Puppeteer installation issue', { error: (err as Error).message }));
  }

  sandboxLastUsed = now;
  return browserSandbox;
}

// ============================================================================
// PUPPETEER SCRIPT BUILDER
// ============================================================================

function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function buildPuppeteerScript(
  url: string,
  action: string,
  options: {
    waitFor?: string;
    clickSelector?: string;
    scrollToBottom?: boolean;
  }
): string {
  const escapedUrl = escapeJsString(url);
  const escapedWaitFor = options.waitFor ? escapeJsString(options.waitFor) : '';
  const escapedClickSelector = options.clickSelector ? escapeJsString(options.clickSelector) : '';

  return `
const puppeteer = require('puppeteer');

(async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate
    await page.goto('${escapedUrl}', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for specific element if specified
    ${escapedWaitFor ? `await page.waitForSelector('${escapedWaitFor}', { timeout: 10000 }).catch(() => {});` : ''}

    // Scroll to bottom if requested
    ${
      options.scrollToBottom
        ? `
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight > 10000) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });
    await new Promise(r => setTimeout(r, 1000));
    `
        : ''
    }

    // Click element if specified
    ${
      escapedClickSelector
        ? `
    try {
      await page.click('${escapedClickSelector}');
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error('Click failed:', e.message);
    }
    `
        : ''
    }

    ${
      action === 'screenshot'
        ? `
    // Take screenshot
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
    console.log(JSON.stringify({ type: 'screenshot', data: screenshot }));
    `
        : action === 'extract_links'
          ? `
    // Extract links
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map(a => ({ text: a.textContent?.trim() || '', href: a.href }))
        .filter(l => l.href.startsWith('http') && l.text)
        .slice(0, 50);
    });
    console.log(JSON.stringify({ type: 'links', data: links }));
    `
          : `
    // Extract content
    const content = await page.evaluate(() => {
      // Remove scripts, styles, nav, footer
      const toRemove = document.querySelectorAll('script, style, nav, footer, header, aside, .ad, .advertisement, .sidebar');
      toRemove.forEach(el => el.remove());

      // Get title
      const title = document.title || '';

      // Get main content
      const main = document.querySelector('main, article, .content, #content, .post, .article') || document.body;
      const text = main.innerText || main.textContent || '';

      // Clean up whitespace
      const cleaned = text.replace(/\\s+/g, ' ').trim().slice(0, 50000);

      return { title, content: cleaned };
    });
    console.log(JSON.stringify({ type: 'content', data: content }));
    `
    }

  } catch (error) {
    console.error(JSON.stringify({ type: 'error', message: error.message }));
  } finally {
    if (browser) await browser.close();
  }
})();
`;
}

// ============================================================================
// BROWSER EXECUTION
// ============================================================================

async function executeBrowserVisit(
  url: string,
  action: string,
  options: {
    waitFor?: string;
    clickSelector?: string;
    scrollToBottom?: boolean;
  }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  try {
    const sandbox = await getBrowserSandbox();
    const script = buildPuppeteerScript(url, action, options);

    log.info('Executing browser visit', { url, action });

    // Write and run script
    const tempFile = `/tmp/browser_${Date.now()}.js`;
    await sandbox.files.write(tempFile, script);

    const result = await sandbox.commands.run(`node ${tempFile}`, {
      timeoutMs: BROWSER_TIMEOUT_MS,
    });

    // Cleanup
    await sandbox.files.remove(tempFile).catch(() => {});

    // Parse output
    const stdout = result.stdout || '';
    const lines = stdout.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'error') {
          return { success: false, error: parsed.message };
        }
        return { success: true, result: parsed };
      } catch {
        // Not JSON, continue
      }
    }

    // Check stderr for errors
    if (result.stderr && result.stderr.includes('error')) {
      return { success: false, error: result.stderr.slice(0, 500) };
    }

    return { success: false, error: 'No output from browser' };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Browser visit failed', { url, error: errMsg });
    return { success: false, error: errMsg };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeBrowserVisitTool(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'browser_visit') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  // Initialize E2B
  const available = await initE2B();
  if (!available) {
    return {
      toolCallId: id,
      content: 'Browser visit is not available. E2B sandbox is not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  let url = args.url as string;
  const action = (args.action as string) || 'extract_content';
  const waitFor = args.wait_for as string;
  const clickSelector = args.click_selector as string;
  const scrollToBottom = args.scroll_to_bottom as boolean;

  if (!url) {
    return {
      toolCallId: id,
      content: 'No URL provided.',
      isError: true,
    };
  }

  // Normalize URL
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Safety check - URL safety (same as Deep Strategy)
  const urlSafety = isUrlSafe(url);
  if (!urlSafety.safe) {
    return {
      toolCallId: id,
      content: `Cannot visit URL: ${urlSafety.reason} (${urlSafety.category})`,
      isError: true,
    };
  }

  // Session-based visit check (use passed session ID or generate fallback)
  const sessionId = toolCall.sessionId || `chat_${Date.now()}`;
  const visitCheck = canVisitPage(sessionId, url);
  if (!visitCheck.safe) {
    return {
      toolCallId: id,
      content: `Cannot visit page: ${visitCheck.reason}`,
      isError: true,
    };
  }

  // Cost check
  const costCheck = canExecuteTool(sessionId, 'browser_visit', TOOL_COST);
  if (!costCheck.allowed) {
    return {
      toolCallId: id,
      content: `Cannot execute browser visit: ${costCheck.reason}`,
      isError: true,
    };
  }

  // Check if click selector is safe (no login/payment elements)
  if (clickSelector) {
    const dangerousSelectors = [
      'login',
      'signin',
      'sign-in',
      'signup',
      'sign-up',
      'register',
      'checkout',
      'payment',
      'pay',
      'purchase',
      'buy',
      'submit',
      'password',
    ];
    const lowerSelector = clickSelector.toLowerCase();
    for (const dangerous of dangerousSelectors) {
      if (lowerSelector.includes(dangerous)) {
        return {
          toolCallId: id,
          content: `Cannot click on potentially sensitive element: ${dangerous}`,
          isError: true,
        };
      }
    }
  }

  // Log for trusted vs untrusted domains
  if (!isDomainTrusted(url)) {
    log.info('Visiting untrusted domain', { url });
  }

  // Execute
  const result = await executeBrowserVisit(url, action, {
    waitFor,
    clickSelector,
    scrollToBottom,
  });

  // Record visit and cost
  recordPageVisit(sessionId, url);
  recordToolCost(sessionId, 'browser_visit', TOOL_COST);

  if (!result.success) {
    return {
      toolCallId: id,
      content: `Browser visit failed: ${result.error}`,
      isError: true,
    };
  }

  // Format output based on action
  const data = result.result as { type: string; data: unknown };

  if (data.type === 'screenshot') {
    return {
      toolCallId: id,
      content: `Screenshot captured. The screenshot data is available as base64.`,
      isError: false,
    };
  }

  if (data.type === 'links') {
    const links = data.data as Array<{ text: string; href: string }>;
    const formatted = links.map((l) => `- [${l.text}](${l.href})`).join('\n');
    return {
      toolCallId: id,
      content: `Found ${links.length} links:\n\n${formatted}`,
      isError: false,
    };
  }

  if (data.type === 'content') {
    const content = data.data as { title: string; content: string };
    let output = '';
    if (content.title) {
      output += `# ${content.title}\n\n`;
    }
    output += sanitizeOutput(content.content.slice(0, MAX_CONTENT_LENGTH));
    output += `\n\n---\n*Source: ${url}*`;

    return {
      toolCallId: id,
      content: output,
      isError: false,
    };
  }

  return {
    toolCallId: id,
    content: JSON.stringify(data.data, null, 2).slice(0, MAX_CONTENT_LENGTH),
    isError: false,
  };
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export async function isBrowserVisitAvailable(): Promise<boolean> {
  return initE2B();
}

export async function cleanupBrowserSandbox(): Promise<void> {
  if (browserSandbox) {
    try {
      await browserSandbox.kill();
      browserSandbox = null;
      log.info('Browser sandbox cleaned up');
    } catch (error) {
      log.warn('Error cleaning up browser sandbox', { error: (error as Error).message });
    }
  }
}
