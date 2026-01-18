/**
 * LSP API - Language Server Protocol Endpoints
 *
 * Provides REST API for LSP operations:
 * - Go-to-definition
 * - Find references
 * - Hover information
 * - Code completions
 * - Document symbols
 * - Rename
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { getLSPManager } from '@/lib/lsp/lsp-client';
import { rateLimiters } from '@/lib/security/rate-limit';
import { validateCSRF } from '@/lib/security/csrf';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { logger } from '@/lib/logger';

const log = logger('LSPAPI');

type LSPOperation =
  | 'initialize'
  | 'update_document'
  | 'goto_definition'
  | 'find_references'
  | 'hover'
  | 'completions'
  | 'document_symbols'
  | 'rename';

interface LSPRequestBody {
  operation: LSPOperation;
  sessionId: string;
  workspaceRoot?: string;
  file?: string;
  content?: string;
  line?: number;
  column?: number;
  newName?: string;
}

/**
 * POST /api/code-lab/lsp
 *
 * LSP operations: initialize, update_document, goto_definition, find_references,
 * hover, completions, document_symbols, rename
 */
export async function POST(request: NextRequest) {
  // CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    // Rate limiting
    const rateLimitResult = await rateLimiters.codeLabLSP(auth.user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: rateLimitResult.retryAfter,
          remaining: rateLimitResult.remaining,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      );
    }

    const body: LSPRequestBody = await request.json();
    const {
      operation,
      sessionId,
      workspaceRoot = '/workspace',
      file,
      content,
      line,
      column,
      newName,
    } = body;

    if (!operation) {
      return NextResponse.json({ error: 'Missing operation' }, { status: 400 });
    }

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    log.debug('LSP operation', { operation, file, userId: auth.user.id });

    // Get or create LSP manager for this workspace
    const lspManager = getLSPManager(workspaceRoot);

    switch (operation) {
      case 'initialize': {
        if (!file || content === undefined) {
          return NextResponse.json(
            { error: 'initialize requires file and content' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json(
            { error: `No language server available for file: ${file}` },
            { status: 400 }
          );
        }

        await client.openDocument(sanitizedFile, content);
        const language = detectLanguage(file);

        return NextResponse.json({
          success: true,
          result: { initialized: true, language },
        });
      }

      case 'update_document': {
        if (!file || content === undefined) {
          return NextResponse.json(
            { error: 'update_document requires file and content' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({ success: true });
        }

        await client.updateDocument(sanitizedFile, content);
        return NextResponse.json({ success: true });
      }

      case 'goto_definition': {
        if (!file || line === undefined || column === undefined) {
          return NextResponse.json(
            { error: 'goto_definition requires file, line, and column' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({
            success: true,
            result: { definitions: [] },
          });
        }

        // Convert to 0-based position
        const position = { line: line - 1, character: column - 1 };
        const result = await client.gotoDefinition(sanitizedFile, position);

        if (!result) {
          return NextResponse.json({
            success: true,
            result: { definitions: [] },
          });
        }

        const locations = Array.isArray(result) ? result : [result];
        const definitions = locations.map((loc) => ({
          file: loc.uri.replace('file://', ''),
          line: loc.range.start.line + 1,
          column: loc.range.start.character + 1,
          endLine: loc.range.end.line + 1,
          endColumn: loc.range.end.character + 1,
        }));

        return NextResponse.json({
          success: true,
          result: { definitions },
        });
      }

      case 'find_references': {
        if (!file || line === undefined || column === undefined) {
          return NextResponse.json(
            { error: 'find_references requires file, line, and column' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({
            success: true,
            result: { references: [], count: 0 },
          });
        }

        const position = { line: line - 1, character: column - 1 };
        const locations = await client.findReferences(sanitizedFile, position, true);

        const references = locations.map((loc) => ({
          file: loc.uri.replace('file://', ''),
          line: loc.range.start.line + 1,
          column: loc.range.start.character + 1,
          endLine: loc.range.end.line + 1,
          endColumn: loc.range.end.character + 1,
        }));

        return NextResponse.json({
          success: true,
          result: { references, count: references.length },
        });
      }

      case 'hover': {
        if (!file || line === undefined || column === undefined) {
          return NextResponse.json(
            { error: 'hover requires file, line, and column' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({
            success: true,
            result: null,
          });
        }

        const position = { line: line - 1, character: column - 1 };
        const hover = await client.hover(sanitizedFile, position);

        if (!hover) {
          return NextResponse.json({
            success: true,
            result: null,
          });
        }

        // Format hover content
        let content: string;
        if (typeof hover.contents === 'string') {
          content = hover.contents;
        } else if (Array.isArray(hover.contents)) {
          content = hover.contents.map((c) => (typeof c === 'string' ? c : c.value)).join('\n\n');
        } else if ('value' in hover.contents) {
          content = hover.contents.value;
        } else {
          content = JSON.stringify(hover.contents);
        }

        return NextResponse.json({
          success: true,
          result: {
            content,
            range: hover.range
              ? {
                  start: {
                    line: hover.range.start.line + 1,
                    column: hover.range.start.character + 1,
                  },
                  end: {
                    line: hover.range.end.line + 1,
                    column: hover.range.end.character + 1,
                  },
                }
              : undefined,
          },
        });
      }

      case 'completions': {
        if (!file || line === undefined || column === undefined) {
          return NextResponse.json(
            { error: 'completions requires file, line, and column' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({
            success: true,
            result: { items: [] },
          });
        }

        const position = { line: line - 1, character: column - 1 };
        const completions = await client.completion(sanitizedFile, position);

        // Format and limit completions
        const items = completions.slice(0, 50).map((item) => ({
          label: item.label,
          kind: completionKindToString(item.kind),
          detail: item.detail,
          documentation:
            typeof item.documentation === 'string' ? item.documentation : item.documentation?.value,
          insertText: item.insertText,
        }));

        return NextResponse.json({
          success: true,
          result: { items },
        });
      }

      case 'document_symbols': {
        if (!file) {
          return NextResponse.json({ error: 'document_symbols requires file' }, { status: 400 });
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({
            success: true,
            result: { symbols: [] },
          });
        }

        const docSymbols = await client.documentSymbols(sanitizedFile);

        const symbols = docSymbols.map((sym) => ({
          name: sym.name,
          kind: symbolKindToString(sym.kind),
          line: sym.range.start.line + 1,
          column: sym.range.start.character + 1,
          endLine: sym.range.end.line + 1,
          endColumn: sym.range.end.character + 1,
        }));

        return NextResponse.json({
          success: true,
          result: { symbols },
        });
      }

      case 'rename': {
        if (!file || line === undefined || column === undefined || !newName) {
          return NextResponse.json(
            { error: 'rename requires file, line, column, and newName' },
            { status: 400 }
          );
        }

        const sanitizedFile = sanitizeFilePath(file, workspaceRoot);
        const client = await lspManager.getClientForFile(sanitizedFile);

        if (!client) {
          return NextResponse.json({
            success: true,
            result: { changes: [] },
          });
        }

        const position = { line: line - 1, character: column - 1 };
        const edit = await client.rename(sanitizedFile, position, newName);

        if (!edit || !edit.changes) {
          return NextResponse.json({
            success: true,
            result: { changes: [] },
          });
        }

        const changes = Object.entries(edit.changes).map(([uri, edits]) => ({
          file: uri.replace('file://', ''),
          edits: edits.map((e) => ({
            line: e.range.start.line + 1,
            column: e.range.start.character + 1,
            endLine: e.range.end.line + 1,
            endColumn: e.range.end.character + 1,
            newText: e.newText,
          })),
        }));

        return NextResponse.json({
          success: true,
          result: { changes },
        });
      }

      default:
        return NextResponse.json({ error: `Unknown operation: ${operation}` }, { status: 400 });
    }
  } catch (error) {
    log.error('LSP API error', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function detectLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    go: 'go',
  };
  return languageMap[ext] || 'plaintext';
}

function completionKindToString(kind?: number): string {
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

function symbolKindToString(kind: number): string {
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
