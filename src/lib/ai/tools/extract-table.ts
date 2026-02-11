/**
 * TABLE EXTRACTION TOOL
 *
 * Extracts table data from images using Vision AI.
 * Converts visual tables into structured data.
 *
 * Features:
 * - Extract tables from screenshots
 * - Convert to markdown or JSON format
 * - Handle pricing tables, comparison charts
 * - Multi-table extraction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost } from './safety';

const log = logger('ExtractTableTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.03; // $0.03 per table extraction (Vision API)
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20MB
const VISION_TIMEOUT_MS = 45000;

// Anthropic lazy load
let AnthropicClient: typeof import('@anthropic-ai/sdk').default | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const extractTableTool: UnifiedTool = {
  name: 'extract_table',
  description: `Extract table data from an image. Use this when:
- User shares a screenshot of a table or spreadsheet
- You need to extract pricing data from an image
- User has a comparison chart or data table as an image
- Converting visual data into usable text/numbers

This uses Vision AI to:
- Identify tables in images
- Extract all cells and data
- Return as structured markdown table or JSON
- Handle headers, multi-row/column spans`,
  parameters: {
    type: 'object',
    properties: {
      image_url: {
        type: 'string',
        description: 'URL of the image containing the table',
      },
      output_format: {
        type: 'string',
        description: 'How to format the extracted data',
        enum: ['markdown', 'json', 'csv'],
        default: 'markdown',
      },
      table_hint: {
        type: 'string',
        description:
          'Hint about what kind of table this is (e.g., "pricing table", "comparison chart")',
      },
    },
    required: ['image_url'],
  },
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initAnthropic(): Promise<boolean> {
  if (AnthropicClient !== null) {
    return true;
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      log.warn('ANTHROPIC_API_KEY not configured');
      return false;
    }

    const anthropicModule = await import('@anthropic-ai/sdk');
    AnthropicClient = anthropicModule.default;
    return true;
  } catch (error) {
    log.error('Failed to init Anthropic', { error: (error as Error).message });
    return false;
  }
}

// ============================================================================
// IMAGE FETCHING
// ============================================================================

async function fetchImage(
  url: string
): Promise<{ success: boolean; data?: string; mediaType?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TableExtractor/1.0)',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return { success: false, error: `Not an image: ${contentType}` };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_SIZE) {
      return { success: false, error: 'Image too large' };
    }

    return {
      success: true,
      data: Buffer.from(buffer).toString('base64'),
      mediaType: contentType.split(';')[0].trim(),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// TABLE EXTRACTION
// ============================================================================

async function extractTable(
  imageBase64: string,
  mediaType: string,
  outputFormat: string,
  tableHint?: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  if (!AnthropicClient) {
    return { success: false, error: 'Vision client not available' };
  }

  try {
    const client = new AnthropicClient({ apiKey: process.env.ANTHROPIC_API_KEY });

    const formatInstructions = {
      markdown: `Return the table as a properly formatted markdown table with | separators.
Example:
| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |`,

      json: `Return the table as a JSON object with this structure:
{
  "headers": ["Column1", "Column2", ...],
  "rows": [
    ["Cell1", "Cell2", ...],
    ...
  ]
}
Return ONLY the JSON, no other text.`,

      csv: `Return the table as CSV format with comma separators.
Use quotes around values containing commas.
Include the header row first.`,
    };

    const prompt = `Extract ALL table data from this image.

${tableHint ? `Context: This appears to be a ${tableHint}.` : ''}

Instructions:
1. Identify ALL tables in the image
2. Extract EVERY cell's content accurately
3. Preserve the exact structure (rows and columns)
4. Keep numerical precision (don't round numbers)
5. Include headers if present

${formatInstructions[outputFormat as keyof typeof formatInstructions] || formatInstructions.markdown}

If there are multiple tables, extract each one and separate them clearly.
If no tables are found, explain what you see instead.`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const result = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n');

    return { success: true, result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeExtractTable(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'extract_table') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  const available = await initAnthropic();
  if (!available) {
    return {
      toolCallId: id,
      content: 'Table extraction not available. Vision API not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const imageUrl = args.image_url as string;
  const outputFormat = (args.output_format as string) || 'markdown';
  const tableHint = args.table_hint as string;

  if (!imageUrl) {
    return { toolCallId: id, content: 'No image URL provided.', isError: true };
  }

  // Cost check (use passed session ID or generate fallback)
  const sessionId = toolCall.sessionId || `chat_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'extract_table', TOOL_COST);
  if (!costCheck.allowed) {
    return { toolCallId: id, content: `Cannot extract: ${costCheck.reason}`, isError: true };
  }

  // Fetch image
  const fetchResult = await fetchImage(imageUrl);
  if (!fetchResult.success) {
    return {
      toolCallId: id,
      content: `Failed to fetch image: ${fetchResult.error}`,
      isError: true,
    };
  }

  // Extract
  const extractResult = await extractTable(
    fetchResult.data!,
    fetchResult.mediaType!,
    outputFormat,
    tableHint
  );

  recordToolCost(sessionId, 'extract_table', TOOL_COST);

  if (!extractResult.success) {
    return { toolCallId: id, content: `Extraction failed: ${extractResult.error}`, isError: true };
  }

  return {
    toolCallId: id,
    content: `**Table Extracted (${outputFormat} format):**\n\n${extractResult.result}`,
    isError: false,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export async function isExtractTableAvailable(): Promise<boolean> {
  return initAnthropic();
}
