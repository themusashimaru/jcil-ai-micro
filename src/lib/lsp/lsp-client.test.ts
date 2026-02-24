import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock child_process to prevent actual process spawning
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const { EventEmitter } = await import('events');
  return {
    ...actual,
    spawn: vi.fn(() => {
      const proc = new EventEmitter();
      (proc as Record<string, unknown>).stdin = { writable: true, write: vi.fn(), end: vi.fn() };
      (proc as Record<string, unknown>).stdout = new EventEmitter();
      (proc as Record<string, unknown>).stderr = new EventEmitter();
      (proc as Record<string, unknown>).kill = vi.fn();
      (proc as Record<string, unknown>).pid = 99999;
      return proc;
    }),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  LSPClient,
  LSPManager,
  getLSPManager,
  type Position,
  type Range,
  type Location,
  type TextDocumentIdentifier,
  type TextDocumentPositionParams,
  type TextDocumentItem,
  type VersionedTextDocumentIdentifier,
  type TextDocumentContentChangeEvent,
  type Diagnostic,
  type DiagnosticRelatedInformation,
  DiagnosticSeverity,
  type CompletionItem,
  CompletionItemKind,
  type MarkupContent,
  type Hover,
  type TextEdit,
  type WorkspaceEdit,
  type SignatureHelp,
  type SignatureInformation,
  type ParameterInformation,
  type LanguageServerType,
} from './lsp-client';

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TYPE EXPORT VALIDATION
// ============================================================================

describe('LSP Client type exports', () => {
  it('should export Position interface', () => {
    const pos: Position = { line: 10, character: 5 };
    expect(pos.line).toBe(10);
    expect(pos.character).toBe(5);
  });

  it('should export Range interface', () => {
    const range: Range = {
      start: { line: 0, character: 0 },
      end: { line: 10, character: 20 },
    };
    expect(range.start.line).toBe(0);
    expect(range.end.character).toBe(20);
  });

  it('should export Location interface', () => {
    const loc: Location = {
      uri: 'file:///test.ts',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
    };
    expect(loc.uri).toBe('file:///test.ts');
  });

  it('should export TextDocumentIdentifier interface', () => {
    const id: TextDocumentIdentifier = { uri: 'file:///foo.ts' };
    expect(id.uri).toBe('file:///foo.ts');
  });

  it('should export TextDocumentPositionParams interface', () => {
    const params: TextDocumentPositionParams = {
      textDocument: { uri: 'file:///foo.ts' },
      position: { line: 5, character: 3 },
    };
    expect(params.position.line).toBe(5);
  });

  it('should export TextDocumentItem interface', () => {
    const doc: TextDocumentItem = {
      uri: 'file:///test.ts',
      languageId: 'typescript',
      version: 1,
      text: 'const x = 1;',
    };
    expect(doc.languageId).toBe('typescript');
    expect(doc.version).toBe(1);
  });

  it('should export VersionedTextDocumentIdentifier interface', () => {
    const vdoc: VersionedTextDocumentIdentifier = {
      uri: 'file:///test.ts',
      version: 3,
    };
    expect(vdoc.version).toBe(3);
  });

  it('should export TextDocumentContentChangeEvent interface', () => {
    const change: TextDocumentContentChangeEvent = {
      text: 'new content',
    };
    expect(change.text).toBe('new content');
  });

  it('should export Diagnostic interface', () => {
    const diag: Diagnostic = {
      range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } },
      message: 'Type error',
      severity: DiagnosticSeverity.Error,
    };
    expect(diag.message).toBe('Type error');
    expect(diag.severity).toBe(1);
  });

  it('should export DiagnosticRelatedInformation interface', () => {
    const info: DiagnosticRelatedInformation = {
      location: {
        uri: 'file:///related.ts',
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
      },
      message: 'Related info here',
    };
    expect(info.message).toBe('Related info here');
  });

  it('should export DiagnosticSeverity enum values', () => {
    expect(DiagnosticSeverity.Error).toBe(1);
    expect(DiagnosticSeverity.Warning).toBe(2);
    expect(DiagnosticSeverity.Information).toBe(3);
    expect(DiagnosticSeverity.Hint).toBe(4);
  });

  it('should export CompletionItem interface', () => {
    const item: CompletionItem = {
      label: 'myFunction',
      kind: CompletionItemKind.Function,
      detail: 'A helper function',
    };
    expect(item.label).toBe('myFunction');
    expect(item.kind).toBe(CompletionItemKind.Function);
  });

  it('should export CompletionItemKind enum values', () => {
    expect(CompletionItemKind.Text).toBe(1);
    expect(CompletionItemKind.Method).toBe(2);
    expect(CompletionItemKind.Function).toBe(3);
    expect(CompletionItemKind.Constructor).toBe(4);
    expect(CompletionItemKind.Field).toBe(5);
    expect(CompletionItemKind.Variable).toBe(6);
    expect(CompletionItemKind.Class).toBe(7);
    expect(CompletionItemKind.Interface).toBe(8);
    expect(CompletionItemKind.Module).toBe(9);
  });

  it('should export MarkupContent interface', () => {
    const content: MarkupContent = {
      kind: 'markdown',
      value: '**bold**',
    };
    expect(content.kind).toBe('markdown');
  });

  it('should export Hover interface', () => {
    const hover: Hover = {
      contents: { kind: 'plaintext', value: 'number' },
    };
    expect(hover.contents).toBeDefined();
  });

  it('should export TextEdit interface', () => {
    const edit: TextEdit = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
      newText: 'const',
    };
    expect(edit.newText).toBe('const');
  });

  it('should export WorkspaceEdit interface', () => {
    const edit: WorkspaceEdit = {
      changes: {
        'file:///test.ts': [
          {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
            newText: 'let',
          },
        ],
      },
    };
    expect(Object.keys(edit.changes!)).toHaveLength(1);
  });

  it('should export SignatureHelp interface', () => {
    const help: SignatureHelp = {
      signatures: [{ label: 'fn(a: string): void' }],
      activeSignature: 0,
      activeParameter: 0,
    };
    expect(help.signatures).toHaveLength(1);
  });

  it('should export SignatureInformation interface', () => {
    const sig: SignatureInformation = {
      label: 'fn(a: string, b: number)',
      documentation: 'A function',
      parameters: [{ label: 'a', documentation: 'First param' }],
    };
    expect(sig.parameters).toHaveLength(1);
  });

  it('should export ParameterInformation interface', () => {
    const param: ParameterInformation = {
      label: 'count',
      documentation: 'Number of items',
    };
    expect(param.label).toBe('count');
  });

  it('should export LanguageServerType', () => {
    const ts: LanguageServerType = 'typescript';
    const py: LanguageServerType = 'python';
    const go: LanguageServerType = 'go';
    expect(ts).toBe('typescript');
    expect(py).toBe('python');
    expect(go).toBe('go');
  });
});

// ============================================================================
// LSPClient CLASS
// ============================================================================

describe('LSPClient', () => {
  describe('constructor', () => {
    it('should create an instance with typescript', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(client).toBeInstanceOf(LSPClient);
    });

    it('should create an instance with python', () => {
      const client = new LSPClient('python', '/workspace');
      expect(client).toBeInstanceOf(LSPClient);
    });

    it('should create an instance with go', () => {
      const client = new LSPClient('go', '/workspace');
      expect(client).toBeInstanceOf(LSPClient);
    });

    it('should be an EventEmitter', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.on).toBe('function');
      expect(typeof client.emit).toBe('function');
      expect(typeof client.removeListener).toBe('function');
    });
  });

  describe('methods', () => {
    it('should have start method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.start).toBe('function');
    });

    it('should have stop method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.stop).toBe('function');
    });

    it('should have restart method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.restart).toBe('function');
    });

    it('should have healthCheck method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.healthCheck).toBe('function');
    });

    it('should have gotoDefinition method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.gotoDefinition).toBe('function');
    });

    it('should have findReferences method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.findReferences).toBe('function');
    });

    it('should have hover method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.hover).toBe('function');
    });

    it('should have completion method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.completion).toBe('function');
    });

    it('should have openDocument method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.openDocument).toBe('function');
    });

    it('should have closeDocument method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.closeDocument).toBe('function');
    });

    it('should have signatureHelp method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.signatureHelp).toBe('function');
    });

    it('should have formatDocument method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.formatDocument).toBe('function');
    });

    it('should have rename method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.rename).toBe('function');
    });

    it('should have documentSymbols method', () => {
      const client = new LSPClient('typescript', '/workspace');
      expect(typeof client.documentSymbols).toBe('function');
    });
  });
});

// ============================================================================
// LSPManager CLASS
// ============================================================================

describe('LSPManager', () => {
  let manager: LSPManager;

  afterEach(() => {
    if (manager) {
      manager.stopHealthMonitor();
    }
  });

  it('should create an instance', () => {
    manager = new LSPManager('/workspace');
    expect(manager).toBeInstanceOf(LSPManager);
  });

  it('should have getClient method', () => {
    manager = new LSPManager('/workspace');
    expect(typeof manager.getClient).toBe('function');
  });

  it('should have getClientForFile method', () => {
    manager = new LSPManager('/workspace');
    expect(typeof manager.getClientForFile).toBe('function');
  });

  it('should have stopAll method', () => {
    manager = new LSPManager('/workspace');
    expect(typeof manager.stopAll).toBe('function');
  });

  it('should have stopHealthMonitor method', () => {
    manager = new LSPManager('/workspace');
    expect(typeof manager.stopHealthMonitor).toBe('function');
  });

  it('should have getHealthStatus method', () => {
    manager = new LSPManager('/workspace');
    expect(typeof manager.getHealthStatus).toBe('function');
  });

  it('should have restartServer method', () => {
    manager = new LSPManager('/workspace');
    expect(typeof manager.restartServer).toBe('function');
  });
});

// ============================================================================
// getLSPManager SINGLETON
// ============================================================================

describe('getLSPManager', () => {
  it('should return an LSPManager', () => {
    const mgr = getLSPManager('/workspace');
    expect(mgr).toBeInstanceOf(LSPManager);
    mgr.stopHealthMonitor();
  });

  it('should return same instance for same root', () => {
    const mgr1 = getLSPManager('/workspace');
    const mgr2 = getLSPManager('/workspace');
    expect(mgr1).toBe(mgr2);
    mgr1.stopHealthMonitor();
  });
});
