/**
 * BARCODE GENERATION TOOL
 *
 * Generate various types of barcodes from data.
 * Uses JsBarcode for high-quality barcode generation.
 *
 * Supported barcode formats:
 * - CODE128: General purpose, alphanumeric
 * - CODE39: Alphanumeric, widely used in logistics
 * - EAN13: European Article Number (13 digits)
 * - EAN8: Compact EAN (8 digits)
 * - UPC: Universal Product Code (12 digits)
 * - ITF14: Shipping container codes
 * - MSI: Modified Plessey (warehouse/inventory)
 * - Pharmacode: Pharmaceutical industry
 * - Codabar: Libraries, blood banks
 *
 * Output: SVG barcode image
 *
 * Zero external API dependencies - runs entirely locally.
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded JsBarcode library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let JsBarcode: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let JSDOM: any = null;

async function initJsBarcode(): Promise<boolean> {
  if (JsBarcode && JSDOM) return true;
  try {
    // JsBarcode needs a DOM environment for SVG generation
    const jsbarcodeModule = await import('jsbarcode');
    JsBarcode = jsbarcodeModule.default || jsbarcodeModule;

    // Use jsdom for server-side SVG generation
    const jsdomModule = await import('jsdom');
    JSDOM = jsdomModule.JSDOM;

    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const barcodeTool: UnifiedTool = {
  name: 'generate_barcode',
  description: `Generate barcodes from data in various formats.

Barcode formats:
- CODE128: Most versatile, supports all ASCII characters. Best for general use.
- CODE39: Alphanumeric (A-Z, 0-9, special chars). Common in manufacturing.
- EAN13: 13-digit retail product codes (European standard)
- EAN8: 8-digit compact product codes
- UPC-A: 12-digit US/Canadian retail product codes
- ITF14: 14-digit shipping container codes
- MSI: Numeric only, used in warehouses/inventory
- pharmacode: 3-131,070 numeric, pharmaceutical use
- codabar: 0-9 plus special chars, used in libraries

Features:
- Customizable dimensions
- Optional text display
- Font customization
- Color options
- Margin control

Returns: SVG image of the barcode`,
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'string',
        description: 'The data to encode in the barcode. Must be valid for the chosen format.',
      },
      format: {
        type: 'string',
        enum: [
          'CODE128',
          'CODE39',
          'EAN13',
          'EAN8',
          'UPC',
          'ITF14',
          'MSI',
          'pharmacode',
          'codabar',
        ],
        description: 'Barcode format. Default: CODE128',
      },
      width: {
        type: 'number',
        description: 'Width of each bar (1-4). Default: 2',
      },
      height: {
        type: 'number',
        description: 'Height of barcode in pixels. Default: 100',
      },
      display_value: {
        type: 'boolean',
        description: 'Show the data text below barcode. Default: true',
      },
      font_size: {
        type: 'number',
        description: 'Font size for text. Default: 20',
      },
      text_margin: {
        type: 'number',
        description: 'Margin between barcode and text. Default: 2',
      },
      margin: {
        type: 'number',
        description: 'Margin around the barcode. Default: 10',
      },
      background: {
        type: 'string',
        description: 'Background color (hex). Default: #ffffff',
      },
      line_color: {
        type: 'string',
        description: 'Barcode line color (hex). Default: #000000',
      },
      text: {
        type: 'string',
        description: 'Custom text to display instead of the data',
      },
    },
    required: ['data'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isBarcodeAvailable(): Promise<boolean> {
  return await initJsBarcode();
}

// ============================================================================
// FORMAT VALIDATION
// ============================================================================

interface FormatValidation {
  valid: boolean;
  error?: string;
  fixedData?: string;
}

function validateFormat(data: string, format: string): FormatValidation {
  switch (format.toUpperCase()) {
    case 'EAN13':
      // Must be 12 or 13 digits (13th is check digit)
      if (!/^\d{12,13}$/.test(data)) {
        return { valid: false, error: 'EAN13 requires exactly 12 or 13 digits' };
      }
      return { valid: true };

    case 'EAN8':
      // Must be 7 or 8 digits
      if (!/^\d{7,8}$/.test(data)) {
        return { valid: false, error: 'EAN8 requires exactly 7 or 8 digits' };
      }
      return { valid: true };

    case 'UPC':
      // Must be 11 or 12 digits
      if (!/^\d{11,12}$/.test(data)) {
        return { valid: false, error: 'UPC requires exactly 11 or 12 digits' };
      }
      return { valid: true };

    case 'ITF14':
      // Must be 13 or 14 digits
      if (!/^\d{13,14}$/.test(data)) {
        return { valid: false, error: 'ITF14 requires exactly 13 or 14 digits' };
      }
      return { valid: true };

    case 'MSI':
      // Numeric only
      if (!/^\d+$/.test(data)) {
        return { valid: false, error: 'MSI format only supports digits (0-9)' };
      }
      return { valid: true };

    case 'PHARMACODE':
      // Must be a number between 3 and 131070
      const num = parseInt(data, 10);
      if (isNaN(num) || num < 3 || num > 131070) {
        return { valid: false, error: 'Pharmacode requires a number between 3 and 131070' };
      }
      return { valid: true };

    case 'CODABAR':
      // Supports 0-9, -, $, :, /, ., + and must start/end with A, B, C, or D
      if (!/^[A-Da-d][0-9\-$:/.+]+[A-Da-d]$/.test(data)) {
        return {
          valid: false,
          error:
            'Codabar must start and end with A, B, C, or D, containing only 0-9, -, $, :, /, ., +',
        };
      }
      return { valid: true };

    case 'CODE39':
      // Supports A-Z, 0-9, and some special chars
      if (!/^[A-Z0-9\-. $/+%*]+$/i.test(data)) {
        return { valid: false, error: 'CODE39 supports only A-Z, 0-9, and -.$/+%* characters' };
      }
      return { valid: true, fixedData: data.toUpperCase() };

    case 'CODE128':
    default:
      // Supports all ASCII characters
      return { valid: true };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeBarcode(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    data: string;
    format?: string;
    width?: number;
    height?: number;
    display_value?: boolean;
    font_size?: number;
    text_margin?: number;
    margin?: number;
    background?: string;
    line_color?: string;
    text?: string;
  };

  // Validate required parameters
  if (!args.data) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: data parameter is required',
      isError: true,
    };
  }

  // Initialize JsBarcode and JSDOM
  const loaded = await initJsBarcode();
  if (!loaded || !JsBarcode || !JSDOM) {
    return {
      toolCallId: toolCall.id,
      content:
        'Error: Barcode libraries not available. Please install jsbarcode and jsdom packages.',
      isError: true,
    };
  }

  try {
    // Determine format
    const format = (args.format || 'CODE128').toUpperCase();

    // Validate data for format
    const validation = validateFormat(args.data, format);
    if (!validation.valid) {
      return {
        toolCallId: toolCall.id,
        content: `Error: ${validation.error}`,
        isError: true,
      };
    }

    const data = validation.fixedData || args.data;

    // Create a virtual DOM for SVG generation
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;

    // Create SVG element
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svgElement);

    // Configure barcode options
    const options = {
      format: format === 'UPC' ? 'UPC' : format,
      width: Math.min(Math.max(args.width || 2, 1), 4),
      height: Math.min(Math.max(args.height || 100, 20), 300),
      displayValue: args.display_value !== false,
      fontSize: args.font_size || 20,
      textMargin: args.text_margin ?? 2,
      margin: args.margin ?? 10,
      background: args.background || '#ffffff',
      lineColor: args.line_color || '#000000',
      text: args.text,
      valid: () => true,
    };

    // Generate barcode
    JsBarcode(svgElement, data, options);

    // Get SVG string
    const svgString = svgElement.outerHTML;

    // Calculate approximate dimensions
    const estimatedWidth = options.width * data.length * 11 + options.margin * 2;
    const estimatedHeight =
      options.height +
      (options.displayValue ? options.fontSize + options.textMargin : 0) +
      options.margin * 2;

    // Convert to base64 for easy embedding
    const base64Svg = Buffer.from(svgString).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64Svg}`;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Generated ${format} barcode for "${data.length > 30 ? data.substring(0, 30) + '...' : data}"`,
        format,
        data,
        dimensions: {
          width: estimatedWidth,
          height: estimatedHeight,
          barWidth: options.width,
          barHeight: options.height,
        },
        options: {
          displayValue: options.displayValue,
          fontSize: options.fontSize,
          margin: options.margin,
          background: options.background,
          lineColor: options.lineColor,
        },
        // SVG string
        svg: svgString,
        // Data URL for direct embedding
        dataUrl,
        // Base64 for storage
        base64: base64Svg,
        mimeType: 'image/svg+xml',
      }),
    };
  } catch (error) {
    const errorMessage = (error as Error).message;

    // Provide helpful error messages for common issues
    if (errorMessage.includes('not valid')) {
      return {
        toolCallId: toolCall.id,
        content: `Error: Data "${args.data}" is not valid for ${args.format || 'CODE128'} format. ${errorMessage}`,
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      content: `Error generating barcode: ${errorMessage}`,
      isError: true,
    };
  }
}
