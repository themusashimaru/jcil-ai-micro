/**
 * OCR TOOL - OPTICAL CHARACTER RECOGNITION
 *
 * Extract text from images using Tesseract.js.
 * Runs entirely locally - no external API costs.
 *
 * Supports: PNG, JPG, BMP, GIF, WEBP
 * Languages: English (default), plus 100+ via config
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded Tesseract
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Tesseract: any = null;

async function initTesseract(): Promise<boolean> {
  if (Tesseract) return true;
  try {
    const mod = await import('tesseract.js');
    Tesseract = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const ocrTool: UnifiedTool = {
  name: 'ocr_extract_text',
  description: `Extract text from images using OCR (Optical Character Recognition).

Supports image formats: PNG, JPG, JPEG, BMP, GIF, WEBP
Input: Base64 encoded image data or image URL

Features:
- High accuracy text extraction
- Preserves layout when possible
- Confidence scores per word
- Bounding box data available
- Multiple language support

Use cases:
- Read text from screenshots
- Extract content from scanned documents
- Digitize printed materials
- Read text from photos

Returns extracted text with confidence score.`,
  parameters: {
    type: 'object',
    properties: {
      image: {
        type: 'string',
        description: 'Base64 encoded image data (with or without data URI prefix) or image URL',
      },
      language: {
        type: 'string',
        description:
          'Language code for OCR. Default: eng. Options: eng, spa, fra, deu, ita, por, chi_sim, jpn, kor, ara, rus',
      },
      output_format: {
        type: 'string',
        enum: ['text', 'detailed', 'words', 'lines'],
        description:
          'Output format. text=plain text, detailed=with confidence, words=word-by-word, lines=line-by-line',
      },
    },
    required: ['image'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isOCRAvailable(): boolean {
  return true; // Always available - pure JS
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeOCR(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    image: string;
    language?: string;
    output_format?: string;
  };

  if (!args.image) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Image data is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initTesseract();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize Tesseract.js' }),
        isError: true,
      };
    }

    const language = args.language || 'eng';
    const outputFormat = args.output_format || 'text';

    // Handle base64 or URL input
    let imageInput = args.image;
    if (!imageInput.startsWith('http') && !imageInput.startsWith('data:')) {
      // Assume base64, add data URI prefix
      const mimeType = detectImageMime(imageInput);
      imageInput = `data:${mimeType};base64,${imageInput}`;
    }

    // Perform OCR
    const worker = await Tesseract.createWorker(language);
    const result = await worker.recognize(imageInput);
    await worker.terminate();

    // Format output based on requested format
    let output: Record<string, unknown>;

    switch (outputFormat) {
      case 'detailed':
        output = {
          text: result.data.text,
          confidence: result.data.confidence,
          paragraphs: result.data.paragraphs?.length || 0,
          lines: result.data.lines?.length || 0,
          words: result.data.words?.length || 0,
        };
        break;

      case 'words':
        output = {
          words:
            result.data.words?.map((w: { text: string; confidence: number }) => ({
              text: w.text,
              confidence: w.confidence,
            })) || [],
          total: result.data.words?.length || 0,
        };
        break;

      case 'lines':
        output = {
          lines:
            result.data.lines?.map((l: { text: string; confidence: number }) => ({
              text: l.text,
              confidence: l.confidence,
            })) || [],
          total: result.data.lines?.length || 0,
        };
        break;

      default: // 'text'
        output = {
          text: result.data.text,
          confidence: result.data.confidence,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(output),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'OCR failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Helper to detect image MIME type from base64
function detectImageMime(base64: string): string {
  const signatures: Record<string, string> = {
    '/9j/': 'image/jpeg',
    iVBORw: 'image/png',
    R0lGOD: 'image/gif',
    UklGR: 'image/webp',
    Qk0: 'image/bmp',
  };

  for (const [sig, mime] of Object.entries(signatures)) {
    if (base64.startsWith(sig)) return mime;
  }
  return 'image/png'; // default
}
