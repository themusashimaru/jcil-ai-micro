/**
 * ASCII ART TOOL
 *
 * Generate ASCII art text using FIGlet.
 * Runs entirely locally - no external API costs.
 *
 * Multiple fonts and styles available.
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded figlet
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let figlet: any = null;

async function initFiglet(): Promise<boolean> {
  if (figlet) return true;
  try {
    const mod = await import('figlet');
    figlet = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const asciiArtTool: UnifiedTool = {
  name: 'ascii_art',
  description: `Generate ASCII art text banners using FIGlet fonts.

Popular fonts:
- Standard: Default clean font
- Banner: Large block letters
- Big: Bold chunky letters
- Slant: Italicized style
- Small: Compact version
- Mini: Very compact
- Script: Cursive style
- Shadow: 3D shadow effect
- Block: Solid blocks
- Lean: Thin stylized

Customization:
- Horizontal layout (default, fitted, full)
- Vertical layout (default, fitted)
- Custom width

Perfect for:
- CLI welcome banners
- Header text
- Fun messages
- Logo text`,
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to convert to ASCII art',
      },
      font: {
        type: 'string',
        description: 'Font name (Standard, Banner, Big, Slant, Small, etc.)',
      },
      horizontal_layout: {
        type: 'string',
        enum: ['default', 'full', 'fitted', 'controlled smushing', 'universal smushing'],
        description: 'Horizontal layout mode',
      },
      vertical_layout: {
        type: 'string',
        enum: ['default', 'full', 'fitted', 'controlled smushing', 'universal smushing'],
        description: 'Vertical layout mode',
      },
      width: {
        type: 'number',
        description: 'Maximum width (characters)',
      },
    },
    required: ['text'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isAsciiArtAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeAsciiArt(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    text: string;
    font?: string;
    horizontal_layout?: string;
    vertical_layout?: string;
    width?: number;
  };

  if (!args.text) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Text is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initFiglet();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize figlet' }),
        isError: true,
      };
    }

    const options: Record<string, unknown> = {};

    if (args.font) {
      options.font = args.font;
    }
    if (args.horizontal_layout) {
      options.horizontalLayout = args.horizontal_layout;
    }
    if (args.vertical_layout) {
      options.verticalLayout = args.vertical_layout;
    }
    if (args.width) {
      options.width = args.width;
    }

    // Generate ASCII art
    const result = await new Promise<string>((resolve, reject) => {
      figlet.text(args.text, options, (err: Error | null, data: string) => {
        if (err) {
          reject(err);
        } else {
          resolve(data || '');
        }
      });
    });

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        text: args.text,
        font: args.font || 'Standard',
        ascii_art: result,
        lines: result.split('\n').length,
        width: Math.max(...result.split('\n').map((l) => l.length)),
      }),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'ASCII art generation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
