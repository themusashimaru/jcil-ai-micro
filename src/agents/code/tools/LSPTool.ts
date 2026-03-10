/**
 * LSP TOOL
 *
 * Provides Language Server Protocol features to the Code Agent.
 * Enables AI to understand code structure and navigate codebases.
 *
 * Features:
 * - Go-to-definition
 * - Find references
 * - Hover information
 * - Code completions
 * - Document symbols
 * - Rename symbol
 */

import { BaseTool, ToolInput, ToolOutput, ToolDefinition } from './BaseTool';
import {
  LSPManager,
  LSPClient,
  Position,
  Location,
  Hover,
  CompletionItem,
} from '@/lib/lsp/lsp-client';
import { logger } from '@/lib/logger';

const log = logger('LSPTool');

// ============================================================================
// TYPES
// ============================================================================

type LSPOperation =
  | 'goto_definition'
  | 'find_references'
  | 'hover'
  | 'completions'
  | 'document_symbols'
  | 'rename';

interface LSPInput extends ToolInput {
  operation: LSPOperation;
  file: string;
  line?: number; // 1-based for user convenience
  column?: number; // 1-based for user convenience
  newName?: string; // For rename operation
  content?: string; // File content (if not already open)
}

interface GotoDefinitionResult {
  definitions: Array<{
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  }>;
}

interface FindReferencesResult {
  references: Array<{
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  }>;
  count: number;
}

interface HoverResult {
  content: string;
  language?: string;
}

interface CompletionsResult {
  items: Array<{
    label: string;
    kind: string;
    detail?: string;
    documentation?: string;
    insertText?: string;
  }>;
}

interface DocumentSymbolsResult {
  symbols: Array<{
    name: string;
    kind: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  }>;
}

interface RenameResult {
  changes: Array<{
    file: string;
    edits: Array<{
      line: number;
      column: number;
      endLine: number;
      endColumn: number;
      newText: string;
    }>;
  }>;
}

type LSPResult =
  | GotoDefinitionResult
  | FindReferencesResult
  | HoverResult
  | CompletionsResult
  | DocumentSymbolsResult
  | RenameResult;

interface LSPOutput extends ToolOutput {
  result?: LSPResult;
}

// ============================================================================
// TOOL IMPLEMENTATION
// ============================================================================

export class LSPTool extends BaseTool {
  name = 'lsp';
  description = `Use Language Server Protocol for code intelligence.

Operations:
- goto_definition: Find where a symbol is defined
- find_references: Find all usages of a symbol
- hover: Get type/documentation info at a position
- completions: Get code completion suggestions
- document_symbols: List all symbols in a file
- rename: Rename a symbol across the codebase

Supports: TypeScript, JavaScript, Python, Go`;

  private lspManager: LSPManager | null = null;
  private workspaceRoot: string = '/workspace';
  private openFiles: Map<string, string> = new Map(); // file -> content

  /**
   * Initialize with workspace context
   */
  initialize(config: { workspaceRoot?: string }): void {
    this.workspaceRoot = config.workspaceRoot || '/workspace';
    this.lspManager = new LSPManager(this.workspaceRoot);
  }

  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description:
              'LSP operation: goto_definition, find_references, hover, completions, document_symbols, rename',
            enum: [
              'goto_definition',
              'find_references',
              'hover',
              'completions',
              'document_symbols',
              'rename',
            ],
            required: true,
          },
          file: {
            type: 'string',
            description: 'File path relative to workspace root (e.g., "src/index.ts")',
            required: true,
          },
          line: {
            type: 'number',
            description:
              'Line number (1-indexed). Required for goto_definition, find_references, hover, completions, rename.',
          },
          column: {
            type: 'number',
            description:
              'Column number (1-indexed). Required for goto_definition, find_references, hover, completions, rename.',
          },
          newName: {
            type: 'string',
            description: 'New name for the symbol (only for rename operation)',
          },
          content: {
            type: 'string',
            description:
              'File content. Provide this if the file has unsaved changes or is not on disk.',
          },
        },
        required: ['operation', 'file'],
      },
    };
  }

  async execute(input: LSPInput): Promise<LSPOutput> {
    const startTime = Date.now();

    const validationError = this.validateInput(input, ['operation', 'file']);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Validate position for operations that need it
    const positionRequired = [
      'goto_definition',
      'find_references',
      'hover',
      'completions',
      'rename',
    ];
    if (positionRequired.includes(input.operation)) {
      if (input.line === undefined || input.column === undefined) {
        return {
          success: false,
          error: `Operation '${input.operation}' requires line and column parameters`,
        };
      }
    }

    // Validate newName for rename
    if (input.operation === 'rename' && !input.newName) {
      return {
        success: false,
        error: "Rename operation requires 'newName' parameter",
      };
    }

    try {
      // Get the appropriate LSP client for this file
      const client = await this.getClientForFile(input.file);
      if (!client) {
        return {
          success: false,
          error: `No language server available for file: ${input.file}. Supported: .ts, .tsx, .js, .jsx, .py, .go`,
        };
      }

      // Ensure file is open in LSP
      await this.ensureFileOpen(client, input.file, input.content);

      // Convert to 0-based positions for LSP
      const position: Position = {
        line: (input.line || 1) - 1,
        character: (input.column || 1) - 1,
      };

      // Execute the requested operation
      let result: LSPResult;

      switch (input.operation) {
        case 'goto_definition':
          result = await this.gotoDefinition(client, input.file, position);
          break;

        case 'find_references':
          result = await this.findReferences(client, input.file, position);
          break;

        case 'hover':
          result = await this.getHover(client, input.file, position);
          break;

        case 'completions':
          result = await this.getCompletions(client, input.file, position);
          break;

        case 'document_symbols':
          result = await this.getDocumentSymbols(client, input.file);
          break;

        case 'rename':
          result = await this.renameSymbol(client, input.file, position, input.newName!);
          break;

        default:
          return { success: false, error: `Unknown operation: ${input.operation}` };
      }

      return {
        success: true,
        result,
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      log.error('LSP operation failed', { operation: input.operation, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LSP operation failed',
        metadata: {
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  // ============================================================================
  // OPERATION IMPLEMENTATIONS
  // ============================================================================

  private async gotoDefinition(
    client: LSPClient,
    file: string,
    position: Position
  ): Promise<GotoDefinitionResult> {
    const result = await client.gotoDefinition(file, position);

    if (!result) {
      return { definitions: [] };
    }

    const locations = Array.isArray(result) ? result : [result];
    return {
      definitions: locations.map((loc) => this.formatLocation(loc)),
    };
  }

  private async findReferences(
    client: LSPClient,
    file: string,
    position: Position
  ): Promise<FindReferencesResult> {
    const locations = await client.findReferences(file, position, true);

    return {
      references: locations.map((loc) => this.formatLocation(loc)),
      count: locations.length,
    };
  }

  private async getHover(
    client: LSPClient,
    file: string,
    position: Position
  ): Promise<HoverResult> {
    const hover = await client.hover(file, position);

    if (!hover) {
      return { content: 'No information available' };
    }

    return this.formatHover(hover);
  }

  private async getCompletions(
    client: LSPClient,
    file: string,
    position: Position
  ): Promise<CompletionsResult> {
    const items = await client.completion(file, position);

    // Limit to top 20 items
    const limitedItems = items.slice(0, 20);

    return {
      items: limitedItems.map((item) => this.formatCompletionItem(item)),
    };
  }

  private async getDocumentSymbols(
    client: LSPClient,
    file: string
  ): Promise<DocumentSymbolsResult> {
    const symbols = await client.documentSymbols(file);

    return {
      symbols: symbols.map((sym) => ({
        name: sym.name,
        kind: this.symbolKindToString(sym.kind),
        line: sym.range.start.line + 1,
        column: sym.range.start.character + 1,
        endLine: sym.range.end.line + 1,
        endColumn: sym.range.end.character + 1,
      })),
    };
  }

  private async renameSymbol(
    client: LSPClient,
    file: string,
    position: Position,
    newName: string
  ): Promise<RenameResult> {
    const edit = await client.rename(file, position, newName);

    if (!edit || !edit.changes) {
      return { changes: [] };
    }

    return {
      changes: Object.entries(edit.changes).map(([uri, edits]) => ({
        file: uri.replace('file://', ''),
        edits: edits.map((e) => ({
          line: e.range.start.line + 1,
          column: e.range.start.character + 1,
          endLine: e.range.end.line + 1,
          endColumn: e.range.end.character + 1,
          newText: e.newText,
        })),
      })),
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async getClientForFile(file: string): Promise<LSPClient | null> {
    if (!this.lspManager) {
      this.lspManager = new LSPManager(this.workspaceRoot);
    }

    return this.lspManager.getClientForFile(file);
  }

  private async ensureFileOpen(client: LSPClient, file: string, content?: string): Promise<void> {
    // If content is provided, use it
    if (content) {
      const cachedContent = this.openFiles.get(file);
      if (cachedContent !== content) {
        if (cachedContent) {
          await client.updateDocument(file, content);
        } else {
          await client.openDocument(file, content);
        }
        this.openFiles.set(file, content);
      }
      return;
    }

    // If already open, nothing to do
    if (this.openFiles.has(file)) {
      return;
    }

    // Try to read from disk
    const fullPath = `${this.workspaceRoot}/${file}`;
    try {
      const fs = await import('fs/promises');
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      await client.openDocument(file, fileContent);
      this.openFiles.set(file, fileContent);
    } catch {
      // File doesn't exist on disk, that's okay for some operations
      log.debug('File not found on disk, LSP may fail', { file });
    }
  }

  private formatLocation(loc: Location): {
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
  } {
    return {
      file: loc.uri.replace('file://', ''),
      line: loc.range.start.line + 1,
      column: loc.range.start.character + 1,
      endLine: loc.range.end.line + 1,
      endColumn: loc.range.end.character + 1,
    };
  }

  private formatHover(hover: Hover): HoverResult {
    const contents = hover.contents;

    // Handle different content formats
    if (typeof contents === 'string') {
      return { content: contents };
    }

    if (Array.isArray(contents)) {
      const parts = contents.map((c) => {
        if (typeof c === 'string') return c;
        return c.value;
      });
      return { content: parts.join('\n\n') };
    }

    if ('value' in contents) {
      return {
        content: contents.value,
        language: contents.kind === 'markdown' ? 'markdown' : undefined,
      };
    }

    return { content: JSON.stringify(contents) };
  }

  private formatCompletionItem(item: CompletionItem): {
    label: string;
    kind: string;
    detail?: string;
    documentation?: string;
    insertText?: string;
  } {
    let documentation: string | undefined;
    if (item.documentation) {
      if (typeof item.documentation === 'string') {
        documentation = item.documentation;
      } else {
        documentation = item.documentation.value;
      }
    }

    return {
      label: item.label,
      kind: this.completionKindToString(item.kind),
      detail: item.detail,
      documentation,
      insertText: item.insertText,
    };
  }

  private completionKindToString(kind?: number): string {
    const kinds: Record<number, string> = {
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
      16: 'color',
      17: 'file',
      18: 'reference',
      19: 'folder',
      20: 'enum_member',
      21: 'constant',
      22: 'struct',
      23: 'event',
      24: 'operator',
      25: 'type_parameter',
    };
    return kinds[kind || 0] || 'unknown';
  }

  private symbolKindToString(kind: number): string {
    const kinds: Record<number, string> = {
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
    return kinds[kind] || 'unknown';
  }

  /**
   * Stop all LSP servers
   */
  async cleanup(): Promise<void> {
    if (this.lspManager) {
      await this.lspManager.stopAll();
    }
    this.openFiles.clear();
  }
}

export const lspTool = new LSPTool();
