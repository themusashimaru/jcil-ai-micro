/**
 * URL CONTENT FETCHER TOOL
 *
 * Fetches and extracts readable content from URLs.
 * Uses simple HTML parsing for static pages, Jina Reader API for JS-heavy sites.
 *
 * Features:
 * - Automatic content extraction (removes navigation, ads, scripts)
 * - Automatic fallback to Jina Reader for JavaScript-rendered pages
 * - Image URL extraction for media-rich pages
 * - Safety checks for blocked domains
 * - Timeout protection
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('FetchUrlTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const FETCH_TIMEOUT_MS = 15000; // 15 second timeout for direct fetch
const JINA_TIMEOUT_MS = 20000; // 20 second timeout for Jina Reader
const MAX_CONTENT_LENGTH = 50000; // ~50KB max content to return
const MIN_USEFUL_CONTENT_LENGTH = 200; // Below this, content is considered too thin
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Blocked domains for safety (same as strategy agent)
const BLOCKED_DOMAINS = [
  // Government
  '.gov',
  '.mil',
  // Sanctioned nations
  '.kp',
  '.ir',
  '.cu',
  '.sy',
  '.ru',
  // State media
  'rt.com',
  'sputniknews.com',
  'xinhuanet.com',
  'cgtn.com',
  'presstv.ir',
  'kcna.kp',
  // Dark web
  '.onion',
  // Adult content patterns
  'porn',
  'xxx',
  'adult',
  // Extremist
  '4chan',
  '8kun',
];

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const fetchUrlTool: UnifiedTool = {
  name: 'fetch_url',
  description: `Fetch and extract the main content from a URL. Use this when:
- User shares a link and asks about its content
- You need to read an article, blog post, or documentation
- User asks "What does this page say?" or "Summarize this link"
- You need specific information from a webpage (not just search results)
- You need to extract images/logos from a website

This renders JavaScript-heavy pages and extracts readable content.
Supports text, links, structured content, and image URL extraction.

Note: Cannot access paywalled content, login-required pages, or blocked domains.`,
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to fetch (must start with http:// or https://)',
      },
      extract_type: {
        type: 'string',
        description:
          'What to extract: "text" for readable content, "links" for all links, "structured" for formatted content, "images" for image URLs',
        enum: ['text', 'links', 'structured', 'images'],
        default: 'text',
      },
    },
    required: ['url'],
  },
};

// ============================================================================
// SAFETY CHECKS
// ============================================================================

function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // Check protocol
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: 'Only HTTP/HTTPS URLs are allowed' };
    }

    // Check blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked) || fullUrl.includes(blocked)) {
        return { safe: false, reason: `Domain is blocked: ${blocked}` };
      }
    }

    // Check for local/private IPs
    if (
      hostname === 'localhost' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.16.')
    ) {
      return { safe: false, reason: 'Cannot access local/private networks' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

// ============================================================================
// HTML PARSING (Simple extraction without external dependencies)
// ============================================================================

function extractTextFromHtml(html: string): string {
  // Remove scripts, styles, and other non-content elements
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Try to find main content areas
  const mainContentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of mainContentPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].length > 500) {
      cleaned = match[1];
      break;
    }
  }

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // Convert headers to markdown-style headers
  cleaned = cleaned
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n');

  // Convert lists
  cleaned = cleaned
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>/gi, '\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '\n')
    .replace(/<\/ol>/gi, '\n');

  // Convert paragraphs and line breaks
  cleaned = cleaned
    .replace(/<p[^>]*>/gi, '\n\n')
    .replace(/<\/p>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<div[^>]*>/gi, '\n')
    .replace(/<\/div>/gi, '');

  // Convert links to markdown
  cleaned = cleaned.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)');

  // Convert bold and italic
  cleaned = cleaned
    .replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**')
    .replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');

  // Remove all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&mdash;/g, '-')
    .replace(/&ndash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™');

  // Clean up whitespace
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n /g, '\n')
    .trim();

  // Build final content with metadata
  let result = '';
  if (title) {
    result += `# ${title}\n\n`;
  }
  if (description) {
    result += `> ${description}\n\n`;
  }
  result += cleaned;

  return result;
}

function extractLinksFromHtml(html: string, baseUrl: string): string {
  const links: Array<{ text: string; url: string }> = [];
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    let url = match[1];
    const text = match[2].trim();

    // Skip empty or anchor-only links
    if (!url || url.startsWith('#') || url.startsWith('javascript:')) continue;
    if (!text) continue;

    // Resolve relative URLs
    try {
      if (!url.startsWith('http')) {
        url = new URL(url, baseUrl).href;
      }
    } catch {
      continue;
    }

    // Dedupe
    if (!links.some((l) => l.url === url)) {
      links.push({ text, url });
    }
  }

  // Format as markdown list
  if (links.length === 0) {
    return 'No links found on this page.';
  }

  return (
    `Found ${links.length} links:\n\n` +
    links
      .slice(0, 50)
      .map((l) => `- [${l.text}](${l.url})`)
      .join('\n')
  );
}

function extractImageUrlsFromHtml(html: string, baseUrl: string): string {
  const images: Array<{ src: string; alt: string }> = [];

  // Match <img> tags
  const imgRegex = /<img[^>]*\s+src="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];
    const altMatch = match[0].match(/alt="([^"]*)"/i);
    const alt = altMatch ? altMatch[1] : '';

    // Skip tiny images (tracking pixels, spacers)
    if (src.includes('1x1') || src.includes('pixel') || src.includes('spacer')) continue;
    // Skip data URIs that are tiny
    if (src.startsWith('data:') && src.length < 200) continue;

    // Resolve relative URLs
    try {
      if (!src.startsWith('http') && !src.startsWith('data:')) {
        src = new URL(src, baseUrl).href;
      }
    } catch {
      continue;
    }

    if (!images.some((i) => i.src === src)) {
      images.push({ src, alt });
    }
  }

  // Also check for og:image and other meta images
  const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
  if (ogImageMatch && ogImageMatch[1]) {
    let ogSrc = ogImageMatch[1];
    try {
      if (!ogSrc.startsWith('http')) {
        ogSrc = new URL(ogSrc, baseUrl).href;
      }
    } catch {
      /* skip */
    }
    if (!images.some((i) => i.src === ogSrc)) {
      images.unshift({ src: ogSrc, alt: 'OpenGraph image' });
    }
  }

  // Check for CSS background images in inline styles
  const bgRegex = /background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    let src = match[1];
    try {
      if (!src.startsWith('http') && !src.startsWith('data:')) {
        src = new URL(src, baseUrl).href;
      }
    } catch {
      continue;
    }
    if (!images.some((i) => i.src === src)) {
      images.push({ src, alt: 'background image' });
    }
  }

  // Check for srcset images (high-res versions)
  const srcsetRegex = /srcset="([^"]*)"/gi;
  while ((match = srcsetRegex.exec(html)) !== null) {
    const srcsetParts = match[1].split(',');
    for (const part of srcsetParts) {
      const [srcRaw] = part.trim().split(/\s+/);
      if (!srcRaw) continue;
      let src = srcRaw;
      try {
        if (!src.startsWith('http') && !src.startsWith('data:')) {
          src = new URL(src, baseUrl).href;
        }
      } catch {
        continue;
      }
      if (!images.some((i) => i.src === src)) {
        images.push({ src, alt: 'srcset image' });
      }
    }
  }

  if (images.length === 0) {
    return 'No images found on this page.';
  }

  // Separate logo candidates from regular images
  const logoImages = images.filter(
    (i) =>
      i.src.toLowerCase().includes('logo') ||
      i.alt.toLowerCase().includes('logo') ||
      i.src.toLowerCase().includes('brand')
  );
  const otherImages = images.filter(
    (i) =>
      !i.src.toLowerCase().includes('logo') &&
      !i.alt.toLowerCase().includes('logo') &&
      !i.src.toLowerCase().includes('brand')
  );

  let result = `Found ${images.length} images:\n\n`;

  if (logoImages.length > 0) {
    result += '**Logo/Brand Images:**\n';
    for (const img of logoImages.slice(0, 5)) {
      result += `- ${img.alt || 'Logo'}: ${img.src}\n`;
    }
    result += '\n';
  }

  result += '**Page Images:**\n';
  for (const img of otherImages.slice(0, 30)) {
    result += `- ${img.alt || '(no alt text)'}: ${img.src}\n`;
  }

  return result;
}

// ============================================================================
// JINA READER FALLBACK
// ============================================================================

/**
 * Fetch page content using Jina Reader API (r.jina.ai).
 * This renders JavaScript, extracts clean content, and returns markdown.
 * Free tier with no API key required.
 */
async function fetchViaJinaReader(
  url: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  log.info('Falling back to Jina Reader for JS-heavy page', { url });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const response = await fetch(jinaUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/markdown',
        'X-Return-Format': 'markdown',
        'X-With-Images': 'true',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Jina Reader error: HTTP ${response.status}`,
      };
    }

    let content = await response.text();

    // Truncate if needed
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
    }

    if (content.length < MIN_USEFUL_CONTENT_LENGTH) {
      return {
        success: false,
        error: 'Page returned very little content even after JavaScript rendering.',
      };
    }

    content += `\n\n---\n*Source: ${url}*`;

    log.info('Jina Reader fetch successful', { url, contentLength: content.length });
    return { success: true, content };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('abort')) {
      return { success: false, error: 'Jina Reader request timed out.' };
    }
    log.error('Jina Reader fetch failed', { url, error: msg });
    return { success: false, error: `Jina Reader failed: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// FETCH IMPLEMENTATION
// ============================================================================

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Detect if HTML content is from a JavaScript-rendered page with minimal static content.
 */
function isJsHeavyPage(html: string): boolean {
  // Clear indicators of JS-only rendering
  if (html.includes('__NEXT_DATA__') || html.includes('__NUXT__')) return true;
  if (html.includes('window.__INITIAL_STATE__') && !html.includes('<article')) return true;

  // Page has <noscript> warning and very little content
  if (html.includes('<noscript>') && html.length < 5000) return true;

  // React/Vue/Angular root div with no content
  if (html.match(/<div\s+id="(root|app|__next)"[^>]*>\s*<\/div>/i)) return true;

  // Very little actual text content relative to page size
  const textContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If after stripping all tags we have very little text but a lot of HTML, it's JS-heavy
  if (html.length > 10000 && textContent.length < 500) return true;

  return false;
}

async function fetchUrlContent(
  url: string,
  extractType: 'text' | 'links' | 'structured' | 'images' = 'text'
): Promise<{ success: boolean; content?: string; error?: string }> {
  // Safety check
  const safetyCheck = isUrlSafe(url);
  if (!safetyCheck.safe) {
    return { success: false, error: safetyCheck.reason };
  }

  try {
    log.info('Fetching URL', { url, extractType });

    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);

    if (!response.ok) {
      // Handle specific error codes — try Jina Reader as fallback for 403s
      if (response.status === 403) {
        log.info('Direct fetch returned 403, trying Jina Reader fallback', { url });
        return fetchViaJinaReader(url);
      }
      if (response.status === 404) {
        return { success: false, error: 'Page not found (404).' };
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limited (429). Try again later.' };
      }
      return { success: false, error: `HTTP error: ${response.status} ${response.statusText}` };
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle non-HTML content
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return {
        success: true,
        content: '```json\n' + JSON.stringify(json, null, 2).slice(0, MAX_CONTENT_LENGTH) + '\n```',
      };
    }

    if (contentType.includes('text/plain')) {
      const text = await response.text();
      return { success: true, content: text.slice(0, MAX_CONTENT_LENGTH) };
    }

    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return {
        success: false,
        error: `Unsupported content type: ${contentType}. Can only extract from HTML pages.`,
      };
    }

    // Get HTML content
    const html = await response.text();

    // Check if page requires JavaScript rendering
    const needsJs = isJsHeavyPage(html);

    if (needsJs) {
      log.info('JS-heavy page detected, using Jina Reader fallback', { url });
      const jinaResult = await fetchViaJinaReader(url);
      if (jinaResult.success) {
        // For image extraction, we still need the raw HTML plus Jina content
        if (extractType === 'images') {
          // Jina markdown may contain image URLs — extract them
          const imageLines = (jinaResult.content || '')
            .split('\n')
            .filter(
              (l) =>
                l.match(/!\[.*?\]\(.*?\)/) ||
                l.match(/https?:\/\/\S+\.(jpg|jpeg|png|svg|webp|gif)/i)
            );
          if (imageLines.length > 0) {
            return {
              success: true,
              content: `Images found on ${url}:\n\n${imageLines.join('\n')}\n\n---\n*Source: ${url}*`,
            };
          }
          // Fall through to HTML-based extraction with what we have
        } else {
          return jinaResult;
        }
      }
      // If Jina fails, still try to extract what we can from the raw HTML
      log.warn('Jina Reader fallback failed, extracting from raw HTML', { url });
    }

    // Extract based on type
    let content: string;
    switch (extractType) {
      case 'links':
        content = extractLinksFromHtml(html, url);
        break;
      case 'images':
        content = extractImageUrlsFromHtml(html, url);
        content += `\n\n---\n*Source: ${url}*`;
        break;
      case 'structured':
        content = extractTextFromHtml(html);
        content += `\n\n---\n*Source: ${url}*`;
        break;
      case 'text':
      default: {
        content = extractTextFromHtml(html);
        content += `\n\n---\n*Source: ${url}*`;

        // If direct extraction yielded very little content, try Jina Reader
        if (!needsJs && content.length < MIN_USEFUL_CONTENT_LENGTH) {
          log.info('Direct extraction yielded thin content, trying Jina Reader', {
            url,
            contentLength: content.length,
          });
          const jinaResult = await fetchViaJinaReader(url);
          if (jinaResult.success) {
            return jinaResult;
          }
        }
        break;
      }
    }

    // Truncate if too long
    if (content.length > MAX_CONTENT_LENGTH) {
      content = content.slice(0, MAX_CONTENT_LENGTH) + '\n\n[Content truncated...]';
    }

    log.info('URL fetch successful', { url, contentLength: content.length });

    return { success: true, content };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('aborted') || errorMessage.includes('abort')) {
      // Direct fetch timed out — try Jina Reader
      log.info('Direct fetch timed out, trying Jina Reader fallback', { url });
      return fetchViaJinaReader(url);
    }

    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      return { success: false, error: 'Could not resolve domain. Check the URL is correct.' };
    }

    if (errorMessage.includes('ECONNREFUSED')) {
      return { success: false, error: 'Connection refused. The server may be down.' };
    }

    log.error('URL fetch failed', { url, error: errorMessage });
    return { success: false, error: `Failed to fetch: ${errorMessage}` };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeFetchUrl(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'fetch_url') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const url = args.url as string;
  const extractType = (args.extract_type as 'text' | 'links' | 'structured' | 'images') || 'text';

  if (!url) {
    return {
      toolCallId: id,
      content: 'No URL provided. Please specify a URL to fetch.',
      isError: true,
    };
  }

  // Ensure URL has protocol
  let normalizedUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    normalizedUrl = 'https://' + url;
  }

  const result = await fetchUrlContent(normalizedUrl, extractType);

  if (!result.success) {
    return {
      toolCallId: id,
      content: result.error || 'Failed to fetch URL',
      isError: true,
    };
  }

  return {
    toolCallId: id,
    content: result.content || 'No content extracted',
    isError: false,
  };
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export function isFetchUrlAvailable(): boolean {
  return true; // Always available since it uses native fetch + Jina Reader
}
