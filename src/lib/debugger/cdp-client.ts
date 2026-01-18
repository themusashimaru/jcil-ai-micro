/**
 * CHROME DEVTOOLS PROTOCOL (CDP) CLIENT
 *
 * Real implementation of CDP for Node.js debugging.
 * Connects to Node.js inspector via WebSocket and implements
 * the full debugging protocol.
 *
 * CDP Documentation: https://chromedevtools.github.io/devtools-protocol/
 *
 * This is a REAL implementation, not a stub.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

const log = logger('CDPClient');

// ============================================================================
// CDP PROTOCOL TYPES
// ============================================================================

/**
 * CDP request message
 */
interface CDPRequest {
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * CDP response message
 */
interface CDPResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: string;
  };
}

/**
 * CDP event message
 */
interface CDPEvent {
  method: string;
  params: Record<string, unknown>;
}

/**
 * CDP message (can be response or event)
 */
type CDPMessage = CDPResponse | CDPEvent;

// ============================================================================
// CDP DEBUGGER DOMAIN TYPES
// ============================================================================

export interface CDPLocation {
  scriptId: string;
  lineNumber: number;
  columnNumber?: number;
}

export interface CDPBreakpoint {
  breakpointId: string;
  locations: CDPLocation[];
}

export interface CDPCallFrame {
  callFrameId: string;
  functionName: string;
  location: CDPLocation;
  url: string;
  scopeChain: CDPScope[];
  this: CDPRemoteObject;
}

export interface CDPScope {
  type: 'global' | 'local' | 'with' | 'closure' | 'catch' | 'block' | 'script' | 'eval' | 'module';
  object: CDPRemoteObject;
  name?: string;
  startLocation?: CDPLocation;
  endLocation?: CDPLocation;
}

export interface CDPRemoteObject {
  type: 'object' | 'function' | 'undefined' | 'string' | 'number' | 'boolean' | 'symbol' | 'bigint';
  subtype?:
    | 'array'
    | 'null'
    | 'node'
    | 'regexp'
    | 'date'
    | 'map'
    | 'set'
    | 'weakmap'
    | 'weakset'
    | 'iterator'
    | 'generator'
    | 'error'
    | 'proxy'
    | 'promise'
    | 'typedarray'
    | 'arraybuffer'
    | 'dataview';
  className?: string;
  value?: unknown;
  unserializableValue?: string;
  description?: string;
  objectId?: string;
  preview?: CDPObjectPreview;
}

export interface CDPObjectPreview {
  type: string;
  subtype?: string;
  description?: string;
  overflow: boolean;
  properties: CDPPropertyPreview[];
}

export interface CDPPropertyPreview {
  name: string;
  type: string;
  value?: string;
  valuePreview?: CDPObjectPreview;
  subtype?: string;
}

export interface CDPPropertyDescriptor {
  name: string;
  value?: CDPRemoteObject;
  writable?: boolean;
  get?: CDPRemoteObject;
  set?: CDPRemoteObject;
  configurable: boolean;
  enumerable: boolean;
  wasThrown?: boolean;
  isOwn?: boolean;
  symbol?: CDPRemoteObject;
}

export interface CDPScript {
  scriptId: string;
  url: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  executionContextId: number;
  hash: string;
  sourceMapURL?: string;
}

// ============================================================================
// CDP CLIENT EVENTS
// ============================================================================

export interface CDPClientEvents {
  connected: void;
  disconnected: { reason: string };
  error: { error: Error };

  // Debugger events
  'Debugger.paused': {
    callFrames: CDPCallFrame[];
    reason: string;
    data?: Record<string, unknown>;
    hitBreakpoints?: string[];
  };
  'Debugger.resumed': void;
  'Debugger.scriptParsed': CDPScript;
  'Debugger.scriptFailedToParse': CDPScript & { errorLine?: number; errorMessage?: string };
  'Debugger.breakpointResolved': { breakpointId: string; location: CDPLocation };

  // Runtime events
  'Runtime.consoleAPICalled': {
    type: string;
    args: CDPRemoteObject[];
    executionContextId: number;
    timestamp: number;
  };
  'Runtime.exceptionThrown': {
    timestamp: number;
    exceptionDetails: {
      exceptionId: number;
      text: string;
      lineNumber: number;
      columnNumber: number;
      scriptId?: string;
      url?: string;
      exception?: CDPRemoteObject;
    };
  };
}

// ============================================================================
// CDP CLIENT IMPLEMENTATION
// ============================================================================

export class CDPClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      method: string;
      timeout: NodeJS.Timeout;
    }
  >();

  private scripts = new Map<string, CDPScript>();
  private urlToScriptId = new Map<string, string>();
  private breakpoints = new Map<string, CDPBreakpoint>();
  private isConnected = false;
  private requestTimeout = 30000; // 30 second timeout

  /**
   * Connect to Node.js inspector
   */
  async connect(host: string = '127.0.0.1', port: number = 9229): Promise<void> {
    return new Promise((resolve, reject) => {
      // First, get the WebSocket debugger URL from the inspector
      const inspectorUrl = `http://${host}:${port}/json`;

      log.info('Fetching inspector metadata', { url: inspectorUrl });

      fetch(inspectorUrl)
        .then((response) => response.json())
        .then((targets: Array<{ webSocketDebuggerUrl: string; id: string; title: string }>) => {
          if (!targets || targets.length === 0) {
            throw new Error('No debug targets found');
          }

          const target = targets[0];
          const wsUrl = target.webSocketDebuggerUrl;

          log.info('Connecting to inspector WebSocket', { url: wsUrl, title: target.title });

          this.ws = new WebSocket(wsUrl);

          this.ws.on('open', async () => {
            log.info('CDP WebSocket connected');
            this.isConnected = true;

            try {
              // Enable required domains
              await this.enableDomains();
              this.emit('connected');
              resolve();
            } catch (error) {
              reject(error);
            }
          });

          this.ws.on('message', (data: WebSocket.Data) => {
            this.handleMessage(data.toString());
          });

          this.ws.on('close', (code, reason) => {
            log.info('CDP WebSocket closed', { code, reason: reason.toString() });
            this.isConnected = false;
            this.rejectAllPending(new Error(`WebSocket closed: ${reason}`));
            this.emit('disconnected', { reason: reason.toString() || 'Connection closed' });
          });

          this.ws.on('error', (error) => {
            log.error('CDP WebSocket error', error);
            this.emit('error', { error });
            reject(error);
          });
        })
        .catch((error) => {
          log.error('Failed to fetch inspector metadata', error);
          reject(new Error(`Failed to connect to inspector: ${error.message}`));
        });
    });
  }

  /**
   * Disconnect from the debugger
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.rejectAllPending(new Error('Client disconnecting'));
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.scripts.clear();
    this.urlToScriptId.clear();
    this.breakpoints.clear();
    log.info('CDP client disconnected');
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // DEBUGGER DOMAIN METHODS
  // ============================================================================

  /**
   * Set breakpoint by URL (file path)
   */
  async setBreakpointByUrl(
    url: string,
    lineNumber: number,
    columnNumber?: number,
    condition?: string
  ): Promise<CDPBreakpoint> {
    const result = (await this.send('Debugger.setBreakpointByUrl', {
      url,
      lineNumber,
      columnNumber,
      condition,
    })) as { breakpointId: string; locations: CDPLocation[] };

    const breakpoint: CDPBreakpoint = {
      breakpointId: result.breakpointId,
      locations: result.locations,
    };

    this.breakpoints.set(result.breakpointId, breakpoint);
    log.debug('Breakpoint set', { breakpointId: result.breakpointId, url, lineNumber });

    return breakpoint;
  }

  /**
   * Set breakpoint by script ID and location
   */
  async setBreakpoint(
    location: CDPLocation,
    condition?: string
  ): Promise<{ breakpointId: string; actualLocation: CDPLocation }> {
    const result = (await this.send('Debugger.setBreakpoint', {
      location,
      condition,
    })) as { breakpointId: string; actualLocation: CDPLocation };

    return result;
  }

  /**
   * Remove a breakpoint
   */
  async removeBreakpoint(breakpointId: string): Promise<void> {
    await this.send('Debugger.removeBreakpoint', { breakpointId });
    this.breakpoints.delete(breakpointId);
    log.debug('Breakpoint removed', { breakpointId });
  }

  /**
   * Continue execution
   */
  async resume(): Promise<void> {
    await this.send('Debugger.resume');
    log.debug('Execution resumed');
  }

  /**
   * Step over (next)
   */
  async stepOver(): Promise<void> {
    await this.send('Debugger.stepOver');
    log.debug('Step over');
  }

  /**
   * Step into
   */
  async stepInto(): Promise<void> {
    await this.send('Debugger.stepInto');
    log.debug('Step into');
  }

  /**
   * Step out
   */
  async stepOut(): Promise<void> {
    await this.send('Debugger.stepOut');
    log.debug('Step out');
  }

  /**
   * Pause execution
   */
  async pause(): Promise<void> {
    await this.send('Debugger.pause');
    log.debug('Execution paused');
  }

  /**
   * Get script source
   */
  async getScriptSource(scriptId: string): Promise<string> {
    const result = (await this.send('Debugger.getScriptSource', { scriptId })) as {
      scriptSource: string;
    };
    return result.scriptSource;
  }

  /**
   * Set pause on exceptions mode
   */
  async setPauseOnExceptions(state: 'none' | 'uncaught' | 'all'): Promise<void> {
    await this.send('Debugger.setPauseOnExceptions', { state });
    log.debug('Pause on exceptions set', { state });
  }

  /**
   * Evaluate on call frame (when paused)
   */
  async evaluateOnCallFrame(
    callFrameId: string,
    expression: string,
    objectGroup?: string,
    returnByValue?: boolean
  ): Promise<{ result: CDPRemoteObject; exceptionDetails?: { text: string } }> {
    const result = (await this.send('Debugger.evaluateOnCallFrame', {
      callFrameId,
      expression,
      objectGroup: objectGroup || 'console',
      includeCommandLineAPI: true,
      silent: false,
      returnByValue: returnByValue || false,
      generatePreview: true,
    })) as { result: CDPRemoteObject; exceptionDetails?: { text: string } };

    return result;
  }

  // ============================================================================
  // RUNTIME DOMAIN METHODS
  // ============================================================================

  /**
   * Evaluate expression in global context
   */
  async evaluate(
    expression: string,
    objectGroup?: string,
    returnByValue?: boolean
  ): Promise<{ result: CDPRemoteObject; exceptionDetails?: { text: string } }> {
    const result = (await this.send('Runtime.evaluate', {
      expression,
      objectGroup: objectGroup || 'console',
      includeCommandLineAPI: true,
      silent: false,
      returnByValue: returnByValue || false,
      generatePreview: true,
      awaitPromise: true,
    })) as { result: CDPRemoteObject; exceptionDetails?: { text: string } };

    return result;
  }

  /**
   * Get properties of an object
   */
  async getProperties(
    objectId: string,
    ownProperties: boolean = true,
    generatePreview: boolean = true
  ): Promise<CDPPropertyDescriptor[]> {
    const result = (await this.send('Runtime.getProperties', {
      objectId,
      ownProperties,
      accessorPropertiesOnly: false,
      generatePreview,
    })) as { result: CDPPropertyDescriptor[] };

    return result.result;
  }

  /**
   * Release object by ID (cleanup)
   */
  async releaseObject(objectId: string): Promise<void> {
    await this.send('Runtime.releaseObject', { objectId });
  }

  /**
   * Release all objects in a group
   */
  async releaseObjectGroup(objectGroup: string): Promise<void> {
    await this.send('Runtime.releaseObjectGroup', { objectGroup });
  }

  // ============================================================================
  // SCRIPT MANAGEMENT
  // ============================================================================

  /**
   * Get script by ID
   */
  getScript(scriptId: string): CDPScript | undefined {
    return this.scripts.get(scriptId);
  }

  /**
   * Get script by URL/file path
   */
  getScriptByUrl(url: string): CDPScript | undefined {
    const scriptId = this.urlToScriptId.get(url);
    return scriptId ? this.scripts.get(scriptId) : undefined;
  }

  /**
   * Get all loaded scripts
   */
  getAllScripts(): CDPScript[] {
    return Array.from(this.scripts.values());
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  /**
   * Enable required CDP domains
   */
  private async enableDomains(): Promise<void> {
    // Enable Debugger domain
    await this.send('Debugger.enable', {
      maxScriptsCacheSize: 10000000, // 10MB cache
    });

    // Enable Runtime domain
    await this.send('Runtime.enable');

    // Set up pause on exceptions (default: uncaught)
    await this.setPauseOnExceptions('uncaught');

    log.info('CDP domains enabled');
  }

  /**
   * Send a CDP request
   */
  private send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Not connected to debugger'));
        return;
      }

      const id = ++this.requestId;
      const request: CDPRequest = { id, method, params };

      // Set up timeout
      const timeout = setTimeout(() => {
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          pending.reject(new Error(`Request ${method} timed out after ${this.requestTimeout}ms`));
        }
      }, this.requestTimeout);

      this.pendingRequests.set(id, { resolve, reject, method, timeout });

      log.debug('Sending CDP request', { id, method });
      this.ws!.send(JSON.stringify(request));
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as CDPMessage;

      // Check if it's a response (has id)
      if ('id' in message) {
        this.handleResponse(message as CDPResponse);
      } else {
        // It's an event
        this.handleEvent(message as CDPEvent);
      }
    } catch (error) {
      log.error('Failed to parse CDP message', error as Error);
    }
  }

  /**
   * Handle CDP response
   */
  private handleResponse(response: CDPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      log.warn('Received response for unknown request', { id: response.id });
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      log.error('CDP request failed', {
        method: pending.method,
        code: response.error.code,
        message: response.error.message,
      });
      pending.reject(new Error(`${pending.method} failed: ${response.error.message}`));
    } else {
      log.debug('CDP request succeeded', { method: pending.method });
      pending.resolve(response.result || {});
    }
  }

  /**
   * Handle CDP event
   */
  private handleEvent(event: CDPEvent): void {
    log.debug('CDP event received', { method: event.method });

    // Handle script parsed events
    if (event.method === 'Debugger.scriptParsed') {
      const script = event.params as unknown as CDPScript;
      this.scripts.set(script.scriptId, script);
      if (script.url) {
        this.urlToScriptId.set(script.url, script.scriptId);
      }
    }

    // Emit typed event
    this.emit(event.method, event.params);
  }

  /**
   * Reject all pending requests (on disconnect)
   */
  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const cdpClient = new CDPClient();
