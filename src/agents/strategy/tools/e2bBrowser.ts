/**
 * E2B BROWSER TOOL
 *
 * Uses E2B sandbox with Puppeteer to visit URLs and extract content.
 * This allows scouts to access dynamic content that requires JavaScript rendering.
 */

import { Sandbox } from '@e2b/code-interpreter';
import type {
  BrowserVisitInput,
  BrowserVisitOutput,
  ScreenshotInput,
  ScreenshotOutput,
} from './types';
import { logger } from '@/lib/logger';

const log = logger('E2BBrowser');

// Sandbox pool for reuse
let sharedSandbox: Sandbox | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 300000; // 5 minutes
const SANDBOX_IDLE_CLEANUP_MS = 60000; // Clean up after 1 min idle

/**
 * Get or create a shared sandbox for browser operations
 */
async function getSandbox(): Promise<Sandbox> {
  const now = Date.now();

  // If we have a sandbox that's been idle too long, clean it up
  if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await sharedSandbox.kill();
    } catch {
      // Ignore cleanup errors
    }
    sharedSandbox = null;
  }

  // Create new sandbox if needed
  if (!sharedSandbox) {
    log.info('Creating new E2B sandbox for browser operations');
    sharedSandbox = await Sandbox.create({
      timeoutMs: SANDBOX_TIMEOUT_MS,
    });

    // Install Puppeteer in the sandbox
    await sharedSandbox.commands.run('npm install puppeteer', {
      timeoutMs: 60000,
    });

    log.info('Puppeteer installed in sandbox');
  }

  sandboxLastUsed = now;
  return sharedSandbox;
}

/**
 * Visit a URL and extract content using Puppeteer
 */
export async function browserVisit(input: BrowserVisitInput): Promise<BrowserVisitOutput> {
  const startTime = Date.now();

  try {
    const sandbox = await getSandbox();

    // Build the Puppeteer script
    const script = buildVisitScript(input);

    log.info('Executing browser visit', { url: input.url });

    // Run the script
    const result = await sandbox.runCode(script);

    if (result.error) {
      log.error('Browser visit script error', { error: result.error });
      return {
        success: false,
        url: input.url,
        error: result.error.value || result.error.name || 'Script execution failed',
      };
    }

    // Parse the output
    const stdout = result.logs.stdout.join('');

    try {
      const output = JSON.parse(stdout);
      log.info('Browser visit complete', {
        url: input.url,
        timeMs: Date.now() - startTime,
        hasContent: !!output.textContent,
      });

      return {
        success: true,
        url: input.url,
        title: output.title,
        textContent: output.textContent,
        links: output.links,
        structuredData: output.structuredData,
      };
    } catch {
      // If we can't parse JSON, return the raw output
      return {
        success: true,
        url: input.url,
        textContent: stdout,
      };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Browser visit failed', { url: input.url, error: errMsg });

    return {
      success: false,
      url: input.url,
      error: errMsg,
    };
  }
}

/**
 * Build the Puppeteer script for visiting a URL
 */
function buildVisitScript(input: BrowserVisitInput): string {
  const {
    url,
    selector,
    waitFor,
    extractText = true,
    extractLinks = false,
    extractStructured = false,
  } = input;

  return `
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set a reasonable viewport
    await page.setViewport({ width: 1280, height: 800 });

    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Navigate to URL
    await page.goto('${url}', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    ${
      waitFor
        ? `
    // Wait for specific element
    await page.waitForSelector('${waitFor}', { timeout: 10000 });
    `
        : ''
    }

    const result = {};

    // Get page title
    result.title = await page.title();

    ${
      selector
        ? `
    // Extract specific content by selector
    result.textContent = await page.$eval('${selector}', el => el.textContent?.trim() || '');
    `
        : extractText
          ? `
    // Extract all text content
    result.textContent = await page.evaluate(() => {
      // Remove script and style elements
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return clone.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 50000) || '';
    });
    `
          : ''
    }

    ${
      extractLinks
        ? `
    // Extract links
    result.links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 50)
        .map(a => ({
          text: a.textContent?.trim().slice(0, 100) || '',
          href: a.href,
        }))
        .filter(l => l.href.startsWith('http'));
    });
    `
        : ''
    }

    ${
      extractStructured
        ? `
    // Try to extract structured data (prices, etc.)
    result.structuredData = await page.evaluate(() => {
      const data = {};

      // Look for JSON-LD
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        try {
          data.jsonLd = JSON.parse(jsonLd.textContent);
        } catch {}
      }

      // Look for price patterns
      const priceRegex = /\\$[\\d,]+(\\.\\d{2})?/g;
      const priceElements = document.body.innerText.match(priceRegex);
      if (priceElements) {
        data.prices = [...new Set(priceElements)].slice(0, 20);
      }

      // Look for meta tags
      const metaTags = {};
      document.querySelectorAll('meta[property], meta[name]').forEach(meta => {
        const key = meta.getAttribute('property') || meta.getAttribute('name');
        const value = meta.getAttribute('content');
        if (key && value) metaTags[key] = value;
      });
      data.meta = metaTags;

      return data;
    });
    `
        : ''
    }

    console.log(JSON.stringify(result));
  } finally {
    await browser.close();
  }
})();
`;
}

/**
 * Take a screenshot of a URL
 */
export async function browserScreenshot(input: ScreenshotInput): Promise<ScreenshotOutput> {
  const startTime = Date.now();

  try {
    const sandbox = await getSandbox();

    const { url, fullPage = false, width = 1280, height = 800 } = input;

    const script = `
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: ${width}, height: ${height} });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto('${url}', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const screenshot = await page.screenshot({
      fullPage: ${fullPage},
      encoding: 'base64',
    });

    console.log(JSON.stringify({ imageBase64: screenshot }));
  } finally {
    await browser.close();
  }
})();
`;

    log.info('Taking screenshot', { url });

    const result = await sandbox.runCode(script);

    if (result.error) {
      return {
        success: false,
        error: result.error.value || result.error.name || 'Screenshot failed',
      };
    }

    const stdout = result.logs.stdout.join('');
    const output = JSON.parse(stdout);

    log.info('Screenshot complete', { url, timeMs: Date.now() - startTime });

    return {
      success: true,
      imageBase64: output.imageBase64,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Screenshot failed', { url: input.url, error: errMsg });

    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Clean up the shared sandbox
 */
export async function cleanupBrowserSandbox(): Promise<void> {
  if (sharedSandbox) {
    try {
      await sharedSandbox.kill();
      log.info('Browser sandbox cleaned up');
    } catch (error) {
      log.warn('Failed to cleanup browser sandbox', { error });
    }
    sharedSandbox = null;
  }
}
