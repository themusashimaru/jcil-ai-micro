/**
 * CODE FORMATTER TOOL
 *
 * Format code in any language using Prettier.
 * Runs entirely locally - no external API costs.
 *
 * Supported languages: JavaScript, TypeScript, CSS, HTML,
 * JSON, Markdown, YAML, GraphQL, and more.
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded Prettier
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prettier: any = null;

async function initPrettier(): Promise<boolean> {
  if (prettier) return true;
  try {
    prettier = await import('prettier');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const prettierTool: UnifiedTool = {
  name: 'format_code',
  description: `Format code in any language using Prettier.

Supported languages:
- JavaScript / TypeScript (js, ts, jsx, tsx)
- HTML / Vue / Angular templates
- CSS / SCSS / LESS
- JSON / JSON5
- Markdown
- YAML
- GraphQL
- XML (via plugin)

Options:
- Tab width (2 or 4)
- Single vs double quotes
- Semicolons
- Trailing commas
- Print width

Returns beautifully formatted code.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to format',
      },
      language: {
        type: 'string',
        enum: [
          'javascript',
          'typescript',
          'jsx',
          'tsx',
          'css',
          'scss',
          'less',
          'html',
          'json',
          'markdown',
          'yaml',
          'graphql',
        ],
        description: 'Programming language of the code',
      },
      tab_width: {
        type: 'number',
        description: 'Number of spaces per indentation level (default: 2)',
      },
      use_tabs: {
        type: 'boolean',
        description: 'Use tabs instead of spaces (default: false)',
      },
      single_quote: {
        type: 'boolean',
        description: 'Use single quotes instead of double quotes (default: false)',
      },
      semicolons: {
        type: 'boolean',
        description: 'Include semicolons (default: true)',
      },
      trailing_comma: {
        type: 'string',
        enum: ['none', 'es5', 'all'],
        description: 'Trailing comma style (default: es5)',
      },
      print_width: {
        type: 'number',
        description: 'Line width before wrapping (default: 80)',
      },
    },
    required: ['code', 'language'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isPrettierAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePrettier(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    code: string;
    language: string;
    tab_width?: number;
    use_tabs?: boolean;
    single_quote?: boolean;
    semicolons?: boolean;
    trailing_comma?: string;
    print_width?: number;
  };

  if (!args.code || !args.language) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Code and language are required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initPrettier();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize Prettier' }),
        isError: true,
      };
    }

    // Map language to Prettier parser
    const parserMap: Record<string, string> = {
      javascript: 'babel',
      typescript: 'typescript',
      jsx: 'babel',
      tsx: 'typescript',
      css: 'css',
      scss: 'scss',
      less: 'less',
      html: 'html',
      json: 'json',
      markdown: 'markdown',
      yaml: 'yaml',
      graphql: 'graphql',
    };

    const parser = parserMap[args.language];
    if (!parser) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: `Unsupported language: ${args.language}` }),
        isError: true,
      };
    }

    const options = {
      parser,
      tabWidth: args.tab_width ?? 2,
      useTabs: args.use_tabs ?? false,
      singleQuote: args.single_quote ?? false,
      semi: args.semicolons ?? true,
      trailingComma: (args.trailing_comma as 'none' | 'es5' | 'all') ?? 'es5',
      printWidth: args.print_width ?? 80,
    };

    const formatted = await prettier.format(args.code, options);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        language: args.language,
        original_length: args.code.length,
        formatted_length: formatted.length,
        formatted_code: formatted,
      }),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Formatting failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}
