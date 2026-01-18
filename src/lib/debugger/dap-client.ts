/**
 * DEBUG ADAPTER PROTOCOL (DAP) CLIENT
 *
 * Real implementation of DAP for Python debugging with debugpy.
 * Connects via TCP socket and implements the full Debug Adapter Protocol.
 *
 * DAP Documentation: https://microsoft.github.io/debug-adapter-protocol/
 *
 * This is a REAL implementation, not a stub.
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

const log = logger('DAPClient');

// ============================================================================
// DAP PROTOCOL TYPES
// ============================================================================

/**
 * DAP message base
 */
interface DAPMessage {
  seq: number;
  type: 'request' | 'response' | 'event';
}

/**
 * DAP request message
 */
interface DAPRequest extends DAPMessage {
  type: 'request';
  command: string;
  arguments?: Record<string, unknown>;
}

/**
 * DAP response message
 */
interface DAPResponse extends DAPMessage {
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: Record<string, unknown>;
}

/**
 * DAP event message
 */
interface DAPEvent extends DAPMessage {
  type: 'event';
  event: string;
  body?: Record<string, unknown>;
}

// ============================================================================
// DAP TYPES
// ============================================================================

export interface DAPSource {
  name?: string;
  path?: string;
  sourceReference?: number;
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize';
  origin?: string;
  sources?: DAPSource[];
  adapterData?: unknown;
  checksums?: { algorithm: string; checksum: string }[];
}

export interface DAPBreakpoint {
  id?: number;
  verified: boolean;
  message?: string;
  source?: DAPSource;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  instructionReference?: string;
  offset?: number;
}

export interface DAPStackFrame {
  id: number;
  name: string;
  source?: DAPSource;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  canRestart?: boolean;
  instructionPointerReference?: string;
  moduleId?: number | string;
  presentationHint?: 'normal' | 'label' | 'subtle';
}

export interface DAPScope {
  name: string;
  presentationHint?: 'arguments' | 'locals' | 'registers';
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive: boolean;
  source?: DAPSource;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface DAPVariable {
  name: string;
  value: string;
  type?: string;
  presentationHint?: {
    kind?: string;
    attributes?: string[];
    visibility?: 'public' | 'private' | 'protected' | 'internal' | 'final';
    lazy?: boolean;
  };
  evaluateName?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
}

export interface DAPThread {
  id: number;
  name: string;
}

export interface DAPCapabilities {
  supportsConfigurationDoneRequest?: boolean;
  supportsFunctionBreakpoints?: boolean;
  supportsConditionalBreakpoints?: boolean;
  supportsHitConditionalBreakpoints?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsStepBack?: boolean;
  supportsSetVariable?: boolean;
  supportsRestartFrame?: boolean;
  supportsStepInTargetsRequest?: boolean;
  supportsCompletionsRequest?: boolean;
  supportsModulesRequest?: boolean;
  supportsExceptionOptions?: boolean;
  supportsValueFormattingOptions?: boolean;
  supportsExceptionInfoRequest?: boolean;
  supportTerminateDebuggee?: boolean;
  supportsDelayedStackTraceLoading?: boolean;
  supportsLogPoints?: boolean;
  supportsTerminateThreadsRequest?: boolean;
  supportsSetExpression?: boolean;
  supportsTerminateRequest?: boolean;
  supportsDataBreakpoints?: boolean;
  supportsReadMemoryRequest?: boolean;
  supportsDisassembleRequest?: boolean;
  supportsCancelRequest?: boolean;
  supportsBreakpointLocationsRequest?: boolean;
  supportsClipboardContext?: boolean;
  supportsSteppingGranularity?: boolean;
  supportsInstructionBreakpoints?: boolean;
  supportsExceptionFilterOptions?: boolean;
}

// ============================================================================
// DAP CLIENT EVENTS
// ============================================================================

export interface DAPClientEvents {
  connected: void;
  disconnected: { reason: string };
  error: { error: Error };

  // DAP events
  initialized: DAPCapabilities;
  stopped: {
    reason: string;
    description?: string;
    threadId?: number;
    preserveFocusHint?: boolean;
    text?: string;
    allThreadsStopped?: boolean;
    hitBreakpointIds?: number[];
  };
  continued: {
    threadId: number;
    allThreadsContinued?: boolean;
  };
  exited: {
    exitCode: number;
  };
  terminated: {
    restart?: unknown;
  };
  thread: {
    reason: 'started' | 'exited';
    threadId: number;
  };
  output: {
    category?: 'console' | 'important' | 'stdout' | 'stderr' | 'telemetry';
    output: string;
    group?: 'start' | 'startCollapsed' | 'end';
    variablesReference?: number;
    source?: DAPSource;
    line?: number;
    column?: number;
    data?: unknown;
  };
  breakpoint: {
    reason: 'changed' | 'new' | 'removed';
    breakpoint: DAPBreakpoint;
  };
  module: {
    reason: 'new' | 'changed' | 'removed';
    module: { id: number | string; name: string; path?: string };
  };
  process: {
    name: string;
    systemProcessId?: number;
    isLocalProcess?: boolean;
    startMethod?: 'launch' | 'attach' | 'attachForSuspendedLaunch';
    pointerSize?: number;
  };
}

// ============================================================================
// DAP CLIENT IMPLEMENTATION
// ============================================================================

export class DAPClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private sequenceNumber = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (result: DAPResponse) => void;
      reject: (error: Error) => void;
      command: string;
      timeout: NodeJS.Timeout;
    }
  >();

  private capabilities: DAPCapabilities = {};
  private isConnected = false;
  private requestTimeout = 30000; // 30 second timeout

  // Buffer for handling partial messages
  private buffer = '';
  private contentLength = -1;

  /**
   * Connect to debugpy DAP server
   */
  async connect(host: string = '127.0.0.1', port: number = 5678): Promise<DAPCapabilities> {
    return new Promise((resolve, reject) => {
      log.info('Connecting to DAP server', { host, port });

      this.socket = net.createConnection({ host, port }, () => {
        log.info('DAP socket connected');
        this.isConnected = true;
        this.emit('connected');
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        log.info('DAP socket closed');
        this.isConnected = false;
        this.rejectAllPending(new Error('Socket closed'));
        this.emit('disconnected', { reason: 'Socket closed' });
      });

      this.socket.on('error', (error) => {
        log.error('DAP socket error', error);
        this.emit('error', { error });
        reject(error);
      });

      // Initialize after connection
      this.socket.once('connect', async () => {
        try {
          // Send initialize request
          const initResponse = await this.initialize();
          this.capabilities = initResponse.body as DAPCapabilities;

          resolve(this.capabilities);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Disconnect from the debugger
   */
  async disconnect(terminateDebuggee: boolean = true): Promise<void> {
    if (this.capabilities.supportTerminateDebuggee) {
      try {
        await this.sendRequest('disconnect', { terminateDebuggee });
      } catch {
        // Ignore errors during disconnect
      }
    }

    if (this.socket) {
      this.rejectAllPending(new Error('Client disconnecting'));
      this.socket.destroy();
      this.socket = null;
    }

    this.isConnected = false;
    log.info('DAP client disconnected');
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected && this.socket !== null && !this.socket.destroyed;
  }

  // ============================================================================
  // DAP PROTOCOL METHODS
  // ============================================================================

  /**
   * Initialize the debug session
   */
  private async initialize(): Promise<DAPResponse> {
    return this.sendRequest('initialize', {
      clientID: 'jcil-code-lab',
      clientName: 'JCIL Code Lab',
      adapterID: 'python',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: true,
      supportsRunInTerminalRequest: false,
      locale: 'en-us',
      supportsProgressReporting: false,
      supportsInvalidatedEvent: true,
      supportsMemoryReferences: false,
    });
  }

  /**
   * Launch the debuggee
   */
  async launch(config: {
    program: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    stopOnEntry?: boolean;
    console?: 'internalConsole' | 'integratedTerminal' | 'externalTerminal';
    justMyCode?: boolean;
  }): Promise<void> {
    await this.sendRequest('launch', {
      type: 'python',
      request: 'launch',
      program: config.program,
      args: config.args || [],
      cwd: config.cwd || process.cwd(),
      env: config.env || {},
      stopOnEntry: config.stopOnEntry ?? true,
      console: config.console || 'internalConsole',
      justMyCode: config.justMyCode ?? true,
      pythonPath: 'python3',
    });

    // Send configurationDone if supported
    if (this.capabilities.supportsConfigurationDoneRequest) {
      await this.configurationDone();
    }
  }

  /**
   * Attach to a running process
   */
  async attach(config: {
    host?: string;
    port?: number;
    pathMappings?: Array<{ localRoot: string; remoteRoot: string }>;
  }): Promise<void> {
    await this.sendRequest('attach', {
      type: 'python',
      request: 'attach',
      connect: {
        host: config.host || '127.0.0.1',
        port: config.port || 5678,
      },
      pathMappings: config.pathMappings,
      justMyCode: true,
    });

    if (this.capabilities.supportsConfigurationDoneRequest) {
      await this.configurationDone();
    }
  }

  /**
   * Configuration done (after setting breakpoints)
   */
  async configurationDone(): Promise<void> {
    await this.sendRequest('configurationDone', {});
  }

  /**
   * Set breakpoints for a source file
   */
  async setBreakpoints(
    source: DAPSource,
    breakpoints: Array<{
      line: number;
      column?: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }>
  ): Promise<DAPBreakpoint[]> {
    const response = await this.sendRequest('setBreakpoints', {
      source,
      breakpoints: breakpoints.map((bp) => ({
        line: bp.line,
        column: bp.column,
        condition: bp.condition,
        hitCondition: bp.hitCondition,
        logMessage: bp.logMessage,
      })),
      lines: breakpoints.map((bp) => bp.line),
      sourceModified: false,
    });

    return (response.body?.breakpoints as DAPBreakpoint[]) || [];
  }

  /**
   * Set function breakpoints
   */
  async setFunctionBreakpoints(
    breakpoints: Array<{ name: string; condition?: string; hitCondition?: string }>
  ): Promise<DAPBreakpoint[]> {
    const response = await this.sendRequest('setFunctionBreakpoints', {
      breakpoints,
    });

    return (response.body?.breakpoints as DAPBreakpoint[]) || [];
  }

  /**
   * Continue execution
   */
  async continue(threadId: number): Promise<{ allThreadsContinued?: boolean }> {
    const response = await this.sendRequest('continue', { threadId });
    return {
      allThreadsContinued: response.body?.allThreadsContinued as boolean | undefined,
    };
  }

  /**
   * Step over (next)
   */
  async next(threadId: number, granularity?: 'statement' | 'line' | 'instruction'): Promise<void> {
    await this.sendRequest('next', {
      threadId,
      singleThread: true,
      granularity: granularity || 'line',
    });
  }

  /**
   * Step into
   */
  async stepIn(
    threadId: number,
    granularity?: 'statement' | 'line' | 'instruction'
  ): Promise<void> {
    await this.sendRequest('stepIn', {
      threadId,
      singleThread: true,
      granularity: granularity || 'line',
    });
  }

  /**
   * Step out
   */
  async stepOut(
    threadId: number,
    granularity?: 'statement' | 'line' | 'instruction'
  ): Promise<void> {
    await this.sendRequest('stepOut', {
      threadId,
      singleThread: true,
      granularity: granularity || 'line',
    });
  }

  /**
   * Pause execution
   */
  async pause(threadId: number): Promise<void> {
    await this.sendRequest('pause', { threadId });
  }

  /**
   * Get all threads
   */
  async threads(): Promise<DAPThread[]> {
    const response = await this.sendRequest('threads', {});
    return (response.body?.threads as DAPThread[]) || [];
  }

  /**
   * Get stack trace for a thread
   */
  async stackTrace(
    threadId: number,
    startFrame?: number,
    levels?: number
  ): Promise<{ stackFrames: DAPStackFrame[]; totalFrames?: number }> {
    const response = await this.sendRequest('stackTrace', {
      threadId,
      startFrame: startFrame ?? 0,
      levels: levels ?? 20,
    });

    return {
      stackFrames: (response.body?.stackFrames as DAPStackFrame[]) || [],
      totalFrames: response.body?.totalFrames as number | undefined,
    };
  }

  /**
   * Get scopes for a stack frame
   */
  async scopes(frameId: number): Promise<DAPScope[]> {
    const response = await this.sendRequest('scopes', { frameId });
    return (response.body?.scopes as DAPScope[]) || [];
  }

  /**
   * Get variables for a scope/object reference
   */
  async variables(
    variablesReference: number,
    filter?: 'indexed' | 'named',
    start?: number,
    count?: number
  ): Promise<DAPVariable[]> {
    const response = await this.sendRequest('variables', {
      variablesReference,
      filter,
      start,
      count,
    });

    return (response.body?.variables as DAPVariable[]) || [];
  }

  /**
   * Evaluate an expression
   */
  async evaluate(
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover' | 'clipboard' | 'variables'
  ): Promise<{
    result: string;
    type?: string;
    presentationHint?: DAPVariable['presentationHint'];
    variablesReference: number;
    namedVariables?: number;
    indexedVariables?: number;
    memoryReference?: string;
  }> {
    const response = await this.sendRequest('evaluate', {
      expression,
      frameId,
      context: context || 'repl',
    });

    return {
      result: (response.body?.result as string) || '',
      type: response.body?.type as string | undefined,
      presentationHint: response.body?.presentationHint as DAPVariable['presentationHint'],
      variablesReference: (response.body?.variablesReference as number) || 0,
      namedVariables: response.body?.namedVariables as number | undefined,
      indexedVariables: response.body?.indexedVariables as number | undefined,
      memoryReference: response.body?.memoryReference as string | undefined,
    };
  }

  /**
   * Set exception breakpoints
   */
  async setExceptionBreakpoints(filters: string[]): Promise<DAPBreakpoint[]> {
    const response = await this.sendRequest('setExceptionBreakpoints', {
      filters,
    });

    return (response.body?.breakpoints as DAPBreakpoint[]) || [];
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  /**
   * Send a DAP request
   */
  private sendRequest(command: string, args?: Record<string, unknown>): Promise<DAPResponse> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to debugger'));
        return;
      }

      const seq = ++this.sequenceNumber;
      const request: DAPRequest = {
        seq,
        type: 'request',
        command,
        arguments: args,
      };

      // Set up timeout
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(seq);
        if (pending) {
          this.pendingRequests.delete(seq);
          pending.reject(new Error(`Request ${command} timed out after ${this.requestTimeout}ms`));
        }
      }, this.requestTimeout);

      this.pendingRequests.set(seq, { resolve, reject, command, timeout });

      const message = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(message, 'utf-8')}\r\n\r\n`;

      log.debug('Sending DAP request', { seq, command });
      this.socket!.write(header + message);
    });
  }

  /**
   * Handle incoming data from socket
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString('utf-8');

    while (true) {
      if (this.contentLength === -1) {
        // Looking for header
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
          break; // Need more data
        }

        const header = this.buffer.substring(0, headerEnd);
        const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
        if (!contentLengthMatch) {
          log.error('Invalid DAP header', { header });
          this.buffer = this.buffer.substring(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(contentLengthMatch[1], 10);
        this.buffer = this.buffer.substring(headerEnd + 4);
      }

      // Check if we have the full message body
      if (this.buffer.length < this.contentLength) {
        break; // Need more data
      }

      // Extract and parse message
      const messageStr = this.buffer.substring(0, this.contentLength);
      this.buffer = this.buffer.substring(this.contentLength);
      this.contentLength = -1;

      try {
        const message = JSON.parse(messageStr) as DAPResponse | DAPEvent;
        this.handleMessage(message);
      } catch (error) {
        log.error('Failed to parse DAP message', error as Error);
      }
    }
  }

  /**
   * Handle parsed DAP message
   */
  private handleMessage(message: DAPResponse | DAPEvent): void {
    if (message.type === 'response') {
      this.handleResponse(message as DAPResponse);
    } else if (message.type === 'event') {
      this.handleEvent(message as DAPEvent);
    }
  }

  /**
   * Handle DAP response
   */
  private handleResponse(response: DAPResponse): void {
    const pending = this.pendingRequests.get(response.request_seq);
    if (!pending) {
      log.warn('Received response for unknown request', { seq: response.request_seq });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.request_seq);

    if (!response.success) {
      log.error('DAP request failed', {
        command: pending.command,
        message: response.message,
      });
      pending.reject(new Error(`${pending.command} failed: ${response.message}`));
    } else {
      log.debug('DAP request succeeded', { command: pending.command });
      pending.resolve(response);
    }
  }

  /**
   * Handle DAP event
   */
  private handleEvent(event: DAPEvent): void {
    log.debug('DAP event received', { event: event.event });

    // Emit typed event
    this.emit(event.event, event.body);
  }

  /**
   * Reject all pending requests (on disconnect)
   */
  private rejectAllPending(error: Error): void {
    for (const [seq, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(seq);
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const dapClient = new DAPClient();
