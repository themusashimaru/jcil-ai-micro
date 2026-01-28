/**
 * ENHANCED E2B BROWSER TOOL
 *
 * Advanced browser automation with safety controls:
 * - Safe form filling (search, filters, quotes only)
 * - Pagination handling
 * - Infinite scroll support
 * - Click-through navigation
 * - PDF download and extraction
 */

import { Sandbox } from '@e2b/code-interpreter';
import {
  isUrlSafe,
  isInputSafe,
  canVisitPage,
  recordPageVisit,
  canSubmitForm,
  recordFormSubmission,
  sanitizeOutput,
  logRiskyAction,
  RATE_LIMITS,
} from './safety';
import { logger } from '@/lib/logger';

const log = logger('E2BBrowserEnhanced');

// Shared sandbox
let sharedSandbox: Sandbox | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 300000;
const SANDBOX_IDLE_CLEANUP_MS = 60000;

// =============================================================================
// TYPES
// =============================================================================

export interface FormField {
  selector: string; // CSS selector
  value: string; // Value to fill
  type?: 'text' | 'select' | 'checkbox' | 'radio';
}

export interface SafeFormInput {
  url: string;
  sessionId: string;
  formSelector?: string; // CSS selector for form, defaults to first form
  fields: FormField[];
  submitSelector?: string; // CSS selector for submit button
  waitForSelector?: string; // Wait for this after submit
}

export interface SafeFormOutput {
  success: boolean;
  resultUrl?: string;
  resultContent?: string;
  error?: string;
}

export interface PaginationInput {
  url: string;
  sessionId: string;
  nextButtonSelector: string;
  contentSelector: string;
  maxPages?: number;
}

export interface PaginationOutput {
  success: boolean;
  pages: Array<{
    pageNumber: number;
    url: string;
    content: string;
  }>;
  totalPages: number;
  error?: string;
}

export interface InfiniteScrollInput {
  url: string;
  sessionId: string;
  contentSelector: string;
  maxScrolls?: number;
  scrollDelay?: number;
}

export interface InfiniteScrollOutput {
  success: boolean;
  content: string;
  itemCount?: number;
  error?: string;
}

export interface ClickNavigateInput {
  url: string;
  sessionId: string;
  clickSelector: string;
  waitForSelector?: string;
  extractContent?: boolean;
}

export interface ClickNavigateOutput {
  success: boolean;
  resultUrl?: string;
  content?: string;
  error?: string;
}

// =============================================================================
// SANDBOX MANAGEMENT
// =============================================================================

async function getSandbox(): Promise<Sandbox> {
  const now = Date.now();

  if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await sharedSandbox.kill();
    } catch {
      // Ignore
    }
    sharedSandbox = null;
  }

  if (!sharedSandbox) {
    log.info('Creating new E2B sandbox for enhanced browser');
    sharedSandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT_MS });
    await sharedSandbox.commands.run('npm install puppeteer', { timeoutMs: 60000 });
    log.info('Puppeteer installed in enhanced sandbox');
  }

  sandboxLastUsed = now;
  return sharedSandbox;
}

function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// =============================================================================
// SAFE FORM FILLING
// =============================================================================

/**
 * Safely fill and submit a form (search, filter, quote forms only)
 *
 * LIMITATIONS:
 * - Does NOT extract or submit CSRF tokens automatically
 * - May fail on sites that require CSRF protection for form submissions
 * - Best used with simple search/filter forms that don't require authentication
 * - For sites with CSRF protection, consider using browser_visit to view results
 *   or the click_navigate tool to interact with pre-rendered forms
 *
 * SUPPORTED FORMS:
 * - Search forms (search boxes, filters)
 * - Quote/estimate forms
 * - Location/date selectors
 * - Price range filters
 *
 * NOT SUPPORTED:
 * - Login/signup forms (blocked by safety)
 * - Payment/checkout forms (blocked by safety)
 * - Forms requiring CSRF tokens (will fail silently or return errors)
 * - Forms requiring cookies from authenticated sessions
 */
export async function safeFormFill(input: SafeFormInput): Promise<SafeFormOutput> {
  const { url, sessionId, formSelector, fields, submitSelector, waitForSelector } = input;

  // Safety checks
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, error: urlCheck.reason };
  }

  const pageCheck = canVisitPage(sessionId, url);
  if (!pageCheck.safe) {
    return { success: false, error: pageCheck.reason };
  }

  const formCheck = canSubmitForm(sessionId);
  if (!formCheck.safe) {
    return { success: false, error: formCheck.reason };
  }

  // Validate each field
  for (const field of fields) {
    const inputCheck = isInputSafe(field.selector, field.selector);
    if (!inputCheck.safe) {
      logRiskyAction(sessionId, 'blocked_field', {
        field: field.selector,
        reason: inputCheck.reason,
      });
      return { success: false, error: `Unsafe field: ${inputCheck.reason}` };
    }
  }

  log.info('Executing safe form fill', { url, fieldCount: fields.length });

  try {
    const sandbox = await getSandbox();

    // Build field filling code
    const fieldCode = fields
      .map((f) => {
        const safeSelector = escapeJsString(f.selector);
        const safeValue = escapeJsString(f.value);

        if (f.type === 'select') {
          return `await page.select('${safeSelector}', '${safeValue}');`;
        } else if (f.type === 'checkbox' || f.type === 'radio') {
          return `await page.click('${safeSelector}');`;
        } else {
          return `await page.type('${safeSelector}', '${safeValue}', { delay: 50 });`;
        }
      })
      .join('\n    ');

    const safeFormSelector = formSelector ? escapeJsString(formSelector) : 'form';
    const safeSubmitSelector = submitSelector ? escapeJsString(submitSelector) : null;
    const safeWaitSelector = waitForSelector ? escapeJsString(waitForSelector) : null;

    const script = `
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto('${escapeJsString(url)}', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for form
    await page.waitForSelector('${safeFormSelector}', { timeout: 10000 });

    // Fill fields
    ${fieldCode}

    // Submit form
    ${
      safeSubmitSelector
        ? `await page.click('${safeSubmitSelector}');`
        : `await page.evaluate((sel) => {
        const form = document.querySelector(sel);
        if (form) form.submit();
      }, '${safeFormSelector}');`
    }

    // Wait for result
    ${safeWaitSelector ? `await page.waitForSelector('${safeWaitSelector}', { timeout: 15000 });` : `await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});`}

    // Extract result
    const resultUrl = page.url();
    const resultContent = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return clone.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 30000) || '';
    });

    console.log(JSON.stringify({ success: true, resultUrl, resultContent }));
  } finally {
    await browser.close();
  }
})();
`;

    const result = await sandbox.runCode(script);

    if (result.error) {
      return { success: false, error: result.error.value || 'Form submission failed' };
    }

    const stdout = result.logs.stdout.join('');
    const output = JSON.parse(stdout);

    recordPageVisit(sessionId, url);
    recordFormSubmission(sessionId);

    return {
      success: true,
      resultUrl: output.resultUrl,
      resultContent: sanitizeOutput(output.resultContent),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Safe form fill failed', { url, error: errMsg });
    return { success: false, error: errMsg };
  }
}

// =============================================================================
// PAGINATION HANDLING
// =============================================================================

/**
 * Navigate through paginated results
 */
export async function handlePagination(input: PaginationInput): Promise<PaginationOutput> {
  const { url, sessionId, nextButtonSelector, contentSelector, maxPages = 5 } = input;

  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, pages: [], totalPages: 0, error: urlCheck.reason };
  }

  log.info('Handling pagination', { url, maxPages });

  try {
    const sandbox = await getSandbox();

    const script = `
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto('${escapeJsString(url)}', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    const pages = [];
    let pageNum = 1;

    while (pageNum <= ${maxPages}) {
      // Extract content from current page
      const content = await page.$eval('${escapeJsString(contentSelector)}', el => el.textContent?.trim() || '');
      pages.push({
        pageNumber: pageNum,
        url: page.url(),
        content: content.slice(0, 10000),
      });

      // Try to find and click next button
      const nextButton = await page.$('${escapeJsString(nextButtonSelector)}');
      if (!nextButton) break;

      const isDisabled = await page.evaluate(btn => {
        return btn.disabled || btn.classList.contains('disabled') || btn.getAttribute('aria-disabled') === 'true';
      }, nextButton);

      if (isDisabled) break;

      await nextButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, ${RATE_LIMITS.actionDelayMs}));

      pageNum++;
    }

    console.log(JSON.stringify({ success: true, pages, totalPages: pages.length }));
  } finally {
    await browser.close();
  }
})();
`;

    const result = await sandbox.runCode(script);

    if (result.error) {
      return {
        success: false,
        pages: [],
        totalPages: 0,
        error: result.error.value || 'Pagination failed',
      };
    }

    const stdout = result.logs.stdout.join('');
    const output = JSON.parse(stdout);

    recordPageVisit(sessionId, url);

    return {
      success: true,
      pages: output.pages.map((p: { pageNumber: number; url: string; content: string }) => ({
        ...p,
        content: sanitizeOutput(p.content),
      })),
      totalPages: output.totalPages,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Pagination failed', { url, error: errMsg });
    return { success: false, pages: [], totalPages: 0, error: errMsg };
  }
}

// =============================================================================
// INFINITE SCROLL
// =============================================================================

/**
 * Handle infinite scroll pages
 */
export async function handleInfiniteScroll(
  input: InfiniteScrollInput
): Promise<InfiniteScrollOutput> {
  const { url, sessionId, contentSelector, maxScrolls = 10, scrollDelay = 1000 } = input;

  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, content: '', error: urlCheck.reason };
  }

  log.info('Handling infinite scroll', { url, maxScrolls });

  try {
    const sandbox = await getSandbox();

    const script = `
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto('${escapeJsString(url)}', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    let previousHeight = 0;
    let scrollCount = 0;

    while (scrollCount < ${maxScrolls}) {
      // Scroll to bottom
      const currentHeight = await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
        return document.body.scrollHeight;
      });

      // Wait for new content
      await new Promise(r => setTimeout(r, ${scrollDelay}));

      // Check if we've loaded new content
      if (currentHeight === previousHeight) {
        break; // No more content to load
      }

      previousHeight = currentHeight;
      scrollCount++;
    }

    // Extract all content
    const content = await page.$eval('${escapeJsString(contentSelector)}', el => el.textContent?.trim() || '');
    const itemCount = await page.$$eval('${escapeJsString(contentSelector)} > *', items => items.length);

    console.log(JSON.stringify({
      success: true,
      content: content.slice(0, 50000),
      itemCount,
    }));
  } finally {
    await browser.close();
  }
})();
`;

    const result = await sandbox.runCode(script);

    if (result.error) {
      return { success: false, content: '', error: result.error.value || 'Infinite scroll failed' };
    }

    const stdout = result.logs.stdout.join('');
    const output = JSON.parse(stdout);

    recordPageVisit(sessionId, url);

    return {
      success: true,
      content: sanitizeOutput(output.content),
      itemCount: output.itemCount,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Infinite scroll failed', { url, error: errMsg });
    return { success: false, content: '', error: errMsg };
  }
}

// =============================================================================
// CLICK NAVIGATION
// =============================================================================

/**
 * Click on an element and extract the resulting page
 */
export async function clickAndNavigate(input: ClickNavigateInput): Promise<ClickNavigateOutput> {
  const { url, sessionId, clickSelector, waitForSelector, extractContent = true } = input;

  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, error: urlCheck.reason };
  }

  const pageCheck = canVisitPage(sessionId, url);
  if (!pageCheck.safe) {
    return { success: false, error: pageCheck.reason };
  }

  log.info('Click and navigate', { url, clickSelector });

  try {
    const sandbox = await getSandbox();

    const script = `
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    await page.goto('${escapeJsString(url)}', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // Wait for element and click
    await page.waitForSelector('${escapeJsString(clickSelector)}', { timeout: 10000 });
    await page.click('${escapeJsString(clickSelector)}');

    // Wait for navigation or specific element
    ${
      waitForSelector
        ? `await page.waitForSelector('${escapeJsString(waitForSelector)}', { timeout: 15000 });`
        : `await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});`
    }

    const resultUrl = page.url();
    let content = '';

    ${
      extractContent
        ? `
    content = await page.evaluate(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return clone.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 30000) || '';
    });
    `
        : ''
    }

    console.log(JSON.stringify({ success: true, resultUrl, content }));
  } finally {
    await browser.close();
  }
})();
`;

    const result = await sandbox.runCode(script);

    if (result.error) {
      return { success: false, error: result.error.value || 'Click navigation failed' };
    }

    const stdout = result.logs.stdout.join('');
    const output = JSON.parse(stdout);

    recordPageVisit(sessionId, url);

    return {
      success: true,
      resultUrl: output.resultUrl,
      content: output.content ? sanitizeOutput(output.content) : undefined,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Click navigation failed', { url, error: errMsg });
    return { success: false, error: errMsg };
  }
}

// =============================================================================
// PDF DOWNLOAD & EXTRACTION
// =============================================================================

export interface PdfExtractInput {
  url: string;
  sessionId: string;
}

export interface PdfExtractOutput {
  success: boolean;
  text?: string;
  pageCount?: number;
  error?: string;
}

/**
 * Download and extract text from a PDF
 */
export async function extractPdf(input: PdfExtractInput): Promise<PdfExtractOutput> {
  const { url, sessionId } = input;

  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, error: urlCheck.reason };
  }

  log.info('Extracting PDF', { url });

  try {
    const sandbox = await getSandbox();

    // Install pdf-parse if not already
    await sandbox.commands.run('npm install pdf-parse 2>/dev/null || true', { timeoutMs: 30000 });

    const script = `
const https = require('https');
const http = require('http');
const pdfParse = require('pdf-parse');

const url = '${escapeJsString(url)}';
const protocol = url.startsWith('https') ? https : http;

protocol.get(url, (response) => {
  const chunks = [];

  response.on('data', (chunk) => chunks.push(chunk));

  response.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks);
      const data = await pdfParse(buffer);

      console.log(JSON.stringify({
        success: true,
        text: data.text.slice(0, 50000),
        pageCount: data.numpages,
      }));
    } catch (err) {
      console.log(JSON.stringify({
        success: false,
        error: err.message,
      }));
    }
  });
}).on('error', (err) => {
  console.log(JSON.stringify({
    success: false,
    error: err.message,
  }));
});
`;

    const result = await sandbox.runCode(script);

    if (result.error) {
      return { success: false, error: result.error.value || 'PDF extraction failed' };
    }

    const stdout = result.logs.stdout.join('');
    const output = JSON.parse(stdout);

    if (!output.success) {
      return { success: false, error: output.error };
    }

    recordPageVisit(sessionId, url);

    return {
      success: true,
      text: sanitizeOutput(output.text),
      pageCount: output.pageCount,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('PDF extraction failed', { url, error: errMsg });
    return { success: false, error: errMsg };
  }
}
