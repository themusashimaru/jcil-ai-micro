/**
 * BROWSER EXECUTOR FOR RESEARCH AGENT
 *
 * Executes browser-based research using Puppeteer in E2B sandbox.
 * Enables the Research Agent to visit JavaScript-heavy sites and capture screenshots.
 *
 * Key Features:
 * - Full JavaScript rendering via Puppeteer
 * - Screenshot capture for visual research
 * - Link extraction for further exploration
 * - Content extraction from dynamic pages
 * - Safety rails from main chat tools
 */

import { GeneratedQuery, SearchResult } from '../../core/types';
import { logger } from '@/lib/logger';
import { executeBrowserVisitTool, isBrowserVisitAvailable } from '@/lib/ai/tools/browser-visit';
import type { UnifiedToolCall, UnifiedToolResult } from '@/lib/ai/providers/types';

const log = logger('BrowserExecutor');

// Browser action types for research
type BrowserAction = 'extract_content' | 'screenshot' | 'extract_links';

export class BrowserExecutor {
  /**
   * Check if browser execution is available
   */
  async isAvailable(): Promise<boolean> {
    return isBrowserVisitAvailable();
  }

  /**
   * Determine if a query should use browser instead of regular search
   * Used for JavaScript-heavy sites or when screenshots are needed
   */
  shouldUseBrowser(query: GeneratedQuery): boolean {
    const lower = query.query.toLowerCase();

    // Patterns that suggest browser is needed
    const browserPatterns = [
      /screenshot/i,
      /visual/i,
      /look.*at.*page/i,
      /see.*website/i,
      /interactive/i,
      /javascript/i,
      /react|angular|vue|svelte/i,
      /spa|single.?page/i,
      /dashboard/i,
      /webapp/i,
      /load.*content/i,
    ];

    // Known JS-heavy domains
    const jsDomains = [
      'twitter.com',
      'x.com',
      'linkedin.com',
      'facebook.com',
      'instagram.com',
      'tiktok.com',
      'reddit.com',
      'notion.so',
      'figma.com',
      'miro.com',
      'canva.com',
      'airtable.com',
    ];

    // Check patterns
    if (browserPatterns.some((p) => p.test(lower))) {
      return true;
    }

    // Check if URL contains known JS-heavy domain
    if (query.expectedInfo?.some((info) => jsDomains.some((d) => info.includes(d)))) {
      return true;
    }

    return false;
  }

  /**
   * Execute a browser visit for a research query
   */
  async execute(query: GeneratedQuery, url?: string): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      if (!(await this.isAvailable())) {
        return this.createErrorResult(
          query,
          'Browser execution not available (E2B not configured)'
        );
      }

      // Determine URL to visit
      const targetUrl = url || this.extractUrlFromQuery(query);
      if (!targetUrl) {
        return this.createErrorResult(
          query,
          'No URL provided and could not extract URL from query'
        );
      }

      log.info('Executing browser visit', { url: targetUrl, purpose: query.purpose });

      // Determine action based on query
      const action = this.determineAction(query);

      // Create tool call
      const toolCall: UnifiedToolCall = {
        id: `browser_${Date.now()}`,
        name: 'browser_visit',
        arguments: {
          url: targetUrl,
          action,
          wait_for: 'networkidle',
        },
      };

      // Execute browser visit
      const result = await executeBrowserVisitTool(toolCall);

      return this.transformResult(query, result, startTime, targetUrl);
    } catch (error) {
      log.error('Browser execution failed', { error: (error as Error).message });
      return this.createErrorResult(query, `Browser error: ${(error as Error).message}`);
    }
  }

  /**
   * Execute browser visits for multiple queries
   * Runs sequentially to avoid overwhelming E2B sandbox
   */
  async executeMany(queries: GeneratedQuery[], urls?: string[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const url = urls?.[i];

      // Rate limit: wait between requests
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const result = await this.execute(query, url);
      results.push(result);
    }

    return results;
  }

  /**
   * Extract URL from query if present
   */
  private extractUrlFromQuery(query: GeneratedQuery): string | null {
    // Check query text for URLs
    const urlMatch = query.query.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      return urlMatch[0];
    }

    // Check expectedInfo for URLs
    for (const info of query.expectedInfo || []) {
      const match = info.match(/https?:\/\/[^\s]+/);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  /**
   * Determine browser action based on query intent
   */
  private determineAction(query: GeneratedQuery): BrowserAction {
    const lower = query.query.toLowerCase();

    if (/screenshot|visual|image|capture/i.test(lower)) {
      return 'screenshot';
    }

    if (/links|urls|navigation|sitemap/i.test(lower)) {
      return 'extract_links';
    }

    // Default to content extraction
    return 'extract_content';
  }

  /**
   * Transform tool result to SearchResult
   */
  private transformResult(
    query: GeneratedQuery,
    toolResult: UnifiedToolResult,
    startTime: number,
    url: string
  ): SearchResult {
    const executionTime = Date.now() - startTime;

    if (toolResult.isError) {
      return this.createErrorResult(query, toolResult.content);
    }

    // Parse the content
    const content = toolResult.content;
    let hasScreenshot = false;

    // Check if result contains screenshot info
    if (content.includes('Screenshot captured') || content.includes('base64')) {
      hasScreenshot = true;
    }

    return {
      id: `browser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      query: query.query,
      source: 'brave', // Using 'brave' as the closest existing type
      content,
      url,
      title: `Browser visit: ${url}`,
      timestamp: Date.now(),
      relevanceScore: 0.8, // Browser results are typically highly relevant
      metadata: {
        executionTime,
        hasRichData: hasScreenshot,
        richDataType: hasScreenshot ? 'screenshot' : 'browser_content',
      },
    };
  }

  /**
   * Create error result
   */
  private createErrorResult(query: GeneratedQuery, error: string): SearchResult {
    return {
      id: `browser_error_${Date.now()}`,
      query: query.query,
      source: 'brave',
      content: error,
      timestamp: Date.now(),
      relevanceScore: 0,
    };
  }
}

// Singleton instance
export const browserExecutor = new BrowserExecutor();
