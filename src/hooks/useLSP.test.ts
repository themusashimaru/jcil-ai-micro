// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { useLSP } from './useLSP';
import type {
  Position,
  Range,
  Location,
  HoverInfo,
  CompletionItem,
  DocumentSymbol,
  LSPStatus,
  UseLSPOptions,
} from './useLSP';

// ============================================================================
// HELPERS
// ============================================================================

function mockFetchSuccess(result: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ result }),
  });
}

function mockFetchError(status: number, message: string) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve({ message }),
  });
}

function mockFetchNetworkError(errorMessage: string) {
  (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error(errorMessage));
}

const defaultOptions: UseLSPOptions = {
  sessionId: 'test-session-123',
};

const samplePosition: Position = { line: 10, column: 5 };
const sampleFile = '/workspace/src/index.ts';

const sampleLocation: Location = {
  file: '/workspace/src/utils.ts',
  line: 20,
  column: 1,
  endLine: 20,
  endColumn: 15,
};

const sampleHoverInfo: HoverInfo = {
  content: 'function greet(name: string): string',
  language: 'typescript',
  range: {
    start: { line: 10, column: 5 },
    end: { line: 10, column: 10 },
  },
};

const sampleCompletionItem: CompletionItem = {
  label: 'console',
  kind: 'variable',
  detail: 'var console: Console',
  documentation: 'The console object provides access to the browser debugging console.',
  insertText: 'console',
};

const sampleSymbol: DocumentSymbol = {
  name: 'greet',
  kind: 'function',
  line: 5,
  column: 1,
  endLine: 10,
  endColumn: 2,
};

// ============================================================================
// TYPE TESTS
// ============================================================================

describe('useLSP types', () => {
  it('should define Position with line and column', () => {
    const pos: Position = { line: 1, column: 1 };
    expect(pos.line).toBe(1);
    expect(pos.column).toBe(1);
  });

  it('should define Range with start and end Positions', () => {
    const range: Range = {
      start: { line: 1, column: 1 },
      end: { line: 5, column: 10 },
    };
    expect(range.start.line).toBe(1);
    expect(range.end.column).toBe(10);
  });

  it('should define Location with file and position info', () => {
    const loc: Location = {
      file: 'test.ts',
      line: 1,
      column: 1,
      endLine: 2,
      endColumn: 5,
    };
    expect(loc.file).toBe('test.ts');
    expect(loc.endLine).toBe(2);
  });

  it('should define HoverInfo with required content and optional fields', () => {
    const hover: HoverInfo = { content: 'test' };
    expect(hover.content).toBe('test');
    expect(hover.language).toBeUndefined();
    expect(hover.range).toBeUndefined();
  });

  it('should define HoverInfo with all fields', () => {
    const hover: HoverInfo = {
      content: 'test',
      language: 'typescript',
      range: { start: { line: 1, column: 1 }, end: { line: 1, column: 5 } },
    };
    expect(hover.language).toBe('typescript');
    expect(hover.range?.start.line).toBe(1);
  });

  it('should define CompletionItem with required label and kind', () => {
    const item: CompletionItem = { label: 'test', kind: 'variable' };
    expect(item.label).toBe('test');
    expect(item.kind).toBe('variable');
    expect(item.detail).toBeUndefined();
    expect(item.documentation).toBeUndefined();
    expect(item.insertText).toBeUndefined();
  });

  it('should define CompletionItem with all optional fields', () => {
    const item: CompletionItem = {
      label: 'test',
      kind: 'function',
      detail: 'detail',
      documentation: 'docs',
      insertText: 'test()',
    };
    expect(item.detail).toBe('detail');
    expect(item.insertText).toBe('test()');
  });

  it('should define DocumentSymbol with position fields', () => {
    const sym: DocumentSymbol = {
      name: 'myFunc',
      kind: 'function',
      line: 1,
      column: 1,
      endLine: 10,
      endColumn: 2,
    };
    expect(sym.name).toBe('myFunc');
    expect(sym.kind).toBe('function');
  });

  it('should define LSPStatus with all fields', () => {
    const status: LSPStatus = {
      connected: false,
      language: null,
      serverName: null,
      error: null,
    };
    expect(status.connected).toBe(false);
    expect(status.language).toBeNull();
  });

  it('should define UseLSPOptions with required sessionId', () => {
    const opts: UseLSPOptions = { sessionId: 'abc' };
    expect(opts.sessionId).toBe('abc');
    expect(opts.apiEndpoint).toBeUndefined();
  });

  it('should define UseLSPOptions with all optional fields', () => {
    const opts: UseLSPOptions = {
      sessionId: 'abc',
      apiEndpoint: '/api/lsp',
      workspaceRoot: '/home',
      enableCompletions: false,
      enableHover: false,
      hoverDebounce: 500,
    };
    expect(opts.enableCompletions).toBe(false);
    expect(opts.hoverDebounce).toBe(500);
  });
});

// ============================================================================
// HOOK INITIAL STATE
// ============================================================================

describe('useLSP initial state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return initial status as disconnected', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.status).toEqual({
      connected: false,
      language: null,
      serverName: null,
      error: null,
    });
  });

  it('should return loading as false initially', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.loading).toBe(false);
  });

  it('should return hoverInfo as null initially', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.hoverInfo).toBeNull();
  });

  it('should return completions as empty array initially', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.completions).toEqual([]);
  });

  it('should return definitions as empty array initially', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.definitions).toEqual([]);
  });

  it('should return references as empty array initially', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.references).toEqual([]);
  });

  it('should return symbols as empty array initially', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(result.current.symbols).toEqual([]);
  });

  it('should return all operation functions', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(typeof result.current.gotoDefinition).toBe('function');
    expect(typeof result.current.findReferences).toBe('function');
    expect(typeof result.current.getHoverInfo).toBe('function');
    expect(typeof result.current.getCompletions).toBe('function');
    expect(typeof result.current.getDocumentSymbols).toBe('function');
    expect(typeof result.current.renameSymbol).toBe('function');
  });

  it('should return document management functions', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(typeof result.current.initializeForFile).toBe('function');
    expect(typeof result.current.updateFileContent).toBe('function');
  });

  it('should return clearing functions', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(typeof result.current.clearHover).toBe('function');
    expect(typeof result.current.clearCompletions).toBe('function');
  });

  it('should return event handler functions', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));
    expect(typeof result.current.handleEditorClick).toBe('function');
    expect(typeof result.current.handleEditorKeyDown).toBe('function');
  });
});

// ============================================================================
// gotoDefinition
// ============================================================================

describe('useLSP gotoDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return definitions on successful request', async () => {
    mockFetchSuccess({ definitions: [sampleLocation] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toEqual([sampleLocation]);
    expect(result.current.definitions).toEqual([sampleLocation]);
  });

  it('should return empty array when request fails', async () => {
    mockFetchError(500, 'Internal server error');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    mockFetchNetworkError('Network failure');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toEqual([]);
  });

  it('should set loading to false after request completes', async () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should send correct parameters in fetch body', async () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/code-lab/lsp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'test-session-123',
        operation: 'goto_definition',
        workspaceRoot: '/workspace',
        file: sampleFile,
        line: 10,
        column: 5,
      }),
    });
  });

  it('should handle multiple definitions', async () => {
    const locations: Location[] = [
      sampleLocation,
      { file: '/workspace/src/other.ts', line: 5, column: 1, endLine: 5, endColumn: 10 },
    ];
    mockFetchSuccess({ definitions: locations });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toHaveLength(2);
  });

  it('should clear previous definitions before new request', async () => {
    mockFetchSuccess({ definitions: [sampleLocation] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });
    expect(result.current.definitions).toHaveLength(1);

    mockFetchSuccess({ definitions: [] });
    await act(async () => {
      await result.current.gotoDefinition(sampleFile, { line: 1, column: 1 });
    });
    expect(result.current.definitions).toEqual([]);
  });
});

// ============================================================================
// findReferences
// ============================================================================

describe('useLSP findReferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return references on successful request', async () => {
    mockFetchSuccess({ references: [sampleLocation], count: 1 });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let refs: Location[] = [];
    await act(async () => {
      refs = await result.current.findReferences(sampleFile, samplePosition);
    });

    expect(refs).toEqual([sampleLocation]);
    expect(result.current.references).toEqual([sampleLocation]);
  });

  it('should return empty array when no references found', async () => {
    mockFetchSuccess({ references: [], count: 0 });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let refs: Location[] = [];
    await act(async () => {
      refs = await result.current.findReferences(sampleFile, samplePosition);
    });

    expect(refs).toEqual([]);
  });

  it('should return empty array on request failure', async () => {
    mockFetchError(404, 'Not found');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let refs: Location[] = [];
    await act(async () => {
      refs = await result.current.findReferences(sampleFile, samplePosition);
    });

    expect(refs).toEqual([]);
  });

  it('should set loading to false after request', async () => {
    mockFetchSuccess({ references: [], count: 0 });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.findReferences(sampleFile, samplePosition);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should send find_references operation', async () => {
    mockFetchSuccess({ references: [], count: 0 });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.findReferences(sampleFile, samplePosition);
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.operation).toBe('find_references');
  });
});

// ============================================================================
// getHoverInfo
// ============================================================================

describe('useLSP getHoverInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return hover info after debounce', async () => {
    mockFetchSuccess(sampleHoverInfo);
    const { result } = renderHook(() => useLSP(defaultOptions));

    let hover: HoverInfo | null = null;
    await act(async () => {
      const promise = result.current.getHoverInfo(sampleFile, samplePosition);
      vi.advanceTimersByTime(200);
      hover = await promise;
    });

    expect(hover).toEqual(sampleHoverInfo);
  });

  it('should return null when hover is disabled', async () => {
    const { result } = renderHook(() => useLSP({ ...defaultOptions, enableHover: false }));

    let hover: HoverInfo | null = null;
    await act(async () => {
      hover = await result.current.getHoverInfo(sampleFile, samplePosition);
    });

    expect(hover).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return null on failed request', async () => {
    mockFetchError(500, 'Server error');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let hover: HoverInfo | null = null;
    await act(async () => {
      const promise = result.current.getHoverInfo(sampleFile, samplePosition);
      vi.advanceTimersByTime(200);
      hover = await promise;
    });

    expect(hover).toBeNull();
  });

  it('should debounce multiple hover requests', async () => {
    mockFetchSuccess(sampleHoverInfo);
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      // Fire first hover, but don't wait for debounce
      result.current.getHoverInfo(sampleFile, { line: 1, column: 1 });
      // Fire second hover before debounce expires
      const promise = result.current.getHoverInfo(sampleFile, { line: 2, column: 2 });
      vi.advanceTimersByTime(200);
      await promise;
    });

    // Only one fetch should have been made (the second one)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.line).toBe(2);
    expect(body.column).toBe(2);
  });

  it('should use custom hoverDebounce value', async () => {
    mockFetchSuccess(sampleHoverInfo);
    const { result } = renderHook(() => useLSP({ ...defaultOptions, hoverDebounce: 500 }));

    await act(async () => {
      const promise = result.current.getHoverInfo(sampleFile, samplePosition);
      vi.advanceTimersByTime(200);
      // Should not have fired yet at 200ms
      expect(global.fetch).not.toHaveBeenCalled();
      vi.advanceTimersByTime(300);
      await promise;
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// getCompletions
// ============================================================================

describe('useLSP getCompletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return completions on successful request', async () => {
    mockFetchSuccess({ items: [sampleCompletionItem] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let items: CompletionItem[] = [];
    await act(async () => {
      const promise = result.current.getCompletions(sampleFile, samplePosition);
      vi.advanceTimersByTime(100);
      items = await promise;
    });

    expect(items).toEqual([sampleCompletionItem]);
    expect(result.current.completions).toEqual([sampleCompletionItem]);
  });

  it('should return empty array when completions are disabled', async () => {
    const { result } = renderHook(() => useLSP({ ...defaultOptions, enableCompletions: false }));

    let items: CompletionItem[] = [];
    await act(async () => {
      items = await result.current.getCompletions(sampleFile, samplePosition);
    });

    expect(items).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should return empty array on failed request', async () => {
    mockFetchError(500, 'Server error');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let items: CompletionItem[] = [];
    await act(async () => {
      const promise = result.current.getCompletions(sampleFile, samplePosition);
      vi.advanceTimersByTime(100);
      items = await promise;
    });

    expect(items).toEqual([]);
  });

  it('should debounce completion requests with 100ms delay', async () => {
    mockFetchSuccess({ items: [sampleCompletionItem] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      result.current.getCompletions(sampleFile, { line: 1, column: 1 });
      const promise = result.current.getCompletions(sampleFile, { line: 1, column: 5 });
      vi.advanceTimersByTime(100);
      await promise;
    });

    // Only the last request should fire
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should send completions operation', async () => {
    mockFetchSuccess({ items: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      const promise = result.current.getCompletions(sampleFile, samplePosition);
      vi.advanceTimersByTime(100);
      await promise;
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.operation).toBe('completions');
  });
});

// ============================================================================
// getDocumentSymbols
// ============================================================================

describe('useLSP getDocumentSymbols', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return symbols on successful request', async () => {
    mockFetchSuccess({ symbols: [sampleSymbol] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let syms: DocumentSymbol[] = [];
    await act(async () => {
      syms = await result.current.getDocumentSymbols(sampleFile);
    });

    expect(syms).toEqual([sampleSymbol]);
    expect(result.current.symbols).toEqual([sampleSymbol]);
  });

  it('should return empty array on failure', async () => {
    mockFetchError(500, 'Server error');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let syms: DocumentSymbol[] = [];
    await act(async () => {
      syms = await result.current.getDocumentSymbols(sampleFile);
    });

    expect(syms).toEqual([]);
  });

  it('should set loading to false after request', async () => {
    mockFetchSuccess({ symbols: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.getDocumentSymbols(sampleFile);
    });

    expect(result.current.loading).toBe(false);
  });

  it('should send document_symbols operation', async () => {
    mockFetchSuccess({ symbols: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.getDocumentSymbols(sampleFile);
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.operation).toBe('document_symbols');
    expect(body.file).toBe(sampleFile);
  });
});

// ============================================================================
// renameSymbol
// ============================================================================

describe('useLSP renameSymbol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return changes on successful rename', async () => {
    const changes = [
      {
        file: sampleFile,
        edits: [{ line: 10, column: 5, endLine: 10, endColumn: 10, newText: 'newName' }],
      },
    ];
    mockFetchSuccess({ changes });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let result_changes: unknown[] = [];
    await act(async () => {
      result_changes = await result.current.renameSymbol(sampleFile, samplePosition, 'newName');
    });

    expect(result_changes).toEqual(changes);
  });

  it('should return empty array on failure', async () => {
    mockFetchError(400, 'Cannot rename');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let result_changes: unknown[] = [];
    await act(async () => {
      result_changes = await result.current.renameSymbol(sampleFile, samplePosition, 'newName');
    });

    expect(result_changes).toEqual([]);
  });

  it('should send rename operation with newName', async () => {
    mockFetchSuccess({ changes: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.renameSymbol(sampleFile, samplePosition, 'renamedVar');
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.operation).toBe('rename');
    expect(body.newName).toBe('renamedVar');
    expect(body.line).toBe(10);
    expect(body.column).toBe(5);
  });

  it('should set loading to false after rename', async () => {
    mockFetchSuccess({ changes: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.renameSymbol(sampleFile, samplePosition, 'x');
    });

    expect(result.current.loading).toBe(false);
  });
});

// ============================================================================
// initializeForFile
// ============================================================================

describe('useLSP initializeForFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should return true and update status on success', async () => {
    mockFetchSuccess({ initialized: true, language: 'typescript' });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let success = false;
    await act(async () => {
      success = await result.current.initializeForFile(sampleFile, 'const x = 1;');
    });

    expect(success).toBe(true);
    expect(result.current.status.connected).toBe(true);
    expect(result.current.status.language).toBe('typescript');
    expect(result.current.status.error).toBeNull();
  });

  it('should return false and set error on failure', async () => {
    mockFetchError(500, 'Init failed');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let success = false;
    await act(async () => {
      success = await result.current.initializeForFile(sampleFile, 'const x = 1;');
    });

    expect(success).toBe(false);
    expect(result.current.status.connected).toBe(false);
    expect(result.current.status.error).toBe('Init failed');
  });

  it('should set default error message when no error returned', async () => {
    mockFetchNetworkError('Connection refused');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let success = false;
    await act(async () => {
      success = await result.current.initializeForFile(sampleFile, '');
    });

    expect(success).toBe(false);
    expect(result.current.status.error).toBe('Connection refused');
  });

  it('should send initialize operation with file and content', async () => {
    mockFetchSuccess({ initialized: true, language: 'javascript' });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.initializeForFile('/workspace/app.js', 'console.log("hi")');
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.operation).toBe('initialize');
    expect(body.file).toBe('/workspace/app.js');
    expect(body.content).toBe('console.log("hi")');
  });

  it('should handle empty content', async () => {
    mockFetchSuccess({ initialized: true, language: 'typescript' });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let success = false;
    await act(async () => {
      success = await result.current.initializeForFile(sampleFile, '');
    });

    expect(success).toBe(true);
  });
});

// ============================================================================
// updateFileContent
// ============================================================================

describe('useLSP updateFileContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should send update_document operation', async () => {
    mockFetchSuccess({});
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.updateFileContent(sampleFile, 'new content');
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.operation).toBe('update_document');
    expect(body.file).toBe(sampleFile);
    expect(body.content).toBe('new content');
  });

  it('should handle empty content update', async () => {
    mockFetchSuccess({});
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.updateFileContent(sampleFile, '');
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// clearHover / clearCompletions
// ============================================================================

describe('useLSP clearHover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should clear hoverInfo state', async () => {
    mockFetchSuccess(sampleHoverInfo);
    const { result } = renderHook(() => useLSP(defaultOptions));

    // Set hover info first
    await act(async () => {
      const promise = result.current.getHoverInfo(sampleFile, samplePosition);
      vi.advanceTimersByTime(200);
      await promise;
    });
    expect(result.current.hoverInfo).not.toBeNull();

    // Clear it
    act(() => {
      result.current.clearHover();
    });
    expect(result.current.hoverInfo).toBeNull();
  });

  it('should cancel pending hover timeout', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    act(() => {
      // Start a hover request (will be pending due to debounce)
      result.current.getHoverInfo(sampleFile, samplePosition);
    });

    act(() => {
      result.current.clearHover();
    });

    // Advance timers — fetch should NOT fire since we cleared
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('useLSP clearCompletions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should clear completions state', async () => {
    mockFetchSuccess({ items: [sampleCompletionItem] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      const promise = result.current.getCompletions(sampleFile, samplePosition);
      vi.advanceTimersByTime(100);
      await promise;
    });
    expect(result.current.completions).toHaveLength(1);

    act(() => {
      result.current.clearCompletions();
    });
    expect(result.current.completions).toEqual([]);
  });

  it('should cancel pending completion timeout', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    act(() => {
      result.current.getCompletions(sampleFile, samplePosition);
    });

    act(() => {
      result.current.clearCompletions();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ============================================================================
// handleEditorClick
// ============================================================================

describe('useLSP handleEditorClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should trigger gotoDefinition on Cmd+Click', async () => {
    mockFetchSuccess({ definitions: [sampleLocation] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      metaKey: true,
      ctrlKey: false,
      preventDefault: vi.fn(),
      target: { selectionStart: 42 },
    } as unknown as React.MouseEvent;

    const getPosition = vi.fn().mockReturnValue({ line: 3, column: 7 });

    let handled = false;
    act(() => {
      handled = result.current.handleEditorClick(mockEvent, sampleFile, getPosition);
    });

    expect(handled).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(getPosition).toHaveBeenCalledWith(42);
  });

  it('should trigger gotoDefinition on Ctrl+Click', () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      metaKey: false,
      ctrlKey: true,
      preventDefault: vi.fn(),
      target: { selectionStart: 10 },
    } as unknown as React.MouseEvent;

    const getPosition = vi.fn().mockReturnValue({ line: 1, column: 1 });

    let handled = false;
    act(() => {
      handled = result.current.handleEditorClick(mockEvent, sampleFile, getPosition);
    });

    expect(handled).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should return false for normal click', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      metaKey: false,
      ctrlKey: false,
      preventDefault: vi.fn(),
      target: { selectionStart: 0 },
    } as unknown as React.MouseEvent;

    const getPosition = vi.fn();

    let handled = false;
    act(() => {
      handled = result.current.handleEditorClick(mockEvent, sampleFile, getPosition);
    });

    expect(handled).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    expect(getPosition).not.toHaveBeenCalled();
  });

  it('should return false if target lacks selectionStart', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      metaKey: true,
      ctrlKey: false,
      preventDefault: vi.fn(),
      target: {},
    } as unknown as React.MouseEvent;

    const getPosition = vi.fn();

    let handled = false;
    act(() => {
      handled = result.current.handleEditorClick(mockEvent, sampleFile, getPosition);
    });

    expect(handled).toBe(false);
  });
});

// ============================================================================
// handleEditorKeyDown
// ============================================================================

describe('useLSP handleEditorKeyDown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should handle F12 for go-to-definition', () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: 'F12',
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should handle Cmd+G for go-to-definition', () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: 'g',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should handle Ctrl+G for go-to-definition', () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: 'g',
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(true);
  });

  it('should handle F2 for rename', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: 'F2',
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should handle Ctrl+Space for completions', () => {
    mockFetchSuccess({ items: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: ' ',
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(true);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('should return false for unhandled key', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: 'a',
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(false);
    expect(mockEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('should return false for Ctrl+A (not a handled shortcut)', () => {
    const { result } = renderHook(() => useLSP(defaultOptions));

    const mockEvent = {
      key: 'a',
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    let handled = false;
    act(() => {
      handled = result.current.handleEditorKeyDown(mockEvent, sampleFile, samplePosition);
    });

    expect(handled).toBe(false);
  });
});

// ============================================================================
// CUSTOM API ENDPOINT & WORKSPACE ROOT
// ============================================================================

describe('useLSP custom options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should use custom apiEndpoint', async () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() =>
      useLSP({ ...defaultOptions, apiEndpoint: '/api/custom-lsp' })
    );

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/custom-lsp', expect.any(Object));
  });

  it('should use custom workspaceRoot', async () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() =>
      useLSP({ ...defaultOptions, workspaceRoot: '/home/user/project' })
    );

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.workspaceRoot).toBe('/home/user/project');
  });

  it('should default apiEndpoint to /api/code-lab/lsp', async () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/code-lab/lsp', expect.any(Object));
  });

  it('should default workspaceRoot to /workspace', async () => {
    mockFetchSuccess({ definitions: [] });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.workspaceRoot).toBe('/workspace');
  });
});

// ============================================================================
// ERROR HANDLING EDGE CASES
// ============================================================================

describe('useLSP error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should handle non-Error thrown from fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toEqual([]);
  });

  it('should handle HTTP error with missing message field', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toEqual([]);
  });

  it('should handle response with success but no result', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    const { result } = renderHook(() => useLSP(defaultOptions));

    let defs: Location[] = [];
    await act(async () => {
      defs = await result.current.gotoDefinition(sampleFile, samplePosition);
    });

    expect(defs).toEqual([]);
  });

  it('should set default error message on initializeForFile when result has no error', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: null }),
    });
    const { result } = renderHook(() => useLSP(defaultOptions));

    await act(async () => {
      await result.current.initializeForFile(sampleFile, '');
    });

    expect(result.current.status.error).toBe('Failed to initialize LSP');
  });
});

// ============================================================================
// UNMOUNT / CLEANUP
// ============================================================================

describe('useLSP cleanup on unmount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('should clean up hover timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useLSP(defaultOptions));

    act(() => {
      result.current.getHoverInfo(sampleFile, samplePosition);
    });

    unmount();

    // Advancing timers should not trigger fetch since timeouts were cleared
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should clean up completion timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useLSP(defaultOptions));

    act(() => {
      result.current.getCompletions(sampleFile, samplePosition);
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
