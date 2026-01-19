/**
 * DEBUG ADAPTER PROTOCOL IMPLEMENTATION
 *
 * Real debugging infrastructure for Code Lab.
 * Implements DAP (Debug Adapter Protocol) for:
 * - Node.js debugging via --inspect (using CDP)
 * - Python debugging via debugpy (using DAP)
 * - Breakpoints, stepping, variable inspection
 *
 * This is REAL debugging, not a mock.
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { spawn, ChildProcess } from 'child_process';
import {
  CDPClient,
  CDPCallFrame,
  CDPScope,
  CDPPropertyDescriptor,
  CDPRemoteObject,
} from './cdp-client';
import {
  DAPClient,
  DAPStackFrame,
  DAPScope as DAPScopeType,
  DAPVariable,
  DAPBreakpoint,
  DAPSource,
} from './dap-client';

const log = logger('DebugAdapter');

// ============================================================================
// DAP TYPES (Based on VS Code Debug Adapter Protocol)
// ============================================================================

export interface DebugConfiguration {
  type: 'node' | 'python';
  name: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  host?: string;
}

export interface Breakpoint {
  id: number;
  verified: boolean;
  line: number;
  column?: number;
  source: Source;
  message?: string;
}

export interface Source {
  name?: string;
  path?: string;
  sourceReference?: number;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: Source;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

export interface Scope {
  name: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive: boolean;
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
}

export interface Thread {
  id: number;
  name: string;
}

export type DebugState = 'idle' | 'running' | 'paused' | 'stopped';

export interface DebugSession {
  id: string;
  configuration: DebugConfiguration;
  state: DebugState;
  threads: Thread[];
  breakpoints: Map<string, Breakpoint[]>; // file path -> breakpoints
  currentThread?: number;
  currentFrame?: number;
}

// ============================================================================
// DEBUG EVENTS
// ============================================================================

export interface DebugEvents {
  initialized: void;
  stopped: { reason: string; threadId?: number; text?: string };
  continued: { threadId: number };
  exited: { exitCode: number };
  terminated: void;
  thread: { reason: 'started' | 'exited'; threadId: number };
  output: { category: string; output: string };
  breakpoint: { reason: 'changed' | 'new' | 'removed'; breakpoint: Breakpoint };
  module: { reason: 'new' | 'changed' | 'removed'; module: unknown };
  loadedSource: { reason: 'new' | 'changed' | 'removed'; source: Source };
  process: { name: string; startMethod?: string };
  capabilities: unknown;
}

// ============================================================================
// DEBUG ADAPTER BASE CLASS
// ============================================================================

export abstract class DebugAdapter extends EventEmitter {
  protected session: DebugSession | null = null;
  protected breakpointId = 0;
  protected variablesReference = 0;

  /**
   * Initialize the debug adapter
   */
  abstract initialize(): Promise<void>;

  /**
   * Launch a debug session
   */
  abstract launch(config: DebugConfiguration): Promise<void>;

  /**
   * Attach to a running process
   */
  abstract attach(config: DebugConfiguration): Promise<void>;

  /**
   * Disconnect from the debuggee
   */
  abstract disconnect(): Promise<void>;

  /**
   * Set breakpoints for a file
   */
  abstract setBreakpoints(
    source: Source,
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]>;

  /**
   * Continue execution
   */
  abstract continue(threadId: number): Promise<void>;

  /**
   * Step over (next)
   */
  abstract stepOver(threadId: number): Promise<void>;

  /**
   * Step into
   */
  abstract stepInto(threadId: number): Promise<void>;

  /**
   * Step out
   */
  abstract stepOut(threadId: number): Promise<void>;

  /**
   * Pause execution
   */
  abstract pause(threadId: number): Promise<void>;

  /**
   * Get threads
   */
  abstract getThreads(): Promise<Thread[]>;

  /**
   * Get stack trace for a thread
   */
  abstract getStackTrace(
    threadId: number,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]>;

  /**
   * Get scopes for a stack frame
   */
  abstract getScopes(frameId: number): Promise<Scope[]>;

  /**
   * Get variables for a scope
   */
  abstract getVariables(variablesReference: number): Promise<Variable[]>;

  /**
   * Evaluate an expression
   */
  abstract evaluate(
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }>;

  // Helper methods
  protected nextBreakpointId(): number {
    return ++this.breakpointId;
  }

  protected nextVariablesReference(): number {
    return ++this.variablesReference;
  }

  getSession(): DebugSession | null {
    return this.session;
  }

  getState(): DebugState {
    return this.session?.state || 'idle';
  }
}

// ============================================================================
// NODE.JS DEBUG ADAPTER (Real CDP Implementation)
// ============================================================================

export class NodeDebugAdapter extends DebugAdapter {
  private debugProcess: ChildProcess | null = null;
  private debugPort = 9229;
  private debugHost = '127.0.0.1';
  private cdp: CDPClient | null = null;

  // CDP state tracking
  private currentCallFrames: CDPCallFrame[] = [];
  private scopeToObjectId = new Map<number, string>();
  private frameIdToCallFrameId = new Map<number, string>();

  async initialize(): Promise<void> {
    log.info('Node debug adapter initialized');
  }

  async launch(config: DebugConfiguration): Promise<void> {
    if (!config.program) {
      throw new Error('Program path required for Node.js debugging');
    }

    // Use configured port or default
    this.debugPort = config.port || 9229;
    this.debugHost = config.host || '127.0.0.1';

    this.session = {
      id: `node-${Date.now()}`,
      configuration: config,
      state: 'running',
      threads: [{ id: 1, name: 'Main Thread' }],
      breakpoints: new Map(),
    };

    const args = [
      `--inspect-brk=${this.debugHost}:${this.debugPort}`,
      config.program,
      ...(config.args || []),
    ];

    log.info('Launching Node.js debug session', {
      program: config.program,
      host: this.debugHost,
      port: this.debugPort,
    });

    this.debugProcess = spawn('node', args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.debugProcess.stdout?.on('data', (data) => {
      this.emit('output', { category: 'stdout', output: data.toString() });
    });

    this.debugProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      this.emit('output', { category: 'stderr', output });

      // Check for debugger listening message, then connect
      if (output.includes('Debugger listening on')) {
        // Give the debugger a moment to fully initialize
        setTimeout(() => this.connectToInspector(), 100);
      }
    });

    this.debugProcess.on('exit', (code) => {
      this.cleanup();
      this.emit('exited', { exitCode: code || 0 });
      this.emit('terminated');
    });

    this.debugProcess.on('error', (error) => {
      log.error('Debug process error', error);
      this.cleanup();
      this.emit('terminated');
    });
  }

  private async connectToInspector(): Promise<void> {
    try {
      log.info('Connecting to Node.js inspector via CDP', {
        host: this.debugHost,
        port: this.debugPort,
      });

      // Create and connect CDP client
      this.cdp = new CDPClient();

      // Set up CDP event handlers
      this.setupCDPEventHandlers();

      await this.cdp.connect(this.debugHost, this.debugPort);

      this.emit('initialized');
      this.emit('process', { name: this.session?.configuration.program || 'node' });

      log.info('Successfully connected to Node.js inspector');
    } catch (error) {
      log.error('Failed to connect to inspector', error as Error);
      this.emit('output', {
        category: 'stderr',
        output: `Failed to connect to debugger: ${(error as Error).message}`,
      });
      throw error;
    }
  }

  private setupCDPEventHandlers(): void {
    if (!this.cdp) return;

    // Handle debugger paused event
    this.cdp.on(
      'Debugger.paused',
      (params: {
        callFrames: CDPCallFrame[];
        reason: string;
        data?: Record<string, unknown>;
        hitBreakpoints?: string[];
      }) => {
        this.currentCallFrames = params.callFrames;

        // Map frame IDs to call frame IDs
        this.frameIdToCallFrameId.clear();
        params.callFrames.forEach((frame, index) => {
          this.frameIdToCallFrameId.set(index + 1, frame.callFrameId);
        });

        if (this.session) {
          this.session.state = 'paused';
          this.session.currentFrame = 1;
        }

        // Map CDP reason to DAP reason
        let reason = params.reason;
        if (reason === 'Break' || reason === 'breakpoint') {
          reason = 'breakpoint';
        } else if (reason === 'exception') {
          reason = 'exception';
        } else if (reason === 'other' || reason === 'debugCommand') {
          reason = 'step';
        }

        log.debug('Debugger paused', {
          reason,
          frameCount: params.callFrames.length,
          hitBreakpoints: params.hitBreakpoints,
        });

        this.emit('stopped', {
          reason,
          threadId: 1,
          text: params.hitBreakpoints?.join(', '),
        });
      }
    );

    // Handle debugger resumed event
    this.cdp.on('Debugger.resumed', () => {
      this.currentCallFrames = [];
      if (this.session) {
        this.session.state = 'running';
      }
      this.emit('continued', { threadId: 1 });
    });

    // Handle script parsed event
    this.cdp.on('Debugger.scriptParsed', (script: { url: string; scriptId: string }) => {
      if (script.url) {
        log.debug('Script parsed', { url: script.url, scriptId: script.scriptId });
        this.emit('loadedSource', {
          reason: 'new',
          source: { path: script.url, name: script.url.split('/').pop() },
        });
      }
    });

    // Handle console output
    this.cdp.on('Runtime.consoleAPICalled', (params: { type: string; args: CDPRemoteObject[] }) => {
      const output = params.args.map((arg) => this.formatRemoteObject(arg)).join(' ');
      this.emit('output', {
        category: params.type === 'error' ? 'stderr' : 'stdout',
        output: output + '\n',
      });
    });

    // Handle exceptions
    this.cdp.on(
      'Runtime.exceptionThrown',
      (params: {
        exceptionDetails: {
          text: string;
          exception?: CDPRemoteObject;
          url?: string;
          lineNumber: number;
        };
      }) => {
        const details = params.exceptionDetails;
        let message = details.text;
        if (details.exception) {
          message = this.formatRemoteObject(details.exception);
        }
        this.emit('output', {
          category: 'stderr',
          output: `Exception: ${message}\n  at ${details.url}:${details.lineNumber}\n`,
        });
      }
    );

    // Handle disconnection
    this.cdp.on('disconnected', () => {
      log.info('CDP disconnected');
      this.cleanup();
    });
  }

  async attach(config: DebugConfiguration): Promise<void> {
    this.debugPort = config.port || 9229;
    this.debugHost = config.host || '127.0.0.1';

    this.session = {
      id: `node-attach-${Date.now()}`,
      configuration: config,
      state: 'running',
      threads: [{ id: 1, name: 'Main Thread' }],
      breakpoints: new Map(),
    };

    log.info('Attaching to Node.js process', { host: this.debugHost, port: this.debugPort });

    await this.connectToInspector();
  }

  async disconnect(): Promise<void> {
    this.cleanup();
    log.info('Disconnected from Node.js debugger');
  }

  private cleanup(): void {
    if (this.cdp) {
      this.cdp.disconnect();
      this.cdp = null;
    }

    if (this.debugProcess) {
      this.debugProcess.kill();
      this.debugProcess = null;
    }

    this.currentCallFrames = [];
    this.scopeToObjectId.clear();
    this.frameIdToCallFrameId.clear();
    this.session = null;
  }

  async setBreakpoints(
    source: Source,
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    if (!this.session || !source.path || !this.cdp) return [];

    // Remove existing breakpoints for this file
    const existingBreakpoints = this.session.breakpoints.get(source.path) || [];
    for (const bp of existingBreakpoints) {
      if (bp.id) {
        try {
          await this.cdp.removeBreakpoint(`${bp.id}`);
        } catch {
          // Ignore removal errors
        }
      }
    }

    // Set new breakpoints
    const verified: Breakpoint[] = [];

    for (const bp of breakpoints) {
      try {
        // Convert file path to URL format that CDP expects
        const url = source.path.startsWith('file://') ? source.path : `file://${source.path}`;

        const result = await this.cdp.setBreakpointByUrl(
          url,
          bp.line - 1, // CDP uses 0-based line numbers
          bp.column ? bp.column - 1 : undefined,
          bp.condition
        );

        verified.push({
          id: this.nextBreakpointId(),
          verified: result.locations.length > 0,
          line: result.locations[0]?.lineNumber + 1 || bp.line,
          column: result.locations[0]?.columnNumber
            ? result.locations[0].columnNumber + 1
            : bp.column,
          source,
        });

        log.debug('Breakpoint set via CDP', {
          file: source.path,
          line: bp.line,
          breakpointId: result.breakpointId,
        });
      } catch (error) {
        log.error('Failed to set breakpoint', error as Error);
        verified.push({
          id: this.nextBreakpointId(),
          verified: false,
          line: bp.line,
          column: bp.column,
          source,
          message: (error as Error).message,
        });
      }
    }

    this.session.breakpoints.set(source.path, verified);
    return verified;
  }

  async continue(_threadId: number): Promise<void> {
    if (!this.cdp) throw new Error('Not connected to debugger');

    await this.cdp.resume();
    if (this.session) {
      this.session.state = 'running';
    }
  }

  async stepOver(_threadId: number): Promise<void> {
    if (!this.cdp) throw new Error('Not connected to debugger');
    await this.cdp.stepOver();
  }

  async stepInto(_threadId: number): Promise<void> {
    if (!this.cdp) throw new Error('Not connected to debugger');
    await this.cdp.stepInto();
  }

  async stepOut(_threadId: number): Promise<void> {
    if (!this.cdp) throw new Error('Not connected to debugger');
    await this.cdp.stepOut();
  }

  async pause(_threadId: number): Promise<void> {
    if (!this.cdp) throw new Error('Not connected to debugger');
    await this.cdp.pause();
    if (this.session) {
      this.session.state = 'paused';
    }
  }

  async getThreads(): Promise<Thread[]> {
    // Node.js is single-threaded for JavaScript execution
    return [{ id: 1, name: 'Main Thread' }];
  }

  async getStackTrace(
    _threadId: number,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    if (!this.cdp || this.currentCallFrames.length === 0) {
      return [];
    }

    const start = startFrame || 0;
    const count = levels || this.currentCallFrames.length;
    const frames = this.currentCallFrames.slice(start, start + count);

    return frames.map((frame, index) => {
      const script = this.cdp!.getScript(frame.location.scriptId);
      const url = frame.url || script?.url || '';
      const name = url.split('/').pop() || 'unknown';

      return {
        id: start + index + 1, // 1-based frame IDs
        name: frame.functionName || '<anonymous>',
        source: {
          path: url.replace('file://', ''),
          name,
        },
        line: frame.location.lineNumber + 1, // Convert to 1-based
        column: (frame.location.columnNumber || 0) + 1,
      };
    });
  }

  async getScopes(frameId: number): Promise<Scope[]> {
    if (!this.cdp || this.currentCallFrames.length === 0) {
      return [];
    }

    // Find the call frame
    const frame = this.currentCallFrames[frameId - 1]; // Convert from 1-based
    if (!frame) {
      return [];
    }

    const scopes: Scope[] = [];

    for (const cdpScope of frame.scopeChain) {
      const varRef = this.nextVariablesReference();

      // Store the object ID for this variables reference
      if (cdpScope.object.objectId) {
        this.scopeToObjectId.set(varRef, cdpScope.object.objectId);
      }

      scopes.push({
        name: this.mapScopeType(cdpScope.type),
        variablesReference: varRef,
        expensive: cdpScope.type === 'global',
      });
    }

    return scopes;
  }

  private mapScopeType(cdpType: CDPScope['type']): string {
    const typeMap: Record<CDPScope['type'], string> = {
      global: 'Global',
      local: 'Local',
      with: 'With',
      closure: 'Closure',
      catch: 'Catch',
      block: 'Block',
      script: 'Script',
      eval: 'Eval',
      module: 'Module',
    };
    return typeMap[cdpType] || cdpType;
  }

  async getVariables(variablesReference: number): Promise<Variable[]> {
    if (!this.cdp) {
      return [];
    }

    const objectId = this.scopeToObjectId.get(variablesReference);
    if (!objectId) {
      return [];
    }

    try {
      const properties = await this.cdp.getProperties(objectId, true, true);
      return this.convertProperties(properties);
    } catch (error) {
      log.error('Failed to get variables', error as Error);
      return [];
    }
  }

  private convertProperties(properties: CDPPropertyDescriptor[]): Variable[] {
    return properties
      .filter((prop) => prop.enumerable || prop.isOwn)
      .map((prop) => {
        const value = prop.value;
        let varRef = 0;

        // If this is an object with properties, create a reference for expansion
        if (value?.objectId && (value.type === 'object' || value.type === 'function')) {
          varRef = this.nextVariablesReference();
          this.scopeToObjectId.set(varRef, value.objectId);
        }

        return {
          name: prop.name,
          value: this.formatRemoteObject(value),
          type: value?.type || 'undefined',
          variablesReference: varRef,
        };
      });
  }

  private formatRemoteObject(obj?: CDPRemoteObject): string {
    if (!obj) return 'undefined';

    if (obj.type === 'undefined') return 'undefined';
    if (obj.type === 'string') return `"${obj.value}"`;
    if (obj.type === 'number' || obj.type === 'boolean') return String(obj.value);
    if (obj.type === 'symbol') return obj.description || 'Symbol()';
    if (obj.type === 'bigint') return `${obj.unserializableValue || obj.description}n`;

    if (obj.type === 'function') {
      return obj.description || 'function';
    }

    if (obj.type === 'object') {
      if (obj.subtype === 'null') return 'null';
      if (obj.subtype === 'array') return obj.description || 'Array';
      if (obj.subtype === 'regexp') return obj.description || 'RegExp';
      if (obj.subtype === 'date') return obj.description || 'Date';
      if (obj.subtype === 'error') return obj.description || 'Error';
      if (obj.subtype === 'promise') return obj.description || 'Promise';
      if (obj.subtype === 'map') return obj.description || 'Map';
      if (obj.subtype === 'set') return obj.description || 'Set';
      return obj.description || obj.className || 'Object';
    }

    return obj.description || String(obj.value);
  }

  async evaluate(
    expression: string,
    frameId?: number,
    _context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    if (!this.cdp) {
      throw new Error('Not connected to debugger');
    }

    try {
      let evalResult;

      if (frameId && this.frameIdToCallFrameId.has(frameId)) {
        // Evaluate in the context of a specific call frame
        const callFrameId = this.frameIdToCallFrameId.get(frameId)!;
        evalResult = await this.cdp.evaluateOnCallFrame(callFrameId, expression);
      } else {
        // Evaluate in global context
        evalResult = await this.cdp.evaluate(expression);
      }

      if (evalResult.exceptionDetails) {
        return {
          result: `Error: ${evalResult.exceptionDetails.text}`,
          type: 'error',
          variablesReference: 0,
        };
      }

      let varRef = 0;
      if (evalResult.result.objectId && evalResult.result.type === 'object') {
        varRef = this.nextVariablesReference();
        this.scopeToObjectId.set(varRef, evalResult.result.objectId);
      }

      return {
        result: this.formatRemoteObject(evalResult.result),
        type: evalResult.result.type,
        variablesReference: varRef,
      };
    } catch (error) {
      return {
        result: `Error: ${(error as Error).message}`,
        type: 'error',
        variablesReference: 0,
      };
    }
  }
}

// ============================================================================
// PYTHON DEBUG ADAPTER (Real DAP Implementation)
// ============================================================================

export class PythonDebugAdapter extends DebugAdapter {
  private debugProcess: ChildProcess | null = null;
  private debugPort = 5678;
  private debugHost = '127.0.0.1';
  private dap: DAPClient | null = null;

  // DAP state tracking
  private variableReferenceMap = new Map<number, number>(); // local ref -> DAP ref

  async initialize(): Promise<void> {
    log.info('Python debug adapter initialized');
  }

  async launch(config: DebugConfiguration): Promise<void> {
    if (!config.program) {
      throw new Error('Program path required for Python debugging');
    }

    // Use configured port or default
    this.debugPort = config.port || 5678;
    this.debugHost = config.host || '127.0.0.1';

    this.session = {
      id: `python-${Date.now()}`,
      configuration: config,
      state: 'running',
      threads: [],
      breakpoints: new Map(),
    };

    // Use debugpy for Python debugging
    const args = [
      '-m',
      'debugpy',
      '--listen',
      `${this.debugHost}:${this.debugPort}`,
      '--wait-for-client',
      config.program,
      ...(config.args || []),
    ];

    log.info('Launching Python debug session', {
      program: config.program,
      host: this.debugHost,
      port: this.debugPort,
    });

    this.debugProcess = spawn('python3', args, {
      cwd: config.cwd,
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.debugProcess.stdout?.on('data', (data) => {
      this.emit('output', { category: 'stdout', output: data.toString() });
    });

    this.debugProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      this.emit('output', { category: 'stderr', output });
    });

    this.debugProcess.on('exit', (code) => {
      this.cleanup();
      this.emit('exited', { exitCode: code || 0 });
      this.emit('terminated');
    });

    this.debugProcess.on('error', (error) => {
      log.error('Debug process error', error);
      this.cleanup();
      this.emit('terminated');
    });

    // Wait for debugpy to start listening, then connect
    await this.waitForDebugpy();
    await this.connectToDebugpy();
  }

  private async waitForDebugpy(): Promise<void> {
    // Wait for debugpy to start (with retry)
    const maxRetries = 10;
    const retryDelay = 500;

    for (let i = 0; i < maxRetries; i++) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));

      try {
        // Try to connect briefly to see if debugpy is listening
        const testSocket = new (await import('net')).Socket();
        await new Promise<void>((resolve, reject) => {
          testSocket.once('connect', () => {
            testSocket.destroy();
            resolve();
          });
          testSocket.once('error', reject);
          testSocket.connect(this.debugPort, this.debugHost);
        });
        log.info('Debugpy is ready');
        return;
      } catch {
        log.debug(`Waiting for debugpy... attempt ${i + 1}/${maxRetries}`);
      }
    }

    throw new Error('Timed out waiting for debugpy to start');
  }

  private async connectToDebugpy(): Promise<void> {
    try {
      log.info('Connecting to debugpy via DAP', {
        host: this.debugHost,
        port: this.debugPort,
      });

      // Create and connect DAP client
      this.dap = new DAPClient();

      // Set up DAP event handlers
      this.setupDAPEventHandlers();

      await this.dap.connect(this.debugHost, this.debugPort);

      // Launch the program through DAP
      await this.dap.launch({
        program: this.session!.configuration.program!,
        args: this.session!.configuration.args,
        cwd: this.session!.configuration.cwd,
        env: this.session!.configuration.env,
        stopOnEntry: true,
      });

      this.emit('initialized');
      this.emit('process', { name: this.session?.configuration.program || 'python' });

      log.info('Successfully connected to debugpy');
    } catch (error) {
      log.error('Failed to connect to debugpy', error as Error);
      this.emit('output', {
        category: 'stderr',
        output: `Failed to connect to debugger: ${(error as Error).message}`,
      });
      throw error;
    }
  }

  private setupDAPEventHandlers(): void {
    if (!this.dap) return;

    // Handle stopped event
    this.dap.on(
      'stopped',
      (params: {
        reason: string;
        threadId?: number;
        text?: string;
        allThreadsStopped?: boolean;
        hitBreakpointIds?: number[];
      }) => {
        if (this.session) {
          this.session.state = 'paused';
        }

        log.debug('Python debugger stopped', {
          reason: params.reason,
          threadId: params.threadId,
          hitBreakpoints: params.hitBreakpointIds,
        });

        this.emit('stopped', {
          reason: params.reason,
          threadId: params.threadId || 1,
          text: params.text,
        });
      }
    );

    // Handle continued event
    this.dap.on('continued', (params: { threadId: number; allThreadsContinued?: boolean }) => {
      if (this.session) {
        this.session.state = 'running';
      }
      this.emit('continued', { threadId: params.threadId });
    });

    // Handle output event
    this.dap.on(
      'output',
      (params: { category?: string; output: string; source?: DAPSource; line?: number }) => {
        this.emit('output', {
          category: params.category || 'console',
          output: params.output,
        });
      }
    );

    // Handle thread event
    this.dap.on('thread', (params: { reason: 'started' | 'exited'; threadId: number }) => {
      this.emit('thread', params);
    });

    // Handle exited event
    this.dap.on('exited', (params: { exitCode: number }) => {
      this.cleanup();
      this.emit('exited', params);
    });

    // Handle terminated event
    this.dap.on('terminated', () => {
      this.cleanup();
      this.emit('terminated');
    });

    // Handle breakpoint event
    this.dap.on('breakpoint', (params: { reason: string; breakpoint: DAPBreakpoint }) => {
      this.emit('breakpoint', {
        reason: params.reason as 'changed' | 'new' | 'removed',
        breakpoint: this.convertDAPBreakpoint(params.breakpoint),
      });
    });

    // Handle disconnection
    this.dap.on('disconnected', () => {
      log.info('DAP disconnected');
      this.cleanup();
    });
  }

  async attach(config: DebugConfiguration): Promise<void> {
    this.debugPort = config.port || 5678;
    this.debugHost = config.host || '127.0.0.1';

    this.session = {
      id: `python-attach-${Date.now()}`,
      configuration: config,
      state: 'running',
      threads: [],
      breakpoints: new Map(),
    };

    log.info('Attaching to Python process', { host: this.debugHost, port: this.debugPort });

    // Create and connect DAP client
    this.dap = new DAPClient();
    this.setupDAPEventHandlers();

    await this.dap.connect(this.debugHost, this.debugPort);
    await this.dap.attach({
      host: this.debugHost,
      port: this.debugPort,
    });

    this.emit('initialized');
    this.emit('process', { name: 'python' });
  }

  async disconnect(): Promise<void> {
    if (this.dap) {
      try {
        await this.dap.disconnect(true);
      } catch {
        // Ignore disconnect errors
      }
    }
    this.cleanup();
    log.info('Disconnected from Python debugger');
  }

  private cleanup(): void {
    if (this.dap) {
      this.dap.removeAllListeners();
      this.dap = null;
    }

    if (this.debugProcess) {
      this.debugProcess.kill();
      this.debugProcess = null;
    }

    this.variableReferenceMap.clear();
    this.session = null;
  }

  async setBreakpoints(
    source: Source,
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    if (!this.session || !source.path || !this.dap) return [];

    try {
      const dapSource: DAPSource = {
        path: source.path,
        name: source.name || source.path.split('/').pop(),
      };

      const dapBreakpoints = await this.dap.setBreakpoints(
        dapSource,
        breakpoints.map((bp) => ({
          line: bp.line,
          column: bp.column,
          condition: bp.condition,
        }))
      );

      const verified = dapBreakpoints.map((bp, index) =>
        this.convertDAPBreakpoint(bp, source, breakpoints[index])
      );

      this.session.breakpoints.set(source.path, verified);

      log.debug('Breakpoints set via DAP', {
        file: source.path,
        count: verified.length,
      });

      return verified;
    } catch (error) {
      log.error('Failed to set breakpoints', error as Error);
      return breakpoints.map((bp) => ({
        id: this.nextBreakpointId(),
        verified: false,
        line: bp.line,
        column: bp.column,
        source,
        message: (error as Error).message,
      }));
    }
  }

  private convertDAPBreakpoint(
    dapBp: DAPBreakpoint,
    source?: Source,
    originalBp?: { line: number; column?: number }
  ): Breakpoint {
    return {
      id: dapBp.id || this.nextBreakpointId(),
      verified: dapBp.verified,
      line: dapBp.line || originalBp?.line || 1,
      column: dapBp.column || originalBp?.column,
      source:
        source ||
        (dapBp.source ? { path: dapBp.source.path, name: dapBp.source.name } : { path: '' }),
      message: dapBp.message,
    };
  }

  async continue(threadId: number): Promise<void> {
    if (!this.dap) throw new Error('Not connected to debugger');

    await this.dap.continue(threadId);
    if (this.session) {
      this.session.state = 'running';
    }
  }

  async stepOver(threadId: number): Promise<void> {
    if (!this.dap) throw new Error('Not connected to debugger');
    await this.dap.next(threadId);
  }

  async stepInto(threadId: number): Promise<void> {
    if (!this.dap) throw new Error('Not connected to debugger');
    await this.dap.stepIn(threadId);
  }

  async stepOut(threadId: number): Promise<void> {
    if (!this.dap) throw new Error('Not connected to debugger');
    await this.dap.stepOut(threadId);
  }

  async pause(threadId: number): Promise<void> {
    if (!this.dap) throw new Error('Not connected to debugger');
    await this.dap.pause(threadId);
    if (this.session) {
      this.session.state = 'paused';
    }
  }

  async getThreads(): Promise<Thread[]> {
    if (!this.dap) {
      return [{ id: 1, name: 'MainThread' }];
    }

    try {
      const dapThreads = await this.dap.threads();
      return dapThreads.map((t) => ({ id: t.id, name: t.name }));
    } catch (error) {
      log.error('Failed to get threads', error as Error);
      return [{ id: 1, name: 'MainThread' }];
    }
  }

  async getStackTrace(
    threadId: number,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    if (!this.dap) {
      return [];
    }

    try {
      const result = await this.dap.stackTrace(threadId, startFrame, levels);
      return result.stackFrames.map((frame) => this.convertDAPStackFrame(frame));
    } catch (error) {
      log.error('Failed to get stack trace', error as Error);
      return [];
    }
  }

  private convertDAPStackFrame(frame: DAPStackFrame): StackFrame {
    return {
      id: frame.id,
      name: frame.name,
      source: frame.source ? { path: frame.source.path, name: frame.source.name } : undefined,
      line: frame.line,
      column: frame.column,
      endLine: frame.endLine,
      endColumn: frame.endColumn,
    };
  }

  async getScopes(frameId: number): Promise<Scope[]> {
    if (!this.dap) {
      return [];
    }

    try {
      const dapScopes = await this.dap.scopes(frameId);
      return dapScopes.map((scope) => this.convertDAPScope(scope));
    } catch (error) {
      log.error('Failed to get scopes', error as Error);
      return [];
    }
  }

  private convertDAPScope(scope: DAPScopeType): Scope {
    // Map DAP variables reference to local reference
    const localRef = this.nextVariablesReference();
    this.variableReferenceMap.set(localRef, scope.variablesReference);

    return {
      name: scope.name,
      variablesReference: localRef,
      namedVariables: scope.namedVariables,
      indexedVariables: scope.indexedVariables,
      expensive: scope.expensive,
    };
  }

  async getVariables(variablesReference: number): Promise<Variable[]> {
    if (!this.dap) {
      return [];
    }

    // Convert local reference back to DAP reference
    const dapRef = this.variableReferenceMap.get(variablesReference) || variablesReference;

    try {
      const dapVariables = await this.dap.variables(dapRef);
      return dapVariables.map((v) => this.convertDAPVariable(v));
    } catch (error) {
      log.error('Failed to get variables', error as Error);
      return [];
    }
  }

  private convertDAPVariable(variable: DAPVariable): Variable {
    let localRef = 0;
    if (variable.variablesReference > 0) {
      localRef = this.nextVariablesReference();
      this.variableReferenceMap.set(localRef, variable.variablesReference);
    }

    return {
      name: variable.name,
      value: variable.value,
      type: variable.type,
      variablesReference: localRef,
      namedVariables: variable.namedVariables,
      indexedVariables: variable.indexedVariables,
    };
  }

  async evaluate(
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    if (!this.dap) {
      throw new Error('Not connected to debugger');
    }

    try {
      const result = await this.dap.evaluate(expression, frameId, context);

      let localRef = 0;
      if (result.variablesReference > 0) {
        localRef = this.nextVariablesReference();
        this.variableReferenceMap.set(localRef, result.variablesReference);
      }

      return {
        result: result.result,
        type: result.type,
        variablesReference: localRef,
      };
    } catch (error) {
      return {
        result: `Error: ${(error as Error).message}`,
        type: 'error',
        variablesReference: 0,
      };
    }
  }
}

// ============================================================================
// DEBUG ADAPTER FACTORY
// ============================================================================

import {
  DebugLanguage,
  UniversalDebugAdapter,
  getSupportedLanguages,
  getLanguageConfig,
  detectLanguageFromFile,
  getLanguageDisplayNames,
  getLanguageCapabilitiesSummary,
  LANGUAGE_CONFIGS,
} from './multi-language-adapters';

// Re-export multi-language types and utilities
export {
  DebugLanguage,
  UniversalDebugAdapter,
  getSupportedLanguages,
  getLanguageConfig,
  detectLanguageFromFile,
  getLanguageDisplayNames,
  getLanguageCapabilitiesSummary,
  LANGUAGE_CONFIGS,
};

/**
 * Legacy factory for node/python (backwards compatibility)
 */
export function createDebugAdapter(type: 'node' | 'python'): DebugAdapter {
  switch (type) {
    case 'node':
      return new NodeDebugAdapter();
    case 'python':
      return new PythonDebugAdapter();
    default:
      throw new Error(`Unsupported debug type: ${type}`);
  }
}

/**
 * Create a universal debug adapter for any of the 30+ supported languages
 */
export function createUniversalDebugAdapter(language: DebugLanguage): UniversalDebugAdapter {
  return new UniversalDebugAdapter(language);
}

/**
 * Get list of all supported debug languages (30+)
 */
export function getAllSupportedLanguages(): DebugLanguage[] {
  return getSupportedLanguages();
}

/**
 * Auto-detect language from file path and create appropriate adapter
 */
export function createDebugAdapterForFile(filePath: string): UniversalDebugAdapter | null {
  const language = detectLanguageFromFile(filePath);
  if (!language) return null;
  return new UniversalDebugAdapter(language);
}
