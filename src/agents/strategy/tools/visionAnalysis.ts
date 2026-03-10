/**
 * VISION ANALYSIS TOOL
 *
 * Takes screenshots and analyzes them with Claude Vision.
 * Can extract:
 * - Pricing tables and grids
 * - Charts and graphs
 * - Floor plans and layouts
 * - Product listings
 * - Any visual content that's hard to scrape
 */

import Anthropic from '@anthropic-ai/sdk';
import { browserScreenshot } from './e2bBrowser';
import { isUrlSafe, sanitizeOutput } from './safety';
import { logger } from '@/lib/logger';

const log = logger('VisionAnalysis');

// =============================================================================
// TYPES
// =============================================================================

export interface VisionAnalysisInput {
  url: string;
  prompt: string; // What to look for/extract
  fullPage?: boolean;
  width?: number;
  height?: number;
}

export interface VisionAnalysisOutput {
  success: boolean;
  analysis?: string;
  extractedData?: Record<string, unknown>;
  error?: string;
}

export interface ExtractTableInput {
  url: string;
  tableDescription: string; // e.g., "pricing table", "comparison chart"
}

export interface ExtractTableOutput {
  success: boolean;
  headers?: string[];
  rows?: string[][];
  rawText?: string;
  error?: string;
}

// =============================================================================
// VISION ANALYSIS FUNCTION
// =============================================================================

/**
 * Analyze a webpage screenshot with Claude Vision
 */
export async function analyzeScreenshot(
  client: Anthropic,
  input: VisionAnalysisInput
): Promise<VisionAnalysisOutput> {
  const { url, prompt, fullPage = false, width = 1280, height = 800 } = input;

  // Safety check
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, error: urlCheck.reason };
  }

  log.info('Analyzing screenshot with Vision', { url, prompt: prompt.slice(0, 50) });

  try {
    // Take the screenshot
    const screenshotResult = await browserScreenshot({
      url,
      fullPage,
      width,
      height,
    });

    if (!screenshotResult.success || !screenshotResult.imageBase64) {
      return {
        success: false,
        error: screenshotResult.error || 'Failed to capture screenshot',
      };
    }

    // Analyze with Claude Vision
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6', // Using Sonnet for vision (good balance of cost/quality)
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotResult.imageBase64,
              },
            },
            {
              type: 'text',
              text: `Analyze this screenshot and ${prompt}

Important:
- Extract specific data points when possible
- Be precise with numbers, prices, dates
- Note any visual elements that provide context
- If you see a table or list, extract it in a structured format

Provide your analysis:`,
            },
          ],
        },
      ],
    });

    const analysisText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Sanitize output
    const sanitizedAnalysis = sanitizeOutput(analysisText);

    log.info('Vision analysis complete', {
      url,
      analysisLength: sanitizedAnalysis.length,
    });

    return {
      success: true,
      analysis: sanitizedAnalysis,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Vision analysis failed', { url, error: errMsg });

    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Extract a table from a webpage screenshot
 */
export async function extractTableFromScreenshot(
  client: Anthropic,
  input: ExtractTableInput
): Promise<ExtractTableOutput> {
  const { url, tableDescription } = input;

  // Safety check
  const urlCheck = isUrlSafe(url);
  if (!urlCheck.safe) {
    return { success: false, error: urlCheck.reason };
  }

  log.info('Extracting table from screenshot', { url, tableDescription });

  try {
    // Take a full page screenshot to capture the table
    const screenshotResult = await browserScreenshot({
      url,
      fullPage: true,
      width: 1280,
      height: 800,
    });

    if (!screenshotResult.success || !screenshotResult.imageBase64) {
      return {
        success: false,
        error: screenshotResult.error || 'Failed to capture screenshot',
      };
    }

    // Extract table with Claude Vision
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshotResult.imageBase64,
              },
            },
            {
              type: 'text',
              text: `Find and extract the ${tableDescription} from this screenshot.

Return the data as a JSON object with this structure:
{
  "headers": ["Column 1", "Column 2", ...],
  "rows": [
    ["Row 1 Col 1", "Row 1 Col 2", ...],
    ["Row 2 Col 1", "Row 2 Col 2", ...],
    ...
  ],
  "notes": "Any additional context about the table"
}

If no table is found, return:
{
  "error": "No matching table found",
  "rawText": "Any relevant text you can extract"
}

Return ONLY valid JSON:`,
            },
          ],
        },
      ],
    });

    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Try to parse as JSON
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.error) {
          return {
            success: false,
            error: parsed.error,
            rawText: parsed.rawText,
          };
        }

        return {
          success: true,
          headers: parsed.headers,
          rows: parsed.rows,
        };
      }
    } catch {
      // JSON parsing failed, return raw text
    }

    return {
      success: true,
      rawText: sanitizeOutput(responseText),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Table extraction failed', { url, error: errMsg });

    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Compare multiple screenshots (e.g., for price comparison)
 */
export async function compareScreenshots(
  client: Anthropic,
  urls: string[],
  comparisonPrompt: string
): Promise<VisionAnalysisOutput> {
  if (urls.length > 4) {
    return {
      success: false,
      error: 'Maximum 4 URLs can be compared at once',
    };
  }

  // Safety check all URLs
  for (const url of urls) {
    const urlCheck = isUrlSafe(url);
    if (!urlCheck.safe) {
      return { success: false, error: `Unsafe URL: ${url} - ${urlCheck.reason}` };
    }
  }

  log.info('Comparing screenshots', {
    urlCount: urls.length,
    prompt: comparisonPrompt.slice(0, 50),
  });

  try {
    // Take screenshots of all URLs
    const screenshots: string[] = [];
    for (const url of urls) {
      const result = await browserScreenshot({ url, width: 1024, height: 768 });
      if (result.success && result.imageBase64) {
        screenshots.push(result.imageBase64);
      } else {
        log.warn('Failed to capture screenshot for comparison', { url });
      }
    }

    if (screenshots.length < 2) {
      return {
        success: false,
        error: 'Need at least 2 successful screenshots to compare',
      };
    }

    // Build message content with all images
    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    screenshots.forEach((base64, i) => {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64,
        },
      });
      content.push({
        type: 'text',
        text: `[Screenshot ${i + 1}: ${urls[i]}]`,
      });
    });

    content.push({
      type: 'text',
      text: `${comparisonPrompt}

Analyze and compare these ${screenshots.length} screenshots. Provide:
1. Key similarities
2. Key differences
3. Extracted data from each (prices, features, etc.)
4. A recommendation if applicable`,
    });

    // Analyze with Claude Vision
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content }],
    });

    const analysisText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      success: true,
      analysis: sanitizeOutput(analysisText),
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Screenshot comparison failed', { error: errMsg });

    return {
      success: false,
      error: errMsg,
    };
  }
}
