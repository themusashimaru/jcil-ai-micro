import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { UniversalDebugger } from './universal-debugger';
import type {
  BreakpointConfig,
  DebugSession,
  StackFrame,
  Scope,
  WatchExpression,
} from './universal-debugger';

describe('UniversalDebugger', () => {
  let debugger_: UniversalDebugger;

  beforeEach(() => {
    debugger_ = new UniversalDebugger();
  });

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  it('should create an instance', () => {
    expect(debugger_).toBeInstanceOf(UniversalDebugger);
  });

  it('should extend EventEmitter', () => {
    expect(typeof debugger_.on).toBe('function');
    expect(typeof debugger_.emit).toBe('function');
  });

  // ==========================================================================
  // createSession()
  // ==========================================================================

  describe('createSession', () => {
    it('should create a session with correct properties', () => {
      const session = debugger_.createSession('javascript');

      expect(session.id).toMatch(/^debug_/);
      expect(session.language).toBe('javascript');
      expect(session.state).toBe('idle');
      expect(session.variables).toBeInstanceOf(Map);
      expect(session.callStack).toEqual([]);
      expect(session.breakpoints).toBeInstanceOf(Map);
    });

    it('should create sessions with unique IDs', () => {
      const s1 = debugger_.createSession('javascript');
      const s2 = debugger_.createSession('python');
      expect(s1.id).not.toBe(s2.id);
    });

    it('should accept options', () => {
      const session = debugger_.createSession('python', {
        workspaceId: 'ws_1',
        programPath: '/app/main.py',
        args: ['--verbose'],
        env: { NODE_ENV: 'test' },
      });
      expect(session).toBeDefined();
      expect(session.language).toBe('python');
    });

    it('should store the session for later retrieval', () => {
      const session = debugger_.createSession('javascript');
      const retrieved = debugger_.getSession(session.id);
      expect(retrieved).toBe(session);
    });
  });

  // ==========================================================================
  // getLanguageConfig()
  // ==========================================================================

  describe('getLanguageConfig', () => {
    it('should return config for JavaScript', () => {
      const config = debugger_.getLanguageConfig('javascript');
      expect(config).toBeDefined();
      expect(config?.debugProtocol).toBe('cdp');
      expect(config?.debugPort).toBe(9229);
    });

    it('should return config for TypeScript', () => {
      const config = debugger_.getLanguageConfig('typescript');
      expect(config).toBeDefined();
      expect(config?.debugProtocol).toBe('cdp');
    });

    it('should return config for Python', () => {
      const config = debugger_.getLanguageConfig('python');
      expect(config).toBeDefined();
      expect(config?.debugProtocol).toBe('dap');
      expect(config?.debugPort).toBe(5678);
    });

    it('should return config for Go', () => {
      const config = debugger_.getLanguageConfig('go');
      expect(config).toBeDefined();
      expect(config?.debugProtocol).toBe('dap');
    });

    it('should return config for Rust', () => {
      const config = debugger_.getLanguageConfig('rust');
      expect(config).toBeDefined();
    });

    it('should return config for Java', () => {
      const config = debugger_.getLanguageConfig('java');
      expect(config).toBeDefined();
      expect(config?.debugPort).toBe(5005);
    });

    it('should return config for C#', () => {
      const config = debugger_.getLanguageConfig('csharp');
      expect(config).toBeDefined();
    });

    it('should return null for unsupported language', () => {
      const config = debugger_.getLanguageConfig('unknown');
      expect(config).toBeNull();
    });
  });

  // ==========================================================================
  // getSupportedLanguages()
  // ==========================================================================

  describe('getSupportedLanguages', () => {
    it('should return an array of supported languages', () => {
      const langs = debugger_.getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs.length).toBeGreaterThan(0);
    });

    it('should include common languages', () => {
      const langs = debugger_.getSupportedLanguages();
      expect(langs).toContain('javascript');
      expect(langs).toContain('typescript');
      expect(langs).toContain('python');
      expect(langs).toContain('go');
      expect(langs).toContain('rust');
      expect(langs).toContain('java');
    });
  });

  // ==========================================================================
  // isLanguageSupported()
  // ==========================================================================

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(debugger_.isLanguageSupported('javascript')).toBe(true);
      expect(debugger_.isLanguageSupported('python')).toBe(true);
      expect(debugger_.isLanguageSupported('go')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(debugger_.isLanguageSupported('unknown')).toBe(false);
      expect(debugger_.isLanguageSupported('haskell')).toBe(false);
    });
  });

  // ==========================================================================
  // setBreakpoint()
  // ==========================================================================

  describe('setBreakpoint', () => {
    it('should set a breakpoint and return id', () => {
      const session = debugger_.createSession('javascript');
      const result = debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
      });

      expect(result.id).toMatch(/^bp_/);
      expect(result.verified).toBe(true);
    });

    it('should throw for non-existent session', () => {
      expect(() =>
        debugger_.setBreakpoint('nonexistent', {
          location: { file: 'test.js', line: 1 },
        })
      ).toThrow('Session not found');
    });

    it('should support conditional breakpoints', () => {
      const session = debugger_.createSession('javascript');
      const result = debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
        condition: 'x > 5',
      });

      expect(result.verified).toBe(true);
    });

    it('should support hit condition breakpoints', () => {
      const session = debugger_.createSession('javascript');
      const result = debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
        hitCondition: '3',
      });

      expect(result.verified).toBe(true);
    });

    it('should support log message breakpoints', () => {
      const session = debugger_.createSession('javascript');
      const result = debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
        logMessage: 'Value of x: {x}',
      });

      expect(result.verified).toBe(true);
    });

    it('should emit breakpoint_set event', () => {
      const listener = vi.fn();
      debugger_.on('breakpoint_set', listener);

      const session = debugger_.createSession('javascript');
      debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
      });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: session.id,
        })
      );
    });

    it('should store breakpoint in session', () => {
      const session = debugger_.createSession('javascript');
      debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
      });

      const bps = debugger_.getBreakpoints(session.id);
      expect(bps).toHaveLength(1);
      expect(bps[0].location.line).toBe(10);
    });
  });

  // ==========================================================================
  // removeBreakpoint()
  // ==========================================================================

  describe('removeBreakpoint', () => {
    it('should remove an existing breakpoint', () => {
      const session = debugger_.createSession('javascript');
      const { id } = debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
      });

      const removed = debugger_.removeBreakpoint(session.id, id);
      expect(removed).toBe(true);
      expect(debugger_.getBreakpoints(session.id)).toHaveLength(0);
    });

    it('should return false for non-existent breakpoint', () => {
      const session = debugger_.createSession('javascript');
      const removed = debugger_.removeBreakpoint(session.id, 'nonexistent');
      expect(removed).toBe(false);
    });

    it('should return false for non-existent session', () => {
      const removed = debugger_.removeBreakpoint('nonexistent', 'bp_1');
      expect(removed).toBe(false);
    });

    it('should emit breakpoint_removed event', () => {
      const listener = vi.fn();
      debugger_.on('breakpoint_removed', listener);

      const session = debugger_.createSession('javascript');
      const { id } = debugger_.setBreakpoint(session.id, {
        location: { file: 'test.js', line: 10 },
      });

      debugger_.removeBreakpoint(session.id, id);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // getBreakpoints()
  // ==========================================================================

  describe('getBreakpoints', () => {
    it('should return empty array for session with no breakpoints', () => {
      const session = debugger_.createSession('javascript');
      expect(debugger_.getBreakpoints(session.id)).toEqual([]);
    });

    it('should return empty array for non-existent session', () => {
      expect(debugger_.getBreakpoints('nonexistent')).toEqual([]);
    });

    it('should return all breakpoints for a session', () => {
      const session = debugger_.createSession('javascript');
      debugger_.setBreakpoint(session.id, { location: { file: 'a.js', line: 1 } });
      debugger_.setBreakpoint(session.id, { location: { file: 'a.js', line: 5 } });
      debugger_.setBreakpoint(session.id, { location: { file: 'b.js', line: 10 } });

      expect(debugger_.getBreakpoints(session.id)).toHaveLength(3);
    });
  });

  // ==========================================================================
  // evaluate()
  // ==========================================================================

  describe('evaluate', () => {
    it('should return evaluation result', async () => {
      const session = debugger_.createSession('javascript');
      const result = await debugger_.evaluate(session.id, 'x + 1');

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('variablesReference');
      expect(result.result).toContain('x + 1');
    });

    it('should throw for non-existent session', async () => {
      await expect(debugger_.evaluate('nonexistent', 'x')).rejects.toThrow('Session not found');
    });

    it('should accept optional frameId', async () => {
      const session = debugger_.createSession('javascript');
      const result = await debugger_.evaluate(session.id, 'x', 0);

      expect(result).toHaveProperty('result');
    });
  });

  // ==========================================================================
  // addWatch()
  // ==========================================================================

  describe('addWatch', () => {
    it('should return a WatchExpression', () => {
      const session = debugger_.createSession('javascript');
      const watch = debugger_.addWatch(session.id, 'myVar');

      expect(watch.expression).toBe('myVar');
      expect(watch.value).toBeUndefined();
      expect(watch.type).toBeUndefined();
    });
  });

  // ==========================================================================
  // getCallStack()
  // ==========================================================================

  describe('getCallStack', () => {
    it('should return empty array for new session', () => {
      const session = debugger_.createSession('javascript');
      expect(debugger_.getCallStack(session.id)).toEqual([]);
    });

    it('should return empty array for non-existent session', () => {
      expect(debugger_.getCallStack('nonexistent')).toEqual([]);
    });
  });

  // ==========================================================================
  // getVariables()
  // ==========================================================================

  describe('getVariables', () => {
    it('should return empty array for new session', () => {
      const session = debugger_.createSession('javascript');
      expect(debugger_.getVariables(session.id, 0)).toEqual([]);
    });

    it('should return empty array for non-existent session', () => {
      expect(debugger_.getVariables('nonexistent', 0)).toEqual([]);
    });
  });

  // ==========================================================================
  // generateLaunchConfig()
  // ==========================================================================

  describe('generateLaunchConfig', () => {
    it('should generate a VS Code launch config for JavaScript', () => {
      const config = debugger_.generateLaunchConfig('javascript', {
        programPath: '/app/index.js',
      });

      expect(config.type).toBe('node');
      expect(config.request).toBe('launch');
      expect(config.program).toBe('/app/index.js');
      expect(config.port).toBe(9229);
    });

    it('should generate a launch config for Python', () => {
      const config = debugger_.generateLaunchConfig('python', {
        programPath: '/app/main.py',
        args: ['--verbose'],
      });

      expect(config.type).toBe('python');
      expect(config.program).toBe('/app/main.py');
      expect(config.args).toEqual(['--verbose']);
    });

    it('should generate a launch config for Go', () => {
      const config = debugger_.generateLaunchConfig('go', {
        programPath: '/app/main.go',
      });

      expect(config.type).toBe('go');
      expect(config.port).toBe(2345);
    });

    it('should include env when provided', () => {
      const config = debugger_.generateLaunchConfig('javascript', {
        programPath: '/app/index.js',
        env: { NODE_ENV: 'test' },
      });

      expect(config.env).toEqual({ NODE_ENV: 'test' });
    });

    it('should include cwd when provided', () => {
      const config = debugger_.generateLaunchConfig('javascript', {
        programPath: '/app/index.js',
        cwd: '/app',
      });

      expect(config.cwd).toBe('/app');
    });

    it('should throw for unsupported language', () => {
      expect(() => debugger_.generateLaunchConfig('unknown', { programPath: '/app/main' })).toThrow(
        'Unsupported language'
      );
    });

    it('should not include port when debugPort is 0', () => {
      const config = debugger_.generateLaunchConfig('rust', {
        programPath: '/app/main',
      });

      expect(config.port).toBeUndefined();
    });
  });

  // ==========================================================================
  // simulateStep()
  // ==========================================================================

  describe('simulateStep', () => {
    it('should return an ExecutionStep', () => {
      const code = `const x = 1;
console.log(x);`;
      const step = debugger_.simulateStep(code, 'javascript', 1, {});

      expect(step).toHaveProperty('location');
      expect(step).toHaveProperty('operation');
      expect(step).toHaveProperty('sideEffects');
      expect(step).toHaveProperty('branches');
      expect(step.location.line).toBe(1);
    });

    it('should detect console.log side effect', () => {
      const code = `console.log("hello");`;
      const step = debugger_.simulateStep(code, 'javascript', 1, {});

      const ioEffect = step.sideEffects.find((se) => se.type === 'io');
      expect(ioEffect).toBeDefined();
    });

    it('should detect fetch network side effect', () => {
      const code = `fetch("/api/data");`;
      const step = debugger_.simulateStep(code, 'javascript', 1, {});

      const netEffect = step.sideEffects.find((se) => se.type === 'network');
      expect(netEffect).toBeDefined();
    });

    it('should detect file system side effect', () => {
      const code = `fs.writeFileSync("file.txt", "data");`;
      const step = debugger_.simulateStep(code, 'javascript', 1, {});

      const fileEffect = step.sideEffects.find((se) => se.type === 'file');
      expect(fileEffect).toBeDefined();
    });

    it('should detect if branch', () => {
      const code = `if (x > 0) { return true; }`;
      const step = debugger_.simulateStep(code, 'javascript', 1, {});

      expect(step.branches).toHaveLength(1);
      expect(step.branches[0].condition).toContain('x > 0');
    });

    it('should handle out-of-bounds line number', () => {
      const code = `const x = 1;`;
      const step = debugger_.simulateStep(code, 'javascript', 999, {});

      expect(step.operation).toBe('');
    });
  });

  // ==========================================================================
  // getDebugInstructions()
  // ==========================================================================

  describe('getDebugInstructions', () => {
    it('should return instructions for supported languages', () => {
      const instructions = debugger_.getDebugInstructions('javascript');
      expect(instructions).toContain('Debugging javascript');
      expect(instructions).toContain('debugger;');
      expect(instructions).toContain('Quick Start');
      expect(instructions).toContain('Step Commands');
    });

    it('should return error message for unsupported language', () => {
      const instructions = debugger_.getDebugInstructions('unknown');
      expect(instructions).toContain('not supported');
    });

    it('should include hot reload info', () => {
      const jsInstructions = debugger_.getDebugInstructions('javascript');
      expect(jsInstructions).toContain('Hot Reload: Yes');

      const pyInstructions = debugger_.getDebugInstructions('python');
      expect(pyInstructions).toContain('Hot Reload: No');
    });

    it('should include protocol info', () => {
      const jsInstructions = debugger_.getDebugInstructions('javascript');
      expect(jsInstructions).toContain('CDP');

      const pyInstructions = debugger_.getDebugInstructions('python');
      expect(pyInstructions).toContain('DAP');
    });
  });

  // ==========================================================================
  // endSession()
  // ==========================================================================

  describe('endSession', () => {
    it('should end and remove the session', () => {
      const session = debugger_.createSession('javascript');
      debugger_.endSession(session.id);

      expect(debugger_.getSession(session.id)).toBeNull();
    });

    it('should set session state to stopped before removal', () => {
      const listener = vi.fn();
      debugger_.on('session_ended', listener);

      const session = debugger_.createSession('javascript');
      debugger_.endSession(session.id);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ sessionId: session.id }));
    });

    it('should not throw for non-existent session', () => {
      expect(() => debugger_.endSession('nonexistent')).not.toThrow();
    });
  });

  // ==========================================================================
  // getSession()
  // ==========================================================================

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      expect(debugger_.getSession('nonexistent')).toBeNull();
    });

    it('should return the correct session', () => {
      const session = debugger_.createSession('javascript');
      expect(debugger_.getSession(session.id)).toBe(session);
    });
  });

  // ==========================================================================
  // getActiveSessions()
  // ==========================================================================

  describe('getActiveSessions', () => {
    it('should return empty array when no sessions', () => {
      expect(debugger_.getActiveSessions()).toEqual([]);
    });

    it('should return all non-stopped sessions', () => {
      debugger_.createSession('javascript');
      debugger_.createSession('python');

      expect(debugger_.getActiveSessions()).toHaveLength(2);
    });

    it('should exclude ended sessions', () => {
      const s1 = debugger_.createSession('javascript');
      debugger_.createSession('python');
      debugger_.endSession(s1.id);

      expect(debugger_.getActiveSessions()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // EXPORTED TYPES
  // ==========================================================================

  describe('exported types', () => {
    it('BreakpointConfig should be usable as a type', () => {
      const bp: BreakpointConfig = {
        location: { file: 'test.js', line: 1 },
        condition: 'x > 0',
      };
      expect(bp.location.line).toBe(1);
    });

    it('DebugSession should be usable as a type', () => {
      const session: DebugSession = {
        id: 'test',
        language: 'javascript',
        state: 'idle',
        variables: new Map(),
        callStack: [],
        breakpoints: new Map(),
      };
      expect(session.state).toBe('idle');
    });

    it('StackFrame should be usable as a type', () => {
      const frame: StackFrame = {
        id: 0,
        name: 'main',
        location: { file: 'test.js', line: 1 },
        scopes: [],
      };
      expect(frame.name).toBe('main');
    });

    it('Scope should be usable as a type', () => {
      const scope: Scope = {
        name: 'Local',
        variables: [],
        expensive: false,
      };
      expect(scope.name).toBe('Local');
    });

    it('WatchExpression should be usable as a type', () => {
      const watch: WatchExpression = {
        expression: 'x',
        value: 42,
        type: 'number',
      };
      expect(watch.expression).toBe('x');
    });
  });
});
