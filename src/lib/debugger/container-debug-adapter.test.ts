import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// HOISTED MOCKS — declared with vi.hoisted so vi.mock factories can reference them
// ============================================================================

const { mockCDPClient, mockDAPClient, mockGetContainerManager, mockLANGUAGE_CONFIGS } = vi.hoisted(
  () => {
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

    const mockContainerManager = {
      getSandbox: vi.fn(),
    };

    const mockGetContainerManager = vi.fn(() => mockContainerManager);

    const mockLANGUAGE_CONFIGS: Record<
      string,
      {
        language: string;
        name: string;
        protocol: string;
        defaultPort: number;
        fileExtensions: string[];
        installCommand?: string;
        debugCommand: (c: Record<string, unknown>) => string;
        requiresCompilation?: boolean;
        compileCommand?: (c: Record<string, unknown>) => string;
        supportsBreakpoints: boolean;
        supportsConditionalBreakpoints: boolean;
        supportsLogPoints: boolean;
        supportsHitCount: boolean;
        supportsDataBreakpoints: boolean;
        supportsExceptionBreakpoints: boolean;
        supportsStepBack: boolean;
        supportsRestartFrame: boolean;
        supportsGotoTargets: boolean;
        supportsCompletionsRequest: boolean;
        supportsModulesRequest: boolean;
        supportsLoadedSourcesRequest: boolean;
        supportsTerminateRequest: boolean;
        supportsSuspendDebuggee: boolean;
        supportsValueFormattingOptions: boolean;
        supportsFunctionBreakpoints: boolean;
      }
    > = {
      node: {
        language: 'node',
        name: 'Node.js',
        protocol: 'cdp',
        defaultPort: 9229,
        fileExtensions: ['.js', '.ts'],
        debugCommand: (c) => `node --inspect-brk=0.0.0.0:${c.port || 9229} ${c.program}`,
        supportsBreakpoints: true,
        supportsConditionalBreakpoints: true,
        supportsLogPoints: true,
        supportsHitCount: true,
        supportsDataBreakpoints: false,
        supportsExceptionBreakpoints: true,
        supportsStepBack: false,
        supportsRestartFrame: true,
        supportsGotoTargets: false,
        supportsCompletionsRequest: true,
        supportsModulesRequest: true,
        supportsLoadedSourcesRequest: true,
        supportsTerminateRequest: true,
        supportsSuspendDebuggee: true,
        supportsValueFormattingOptions: true,
        supportsFunctionBreakpoints: true,
      },
      python: {
        language: 'python',
        name: 'Python',
        protocol: 'dap',
        defaultPort: 5678,
        fileExtensions: ['.py'],
        installCommand: 'pip install debugpy',
        debugCommand: (c) => `python3 -m debugpy --listen 0.0.0.0:${c.port || 5678} ${c.program}`,
        supportsBreakpoints: true,
        supportsConditionalBreakpoints: true,
        supportsLogPoints: true,
        supportsHitCount: true,
        supportsDataBreakpoints: false,
        supportsExceptionBreakpoints: true,
        supportsStepBack: false,
        supportsRestartFrame: false,
        supportsGotoTargets: false,
        supportsCompletionsRequest: true,
        supportsModulesRequest: true,
        supportsLoadedSourcesRequest: true,
        supportsTerminateRequest: true,
        supportsSuspendDebuggee: true,
        supportsValueFormattingOptions: true,
        supportsFunctionBreakpoints: true,
      },
      go: {
        language: 'go',
        name: 'Go',
        protocol: 'dap',
        defaultPort: 2345,
        fileExtensions: ['.go'],
        debugCommand: (c) => `dlv dap --listen=:${c.port || 2345}`,
        supportsBreakpoints: true,
        supportsConditionalBreakpoints: true,
        supportsLogPoints: false,
        supportsHitCount: true,
        supportsDataBreakpoints: false,
        supportsExceptionBreakpoints: false,
        supportsStepBack: false,
        supportsRestartFrame: false,
        supportsGotoTargets: false,
        supportsCompletionsRequest: false,
        supportsModulesRequest: false,
        supportsLoadedSourcesRequest: false,
        supportsTerminateRequest: true,
        supportsSuspendDebuggee: false,
        supportsValueFormattingOptions: false,
        supportsFunctionBreakpoints: false,
      },
    };

    return {
      mockCDPClient,
      mockDAPClient,
      mockGetContainerManager,
      mockContainerManager,
      mockLANGUAGE_CONFIGS,
    };
  }
);

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

vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: vi.fn(),
}));

vi.mock('@/lib/workspace/container', () => ({
  ContainerManager: vi.fn(),
  getContainerManager: mockGetContainerManager,
}));

vi.mock('./cdp-client', () => ({
  CDPClient: vi.fn(() => mockCDPClient),
}));

vi.mock('./dap-client', () => ({
  DAPClient: vi.fn(() => mockDAPClient),
  DAPSource: vi.fn(),
}));

vi.mock('./multi-language-adapters', () => ({
  LANGUAGE_CONFIGS: mockLANGUAGE_CONFIGS,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { ContainerDebugAdapter, getContainerDebugAdapter } from './container-debug-adapter';

import type {
  ContainerDebugConfig,
  ContainerDebugSession,
  Breakpoint,
  StackFrame,
  Scope,
  Variable,
  Thread,
} from './container-debug-adapter';

// ============================================================================
// TYPE EXPORT TESTS
// ============================================================================

describe('Type exports', () => {
  it('should export ContainerDebugConfig type', () => {
    const config: ContainerDebugConfig = {
      type: 'node',
      program: '/test.js',
    };
    expect(config.type).toBe('node');
    expect(config.program).toBe('/test.js');
  });

  it('should export ContainerDebugConfig with optional fields', () => {
    const config: ContainerDebugConfig = {
      type: 'python',
      program: '/test.py',
      args: ['--verbose'],
      cwd: '/workspace',
      env: { DEBUG: '1' },
      stopOnEntry: true,
    };
    expect(config.args).toEqual(['--verbose']);
    expect(config.cwd).toBe('/workspace');
    expect(config.env).toEqual({ DEBUG: '1' });
    expect(config.stopOnEntry).toBe(true);
  });

  it('should export ContainerDebugSession type', () => {
    const session: ContainerDebugSession = {
      id: 'session-1',
      workspaceId: 'ws-1',
      config: { type: 'node', program: '/test.js' },
      state: 'starting',
      debugPort: 9229,
    };
    expect(session.id).toBe('session-1');
    expect(session.state).toBe('starting');
  });

  it('should export ContainerDebugSession with optional fields', () => {
    const session: ContainerDebugSession = {
      id: 'session-2',
      workspaceId: 'ws-2',
      config: { type: 'python', program: '/test.py' },
      state: 'running',
      debugPort: 5678,
      debugUrl: 'tcp://localhost:5678',
      pid: 12345,
    };
    expect(session.debugUrl).toBe('tcp://localhost:5678');
    expect(session.pid).toBe(12345);
  });

  it('should allow all valid ContainerDebugSession states', () => {
    const states: ContainerDebugSession['state'][] = [
      'starting',
      'running',
      'paused',
      'stopped',
      'error',
    ];
    expect(states).toHaveLength(5);
    states.forEach((s) => expect(typeof s).toBe('string'));
  });

  it('should export Breakpoint type', () => {
    const bp: Breakpoint = {
      id: 1,
      verified: true,
      line: 10,
      source: { path: '/test.js', name: 'test.js' },
    };
    expect(bp.id).toBe(1);
    expect(bp.verified).toBe(true);
    expect(bp.line).toBe(10);
  });

  it('should export Breakpoint type with optional fields', () => {
    const bp: Breakpoint = {
      id: 2,
      verified: false,
      line: 20,
      column: 5,
      source: { path: '/test.py' },
      message: 'Could not verify breakpoint',
    };
    expect(bp.column).toBe(5);
    expect(bp.message).toBe('Could not verify breakpoint');
  });

  it('should export StackFrame type', () => {
    const frame: StackFrame = {
      id: 1,
      name: 'main',
      line: 5,
      column: 1,
    };
    expect(frame.id).toBe(1);
    expect(frame.name).toBe('main');
  });

  it('should export StackFrame type with optional fields', () => {
    const frame: StackFrame = {
      id: 2,
      name: 'handler',
      source: { path: '/src/handler.ts', name: 'handler.ts' },
      line: 15,
      column: 3,
      endLine: 20,
      endColumn: 1,
    };
    expect(frame.source?.path).toBe('/src/handler.ts');
    expect(frame.endLine).toBe(20);
    expect(frame.endColumn).toBe(1);
  });

  it('should export Scope type', () => {
    const scope: Scope = {
      name: 'Local',
      variablesReference: 1,
      expensive: false,
    };
    expect(scope.name).toBe('Local');
    expect(scope.expensive).toBe(false);
  });

  it('should export Scope type with optional fields', () => {
    const scope: Scope = {
      name: 'Global',
      variablesReference: 2,
      namedVariables: 50,
      indexedVariables: 10,
      expensive: true,
    };
    expect(scope.namedVariables).toBe(50);
    expect(scope.indexedVariables).toBe(10);
  });

  it('should export Variable type', () => {
    const variable: Variable = {
      name: 'x',
      value: '42',
      variablesReference: 0,
    };
    expect(variable.name).toBe('x');
    expect(variable.value).toBe('42');
  });

  it('should export Variable type with optional fields', () => {
    const variable: Variable = {
      name: 'obj',
      value: 'Object',
      type: 'object',
      variablesReference: 5,
      namedVariables: 3,
      indexedVariables: 0,
    };
    expect(variable.type).toBe('object');
    expect(variable.namedVariables).toBe(3);
  });

  it('should export Thread type', () => {
    const thread: Thread = { id: 1, name: 'Main Thread' };
    expect(thread.id).toBe(1);
    expect(thread.name).toBe('Main Thread');
  });
});

// ============================================================================
// ContainerDebugAdapter — construction and basic methods
// ============================================================================

describe('ContainerDebugAdapter', () => {
  let adapter: ContainerDebugAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ContainerDebugAdapter();
  });

  describe('constructor', () => {
    it('should instantiate without error', () => {
      expect(adapter).toBeInstanceOf(ContainerDebugAdapter);
    });

    it('should call getContainerManager during construction', () => {
      expect(mockGetContainerManager).toHaveBeenCalled();
    });

    it('should extend EventEmitter', () => {
      expect(typeof adapter.on).toBe('function');
      expect(typeof adapter.emit).toBe('function');
      expect(typeof adapter.removeListener).toBe('function');
      expect(typeof adapter.once).toBe('function');
    });
  });

  describe('getSession', () => {
    it('should return null for a non-existent session', () => {
      const result = adapter.getSession('non-existent-id');
      expect(result).toBeNull();
    });

    it('should return null for empty string session id', () => {
      const result = adapter.getSession('');
      expect(result).toBeNull();
    });
  });

  describe('getWorkspaceSessions', () => {
    it('should return empty array when no sessions exist', () => {
      const result = adapter.getWorkspaceSessions('ws-1');
      expect(result).toEqual([]);
    });

    it('should return empty array for a workspace with no matching sessions', () => {
      const result = adapter.getWorkspaceSessions('non-existent-workspace');
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('stopSession', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.stopSession('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('setBreakpoints', () => {
    it('should throw when session does not exist', async () => {
      await expect(
        adapter.setBreakpoints('non-existent', { path: '/test.js' }, [{ line: 5 }])
      ).rejects.toThrow('Session not found: non-existent');
    });
  });

  describe('continue', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.continue('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('stepOver', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.stepOver('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('stepInto', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.stepInto('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('stepOut', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.stepOut('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('pause', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.pause('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('getThreads', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.getThreads('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('getStackTrace', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.getStackTrace('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('getScopes', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.getScopes('non-existent', 1)).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('getVariables', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.getVariables('non-existent', 1)).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('evaluate', () => {
    it('should throw when session does not exist', async () => {
      await expect(adapter.evaluate('non-existent', '1+1')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });
  });

  describe('event emitter functionality', () => {
    it('should support on/emit for initialized events', () => {
      const handler = vi.fn();
      adapter.on('initialized', handler);
      adapter.emit('initialized', { sessionId: 'test-1' });
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1' });
    });

    it('should support on/emit for stopped events', () => {
      const handler = vi.fn();
      adapter.on('stopped', handler);
      adapter.emit('stopped', { sessionId: 'test-1', reason: 'breakpoint', threadId: 1 });
      expect(handler).toHaveBeenCalledWith({
        sessionId: 'test-1',
        reason: 'breakpoint',
        threadId: 1,
      });
    });

    it('should support on/emit for output events', () => {
      const handler = vi.fn();
      adapter.on('output', handler);
      adapter.emit('output', { sessionId: 'test-1', category: 'stdout', output: 'hello\n' });
      expect(handler).toHaveBeenCalledWith({
        sessionId: 'test-1',
        category: 'stdout',
        output: 'hello\n',
      });
    });

    it('should support on/emit for terminated events', () => {
      const handler = vi.fn();
      adapter.on('terminated', handler);
      adapter.emit('terminated', { sessionId: 'test-1' });
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1' });
    });

    it('should support on/emit for exited events', () => {
      const handler = vi.fn();
      adapter.on('exited', handler);
      adapter.emit('exited', { sessionId: 'test-1', exitCode: 0 });
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1', exitCode: 0 });
    });

    it('should support on/emit for connected events', () => {
      const handler = vi.fn();
      adapter.on('connected', handler);
      adapter.emit('connected', { sessionId: 'test-1' });
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1' });
    });

    it('should support on/emit for continued events', () => {
      const handler = vi.fn();
      adapter.on('continued', handler);
      adapter.emit('continued', { sessionId: 'test-1', threadId: 1 });
      expect(handler).toHaveBeenCalledWith({ sessionId: 'test-1', threadId: 1 });
    });
  });

  describe('method existence', () => {
    it('should have startSession method', () => {
      expect(typeof adapter.startSession).toBe('function');
    });

    it('should have stopSession method', () => {
      expect(typeof adapter.stopSession).toBe('function');
    });

    it('should have setBreakpoints method', () => {
      expect(typeof adapter.setBreakpoints).toBe('function');
    });

    it('should have continue method', () => {
      expect(typeof adapter.continue).toBe('function');
    });

    it('should have stepOver method', () => {
      expect(typeof adapter.stepOver).toBe('function');
    });

    it('should have stepInto method', () => {
      expect(typeof adapter.stepInto).toBe('function');
    });

    it('should have stepOut method', () => {
      expect(typeof adapter.stepOut).toBe('function');
    });

    it('should have pause method', () => {
      expect(typeof adapter.pause).toBe('function');
    });

    it('should have getThreads method', () => {
      expect(typeof adapter.getThreads).toBe('function');
    });

    it('should have getStackTrace method', () => {
      expect(typeof adapter.getStackTrace).toBe('function');
    });

    it('should have getScopes method', () => {
      expect(typeof adapter.getScopes).toBe('function');
    });

    it('should have getVariables method', () => {
      expect(typeof adapter.getVariables).toBe('function');
    });

    it('should have evaluate method', () => {
      expect(typeof adapter.evaluate).toBe('function');
    });

    it('should have getSession method', () => {
      expect(typeof adapter.getSession).toBe('function');
    });

    it('should have getWorkspaceSessions method', () => {
      expect(typeof adapter.getWorkspaceSessions).toBe('function');
    });
  });
});

// ============================================================================
// getContainerDebugAdapter (singleton)
// ============================================================================

describe('getContainerDebugAdapter', () => {
  it('should return a ContainerDebugAdapter instance', () => {
    const instance = getContainerDebugAdapter();
    expect(instance).toBeInstanceOf(ContainerDebugAdapter);
  });

  it('should return the same instance on repeated calls (singleton)', () => {
    const first = getContainerDebugAdapter();
    const second = getContainerDebugAdapter();
    expect(first).toBe(second);
  });
});
