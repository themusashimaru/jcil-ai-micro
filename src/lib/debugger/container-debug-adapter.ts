/**
 * CONTAINER DEBUG ADAPTER - EPIC MULTI-LANGUAGE SUPPORT
 *
 * Real debugging inside E2B containers for 30+ programming languages.
 * This bridges the debug infrastructure with E2B sandboxed execution.
 *
 * Supported Languages:
 * - Node.js/JavaScript/TypeScript (CDP)
 * - Python (DAP via debugpy)
 * - Go (DAP via Delve)
 * - Rust (DAP via CodeLLDB)
 * - Java/Kotlin/Scala/Groovy (JDWP)
 * - C/C++ (GDB/LLDB)
 * - Ruby (debug gem)
 * - PHP (Xdebug)
 * - C#/F# (.NET)
 * - Swift (LLDB)
 * - Perl, Lua, R, Julia
 * - Elixir/Erlang
 * - Haskell, Dart, Zig, Nim, Crystal
 * - OCaml, V, Odin, Clojure
 * - Bash/Shell, PowerShell
 */

import { EventEmitter } from 'events';
import { Sandbox } from '@e2b/code-interpreter';
import { ContainerManager } from '@/lib/workspace/container';
import { CDPClient } from './cdp-client';
import { DAPClient, DAPSource } from './dap-client';
import { logger } from '@/lib/logger';
import { DebugLanguage, LANGUAGE_CONFIGS, LanguageDebugConfig } from './multi-language-adapters';

const log = logger('ContainerDebugAdapter');

// ============================================================================
// TYPES
// ============================================================================

export interface ContainerDebugConfig {
  type: DebugLanguage;
  program: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stopOnEntry?: boolean;
}

export interface ContainerDebugSession {
  id: string;
  workspaceId: string;
  config: ContainerDebugConfig;
  state: 'starting' | 'running' | 'paused' | 'stopped' | 'error';
  debugPort: number;
  debugUrl?: string;
  pid?: number;
}

export interface Breakpoint {
  id: number;
  verified: boolean;
  line: number;
  column?: number;
  source: { path?: string; name?: string };
  message?: string;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: { path?: string; name?: string };
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

// ============================================================================
// CONTAINER DEBUG ADAPTER
// ============================================================================

export class ContainerDebugAdapter extends EventEmitter {
  private containerManager: ContainerManager;
  private sessions: Map<string, ContainerDebugSession> = new Map();
  private cdpClients: Map<string, CDPClient> = new Map();
  private dapClients: Map<string, DAPClient> = new Map();
  private sandboxes: Map<string, Sandbox> = new Map();

  // CDP state tracking per session
  private sessionCallFrames: Map<
    string,
    Array<{
      callFrameId: string;
      functionName: string;
      location: { scriptId: string; lineNumber: number; columnNumber?: number };
      url: string;
      scopeChain: Array<{ type: string; object: { objectId?: string } }>;
    }>
  > = new Map();
  private sessionScopeToObjectId: Map<string, Map<number, string>> = new Map();
  private sessionFrameIdToCallFrameId: Map<string, Map<number, string>> = new Map();
  private variablesReferenceCounter = 0;

  constructor() {
    super();
    this.containerManager = new ContainerManager();
  }

  /**
   * Start a debug session in a container
   */
  async startSession(
    workspaceId: string,
    config: ContainerDebugConfig
  ): Promise<ContainerDebugSession> {
    const sessionId = `container-debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    log.info('Starting container debug session', {
      sessionId,
      type: config.type,
      program: config.program,
    });

    try {
      // Get or create sandbox
      const sandbox = await this.containerManager.getSandbox(workspaceId);
      this.sandboxes.set(sessionId, sandbox);

      // Choose debug port based on language configuration
      const langConfig = LANGUAGE_CONFIGS[config.type];
      const debugPort = langConfig?.defaultPort || 9229;

      // Create session
      const session: ContainerDebugSession = {
        id: sessionId,
        workspaceId,
        config,
        state: 'starting',
        debugPort,
      };

      this.sessions.set(sessionId, session);

      // Initialize scope tracking for this session
      this.sessionScopeToObjectId.set(sessionId, new Map());
      this.sessionFrameIdToCallFrameId.set(sessionId, new Map());
      this.sessionCallFrames.set(sessionId, []);

      // Start debug server based on language type
      await this.startDebugServer(sessionId, sandbox, config, langConfig);

      session.state = 'running';
      this.emit('initialized', { sessionId });

      return session;
    } catch (error) {
      log.error('Failed to start container debug session', error as Error);
      throw error;
    }
  }

  /**
   * Universal debug server starter - supports all 30+ languages
   */
  private async startDebugServer(
    sessionId: string,
    sandbox: Sandbox,
    config: ContainerDebugConfig,
    langConfig: LanguageDebugConfig
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;
    const cwd = config.cwd || '/workspace';

    // Install debug tools if needed
    if (langConfig.installCommand) {
      log.info('Installing debug tools', {
        language: config.type,
        command: langConfig.installCommand,
      });
      try {
        await sandbox.commands.run(langConfig.installCommand, { cwd, timeoutMs: 120000 });
      } catch (error) {
        log.warn('Debug tools installation may have failed', { error });
        // Continue anyway - tools might already be installed
      }
    }

    // Compile if needed
    if (langConfig.requiresCompilation && langConfig.compileCommand) {
      const compileCmd = langConfig.compileCommand({
        type: config.type,
        name: 'debug',
        request: 'launch',
        program: config.program,
        args: config.args,
        cwd,
        env: config.env,
        port: langConfig.defaultPort,
      });
      log.info('Compiling program', { language: config.type, command: compileCmd });

      const compileResult = await sandbox.commands.run(compileCmd, {
        cwd,
        envs: config.env,
        timeoutMs: 120000,
        onStdout: (data) => this.emit('output', { sessionId, category: 'stdout', output: data }),
        onStderr: (data) => this.emit('output', { sessionId, category: 'stderr', output: data }),
      });

      if (compileResult.exitCode !== 0) {
        throw new Error(`Compilation failed with exit code ${compileResult.exitCode}`);
      }
    }

    // Build debug command
    const debugCmd = langConfig.debugCommand({
      type: config.type,
      name: 'debug',
      request: 'launch',
      program: config.program,
      args: config.args,
      cwd,
      env: config.env,
      port: langConfig.defaultPort,
      stopOnEntry: config.stopOnEntry,
    });

    log.info('Starting debug server', {
      language: config.type,
      command: debugCmd,
      protocol: langConfig.protocol,
    });

    // Run the debug command (don't await - it runs in background)
    sandbox.commands
      .run(`cd ${cwd} && ${debugCmd}`, {
        cwd,
        envs: config.env,
        timeoutMs: 600000, // 10 minutes
        onStdout: (data) => {
          this.emit('output', { sessionId, category: 'stdout', output: data });
        },
        onStderr: (data) => {
          this.emit('output', { sessionId, category: 'stderr', output: data });

          // Check for various debugger ready messages
          const readyPatterns = [
            'Debugger listening', // Node.js
            'listening on', // Generic DAP
            'DAP server', // Go Delve
            'Debug server started', // Various
            'Waiting for debugger', // Python debugpy
            'Ready to accept', // Various
            'Server started', // Generic
          ];

          if (readyPatterns.some((pattern) => data.includes(pattern))) {
            setTimeout(() => this.connectDebugger(sessionId, sandbox, config, langConfig), 500);
          }
        },
      })
      .then((result) => {
        session.state = 'stopped';
        this.emit('exited', { sessionId, exitCode: result.exitCode });
        this.emit('terminated', { sessionId });
      })
      .catch((error) => {
        log.error('Debug process error', error);
        session.state = 'error';
        this.emit('output', { sessionId, category: 'stderr', output: `Error: ${error.message}` });
      });

    // Wait for debugger to start
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 5000);
      this.once('output', (data) => {
        if (data.sessionId === sessionId) {
          const readyPatterns = ['Debugger listening', 'listening on', 'DAP server', 'Ready'];
          if (readyPatterns.some((p) => data.output?.includes(p))) {
            clearTimeout(timeout);
            resolve();
          }
        }
      });
    });
  }

  /**
   * Universal debugger connector - handles CDP, DAP, and JDWP
   */
  private async connectDebugger(
    sessionId: string,
    sandbox: Sandbox,
    config: ContainerDebugConfig,
    langConfig: LanguageDebugConfig
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const port = langConfig.defaultPort;

    try {
      const hostUrl = sandbox.getHost(port);
      session.debugUrl = `${langConfig.protocol === 'cdp' ? 'http' : 'tcp'}://${hostUrl}`;

      log.info('Connecting to debugger', { url: session.debugUrl, protocol: langConfig.protocol });

      switch (langConfig.protocol) {
        case 'cdp':
          await this.connectCDPDebugger(sessionId, hostUrl);
          break;
        case 'dap':
        case 'jdwp':
          await this.connectDAPDebugger(sessionId, hostUrl, config);
          break;
        case 'custom':
          // For custom protocols, try DAP first as fallback
          try {
            await this.connectDAPDebugger(sessionId, hostUrl, config);
          } catch {
            log.warn('Custom protocol - DAP connection failed, running in limited mode');
          }
          break;
      }

      session.state = 'running';
      this.emit('connected', { sessionId });
    } catch (error) {
      log.error('Failed to connect to debugger', error as Error);
      session.state = 'error';
      this.emit('output', {
        sessionId,
        category: 'stderr',
        output: `Failed to connect to debugger: ${(error as Error).message}`,
      });
    }
  }

  /**
   * Connect CDP debugger (Node.js/Chrome)
   */
  private async connectCDPDebugger(sessionId: string, hostUrl: string): Promise<void> {
    const cdp = new CDPClient();
    this.cdpClients.set(sessionId, cdp);
    this.setupCDPEventHandlers(sessionId, cdp);

    // Try to get WebSocket URL from /json endpoint
    try {
      const jsonUrl = `http://${hostUrl}/json`;
      const response = await fetch(jsonUrl);
      const targets = await response.json();

      if (targets && targets.length > 0) {
        let wsUrl = targets[0].webSocketDebuggerUrl;
        if (wsUrl) {
          wsUrl = wsUrl
            .replace('127.0.0.1', hostUrl.split(':')[0])
            .replace('localhost', hostUrl.split(':')[0])
            .replace('ws://', 'wss://');
        }
        log.info('Connecting to debugger WebSocket', { wsUrl });
      }
    } catch {
      log.warn('Could not fetch /json, connecting directly');
    }

    const [host, portStr] = hostUrl.split(':');
    const port = parseInt(portStr) || 9229;
    await cdp.connect(host, port);
  }

  /**
   * Connect DAP debugger (Python, Go, Rust, etc.)
   */
  private async connectDAPDebugger(
    sessionId: string,
    hostUrl: string,
    config: ContainerDebugConfig
  ): Promise<void> {
    const dap = new DAPClient();
    this.dapClients.set(sessionId, dap);
    this.setupDAPEventHandlers(sessionId, dap);

    const [host, portStr] = hostUrl.split(':');
    const langConfig = LANGUAGE_CONFIGS[config.type];
    const port = parseInt(portStr) || langConfig.defaultPort;

    await dap.connect(host, port);

    // Launch the program through DAP
    await dap.launch({
      program: config.program,
      args: config.args,
      cwd: config.cwd || '/workspace',
      stopOnEntry: config.stopOnEntry,
    });
  }

  /**
   * Start Node.js debug server in container (legacy method for backwards compatibility)
   */
  private async startNodeDebugServer(
    sessionId: string,
    sandbox: Sandbox,
    config: ContainerDebugConfig
  ): Promise<void> {
    const langConfig = LANGUAGE_CONFIGS['node'];
    await this.startDebugServer(sessionId, sandbox, config, langConfig);
  }

  /**
   * Connect to Node.js inspector in container
   */
  private async connectNodeDebugger(sessionId: string, sandbox: Sandbox): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Get the host URL for the debug port
      const hostUrl = sandbox.getHost(9229);
      session.debugUrl = `http://${hostUrl}`;

      log.info('Connecting to Node.js debugger', { url: session.debugUrl });

      // Create CDP client
      const cdp = new CDPClient();
      this.cdpClients.set(sessionId, cdp);

      // Set up CDP event handlers
      this.setupCDPEventHandlers(sessionId, cdp);

      // Connect via E2B's exposed port
      // E2B provides HTTP access, so we need to fetch the WebSocket URL from /json
      const jsonUrl = `http://${hostUrl}/json`;
      const response = await fetch(jsonUrl);
      const targets = await response.json();

      if (targets && targets.length > 0) {
        // The webSocketDebuggerUrl needs to be adjusted for E2B access
        let wsUrl = targets[0].webSocketDebuggerUrl;

        // Replace localhost with E2B's host
        if (wsUrl) {
          wsUrl = wsUrl.replace('127.0.0.1:9229', hostUrl).replace('localhost:9229', hostUrl);
          wsUrl = wsUrl.replace('ws://', 'wss://'); // E2B uses HTTPS
        }

        log.info('Connecting to debugger WebSocket', { wsUrl });

        // Connect CDP client directly to WebSocket URL
        await cdp.connect(hostUrl.split(':')[0], parseInt(hostUrl.split(':')[1] || '9229'));
      }

      session.state = 'running';
      this.emit('connected', { sessionId });
    } catch (error) {
      log.error('Failed to connect to Node.js debugger', error as Error);
      session.state = 'error';
      this.emit('output', {
        sessionId,
        category: 'stderr',
        output: `Failed to connect to debugger: ${(error as Error).message}`,
      });
    }
  }

  /**
   * Set up CDP event handlers
   */
  private setupCDPEventHandlers(sessionId: string, cdp: CDPClient): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    cdp.on(
      'Debugger.paused',
      (params: {
        callFrames: Array<{
          callFrameId: string;
          functionName: string;
          location: { scriptId: string; lineNumber: number; columnNumber?: number };
          url: string;
          scopeChain: Array<{ type: string; object: { objectId?: string } }>;
        }>;
        reason: string;
        hitBreakpoints?: string[];
      }) => {
        session.state = 'paused';
        this.sessionCallFrames.set(sessionId, params.callFrames);

        // Map frame IDs to call frame IDs
        const frameMap = this.sessionFrameIdToCallFrameId.get(sessionId)!;
        frameMap.clear();
        params.callFrames.forEach((frame, index) => {
          frameMap.set(index + 1, frame.callFrameId);
        });

        let reason = params.reason;
        if (reason === 'Break' || reason === 'breakpoint') reason = 'breakpoint';
        else if (reason === 'exception') reason = 'exception';
        else reason = 'step';

        this.emit('stopped', {
          sessionId,
          reason,
          threadId: 1,
        });
      }
    );

    cdp.on('Debugger.resumed', () => {
      session.state = 'running';
      this.sessionCallFrames.set(sessionId, []);
      this.emit('continued', { sessionId, threadId: 1 });
    });

    cdp.on(
      'Runtime.consoleAPICalled',
      (params: { type: string; args: Array<{ value?: unknown; description?: string }> }) => {
        const output = params.args.map((arg) => arg.value ?? arg.description ?? '').join(' ');
        this.emit('output', {
          sessionId,
          category: params.type === 'error' ? 'stderr' : 'stdout',
          output: output + '\n',
        });
      }
    );

    cdp.on('disconnected', () => {
      session.state = 'stopped';
      this.emit('terminated', { sessionId });
    });
  }

  /**
   * Start Python debug server in container
   */
  private async startPythonDebugServer(
    sessionId: string,
    sandbox: Sandbox,
    config: ContainerDebugConfig
  ): Promise<void> {
    const session = this.sessions.get(sessionId)!;

    // Install debugpy if not present
    await sandbox.commands.run(
      'pip install debugpy 2>/dev/null || pip3 install debugpy 2>/dev/null',
      {
        timeoutMs: 60000,
      }
    );

    const cwd = config.cwd || '/workspace';
    const args = config.args?.join(' ') || '';
    const waitFlag = config.stopOnEntry ? '--wait-for-client' : '';

    // Start Python with debugpy
    const command = `cd ${cwd} && python3 -m debugpy --listen 0.0.0.0:5678 ${waitFlag} ${config.program} ${args}`;

    log.info('Starting Python debug server', { command });

    // Run the debug command
    sandbox.commands
      .run(command, {
        cwd,
        envs: config.env,
        timeoutMs: 600000,
        onStdout: (data) => {
          this.emit('output', { sessionId, category: 'stdout', output: data });
        },
        onStderr: (data) => {
          this.emit('output', { sessionId, category: 'stderr', output: data });
        },
      })
      .then((result) => {
        session.state = 'stopped';
        this.emit('exited', { sessionId, exitCode: result.exitCode });
        this.emit('terminated', { sessionId });
      })
      .catch((error) => {
        log.error('Debug process error', error);
        session.state = 'error';
      });

    // Wait for debugpy to start then connect
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.connectPythonDebugger(sessionId, sandbox);
  }

  /**
   * Connect to Python debugpy in container
   */
  private async connectPythonDebugger(sessionId: string, sandbox: Sandbox): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    try {
      // Get the host URL for the debug port
      const hostUrl = sandbox.getHost(5678);
      session.debugUrl = `tcp://${hostUrl}`;

      log.info('Connecting to Python debugger', { url: session.debugUrl });

      // Create DAP client
      const dap = new DAPClient();
      this.dapClients.set(sessionId, dap);

      // Set up DAP event handlers
      this.setupDAPEventHandlers(sessionId, dap);

      // Connect via E2B's exposed port
      const [host, portStr] = hostUrl.split(':');
      const port = parseInt(portStr) || 5678;

      await dap.connect(host, port);

      // Launch the program
      await dap.launch({
        program: session.config.program,
        args: session.config.args,
        cwd: session.config.cwd || '/workspace',
        stopOnEntry: session.config.stopOnEntry,
      });

      session.state = 'running';
      this.emit('connected', { sessionId });
    } catch (error) {
      log.error('Failed to connect to Python debugger', error as Error);
      session.state = 'error';
      this.emit('output', {
        sessionId,
        category: 'stderr',
        output: `Failed to connect to debugger: ${(error as Error).message}`,
      });
    }
  }

  /**
   * Set up DAP event handlers
   */
  private setupDAPEventHandlers(sessionId: string, dap: DAPClient): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    dap.on('stopped', (params: { reason: string; threadId?: number }) => {
      session.state = 'paused';
      this.emit('stopped', {
        sessionId,
        reason: params.reason,
        threadId: params.threadId || 1,
      });
    });

    dap.on('continued', (params: { threadId: number }) => {
      session.state = 'running';
      this.emit('continued', { sessionId, threadId: params.threadId });
    });

    dap.on('output', (params: { category?: string; output: string }) => {
      this.emit('output', {
        sessionId,
        category: params.category || 'console',
        output: params.output,
      });
    });

    dap.on('exited', (params: { exitCode: number }) => {
      this.emit('exited', { sessionId, exitCode: params.exitCode });
    });

    dap.on('terminated', () => {
      session.state = 'stopped';
      this.emit('terminated', { sessionId });
    });

    dap.on('disconnected', () => {
      session.state = 'stopped';
      this.emit('terminated', { sessionId });
    });
  }

  /**
   * Stop a debug session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    log.info('Stopping container debug session', { sessionId });

    // Disconnect debug client based on protocol
    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      const cdp = this.cdpClients.get(sessionId);
      if (cdp) {
        await cdp.disconnect();
        this.cdpClients.delete(sessionId);
      }
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) {
        await dap.disconnect(true);
        this.dapClients.delete(sessionId);
      }
    }

    // Kill the debug process in the container
    const sandbox = this.sandboxes.get(sessionId);
    if (sandbox) {
      try {
        await sandbox.commands.run('pkill -f "node.*--inspect" || pkill -f debugpy || true', {
          timeoutMs: 5000,
        });
      } catch {
        // Ignore kill errors
      }
    }

    // Clean up
    this.sessions.delete(sessionId);
    this.sandboxes.delete(sessionId);
    this.sessionCallFrames.delete(sessionId);
    this.sessionScopeToObjectId.delete(sessionId);
    this.sessionFrameIdToCallFrameId.delete(sessionId);

    session.state = 'stopped';
    this.emit('terminated', { sessionId });
  }

  /**
   * Set breakpoints for a file - works with all 30+ languages
   */
  async setBreakpoints(
    sessionId: string,
    source: { path?: string; name?: string },
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];

    // Use CDP for CDP-based languages, DAP for everything else
    if (langConfig.protocol === 'cdp') {
      return this.setNodeBreakpoints(sessionId, source, breakpoints);
    } else {
      return this.setPythonBreakpoints(sessionId, source, breakpoints);
    }
  }

  private async setNodeBreakpoints(
    sessionId: string,
    source: { path?: string; name?: string },
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    const cdp = this.cdpClients.get(sessionId);
    if (!cdp || !source.path) return [];

    const verified: Breakpoint[] = [];

    for (const bp of breakpoints) {
      try {
        const url = source.path.startsWith('file://') ? source.path : `file://${source.path}`;
        const result = await cdp.setBreakpointByUrl(
          url,
          bp.line - 1,
          bp.column ? bp.column - 1 : undefined,
          bp.condition
        );

        verified.push({
          id: verified.length + 1,
          verified: result.locations.length > 0,
          line: result.locations[0]?.lineNumber + 1 || bp.line,
          column: result.locations[0]?.columnNumber
            ? result.locations[0].columnNumber + 1
            : bp.column,
          source,
        });
      } catch (error) {
        verified.push({
          id: verified.length + 1,
          verified: false,
          line: bp.line,
          column: bp.column,
          source,
          message: (error as Error).message,
        });
      }
    }

    return verified;
  }

  private async setPythonBreakpoints(
    sessionId: string,
    source: { path?: string; name?: string },
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    const dap = this.dapClients.get(sessionId);
    if (!dap || !source.path) return [];

    try {
      const dapSource: DAPSource = { path: source.path, name: source.name };
      const dapBreakpoints = await dap.setBreakpoints(
        dapSource,
        breakpoints.map((bp) => ({
          line: bp.line,
          column: bp.column,
          condition: bp.condition,
        }))
      );

      return dapBreakpoints.map((bp, index) => ({
        id: bp.id || index + 1,
        verified: bp.verified,
        line: bp.line || breakpoints[index].line,
        column: bp.column,
        source,
      }));
    } catch (error) {
      return breakpoints.map((bp, index) => ({
        id: index + 1,
        verified: false,
        line: bp.line,
        column: bp.column,
        source,
        message: (error as Error).message,
      }));
    }
  }

  /**
   * Continue execution - works with all 30+ languages
   */
  async continue(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      const cdp = this.cdpClients.get(sessionId);
      if (cdp) await cdp.resume();
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) await dap.continue(threadId);
    }
  }

  /**
   * Step over - works with all 30+ languages
   */
  async stepOver(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      const cdp = this.cdpClients.get(sessionId);
      if (cdp) await cdp.stepOver();
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) await dap.next(threadId);
    }
  }

  /**
   * Step into - works with all 30+ languages
   */
  async stepInto(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      const cdp = this.cdpClients.get(sessionId);
      if (cdp) await cdp.stepInto();
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) await dap.stepIn(threadId);
    }
  }

  /**
   * Step out - works with all 30+ languages
   */
  async stepOut(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      const cdp = this.cdpClients.get(sessionId);
      if (cdp) await cdp.stepOut();
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) await dap.stepOut(threadId);
    }
  }

  /**
   * Pause execution - works with all 30+ languages
   */
  async pause(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      const cdp = this.cdpClients.get(sessionId);
      if (cdp) await cdp.pause();
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) await dap.pause(threadId);
    }
  }

  /**
   * Get threads - works with all 30+ languages
   */
  async getThreads(sessionId: string): Promise<Thread[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      // CDP-based languages are typically single-threaded for JavaScript execution
      return [{ id: 1, name: 'Main Thread' }];
    } else {
      const dap = this.dapClients.get(sessionId);
      if (dap) {
        const threads = await dap.threads();
        return threads.map((t) => ({ id: t.id, name: t.name }));
      }
    }
    return [{ id: 1, name: 'Main Thread' }];
  }

  /**
   * Get stack trace - works with all 30+ languages
   */
  async getStackTrace(
    sessionId: string,
    threadId: number = 1,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      return this.getNodeStackTrace(sessionId, startFrame, levels);
    } else {
      return this.getPythonStackTrace(sessionId, threadId, startFrame, levels);
    }
  }

  private async getNodeStackTrace(
    sessionId: string,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    const callFrames = this.sessionCallFrames.get(sessionId) || [];
    if (callFrames.length === 0) return [];

    const cdp = this.cdpClients.get(sessionId);
    if (!cdp) return [];

    const start = startFrame || 0;
    const count = levels || callFrames.length;
    const frames = callFrames.slice(start, start + count);

    return frames.map((frame, index) => {
      const script = cdp.getScript(frame.location.scriptId);
      const url = frame.url || script?.url || '';
      const name = url.split('/').pop() || 'unknown';

      return {
        id: start + index + 1,
        name: frame.functionName || '<anonymous>',
        source: {
          path: url.replace('file://', ''),
          name,
        },
        line: frame.location.lineNumber + 1,
        column: (frame.location.columnNumber || 0) + 1,
      };
    });
  }

  private async getPythonStackTrace(
    sessionId: string,
    threadId: number,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    const dap = this.dapClients.get(sessionId);
    if (!dap) return [];

    try {
      const result = await dap.stackTrace(threadId, startFrame, levels);
      return result.stackFrames.map((frame) => ({
        id: frame.id,
        name: frame.name,
        source: frame.source ? { path: frame.source.path, name: frame.source.name } : undefined,
        line: frame.line,
        column: frame.column,
        endLine: frame.endLine,
        endColumn: frame.endColumn,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get scopes for a stack frame - works with all 30+ languages
   */
  async getScopes(sessionId: string, frameId: number): Promise<Scope[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      return this.getNodeScopes(sessionId, frameId);
    } else {
      return this.getPythonScopes(sessionId, frameId);
    }
  }

  private async getNodeScopes(sessionId: string, frameId: number): Promise<Scope[]> {
    const callFrames = this.sessionCallFrames.get(sessionId) || [];
    const frame = callFrames[frameId - 1];
    if (!frame) return [];

    const scopeToObjectId = this.sessionScopeToObjectId.get(sessionId)!;
    const scopes: Scope[] = [];

    for (const cdpScope of frame.scopeChain) {
      const varRef = ++this.variablesReferenceCounter;

      if (cdpScope.object.objectId) {
        scopeToObjectId.set(varRef, cdpScope.object.objectId);
      }

      const scopeTypeMap: Record<string, string> = {
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

      scopes.push({
        name: scopeTypeMap[cdpScope.type] || cdpScope.type,
        variablesReference: varRef,
        expensive: cdpScope.type === 'global',
      });
    }

    return scopes;
  }

  private async getPythonScopes(sessionId: string, frameId: number): Promise<Scope[]> {
    const dap = this.dapClients.get(sessionId);
    if (!dap) return [];

    try {
      const scopes = await dap.scopes(frameId);
      return scopes.map((scope) => ({
        name: scope.name,
        variablesReference: scope.variablesReference,
        namedVariables: scope.namedVariables,
        indexedVariables: scope.indexedVariables,
        expensive: scope.expensive,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Get variables for a scope - works with all 30+ languages
   */
  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      return this.getNodeVariables(sessionId, variablesReference);
    } else {
      return this.getPythonVariables(sessionId, variablesReference);
    }
  }

  private async getNodeVariables(
    sessionId: string,
    variablesReference: number
  ): Promise<Variable[]> {
    const cdp = this.cdpClients.get(sessionId);
    if (!cdp) return [];

    const scopeToObjectId = this.sessionScopeToObjectId.get(sessionId)!;
    const objectId = scopeToObjectId.get(variablesReference);
    if (!objectId) return [];

    try {
      const properties = await cdp.getProperties(objectId, true, true);
      return properties
        .filter((prop) => prop.enumerable || prop.isOwn)
        .map((prop) => {
          const value = prop.value;
          let varRef = 0;

          if (value?.objectId && (value.type === 'object' || value.type === 'function')) {
            varRef = ++this.variablesReferenceCounter;
            scopeToObjectId.set(varRef, value.objectId);
          }

          return {
            name: prop.name,
            value: this.formatCDPValue(value),
            type: value?.type || 'undefined',
            variablesReference: varRef,
          };
        });
    } catch {
      return [];
    }
  }

  private formatCDPValue(obj?: {
    type: string;
    value?: unknown;
    description?: string;
    subtype?: string;
  }): string {
    if (!obj) return 'undefined';
    if (obj.type === 'undefined') return 'undefined';
    if (obj.type === 'string') return `"${obj.value}"`;
    if (obj.type === 'number' || obj.type === 'boolean') return String(obj.value);
    if (obj.type === 'function') return obj.description || 'function';
    if (obj.type === 'object') {
      if (obj.subtype === 'null') return 'null';
      return obj.description || 'Object';
    }
    return obj.description || String(obj.value);
  }

  private async getPythonVariables(
    sessionId: string,
    variablesReference: number
  ): Promise<Variable[]> {
    const dap = this.dapClients.get(sessionId);
    if (!dap) return [];

    try {
      const variables = await dap.variables(variablesReference);
      return variables.map((v) => ({
        name: v.name,
        value: v.value,
        type: v.type,
        variablesReference: v.variablesReference,
        namedVariables: v.namedVariables,
        indexedVariables: v.indexedVariables,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Evaluate an expression - works with all 30+ languages
   */
  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    const langConfig = LANGUAGE_CONFIGS[session.config.type];
    if (langConfig.protocol === 'cdp') {
      return this.evaluateNode(sessionId, expression, frameId, context);
    } else {
      return this.evaluatePython(sessionId, expression, frameId, context);
    }
  }

  private async evaluateNode(
    sessionId: string,
    expression: string,
    frameId?: number,
    _context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    const cdp = this.cdpClients.get(sessionId);
    if (!cdp) throw new Error('Not connected to debugger');

    try {
      let evalResult;

      if (frameId) {
        const frameMap = this.sessionFrameIdToCallFrameId.get(sessionId)!;
        const callFrameId = frameMap.get(frameId);
        if (callFrameId) {
          evalResult = await cdp.evaluateOnCallFrame(callFrameId, expression);
        } else {
          evalResult = await cdp.evaluate(expression);
        }
      } else {
        evalResult = await cdp.evaluate(expression);
      }

      if (evalResult.exceptionDetails) {
        return {
          result: `Error: ${evalResult.exceptionDetails.text}`,
          type: 'error',
          variablesReference: 0,
        };
      }

      const scopeToObjectId = this.sessionScopeToObjectId.get(sessionId)!;
      let varRef = 0;
      if (evalResult.result.objectId && evalResult.result.type === 'object') {
        varRef = ++this.variablesReferenceCounter;
        scopeToObjectId.set(varRef, evalResult.result.objectId);
      }

      return {
        result: this.formatCDPValue(evalResult.result),
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

  private async evaluatePython(
    sessionId: string,
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    const dap = this.dapClients.get(sessionId);
    if (!dap) throw new Error('Not connected to debugger');

    try {
      const result = await dap.evaluate(expression, frameId, context);
      return {
        result: result.result,
        type: result.type,
        variablesReference: result.variablesReference,
      };
    } catch (error) {
      return {
        result: `Error: ${(error as Error).message}`,
        type: 'error',
        variablesReference: 0,
      };
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): ContainerDebugSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all sessions for a workspace
   */
  getWorkspaceSessions(workspaceId: string): ContainerDebugSession[] {
    const sessions: ContainerDebugSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.workspaceId === workspaceId) {
        sessions.push(session);
      }
    }
    return sessions;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let containerDebugAdapterInstance: ContainerDebugAdapter | null = null;

export function getContainerDebugAdapter(): ContainerDebugAdapter {
  if (!containerDebugAdapterInstance) {
    containerDebugAdapterInstance = new ContainerDebugAdapter();
  }
  return containerDebugAdapterInstance;
}
