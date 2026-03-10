import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// HOISTED MOCKS — these must be declared with vi.hoisted so vi.mock factories
// (which are hoisted to the top of the file) can reference them.
// ============================================================================

const {
  mockCDPClient,
  mockDAPClient,
  mockUniversalDebugAdapter,
  mockGetSupportedLanguages,
  mockGetLanguageConfig,
  mockDetectLanguageFromFile,
  mockGetLanguageDisplayNames,
  mockGetLanguageCapabilitiesSummary,
  mockLANGUAGE_CONFIGS,
  mockSpawn,
} = vi.hoisted(() => {
  const mockSpawn = vi.fn(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  }));
  const mockCDPClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    resume: vi.fn(),
    stepOver: vi.fn(),
    stepInto: vi.fn(),
    stepOut: vi.fn(),
    pause: vi.fn(),
    setBreakpointByUrl: vi.fn(),
    removeBreakpoint: vi.fn(),
    getProperties: vi.fn(),
    getScript: vi.fn(),
    evaluate: vi.fn(),
    evaluateOnCallFrame: vi.fn(),
    emit: vi.fn(),
  };

  const mockDAPClient = {
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    launch: vi.fn(),
    attach: vi.fn(),
    resume: vi.fn(),
    continue: vi.fn(),
    next: vi.fn(),
    stepIn: vi.fn(),
    stepOut: vi.fn(),
    pause: vi.fn(),
    setBreakpoints: vi.fn(),
    threads: vi.fn(),
    stackTrace: vi.fn(),
    scopes: vi.fn(),
    variables: vi.fn(),
    evaluate: vi.fn(),
    emit: vi.fn(),
  };

  const mockUniversalDebugAdapter = vi.fn();
  const mockGetSupportedLanguages = vi.fn(() => ['node', 'python', 'go']);
  const mockGetLanguageConfig = vi.fn();
  const mockDetectLanguageFromFile = vi.fn();
  const mockGetLanguageDisplayNames = vi.fn(() => ({
    node: 'Node.js',
    python: 'Python',
  }));
  const mockGetLanguageCapabilitiesSummary = vi.fn(() => []);
  const mockLANGUAGE_CONFIGS = {
    node: { language: 'node', name: 'Node.js' },
    python: { language: 'python', name: 'Python' },
  };

  return {
    mockCDPClient,
    mockDAPClient,
    mockUniversalDebugAdapter,
    mockGetSupportedLanguages,
    mockGetLanguageConfig,
    mockDetectLanguageFromFile,
    mockGetLanguageDisplayNames,
    mockGetLanguageCapabilitiesSummary,
    mockLANGUAGE_CONFIGS,
    mockSpawn,
  };
});

// ============================================================================
// MODULE MOCKS
// ============================================================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    spawn: mockSpawn,
  };
});

vi.mock('./cdp-client', () => ({
  CDPClient: vi.fn(() => mockCDPClient),
}));

vi.mock('./dap-client', () => ({
  DAPClient: vi.fn(() => mockDAPClient),
}));

vi.mock('./multi-language-adapters', () => ({
  UniversalDebugAdapter: mockUniversalDebugAdapter,
  getSupportedLanguages: mockGetSupportedLanguages,
  getLanguageConfig: mockGetLanguageConfig,
  detectLanguageFromFile: mockDetectLanguageFromFile,
  getLanguageDisplayNames: mockGetLanguageDisplayNames,
  getLanguageCapabilitiesSummary: mockGetLanguageCapabilitiesSummary,
  LANGUAGE_CONFIGS: mockLANGUAGE_CONFIGS,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import {
  NodeDebugAdapter,
  PythonDebugAdapter,
  createDebugAdapter,
  createUniversalDebugAdapter,
  getAllSupportedLanguages,
  createDebugAdapterForFile,
  getSupportedLanguages,
  getLanguageConfig,
  detectLanguageFromFile,
  getLanguageDisplayNames,
  getLanguageCapabilitiesSummary,
  LANGUAGE_CONFIGS,
} from './debug-adapter';

import type {
  DebugConfiguration,
  Breakpoint,
  Source,
  StackFrame,
  Scope,
  Variable,
  Thread,
  DebugState,
  DebugSession,
  DebugEvents,
  DebugLanguage,
} from './debug-adapter';

// ============================================================================
// TYPE EXPORT TESTS
// ============================================================================

describe('Type exports', () => {
  it('should export DebugConfiguration type', () => {
    const config: DebugConfiguration = {
      type: 'node',
      name: 'test',
      request: 'launch',
      program: '/test.js',
    };
    expect(config.type).toBe('node');
    expect(config.request).toBe('launch');
  });

  it('should export Breakpoint type', () => {
    const bp: Breakpoint = {
      id: 1,
      verified: true,
      line: 10,
      source: { path: '/test.js' },
    };
    expect(bp.id).toBe(1);
    expect(bp.verified).toBe(true);
  });

  it('should export Source type', () => {
    const src: Source = {
      name: 'test.js',
      path: '/test.js',
      sourceReference: 0,
    };
    expect(src.name).toBe('test.js');
  });

  it('should export StackFrame type', () => {
    const frame: StackFrame = {
      id: 1,
      name: 'main',
      line: 5,
      column: 1,
    };
    expect(frame.id).toBe(1);
  });

  it('should export Scope type', () => {
    const scope: Scope = {
      name: 'Local',
      variablesReference: 1,
      expensive: false,
    };
    expect(scope.name).toBe('Local');
  });

  it('should export Variable type', () => {
    const variable: Variable = {
      name: 'x',
      value: '42',
      variablesReference: 0,
    };
    expect(variable.value).toBe('42');
  });

  it('should export Thread type', () => {
    const thread: Thread = { id: 1, name: 'Main Thread' };
    expect(thread.id).toBe(1);
  });

  it('should export DebugState type', () => {
    const state: DebugState = 'idle';
    expect(state).toBe('idle');
    const running: DebugState = 'running';
    expect(running).toBe('running');
    const paused: DebugState = 'paused';
    expect(paused).toBe('paused');
    const stopped: DebugState = 'stopped';
    expect(stopped).toBe('stopped');
  });

  it('should export DebugSession type', () => {
    const session: DebugSession = {
      id: 'test-1',
      configuration: { type: 'node', name: 'test', request: 'launch' },
      state: 'idle',
      threads: [],
      breakpoints: new Map(),
    };
    expect(session.id).toBe('test-1');
  });

  it('should export DebugEvents interface (compile-time check)', () => {
    const events: Partial<DebugEvents> = {
      stopped: { reason: 'breakpoint' },
    };
    expect(events.stopped?.reason).toBe('breakpoint');
  });

  it('should export DebugLanguage type', () => {
    const lang: DebugLanguage = 'node';
    expect(lang).toBe('node');
  });
});

// ============================================================================
// NodeDebugAdapter
// ============================================================================

describe('NodeDebugAdapter', () => {
  let adapter: NodeDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NodeDebugAdapter();
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  describe('getSession / getState before launch', () => {
    it('should return null session initially', () => {
      expect(adapter.getSession()).toBeNull();
    });

    it('should return idle state when no session', () => {
      expect(adapter.getState()).toBe('idle');
    });
  });

  describe('launch', () => {
    it('should throw if no program is provided', async () => {
      const config: DebugConfiguration = {
        type: 'node',
        name: 'test',
        request: 'launch',
      };
      await expect(adapter.launch(config)).rejects.toThrow(
        'Program path required for Node.js debugging'
      );
    });

    it('should create a session on launch', async () => {
      const config: DebugConfiguration = {
        type: 'node',
        name: 'test',
        request: 'launch',
        program: '/test.js',
        port: 9300,
        host: '0.0.0.0',
      };

      await adapter.launch(config);

      const session = adapter.getSession();
      expect(session).not.toBeNull();
      expect(session!.configuration).toEqual(config);
      expect(session!.state).toBe('running');
      expect(session!.threads).toEqual([{ id: 1, name: 'Main Thread' }]);
    });

    it('should use default port and host if not specified', async () => {
      const config: DebugConfiguration = {
        type: 'node',
        name: 'test',
        request: 'launch',
        program: '/test.js',
      };

      await adapter.launch(config);

      const session = adapter.getSession();
      expect(session).not.toBeNull();
    });

    it('should set session with custom args, cwd, and env', async () => {
      const config: DebugConfiguration = {
        type: 'node',
        name: 'test',
        request: 'launch',
        program: '/test.js',
        args: ['--flag', 'value'],
        cwd: '/some/dir',
        env: { FOO: 'bar' },
      };

      await adapter.launch(config);

      const session = adapter.getSession();
      expect(session).not.toBeNull();
      expect(session!.configuration.args).toEqual(['--flag', 'value']);
      expect(session!.configuration.cwd).toBe('/some/dir');
      expect(session!.configuration.env).toEqual({ FOO: 'bar' });
    });
  });

  describe('disconnect', () => {
    it('should disconnect without error even when not connected', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });

    it('should clean up session on disconnect after launch', async () => {
      const config: DebugConfiguration = {
        type: 'node',
        name: 'test',
        request: 'launch',
        program: '/test.js',
      };

      await adapter.launch(config);
      expect(adapter.getSession()).not.toBeNull();

      await adapter.disconnect();
      expect(adapter.getSession()).toBeNull();
    });
  });

  describe('continue', () => {
    it('should throw if not connected (no CDP)', async () => {
      await expect(adapter.continue(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('stepOver', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.stepOver(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('stepInto', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.stepInto(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('stepOut', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.stepOut(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('pause', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.pause(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('getThreads', () => {
    it('should always return single main thread', async () => {
      const threads = await adapter.getThreads();
      expect(threads).toEqual([{ id: 1, name: 'Main Thread' }]);
    });
  });

  describe('getStackTrace', () => {
    it('should return empty array when no CDP and no call frames', async () => {
      const frames = await adapter.getStackTrace(1);
      expect(frames).toEqual([]);
    });
  });

  describe('getScopes', () => {
    it('should return empty array when no CDP connection', async () => {
      const scopes = await adapter.getScopes(1);
      expect(scopes).toEqual([]);
    });
  });

  describe('getVariables', () => {
    it('should return empty array when no CDP connection', async () => {
      const vars = await adapter.getVariables(1);
      expect(vars).toEqual([]);
    });
  });

  describe('evaluate', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.evaluate('1+1')).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('setBreakpoints', () => {
    it('should return empty array when no session', async () => {
      const result = await adapter.setBreakpoints({ path: '/test.js' }, [{ line: 5 }]);
      expect(result).toEqual([]);
    });

    it('should return empty array when no source path', async () => {
      await adapter.launch({
        type: 'node',
        name: 'test',
        request: 'launch',
        program: '/test.js',
      });

      const result = await adapter.setBreakpoints({}, [{ line: 5 }]);
      expect(result).toEqual([]);
    });
  });

  describe('event emitter', () => {
    it('should support on/emit pattern', () => {
      const handler = vi.fn();
      adapter.on('stopped', handler);
      adapter.emit('stopped', { reason: 'breakpoint', threadId: 1 });
      expect(handler).toHaveBeenCalledWith({ reason: 'breakpoint', threadId: 1 });
    });
  });
});

// ============================================================================
// PythonDebugAdapter
// ============================================================================

describe('PythonDebugAdapter', () => {
  let adapter: PythonDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PythonDebugAdapter();
  });

  describe('initialize', () => {
    it('should initialize without error', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
    });
  });

  describe('getSession / getState before launch', () => {
    it('should return null session initially', () => {
      expect(adapter.getSession()).toBeNull();
    });

    it('should return idle state when no session', () => {
      expect(adapter.getState()).toBe('idle');
    });
  });

  describe('launch', () => {
    it('should throw if no program is provided', async () => {
      const config: DebugConfiguration = {
        type: 'python',
        name: 'test',
        request: 'launch',
      };
      await expect(adapter.launch(config)).rejects.toThrow(
        'Program path required for Python debugging'
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect without error even when not connected', async () => {
      await expect(adapter.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('continue', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.continue(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('stepOver', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.stepOver(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('stepInto', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.stepInto(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('stepOut', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.stepOut(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('pause', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.pause(1)).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('getThreads', () => {
    it('should return fallback MainThread when no DAP', async () => {
      const threads = await adapter.getThreads();
      expect(threads).toEqual([{ id: 1, name: 'MainThread' }]);
    });
  });

  describe('getStackTrace', () => {
    it('should return empty array when no DAP', async () => {
      const frames = await adapter.getStackTrace(1);
      expect(frames).toEqual([]);
    });
  });

  describe('getScopes', () => {
    it('should return empty array when no DAP', async () => {
      const scopes = await adapter.getScopes(1);
      expect(scopes).toEqual([]);
    });
  });

  describe('getVariables', () => {
    it('should return empty array when no DAP', async () => {
      const vars = await adapter.getVariables(1);
      expect(vars).toEqual([]);
    });
  });

  describe('evaluate', () => {
    it('should throw if not connected', async () => {
      await expect(adapter.evaluate('x')).rejects.toThrow('Not connected to debugger');
    });
  });

  describe('setBreakpoints', () => {
    it('should return empty array when no session', async () => {
      const result = await adapter.setBreakpoints({ path: '/test.py' }, [{ line: 5 }]);
      expect(result).toEqual([]);
    });
  });

  describe('event emitter', () => {
    it('should support on/emit pattern', () => {
      const handler = vi.fn();
      adapter.on('terminated', handler);
      adapter.emit('terminated');
      expect(handler).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// createDebugAdapter (legacy factory)
// ============================================================================

describe('createDebugAdapter', () => {
  it('should create a NodeDebugAdapter for "node"', () => {
    const adapter = createDebugAdapter('node');
    expect(adapter).toBeInstanceOf(NodeDebugAdapter);
  });

  it('should create a PythonDebugAdapter for "python"', () => {
    const adapter = createDebugAdapter('python');
    expect(adapter).toBeInstanceOf(PythonDebugAdapter);
  });

  it('should throw for unsupported languages', () => {
    expect(() => createDebugAdapter('go')).toThrow(
      "Local debugging for 'go' is not supported. Use container debugging for this language."
    );
  });

  it('should throw for arbitrary language strings', () => {
    expect(() => createDebugAdapter('rust')).toThrow("Local debugging for 'rust' is not supported");
  });
});

// ============================================================================
// createUniversalDebugAdapter
// ============================================================================

describe('createUniversalDebugAdapter', () => {
  it('should call UniversalDebugAdapter constructor', () => {
    mockUniversalDebugAdapter.mockClear();
    createUniversalDebugAdapter('go');
    expect(mockUniversalDebugAdapter).toHaveBeenCalledWith('go');
  });

  it('should return an instance', () => {
    const result = createUniversalDebugAdapter('python');
    expect(result).toBeDefined();
  });
});

// ============================================================================
// getAllSupportedLanguages
// ============================================================================

describe('getAllSupportedLanguages', () => {
  it('should delegate to getSupportedLanguages', () => {
    const result = getAllSupportedLanguages();
    expect(mockGetSupportedLanguages).toHaveBeenCalled();
    expect(result).toEqual(['node', 'python', 'go']);
  });
});

// ============================================================================
// createDebugAdapterForFile
// ============================================================================

describe('createDebugAdapterForFile', () => {
  it('should return null when language is not detected', () => {
    mockDetectLanguageFromFile.mockReturnValueOnce(undefined);
    const result = createDebugAdapterForFile('/unknown.xyz');
    expect(result).toBeNull();
  });

  it('should create an adapter when language is detected', () => {
    mockDetectLanguageFromFile.mockReturnValueOnce('python');
    mockUniversalDebugAdapter.mockClear();
    const result = createDebugAdapterForFile('/test.py');
    expect(result).toBeDefined();
    expect(mockUniversalDebugAdapter).toHaveBeenCalledWith('python');
  });
});

// ============================================================================
// Re-exported utilities
// ============================================================================

describe('Re-exported multi-language utilities', () => {
  it('should re-export getSupportedLanguages', () => {
    expect(typeof getSupportedLanguages).toBe('function');
    getSupportedLanguages();
    expect(mockGetSupportedLanguages).toHaveBeenCalled();
  });

  it('should re-export getLanguageConfig', () => {
    expect(typeof getLanguageConfig).toBe('function');
    getLanguageConfig('node');
    expect(mockGetLanguageConfig).toHaveBeenCalledWith('node');
  });

  it('should re-export detectLanguageFromFile', () => {
    expect(typeof detectLanguageFromFile).toBe('function');
    detectLanguageFromFile('/foo.py');
    expect(mockDetectLanguageFromFile).toHaveBeenCalledWith('/foo.py');
  });

  it('should re-export getLanguageDisplayNames', () => {
    expect(typeof getLanguageDisplayNames).toBe('function');
    const names = getLanguageDisplayNames();
    expect(names).toEqual({ node: 'Node.js', python: 'Python' });
  });

  it('should re-export getLanguageCapabilitiesSummary', () => {
    expect(typeof getLanguageCapabilitiesSummary).toBe('function');
    const summary = getLanguageCapabilitiesSummary();
    expect(Array.isArray(summary)).toBe(true);
  });

  it('should re-export LANGUAGE_CONFIGS', () => {
    expect(LANGUAGE_CONFIGS).toBeDefined();
    expect(LANGUAGE_CONFIGS.node).toEqual({ language: 'node', name: 'Node.js' });
  });
});
