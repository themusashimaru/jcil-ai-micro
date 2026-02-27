// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock fs/promises for ensureFileOpen
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Create mock LSP client
function createMockClient() {
  return {
    gotoDefinition: vi.fn(),
    findReferences: vi.fn(),
    hover: vi.fn(),
    completion: vi.fn(),
    documentSymbols: vi.fn(),
    rename: vi.fn(),
    openDocument: vi.fn(),
    updateDocument: vi.fn(),
  };
}

// Create mock LSP manager
function createMockManager() {
  return {
    getClientForFile: vi.fn(),
    stopAll: vi.fn(),
  };
}

// Mock the lsp-client module
const mockLSPManagerConstructor = vi.fn();
vi.mock('@/lib/lsp/lsp-client', () => ({
  LSPManager: class {
    constructor(workspaceRoot: string) {
      mockLSPManagerConstructor(workspaceRoot);
      const mgr = createMockManager();
      // Store on the instance so tests can get at it
      Object.assign(this, mgr);
    }
  },
  LSPClient: class {},
}));

import { LSPTool, lspTool } from '../LSPTool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTool(): LSPTool {
  const tool = new LSPTool();
  return tool;
}

/**
 * Create an LSPTool with a pre-injected mock manager and client.
 * Returns { tool, client, manager } for easy test access.
 */
function makeToolWithClient() {
  const tool = new LSPTool();
  const client = createMockClient();
  const manager = createMockManager();
  manager.getClientForFile.mockResolvedValue(client);

  // Inject the mock manager directly
  (tool as any).lspManager = manager;
  return { tool, client, manager };
}

function makeLocation(file: string, startLine = 0, startCol = 0, endLine = 0, endCol = 0) {
  return {
    uri: `file://${file}`,
    range: {
      start: { line: startLine, character: startCol },
      end: { line: endLine, character: endCol },
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LSPTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadFile.mockReset();
  });

  // =========================================================================
  // Basic properties
  // =========================================================================

  describe('basic properties', () => {
    it('should have name "lsp"', () => {
      const tool = makeTool();
      expect(tool.name).toBe('lsp');
    });

    it('should have a non-empty description', () => {
      const tool = makeTool();
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe('string');
    });

    it('should describe supported operations in description', () => {
      const tool = makeTool();
      expect(tool.description).toContain('goto_definition');
      expect(tool.description).toContain('find_references');
      expect(tool.description).toContain('hover');
      expect(tool.description).toContain('completions');
      expect(tool.description).toContain('document_symbols');
      expect(tool.description).toContain('rename');
    });

    it('should mention supported languages', () => {
      const tool = makeTool();
      expect(tool.description).toContain('TypeScript');
      expect(tool.description).toContain('Python');
    });
  });

  // =========================================================================
  // getDefinition
  // =========================================================================

  describe('getDefinition', () => {
    it('should return a valid tool definition', () => {
      const tool = makeTool();
      const def = tool.getDefinition();
      expect(def.name).toBe('lsp');
      expect(def.parameters.type).toBe('object');
      expect(def.parameters.required).toContain('operation');
      expect(def.parameters.required).toContain('file');
    });

    it('should define the operation parameter with enum values', () => {
      const tool = makeTool();
      const def = tool.getDefinition();
      const opProp = def.parameters.properties.operation;
      expect(opProp.type).toBe('string');
      expect(opProp.enum).toEqual([
        'goto_definition',
        'find_references',
        'hover',
        'completions',
        'document_symbols',
        'rename',
      ]);
    });

    it('should define the file parameter', () => {
      const tool = makeTool();
      const def = tool.getDefinition();
      expect(def.parameters.properties.file).toBeDefined();
      expect(def.parameters.properties.file.type).toBe('string');
    });

    it('should define optional line, column, newName, content parameters', () => {
      const tool = makeTool();
      const def = tool.getDefinition();
      expect(def.parameters.properties.line).toBeDefined();
      expect(def.parameters.properties.column).toBeDefined();
      expect(def.parameters.properties.newName).toBeDefined();
      expect(def.parameters.properties.content).toBeDefined();
    });

    it('should have description on the definition', () => {
      const tool = makeTool();
      const def = tool.getDefinition();
      expect(def.description).toBeTruthy();
    });
  });

  // =========================================================================
  // initialize
  // =========================================================================

  describe('initialize', () => {
    it('should set workspaceRoot from config', () => {
      const tool = makeTool();
      tool.initialize({ workspaceRoot: '/my/workspace' });
      expect((tool as any).workspaceRoot).toBe('/my/workspace');
    });

    it('should default workspaceRoot to /workspace', () => {
      const tool = makeTool();
      tool.initialize({});
      expect((tool as any).workspaceRoot).toBe('/workspace');
    });

    it('should create an LSPManager with the workspace root', () => {
      const tool = makeTool();
      mockLSPManagerConstructor.mockClear();
      tool.initialize({ workspaceRoot: '/test/root' });
      expect(mockLSPManagerConstructor).toHaveBeenCalledWith('/test/root');
    });
  });

  // =========================================================================
  // Input validation
  // =========================================================================

  describe('input validation', () => {
    it('should fail when operation is missing', async () => {
      const tool = makeTool();
      const result = await tool.execute({ file: 'src/index.ts' } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('operation');
    });

    it('should fail when file is missing', async () => {
      const tool = makeTool();
      const result = await tool.execute({ operation: 'hover' } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('file');
    });

    it('should fail when goto_definition is missing line', async () => {
      const tool = makeTool();
      const result = await tool.execute({
        operation: 'goto_definition',
        file: 'src/index.ts',
        column: 5,
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('line and column');
    });

    it('should fail when find_references is missing column', async () => {
      const tool = makeTool();
      const result = await tool.execute({
        operation: 'find_references',
        file: 'src/index.ts',
        line: 5,
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('line and column');
    });

    it('should fail when hover is missing line and column', async () => {
      const tool = makeTool();
      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('line and column');
    });

    it('should fail when completions is missing position', async () => {
      const tool = makeTool();
      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('line and column');
    });

    it('should fail when rename is missing newName', async () => {
      const { tool, client, manager } = makeToolWithClient();
      const result = await tool.execute({
        operation: 'rename',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('newName');
    });

    it('should NOT require line/column for document_symbols', async () => {
      const { tool, client } = makeToolWithClient();
      client.documentSymbols.mockResolvedValue([]);
      mockReadFile.mockResolvedValue('file content');

      const result = await tool.execute({
        operation: 'document_symbols',
        file: 'src/index.ts',
      } as any);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Client resolution
  // =========================================================================

  describe('client resolution', () => {
    it('should return error when no LSP client available for file type', async () => {
      const { tool, manager } = makeToolWithClient();
      manager.getClientForFile.mockResolvedValue(null);

      const result = await tool.execute({
        operation: 'hover',
        file: 'README.md',
        line: 1,
        column: 1,
      } as any);
      expect(result.success).toBe(false);
      expect(result.error).toContain('No language server available');
    });

    it('should create LSPManager lazily if not initialized', async () => {
      const tool = makeTool();
      // Do NOT call initialize; the execute path should create an LSPManager
      // We need to set up the mock so the auto-created manager returns null
      // (since the mock constructor creates a mock manager)
      const result = await tool.execute({
        operation: 'hover',
        file: 'README.md',
        line: 1,
        column: 1,
      } as any);
      // It should have attempted to get a client (even if it returned null)
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // goto_definition
  // =========================================================================

  describe('goto_definition', () => {
    it('should return definitions from a single Location result', async () => {
      const { tool, client } = makeToolWithClient();
      client.gotoDefinition.mockResolvedValue(
        makeLocation('/workspace/src/types.ts', 10, 5, 10, 20)
      );
      mockReadFile.mockResolvedValue('file content');

      const result = await tool.execute({
        operation: 'goto_definition',
        file: 'src/index.ts',
        line: 5,
        column: 10,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.definitions).toHaveLength(1);
      expect(result.result.definitions[0].file).toBe('/workspace/src/types.ts');
      expect(result.result.definitions[0].line).toBe(11); // 0-based -> 1-based
      expect(result.result.definitions[0].column).toBe(6);
    });

    it('should return definitions from an array of Locations', async () => {
      const { tool, client } = makeToolWithClient();
      client.gotoDefinition.mockResolvedValue([
        makeLocation('/workspace/src/a.ts', 1, 2, 1, 5),
        makeLocation('/workspace/src/b.ts', 3, 4, 3, 8),
      ]);
      mockReadFile.mockResolvedValue('file content');

      const result = await tool.execute({
        operation: 'goto_definition',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.definitions).toHaveLength(2);
    });

    it('should return empty definitions when result is null', async () => {
      const { tool, client } = makeToolWithClient();
      client.gotoDefinition.mockResolvedValue(null);
      mockReadFile.mockResolvedValue('file content');

      const result = await tool.execute({
        operation: 'goto_definition',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.definitions).toEqual([]);
    });

    it('should convert 1-based input to 0-based LSP position', async () => {
      const { tool, client } = makeToolWithClient();
      client.gotoDefinition.mockResolvedValue(null);
      mockReadFile.mockResolvedValue('content');

      await tool.execute({
        operation: 'goto_definition',
        file: 'src/index.ts',
        line: 10,
        column: 5,
      } as any);

      expect(client.gotoDefinition).toHaveBeenCalledWith('src/index.ts', {
        line: 9,
        character: 4,
      });
    });
  });

  // =========================================================================
  // find_references
  // =========================================================================

  describe('find_references', () => {
    it('should return references and count', async () => {
      const { tool, client } = makeToolWithClient();
      client.findReferences.mockResolvedValue([
        makeLocation('/workspace/src/a.ts', 0, 0, 0, 5),
        makeLocation('/workspace/src/b.ts', 2, 3, 2, 8),
        makeLocation('/workspace/src/c.ts', 10, 1, 10, 6),
      ]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'find_references',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.references).toHaveLength(3);
      expect(result.result.count).toBe(3);
    });

    it('should return empty references for no results', async () => {
      const { tool, client } = makeToolWithClient();
      client.findReferences.mockResolvedValue([]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'find_references',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.references).toEqual([]);
      expect(result.result.count).toBe(0);
    });

    it('should pass includeDeclaration=true to client', async () => {
      const { tool, client } = makeToolWithClient();
      client.findReferences.mockResolvedValue([]);
      mockReadFile.mockResolvedValue('content');

      await tool.execute({
        operation: 'find_references',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(client.findReferences).toHaveBeenCalledWith(
        'src/index.ts',
        { line: 0, character: 0 },
        true
      );
    });
  });

  // =========================================================================
  // hover
  // =========================================================================

  describe('hover', () => {
    it('should return hover content when available', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue({
        contents: { kind: 'markdown', value: '```ts\nconst x: number\n```' },
      });
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('```ts\nconst x: number\n```');
      expect(result.result.language).toBe('markdown');
    });

    it('should return "No information available" when hover is null', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('No information available');
    });

    it('should handle string hover contents', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue({ contents: 'Simple string hover' });
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('Simple string hover');
    });

    it('should handle array hover contents with mixed types', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue({
        contents: ['First section', { value: 'Second section', kind: 'markdown' }],
      });
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('First section\n\nSecond section');
    });

    it('should handle MarkupContent with plaintext kind (no language)', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue({
        contents: { kind: 'plaintext', value: 'Plain text info' },
      });
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('Plain text info');
      expect(result.result.language).toBeUndefined();
    });

    it('should JSON.stringify unrecognized hover formats', async () => {
      const { tool, client } = makeToolWithClient();
      // An object without 'value' property, not a string, not an array
      client.hover.mockResolvedValue({
        contents: { someUnknownProp: 'test' },
      });
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.content).toBe('{"someUnknownProp":"test"}');
    });
  });

  // =========================================================================
  // completions
  // =========================================================================

  describe('completions', () => {
    it('should return formatted completion items', async () => {
      const { tool, client } = makeToolWithClient();
      client.completion.mockResolvedValue([
        { label: 'myVar', kind: 6, detail: 'const myVar: string', insertText: 'myVar' },
        { label: 'myFunc', kind: 3, detail: 'function myFunc()' },
      ]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.items).toHaveLength(2);
      expect(result.result.items[0].label).toBe('myVar');
      expect(result.result.items[0].kind).toBe('variable');
      expect(result.result.items[0].insertText).toBe('myVar');
      expect(result.result.items[1].kind).toBe('function');
    });

    it('should limit completions to 20 items', async () => {
      const { tool, client } = makeToolWithClient();
      const manyItems = Array.from({ length: 30 }, (_, i) => ({
        label: `item${i}`,
        kind: 6,
      }));
      client.completion.mockResolvedValue(manyItems);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.items).toHaveLength(20);
    });

    it('should handle string documentation in completion items', async () => {
      const { tool, client } = makeToolWithClient();
      client.completion.mockResolvedValue([{ label: 'item', kind: 1, documentation: 'Some docs' }]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.result.items[0].documentation).toBe('Some docs');
    });

    it('should handle MarkupContent documentation in completion items', async () => {
      const { tool, client } = makeToolWithClient();
      client.completion.mockResolvedValue([
        { label: 'item', kind: 1, documentation: { kind: 'markdown', value: '**bold**' } },
      ]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.result.items[0].documentation).toBe('**bold**');
    });

    it('should return "unknown" for unrecognized completion kind', async () => {
      const { tool, client } = makeToolWithClient();
      client.completion.mockResolvedValue([{ label: 'item', kind: 999 }]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.result.items[0].kind).toBe('unknown');
    });

    it('should return "unknown" when completion kind is undefined', async () => {
      const { tool, client } = makeToolWithClient();
      client.completion.mockResolvedValue([{ label: 'item' }]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'completions',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.result.items[0].kind).toBe('unknown');
    });
  });

  // =========================================================================
  // document_symbols
  // =========================================================================

  describe('document_symbols', () => {
    it('should return formatted document symbols', async () => {
      const { tool, client } = makeToolWithClient();
      client.documentSymbols.mockResolvedValue([
        {
          name: 'MyClass',
          kind: 5,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 20, character: 1 },
          },
          selectionRange: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 13 },
          },
        },
        {
          name: 'myFunction',
          kind: 12,
          range: {
            start: { line: 22, character: 0 },
            end: { line: 30, character: 1 },
          },
          selectionRange: {
            start: { line: 22, character: 9 },
            end: { line: 22, character: 19 },
          },
        },
      ]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'document_symbols',
        file: 'src/index.ts',
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.symbols).toHaveLength(2);
      expect(result.result.symbols[0].name).toBe('MyClass');
      expect(result.result.symbols[0].kind).toBe('class');
      expect(result.result.symbols[0].line).toBe(1); // 0-based -> 1-based
      expect(result.result.symbols[1].name).toBe('myFunction');
      expect(result.result.symbols[1].kind).toBe('function');
      expect(result.result.symbols[1].line).toBe(23);
    });

    it('should return empty symbols for empty result', async () => {
      const { tool, client } = makeToolWithClient();
      client.documentSymbols.mockResolvedValue([]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'document_symbols',
        file: 'src/index.ts',
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.symbols).toEqual([]);
    });

    it('should return "unknown" for unrecognized symbol kind', async () => {
      const { tool, client } = makeToolWithClient();
      client.documentSymbols.mockResolvedValue([
        {
          name: 'mystery',
          kind: 999,
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 5 },
          },
        },
      ]);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'document_symbols',
        file: 'src/index.ts',
      } as any);

      expect(result.result.symbols[0].kind).toBe('unknown');
    });
  });

  // =========================================================================
  // rename
  // =========================================================================

  describe('rename', () => {
    it('should return workspace edit changes', async () => {
      const { tool, client } = makeToolWithClient();
      client.rename.mockResolvedValue({
        changes: {
          'file:///workspace/src/a.ts': [
            {
              range: {
                start: { line: 5, character: 10 },
                end: { line: 5, character: 20 },
              },
              newText: 'newName',
            },
          ],
          'file:///workspace/src/b.ts': [
            {
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 7 },
              },
              newText: 'newName',
            },
          ],
        },
      });
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'rename',
        file: 'src/a.ts',
        line: 6,
        column: 11,
        newName: 'newName',
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.changes).toHaveLength(2);
      expect(result.result.changes[0].file).toBe('/workspace/src/a.ts');
      expect(result.result.changes[0].edits[0].newText).toBe('newName');
      expect(result.result.changes[0].edits[0].line).toBe(6); // 0-based -> 1-based
    });

    it('should return empty changes when rename returns null', async () => {
      const { tool, client } = makeToolWithClient();
      client.rename.mockResolvedValue(null);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'rename',
        file: 'src/a.ts',
        line: 1,
        column: 1,
        newName: 'newName',
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.changes).toEqual([]);
    });

    it('should return empty changes when edit has no changes property', async () => {
      const { tool, client } = makeToolWithClient();
      client.rename.mockResolvedValue({});
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'rename',
        file: 'src/a.ts',
        line: 1,
        column: 1,
        newName: 'newName',
      } as any);

      expect(result.success).toBe(true);
      expect(result.result.changes).toEqual([]);
    });
  });

  // =========================================================================
  // Unknown operation
  // =========================================================================

  describe('unknown operation', () => {
    it('should return error for unknown operation', async () => {
      const { tool, client } = makeToolWithClient();
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'not_a_real_operation',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown operation');
    });
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('should catch and return Error instances', async () => {
      const { tool, client } = makeToolWithClient();
      client.gotoDefinition.mockRejectedValue(new Error('LSP server crashed'));
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'goto_definition',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('LSP server crashed');
      expect(result.metadata?.executionTime).toBeDefined();
    });

    it('should return generic message for non-Error throws', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockRejectedValue('string error');
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toBe('LSP operation failed');
    });

    it('should include executionTime in metadata on success', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(true);
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include executionTime in metadata on error', async () => {
      const { tool, client } = makeToolWithClient();
      client.findReferences.mockRejectedValue(new Error('timeout'));
      mockReadFile.mockResolvedValue('content');

      const result = await tool.execute({
        operation: 'find_references',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(result.success).toBe(false);
      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // ensureFileOpen
  // =========================================================================

  describe('ensureFileOpen (via execute)', () => {
    it('should open file with provided content', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);

      const result = await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
        content: 'const x = 1;',
      } as any);

      expect(result.success).toBe(true);
      expect(client.openDocument).toHaveBeenCalledWith('src/index.ts', 'const x = 1;');
    });

    it('should update document when content changes', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);

      // First call opens the document
      await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
        content: 'const x = 1;',
      } as any);

      // Second call with different content should update
      await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
        content: 'const x = 2;',
      } as any);

      expect(client.openDocument).toHaveBeenCalledTimes(1);
      expect(client.updateDocument).toHaveBeenCalledWith('src/index.ts', 'const x = 2;');
    });

    it('should not reopen file when content is unchanged', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);

      await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
        content: 'const x = 1;',
      } as any);

      await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
        content: 'const x = 1;',
      } as any);

      expect(client.openDocument).toHaveBeenCalledTimes(1);
      expect(client.updateDocument).not.toHaveBeenCalled();
    });

    it('should read file from disk when no content provided', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);
      mockReadFile.mockResolvedValue('disk content');

      await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
      } as any);

      expect(mockReadFile).toHaveBeenCalledWith('/workspace/src/index.ts', 'utf-8');
      expect(client.openDocument).toHaveBeenCalledWith('src/index.ts', 'disk content');
    });

    it('should handle file not found on disk gracefully', async () => {
      const { tool, client } = makeToolWithClient();
      client.hover.mockResolvedValue(null);
      mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await tool.execute({
        operation: 'hover',
        file: 'nonexistent.ts',
        line: 1,
        column: 1,
      } as any);

      // Should still succeed (the LSP operation continues)
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // cleanup
  // =========================================================================

  describe('cleanup', () => {
    it('should stop all LSP servers via manager', async () => {
      const { tool, manager } = makeToolWithClient();
      manager.stopAll.mockResolvedValue(undefined);

      await tool.cleanup();

      expect(manager.stopAll).toHaveBeenCalledOnce();
    });

    it('should clear openFiles map', async () => {
      const { tool, client, manager } = makeToolWithClient();
      client.hover.mockResolvedValue(null);
      manager.stopAll.mockResolvedValue(undefined);

      // Open a file
      await tool.execute({
        operation: 'hover',
        file: 'src/index.ts',
        line: 1,
        column: 1,
        content: 'content',
      } as any);

      expect((tool as any).openFiles.size).toBe(1);

      await tool.cleanup();

      expect((tool as any).openFiles.size).toBe(0);
    });

    it('should handle cleanup when lspManager is null', async () => {
      const tool = makeTool();
      // lspManager is null by default
      await expect(tool.cleanup()).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Completion kind mapping
  // =========================================================================

  describe('completionKindToString', () => {
    const tool = makeTool();
    const fn = (tool as any).completionKindToString.bind(tool);

    it.each([
      [1, 'text'],
      [2, 'method'],
      [3, 'function'],
      [4, 'constructor'],
      [5, 'field'],
      [6, 'variable'],
      [7, 'class'],
      [8, 'interface'],
      [9, 'module'],
      [10, 'property'],
      [11, 'unit'],
      [12, 'value'],
      [13, 'enum'],
      [14, 'keyword'],
      [15, 'snippet'],
      [16, 'color'],
      [17, 'file'],
      [18, 'reference'],
      [19, 'folder'],
      [20, 'enum_member'],
      [21, 'constant'],
      [22, 'struct'],
      [23, 'event'],
      [24, 'operator'],
      [25, 'type_parameter'],
    ])('should map kind %d to "%s"', (kind, expected) => {
      expect(fn(kind)).toBe(expected);
    });

    it('should return "unknown" for undefined kind', () => {
      expect(fn(undefined)).toBe('unknown');
    });

    it('should return "unknown" for kind 0', () => {
      expect(fn(0)).toBe('unknown');
    });
  });

  // =========================================================================
  // Symbol kind mapping
  // =========================================================================

  describe('symbolKindToString', () => {
    const tool = makeTool();
    const fn = (tool as any).symbolKindToString.bind(tool);

    it.each([
      [1, 'file'],
      [2, 'module'],
      [3, 'namespace'],
      [5, 'class'],
      [6, 'method'],
      [12, 'function'],
      [13, 'variable'],
      [14, 'constant'],
      [26, 'type_parameter'],
    ])('should map symbol kind %d to "%s"', (kind, expected) => {
      expect(fn(kind)).toBe(expected);
    });

    it('should return "unknown" for unrecognized symbol kind', () => {
      expect(fn(999)).toBe('unknown');
    });
  });

  // =========================================================================
  // Singleton export
  // =========================================================================

  describe('lspTool singleton', () => {
    it('should be an instance of LSPTool', () => {
      expect(lspTool).toBeInstanceOf(LSPTool);
    });

    it('should have name "lsp"', () => {
      expect(lspTool.name).toBe('lsp');
    });
  });
});
