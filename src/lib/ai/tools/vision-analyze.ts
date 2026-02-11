/**
 * VISION ANALYSIS TOOL
 *
 * Uses Claude Vision to analyze images and extract structured data.
 * Works with images in the conversation (uploaded by user) or URLs.
 *
 * Features:
 * - Analyze screenshots, photos, charts, documents
 * - Extract text from images (OCR-like functionality)
 * - Extract structured data from charts and tables
 * - Describe image content
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost } from './safety';

const log = logger('VisionAnalyzeTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.02; // $0.02 per analysis (Claude Vision is more expensive)
const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB max
const VISION_TIMEOUT_MS = 30000; // 30 seconds

// Track Anthropic availability
let anthropicAvailable: boolean | null = null;
let AnthropicClient: typeof import('@anthropic-ai/sdk').default | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const visionAnalyzeTool: UnifiedTool = {
  name: 'analyze_image',
  description: `Analyze an image using AI vision. Use this when:
- User uploads an image and asks questions about it
- You need to extract text from a screenshot or photo
- User asks to read data from a chart, graph, or table image
- You need to describe what's in an image
- User shares a receipt, document, or form image

This tool can:
- Read text in images (OCR)
- Understand charts, graphs, diagrams
- Extract structured data from tables in images
- Describe scenes and objects
- Analyze screenshots of apps/websites

Note: Works best with clear, readable images. May struggle with very low quality or highly stylized text.`,
  parameters: {
    type: 'object',
    properties: {
      image_source: {
        type: 'string',
        description:
          'Where the image is from: "conversation" (user uploaded in this chat) or "url" (web URL)',
        enum: ['conversation', 'url'],
        default: 'conversation',
      },
      image_url: {
        type: 'string',
        description: 'URL of the image (only needed if image_source is "url")',
      },
      analysis_type: {
        type: 'string',
        description: 'What kind of analysis to perform',
        enum: ['general', 'text_extraction', 'table_extraction', 'chart_data', 'describe'],
        default: 'general',
      },
      question: {
        type: 'string',
        description: 'Specific question about the image (optional)',
      },
    },
    required: ['image_source'],
  },
};

// ============================================================================
// ANTHROPIC INITIALIZATION
// ============================================================================

async function initAnthropic(): Promise<boolean> {
  if (anthropicAvailable !== null) {
    return anthropicAvailable;
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      log.warn('ANTHROPIC_API_KEY not configured - vision analysis disabled');
      anthropicAvailable = false;
      return false;
    }

    const anthropicModule = await import('@anthropic-ai/sdk');
    AnthropicClient = anthropicModule.default;
    anthropicAvailable = true;
    log.info('Vision analysis available');
    return true;
  } catch (error) {
    log.error('Failed to initialize Anthropic', { error: (error as Error).message });
    anthropicAvailable = false;
    return false;
  }
}

// ============================================================================
// IMAGE FETCHING
// ============================================================================

async function fetchImageAsBase64(
  url: string
): Promise<{ success: boolean; data?: string; mediaType?: string; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `HTTP error: ${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return { success: false, error: `Not an image: ${contentType}` };
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return {
        success: false,
        error: `Image too large (${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB > 20MB)`,
      };
    }

    const base64 = Buffer.from(buffer).toString('base64');
    const mediaType = contentType.split(';')[0].trim();

    return { success: true, data: base64, mediaType };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('abort')) {
      return { success: false, error: 'Image fetch timed out' };
    }
    return { success: false, error: errMsg };
  }
}

// ============================================================================
// ANALYSIS PROMPTS
// ============================================================================

function getAnalysisPrompt(analysisType: string, question?: string): string {
  const basePrompt = question ? `User question: ${question}\n\n` : '';

  switch (analysisType) {
    case 'text_extraction':
      return `${basePrompt}Extract all visible text from this image. Preserve the layout and structure as much as possible. If there are multiple sections, separate them clearly. Return the text in a clean, readable format.`;

    case 'table_extraction':
      return `${basePrompt}Extract the table data from this image. Return it as a structured format:

1. First, identify the column headers
2. Then, extract each row of data
3. Format as a markdown table if possible

If there are multiple tables, extract each one separately. Preserve numerical precision.`;

    case 'chart_data':
      return `${basePrompt}Analyze this chart/graph and extract the data:

1. Identify the chart type (bar, line, pie, etc.)
2. Extract the axis labels and title if present
3. Extract the data points as accurately as possible
4. Describe any trends or key insights

Return the data in a structured format.`;

    case 'describe':
      return `${basePrompt}Describe this image in detail. Include:
- What the image shows
- Key elements and their positions
- Any text visible
- Colors, style, and quality
- Context clues about what this might be`;

    case 'general':
    default:
      return `${basePrompt}Analyze this image and provide relevant information based on what you see. If there's text, extract it. If there's data, summarize it. If it's a scene, describe it. Be thorough but concise.`;
  }
}

// ============================================================================
// VISION ANALYSIS
// ============================================================================

async function analyzeImage(
  imageBase64: string,
  mediaType: string,
  analysisType: string,
  question?: string
): Promise<{ success: boolean; result?: string; error?: string }> {
  if (!AnthropicClient) {
    return { success: false, error: 'Anthropic client not initialized' };
  }

  try {
    const client = new AnthropicClient({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = getAnalysisPrompt(analysisType, question);

    log.info('Starting vision analysis', { analysisType, hasQuestion: !!question });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929', // Use Sonnet for vision (good balance of quality/cost)
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
      .filter((block) => block.type === 'text')
      .map((block) => (block as { type: 'text'; text: string }).text)
      .join('\n');

    log.info('Vision analysis complete', { resultLength: result.length });

    return { success: true, result };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Vision analysis failed', { error: errMsg });
    return { success: false, error: errMsg };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeVisionAnalyze(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'analyze_image') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  // Initialize Anthropic
  const available = await initAnthropic();
  if (!available) {
    return {
      toolCallId: id,
      content: 'Vision analysis is not currently available. Anthropic API is not configured.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const imageSource = (args.image_source as string) || 'conversation';
  const imageUrl = args.image_url as string;
  const analysisType = (args.analysis_type as string) || 'general';
  const question = args.question as string;

  // Check cost limits (use passed session ID or generate fallback)
  const sessionId = toolCall.sessionId || `chat_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'analyze_image', TOOL_COST);
  if (!costCheck.allowed) {
    return {
      toolCallId: id,
      content: `Cannot analyze image: ${costCheck.reason}`,
      isError: true,
    };
  }

  // Handle different image sources
  if (imageSource === 'url') {
    if (!imageUrl) {
      return {
        toolCallId: id,
        content: 'No image URL provided. Please specify the image_url parameter.',
        isError: true,
      };
    }

    // Validate URL
    try {
      new URL(imageUrl);
    } catch {
      return {
        toolCallId: id,
        content: 'Invalid image URL format.',
        isError: true,
      };
    }

    // Fetch the image
    const fetchResult = await fetchImageAsBase64(imageUrl);
    if (!fetchResult.success) {
      return {
        toolCallId: id,
        content: `Failed to fetch image: ${fetchResult.error}`,
        isError: true,
      };
    }

    // Analyze
    const analysisResult = await analyzeImage(
      fetchResult.data!,
      fetchResult.mediaType!,
      analysisType,
      question
    );

    recordToolCost(sessionId, 'analyze_image', TOOL_COST);

    if (!analysisResult.success) {
      return {
        toolCallId: id,
        content: `Analysis failed: ${analysisResult.error}`,
        isError: true,
      };
    }

    return {
      toolCallId: id,
      content: analysisResult.result || 'Analysis complete but no content extracted.',
      isError: false,
    };
  } else {
    // Image from conversation
    // Note: This requires the image to be passed through the conversation context
    // The actual image data should be in the message content
    return {
      toolCallId: id,
      content:
        'To analyze an image from the conversation, please refer to the image content in the message. If you need to analyze a specific image, provide its URL using image_source="url" and image_url parameters.',
      isError: false,
    };
  }
}

// ============================================================================
// HELPER EXPORTS
// ============================================================================

export async function isVisionAnalyzeAvailable(): Promise<boolean> {
  return initAnthropic();
}

/**
 * Direct analysis function for use with conversation images
 * Called when image data is already available in base64
 */
export async function analyzeConversationImage(
  imageBase64: string,
  mediaType: string,
  options?: {
    analysisType?: string;
    question?: string;
  }
): Promise<{ success: boolean; result?: string; error?: string }> {
  const available = await initAnthropic();
  if (!available) {
    return { success: false, error: 'Vision analysis not available' };
  }

  return analyzeImage(
    imageBase64,
    mediaType,
    options?.analysisType || 'general',
    options?.question
  );
}
