/**
 * QR CODE GENERATION TOOL
 *
 * Generates QR codes from text, URLs, or data.
 * Returns base64-encoded PNG image.
 *
 * Features:
 * - Text/URL to QR code
 * - Customizable size
 * - Error correction levels
 * - Color customization
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded QR code library
let QRCode: typeof import('qrcode') | null = null;

async function initQRCode(): Promise<boolean> {
  if (QRCode) return true;
  try {
    QRCode = await import('qrcode');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const qrCodeTool: UnifiedTool = {
  name: 'generate_qr_code',
  description: `Generate QR codes from text, URLs, or data. Returns a downloadable PNG image.

Use cases:
- Create QR codes for URLs/links
- Generate QR codes for WiFi credentials
- Create QR codes for contact info (vCard)
- Generate QR codes for plain text

The QR code is returned as a downloadable PNG image that users can save.`,
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description:
          'The text, URL, or data to encode in the QR code. Can be a URL, plain text, WiFi config, vCard, etc.',
      },
      size: {
        type: 'number',
        description: 'Width/height of the QR code in pixels. Default: 300. Range: 100-1000.',
      },
      error_correction: {
        type: 'string',
        enum: ['L', 'M', 'Q', 'H'],
        description:
          'Error correction level. L=7%, M=15%, Q=25%, H=30% recovery. Higher = more robust but larger. Default: M',
      },
      dark_color: {
        type: 'string',
        description: 'Color of the dark modules (hex). Default: #000000',
      },
      light_color: {
        type: 'string',
        description: 'Color of the light modules (hex). Default: #ffffff',
      },
      margin: {
        type: 'number',
        description: 'Quiet zone margin in modules. Default: 4',
      },
    },
    required: ['content'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isQRCodeAvailable(): boolean {
  // Always available - qrcode package has no external dependencies
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeQRCode(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    content: string;
    size?: number;
    error_correction?: 'L' | 'M' | 'Q' | 'H';
    dark_color?: string;
    light_color?: string;
    margin?: number;
  };

  // Validate required parameters
  if (!args.content) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: content parameter is required',
      isError: true,
    };
  }

  // Validate content length (QR codes have limits)
  if (args.content.length > 4296) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: Content too long. Maximum is 4296 characters for alphanumeric data.',
      isError: true,
    };
  }

  // Initialize QR code library
  const loaded = await initQRCode();
  if (!loaded || !QRCode) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: QR code library not available. Please install qrcode package.',
      isError: true,
    };
  }

  try {
    // Configure options
    const size = Math.min(Math.max(args.size || 300, 100), 1000);
    const errorCorrectionLevel = args.error_correction || 'M';
    const darkColor = args.dark_color || '#000000';
    const lightColor = args.light_color || '#ffffff';
    const margin = args.margin ?? 4;

    // Validate colors
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    if (!hexColorRegex.test(darkColor)) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: dark_color must be a valid hex color (e.g., #000000)',
        isError: true,
      };
    }
    if (!hexColorRegex.test(lightColor)) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: light_color must be a valid hex color (e.g., #ffffff)',
        isError: true,
      };
    }

    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(args.content, {
      width: size,
      errorCorrectionLevel,
      color: {
        dark: darkColor,
        light: lightColor,
      },
      margin,
    });

    // Extract base64 data from data URL
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');

    // Generate a filename
    const contentPreview =
      args.content.length > 20 ? args.content.substring(0, 20) + '...' : args.content;
    const timestamp = Date.now();
    const filename = `qr_code_${timestamp}.png`;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `QR code generated successfully for: "${contentPreview}"`,
        filename,
        mimeType: 'image/png',
        size: `${size}x${size}`,
        errorCorrection: errorCorrectionLevel,
        dataLength: args.content.length,
        // Base64 data for the image
        imageData: base64Data,
        dataUrl: dataUrl,
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating QR code: ${(error as Error).message}`,
      isError: true,
    };
  }
}
