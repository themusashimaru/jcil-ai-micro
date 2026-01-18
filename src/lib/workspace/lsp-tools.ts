/**
 * LSP TOOLS FOR WORKSPACE AGENT
 *
 * Provides AI-accessible Language Server Protocol tools.
 * Enables Claude to:
 * - Navigate to definitions
 * - Find all references
 * - Get hover information
 * - Get code completions
 * - List document symbols
 * - Rename symbols
 */

import Anthropic from '@anthropic-ai/sdk';
import { getLSPManager, Position } from '@/lib/lsp/lsp-client';
import { logger } from '@/lib/logger';
import * as path from 'path';

const log = logger('LSPTools');

// Singleton LSP manager instance
let lspManagerInstance: ReturnType<typeof getLSPManager> | null = null;

function getLspManager(workspaceRoot: string): ReturnType<typeof getLSPManager> {
  if (!lspManagerInstance) {
    lspManagerInstance = getLSPManager(workspaceRoot);
  }
  return lspManagerInstance;
}

// Track open documents per workspace
const workspaceOpenDocs = new Map<string, Set<string>>();

/**
 * LSP tool definitions for the workspace agent
 */
export function getLSPTools(): Anthropic.Tool[] {
  return [
    {
      name: 'lsp_goto_definition',
      description:
        'Navigate to the definition of a symbol at a specific position. Returns file and line where the symbol is defined.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description: 'File path relative to workspace root (e.g., "src/index.ts")',
          },
          line: {
            type: 'number',
            description: 'Line number (1-indexed)',
          },
          column: {
            type: 'number',
            description: 'Column number (1-indexed)',
          },
          content: {
            type: 'string',
            description: 'File content (provide if file has unsaved changes)',
          },
        },
        required: ['file', 'line', 'column'],
      },
    },
    {
      name: 'lsp_find_references',
      description:
        'Find all references to a symbol at a specific position. Returns all locations where the symbol is used.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          line: {
            type: 'number',
            description: 'Line number (1-indexed)',
          },
          column: {
            type: 'number',
            description: 'Column number (1-indexed)',
          },
          content: {
            type: 'string',
            description: 'File content (provide if file has unsaved changes)',
          },
        },
        required: ['file', 'line', 'column'],
      },
    },
    {
      name: 'lsp_hover',
      description:
        'Get type information and documentation for a symbol at a specific position. Useful for understanding what a variable or function is.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          line: {
            type: 'number',
            description: 'Line number (1-indexed)',
          },
          column: {
            type: 'number',
            description: 'Column number (1-indexed)',
          },
          content: {
            type: 'string',
            description: 'File content (provide if file has unsaved changes)',
          },
        },
        required: ['file', 'line', 'column'],
      },
    },
    {
      name: 'lsp_document_symbols',
      description:
        'List all symbols (functions, classes, variables, etc.) in a file. Useful for getting an overview of file structure.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          content: {
            type: 'string',
            description: 'File content (provide if file has unsaved changes)',
          },
        },
        required: ['file'],
      },
    },
    {
      name: 'lsp_completions',
      description:
        'Get code completion suggestions at a specific position. Returns possible completions for the current context.',
      input_schema: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description: 'File path relative to workspace root',
          },
          line: {
            type: 'number',
            description: 'Line number (1-indexed)',
          },
          column: {
            type: 'number',
            description: 'Column number (1-indexed)',
          },
          content: {
            type: 'string',
            description: 'File content (required for accurate completions)',
          },
        },
        required: ['file', 'line', 'column', 'content'],
      },
    },
  ];
}

/**
 * Execute an LSP tool
 */
export async function executeLSPTool(
  toolName: string,
  input: Record<string, unknown>,
  workspaceId: string,
  workspaceRoot: string = '/workspace'
): Promise<string> {
  const lspManager = getLspManager(workspaceRoot);

  try {
    const file = input.file as string;
    const content = input.content as string | undefined;
    const line = input.line as number | undefined;
    const column = input.column as number | undefined;

    // Get the appropriate client for this file
    const client = await lspManager.getClientForFile(file);
    if (!client) {
      return `No language server available for file: ${file}. Supported extensions: .ts, .tsx, .js, .jsx, .py, .go`;
    }

    // Ensure file is open in LSP
    await ensureFileOpen(client, file, content, workspaceId, workspaceRoot);

    // Convert to 0-based position for LSP
    const position: Position | undefined =
      line !== undefined && column !== undefined
        ? { line: line - 1, character: column - 1 }
        : undefined;

    switch (toolName) {
      case 'lsp_goto_definition': {
        if (!position) {
          return 'Error: line and column are required for goto_definition';
        }

        const result = await client.gotoDefinition(file, position);
        return formatDefinitionResult(result);
      }

      case 'lsp_find_references': {
        if (!position) {
          return 'Error: line and column are required for find_references';
        }

        const locations = await client.findReferences(file, position, true);
        return formatReferencesResult(locations);
      }

      case 'lsp_hover': {
        if (!position) {
          return 'Error: line and column are required for hover';
        }

        const hover = await client.hover(file, position);
        return formatHoverResult(hover);
      }

      case 'lsp_document_symbols': {
        const symbols = await client.documentSymbols(file);
        return formatSymbolsResult(symbols);
      }

      case 'lsp_completions': {
        if (!position) {
          return 'Error: line and column are required for completions';
        }

        const completions = await client.completion(file, position);
        return formatCompletionsResult(completions);
      }

      default:
        return `Unknown LSP tool: ${toolName}`;
    }
  } catch (error) {
    log.error('LSP tool error', { toolName, error });
    return `LSP error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function ensureFileOpen(
  client: ReturnType<typeof getLSPManager> extends {
    getClientForFile: (f: string) => Promise<infer T>;
  }
    ? NonNullable<T>
    : never,
  file: string,
  content: string | undefined,
  workspaceId: string,
  workspaceRoot: string
): Promise<void> {
  let openDocs = workspaceOpenDocs.get(workspaceId);
  if (!openDocs) {
    openDocs = new Set();
    workspaceOpenDocs.set(workspaceId, openDocs);
  }

  // If content provided, update the document
  if (content !== undefined) {
    if (openDocs.has(file)) {
      await client.updateDocument(file, content);
    } else {
      await client.openDocument(file, content);
      openDocs.add(file);
    }
    return;
  }

  // If already open, nothing to do
  if (openDocs.has(file)) {
    return;
  }

  // Try to read from disk
  try {
    const fs = await import('fs/promises');
    const fullPath = path.join(workspaceRoot, file);
    const fileContent = await fs.readFile(fullPath, 'utf-8');
    await client.openDocument(file, fileContent);
    openDocs.add(file);
  } catch {
    log.debug('File not found on disk, LSP may not work', { file });
  }
}

function formatDefinitionResult(
  result:
    | {
        uri: string;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
      }
    | Array<{
        uri: string;
        range: {
          start: { line: number; character: number };
          end: { line: number; character: number };
        };
      }>
    | null
): string {
  if (!result) {
    return 'No definition found.';
  }

  const locations = Array.isArray(result) ? result : [result];
  if (locations.length === 0) {
    return 'No definition found.';
  }

  const formatted = locations.map((loc) => {
    const file = loc.uri.replace('file://', '');
    const line = loc.range.start.line + 1;
    const col = loc.range.start.character + 1;
    return `  ${file}:${line}:${col}`;
  });

  return `Definition found at:\n${formatted.join('\n')}`;
}

function formatReferencesResult(
  locations: Array<{
    uri: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
  }>
): string {
  if (locations.length === 0) {
    return 'No references found.';
  }

  const formatted = locations.slice(0, 20).map((loc) => {
    const file = loc.uri.replace('file://', '');
    const line = loc.range.start.line + 1;
    const col = loc.range.start.character + 1;
    return `  ${file}:${line}:${col}`;
  });

  let result = `Found ${locations.length} reference${locations.length === 1 ? '' : 's'}:\n${formatted.join('\n')}`;
  if (locations.length > 20) {
    result += `\n  ... and ${locations.length - 20} more`;
  }

  return result;
}

function formatHoverResult(
  hover: {
    contents:
      | { kind: string; value: string }
      | string
      | Array<{ kind: string; value: string } | string>;
    range?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
  } | null
): string {
  if (!hover) {
    return 'No hover information available.';
  }

  let content: string;
  const contents = hover.contents;

  if (typeof contents === 'string') {
    content = contents;
  } else if (Array.isArray(contents)) {
    content = contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n\n');
  } else if ('value' in contents) {
    content = contents.value;
  } else {
    content = JSON.stringify(contents);
  }

  return content;
}

function formatSymbolsResult(
  symbols: Array<{
    name: string;
    kind: number;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
  }>
): string {
  if (symbols.length === 0) {
    return 'No symbols found in this file.';
  }

  const kindMap: Record<number, string> = {
    1: 'file',
    2: 'module',
    3: 'namespace',
    4: 'package',
    5: 'class',
    6: 'method',
    7: 'property',
    8: 'field',
    9: 'constructor',
    10: 'enum',
    11: 'interface',
    12: 'function',
    13: 'variable',
    14: 'constant',
    15: 'string',
    16: 'number',
    17: 'boolean',
    18: 'array',
    19: 'object',
    20: 'key',
    21: 'null',
    22: 'enum_member',
    23: 'struct',
    24: 'event',
    25: 'operator',
    26: 'type_parameter',
  };

  const formatted = symbols.map((sym) => {
    const kind = kindMap[sym.kind] || 'unknown';
    const line = sym.range.start.line + 1;
    return `  [${kind}] ${sym.name} (line ${line})`;
  });

  return `Document symbols:\n${formatted.join('\n')}`;
}

function formatCompletionsResult(
  completions: Array<{
    label: string;
    kind?: number;
    detail?: string;
    documentation?: string | { value: string };
  }>
): string {
  if (completions.length === 0) {
    return 'No completions available.';
  }

  const kindMap: Record<number, string> = {
    1: 'text',
    2: 'method',
    3: 'function',
    4: 'constructor',
    5: 'field',
    6: 'variable',
    7: 'class',
    8: 'interface',
    9: 'module',
    10: 'property',
    11: 'unit',
    12: 'value',
    13: 'enum',
    14: 'keyword',
    15: 'snippet',
  };

  const formatted = completions.slice(0, 15).map((item) => {
    const kind = item.kind ? kindMap[item.kind] || 'unknown' : '';
    const detail = item.detail ? ` - ${item.detail}` : '';
    return `  [${kind}] ${item.label}${detail}`;
  });

  let result = `Completions (${completions.length} total):\n${formatted.join('\n')}`;
  if (completions.length > 15) {
    result += `\n  ... and ${completions.length - 15} more`;
  }

  return result;
}

/**
 * Check if a tool name is an LSP tool
 */
export function isLSPTool(toolName: string): boolean {
  return toolName.startsWith('lsp_');
}

/**
 * Get supported file extensions for LSP
 */
export function getSupportedExtensions(): string[] {
  return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.go'];
}
