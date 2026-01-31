/**
 * COLOR MANIPULATION TOOL
 *
 * Color operations using chroma.js.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Color format conversion
 * - Color palette generation
 * - Color blending/mixing
 * - Accessibility contrast checking
 * - Color manipulation (lighten, darken, saturate)
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded chroma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chroma: any = null;

async function initChroma(): Promise<boolean> {
  if (chroma) return true;
  try {
    const mod = await import('chroma-js');
    chroma = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const colorTool: UnifiedTool = {
  name: 'color_tools',
  description: `Color manipulation, conversion, and palette generation.

Operations:
- convert: Convert between color formats (hex, rgb, hsl, lab, etc.)
- palette: Generate color palettes (analogous, complementary, triadic, etc.)
- scale: Create color scales/gradients
- mix: Blend two colors together
- contrast: Check WCAG accessibility contrast ratio
- manipulate: Lighten, darken, saturate, desaturate colors
- analyze: Get color properties (luminance, temperature, etc.)

Color formats:
- Hex: #ff5500 or ff5500
- RGB: rgb(255, 85, 0) or [255, 85, 0]
- HSL: hsl(20, 100%, 50%)
- HSV, Lab, LCH, CMYK

Use cases:
- Design system color generation
- Accessibility compliance checking
- Theme color creation
- Color harmonies`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['convert', 'palette', 'scale', 'mix', 'contrast', 'manipulate', 'analyze'],
        description: 'Color operation to perform',
      },
      color: {
        type: 'string',
        description: 'Primary color (hex, rgb, hsl, or color name)',
      },
      color2: {
        type: 'string',
        description: 'Secondary color for mix/contrast operations',
      },
      format: {
        type: 'string',
        enum: ['hex', 'rgb', 'rgba', 'hsl', 'hsv', 'lab', 'lch', 'cmyk'],
        description: 'Output color format (default: hex)',
      },
      palette_type: {
        type: 'string',
        enum: [
          'analogous',
          'complementary',
          'triadic',
          'tetradic',
          'split-complementary',
          'monochromatic',
        ],
        description: 'For palette: type of color harmony',
      },
      count: {
        type: 'number',
        description: 'For palette/scale: number of colors to generate',
      },
      manipulation: {
        type: 'string',
        enum: ['lighten', 'darken', 'saturate', 'desaturate', 'brighten', 'shade', 'tint'],
        description: 'For manipulate: type of manipulation',
      },
      amount: {
        type: 'number',
        description: 'For manipulate: amount (0-1 scale)',
      },
    },
    required: ['operation', 'color'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isColorAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeColor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    color: string;
    color2?: string;
    format?: string;
    palette_type?: string;
    count?: number;
    manipulation?: string;
    amount?: number;
  };

  if (!args.operation || !args.color) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation and color are required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initChroma();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize chroma-js' }),
        isError: true,
      };
    }

    // Validate input color
    let inputColor;
    try {
      inputColor = chroma(args.color);
    } catch {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: `Invalid color: ${args.color}` }),
        isError: true,
      };
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'convert': {
        const format = args.format || 'hex';

        result = {
          operation: 'convert',
          input: args.color,
          output_format: format,
          hex: inputColor.hex(),
          rgb: inputColor.rgb(),
          hsl: inputColor.hsl(),
          hsv: inputColor.hsv(),
          lab: inputColor.lab(),
          lch: inputColor.lch(),
        };
        break;
      }

      case 'palette': {
        const paletteType = args.palette_type || 'analogous';
        const count = args.count || 5;
        const hsl = inputColor.hsl();
        const h = hsl[0] || 0;
        const s = hsl[1];
        const l = hsl[2];

        let colors: string[] = [];

        switch (paletteType) {
          case 'analogous':
            colors = Array.from({ length: count }, (_, i) => {
              const offset = (i - Math.floor(count / 2)) * 30;
              return chroma.hsl((h + offset + 360) % 360, s, l).hex();
            });
            break;

          case 'complementary':
            colors = [inputColor.hex(), chroma.hsl((h + 180) % 360, s, l).hex()];
            break;

          case 'triadic':
            colors = [0, 120, 240].map((offset) => chroma.hsl((h + offset) % 360, s, l).hex());
            break;

          case 'tetradic':
            colors = [0, 90, 180, 270].map((offset) => chroma.hsl((h + offset) % 360, s, l).hex());
            break;

          case 'split-complementary':
            colors = [0, 150, 210].map((offset) => chroma.hsl((h + offset) % 360, s, l).hex());
            break;

          case 'monochromatic':
            colors = Array.from({ length: count }, (_, i) => {
              const lightness = 0.2 + (0.6 * i) / (count - 1);
              return chroma.hsl(h, s, lightness).hex();
            });
            break;
        }

        result = {
          operation: 'palette',
          base_color: inputColor.hex(),
          palette_type: paletteType,
          colors,
        };
        break;
      }

      case 'scale': {
        const count = args.count || 5;
        const endColor = args.color2 ? chroma(args.color2) : chroma('white');

        const scale = chroma.scale([inputColor, endColor]).mode('lab').colors(count);

        result = {
          operation: 'scale',
          start_color: inputColor.hex(),
          end_color: endColor.hex(),
          colors: scale,
        };
        break;
      }

      case 'mix': {
        if (!args.color2) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Second color required for mix' }),
            isError: true,
          };
        }

        const color2 = chroma(args.color2);
        const ratio = args.amount ?? 0.5;
        const mixed = chroma.mix(inputColor, color2, ratio, 'lab');

        result = {
          operation: 'mix',
          color1: inputColor.hex(),
          color2: color2.hex(),
          ratio,
          result: mixed.hex(),
        };
        break;
      }

      case 'contrast': {
        if (!args.color2) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Second color required for contrast' }),
            isError: true,
          };
        }

        const color2 = chroma(args.color2);
        const ratio = chroma.contrast(inputColor, color2);

        // WCAG compliance levels
        const wcag = {
          ratio: Math.round(ratio * 100) / 100,
          aa_normal: ratio >= 4.5,
          aa_large: ratio >= 3,
          aaa_normal: ratio >= 7,
          aaa_large: ratio >= 4.5,
        };

        result = {
          operation: 'contrast',
          color1: inputColor.hex(),
          color2: color2.hex(),
          contrast_ratio: `${wcag.ratio}:1`,
          wcag_compliance: wcag,
        };
        break;
      }

      case 'manipulate': {
        if (!args.manipulation) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Manipulation type required' }),
            isError: true,
          };
        }

        const amount = args.amount ?? 0.2;
        let manipulated;

        switch (args.manipulation) {
          case 'lighten':
            manipulated = inputColor.brighten(amount * 3);
            break;
          case 'darken':
            manipulated = inputColor.darken(amount * 3);
            break;
          case 'saturate':
            manipulated = inputColor.saturate(amount * 3);
            break;
          case 'desaturate':
            manipulated = inputColor.desaturate(amount * 3);
            break;
          case 'brighten':
            manipulated = inputColor.brighten(amount * 3);
            break;
          case 'shade':
            manipulated = chroma.mix(inputColor, 'black', amount, 'rgb');
            break;
          case 'tint':
            manipulated = chroma.mix(inputColor, 'white', amount, 'rgb');
            break;
          default:
            return {
              toolCallId: toolCall.id,
              content: JSON.stringify({ error: `Unknown manipulation: ${args.manipulation}` }),
              isError: true,
            };
        }

        result = {
          operation: 'manipulate',
          original: inputColor.hex(),
          manipulation: args.manipulation,
          amount,
          result: manipulated.hex(),
        };
        break;
      }

      case 'analyze': {
        result = {
          operation: 'analyze',
          color: inputColor.hex(),
          properties: {
            luminance: Math.round(inputColor.luminance() * 1000) / 1000,
            is_dark: inputColor.luminance() < 0.5,
            is_light: inputColor.luminance() >= 0.5,
            temperature: inputColor.temperature(),
            alpha: inputColor.alpha(),
          },
          formats: {
            hex: inputColor.hex(),
            rgb: inputColor.rgb(),
            hsl: inputColor.hsl(),
            hsv: inputColor.hsv(),
            lab: inputColor.lab(),
            css_rgb: inputColor.css(),
            css_hsl: inputColor.css('hsl'),
          },
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Color operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
