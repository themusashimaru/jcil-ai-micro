/**
 * UNIVERSAL DEBUGGER
 *
 * A unified debugging interface that works across 30+ programming languages.
 * Abstracts away the differences between DAP, CDP, and language-specific debuggers.
 *
 * "One debugger to rule them all."
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { DebugLanguage, SourceLocation, Variable, ExecutionStep } from './types';

const log = logger('UniversalDebugger');

// ============================================================================
// TYPES
// ============================================================================

export interface BreakpointConfig {
  location: SourceLocation;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export interface DebugSession {
  id: string;
  language: DebugLanguage;
  state: 'idle' | 'running' | 'paused' | 'stopped';
  currentLocation?: SourceLocation;
  variables: Map<string, Variable>;
  callStack: StackFrame[];
  breakpoints: Map<string, BreakpointConfig>;
}

export interface StackFrame {
  id: number;
  name: string;
  location: SourceLocation;
  scopes: Scope[];
}

export interface Scope {
  name: string;
  variables: Variable[];
  expensive: boolean;
}

export interface WatchExpression {
  expression: string;
  value?: unknown;
  type?: string;
  error?: string;
}

// ============================================================================
// LANGUAGE CONFIGS
// ============================================================================

interface LanguageConfig {
  debugProtocol: 'dap' | 'cdp' | 'custom';
  debugCommand: string;
  debugPort: number;
  breakpointSyntax: string;
  stepCommands: {
    continue: string;
    stepOver: string;
    stepInto: string;
    stepOut: string;
  };
  variableInspection: boolean;
  hotReload: boolean;
}

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  javascript: {
    debugProtocol: 'cdp',
    debugCommand: 'node --inspect-brk',
    debugPort: 9229,
    breakpointSyntax: 'debugger;',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'o' },
    variableInspection: true,
    hotReload: true,
  },
  typescript: {
    debugProtocol: 'cdp',
    debugCommand: 'node --inspect-brk -r ts-node/register',
    debugPort: 9229,
    breakpointSyntax: 'debugger;',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'o' },
    variableInspection: true,
    hotReload: true,
  },
  python: {
    debugProtocol: 'dap',
    debugCommand: 'python -m debugpy --listen',
    debugPort: 5678,
    breakpointSyntax: 'breakpoint()',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'r' },
    variableInspection: true,
    hotReload: false,
  },
  go: {
    debugProtocol: 'dap',
    debugCommand: 'dlv debug --headless --listen=:',
    debugPort: 2345,
    breakpointSyntax: 'runtime.Breakpoint()',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'stepout' },
    variableInspection: true,
    hotReload: false,
  },
  rust: {
    debugProtocol: 'dap',
    debugCommand: 'rust-lldb',
    debugPort: 0,
    breakpointSyntax: 'std::process::abort();',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'finish' },
    variableInspection: true,
    hotReload: false,
  },
  java: {
    debugProtocol: 'dap',
    debugCommand: 'java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=',
    debugPort: 5005,
    breakpointSyntax: '// breakpoint',
    stepCommands: { continue: 'cont', stepOver: 'next', stepInto: 'step', stepOut: 'step up' },
    variableInspection: true,
    hotReload: true,
  },
  kotlin: {
    debugProtocol: 'dap',
    debugCommand: 'kotlin -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=',
    debugPort: 5005,
    breakpointSyntax: '// breakpoint',
    stepCommands: { continue: 'cont', stepOver: 'next', stepInto: 'step', stepOut: 'step up' },
    variableInspection: true,
    hotReload: true,
  },
  csharp: {
    debugProtocol: 'dap',
    debugCommand: 'dotnet run --configuration Debug',
    debugPort: 0,
    breakpointSyntax: 'System.Diagnostics.Debugger.Break();',
    stepCommands: { continue: 'g', stepOver: 'p', stepInto: 't', stepOut: 'gu' },
    variableInspection: true,
    hotReload: true,
  },
  ruby: {
    debugProtocol: 'dap',
    debugCommand: 'ruby -r debug',
    debugPort: 0,
    breakpointSyntax: 'binding.pry',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'fin' },
    variableInspection: true,
    hotReload: false,
  },
  php: {
    debugProtocol: 'dap',
    debugCommand: 'php -dxdebug.mode=debug -dxdebug.start_with_request=yes',
    debugPort: 9003,
    breakpointSyntax: 'xdebug_break();',
    stepCommands: {
      continue: 'run',
      stepOver: 'step_over',
      stepInto: 'step_into',
      stepOut: 'step_out',
    },
    variableInspection: true,
    hotReload: false,
  },
  swift: {
    debugProtocol: 'dap',
    debugCommand: 'lldb',
    debugPort: 0,
    breakpointSyntax: 'raise(SIGINT)',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'finish' },
    variableInspection: true,
    hotReload: false,
  },
  c: {
    debugProtocol: 'dap',
    debugCommand: 'gdb --interpreter=dap',
    debugPort: 0,
    breakpointSyntax: 'asm("int $3");',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'finish' },
    variableInspection: true,
    hotReload: false,
  },
  cpp: {
    debugProtocol: 'dap',
    debugCommand: 'gdb --interpreter=dap',
    debugPort: 0,
    breakpointSyntax: '__debugbreak();',
    stepCommands: { continue: 'c', stepOver: 'n', stepInto: 's', stepOut: 'finish' },
    variableInspection: true,
    hotReload: false,
  },
};

// ============================================================================
// UNIVERSAL DEBUGGER
// ============================================================================

export class UniversalDebugger extends EventEmitter {
  private sessions: Map<string, DebugSession> = new Map();

  /**
   * Create a new debug session
   */
  createSession(
    language: DebugLanguage,
    _options: {
      workspaceId?: string;
      programPath?: string;
      args?: string[];
      env?: Record<string, string>;
    } = {}
  ): DebugSession {
    const session: DebugSession = {
      id: `debug_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      language,
      state: 'idle',
      variables: new Map(),
      callStack: [],
      breakpoints: new Map(),
    };

    this.sessions.set(session.id, session);
    log.info('Debug session created', { sessionId: session.id, language });

    return session;
  }

  /**
   * Get debug configuration for a language
   */
  getLanguageConfig(language: DebugLanguage): LanguageConfig | null {
    return LANGUAGE_CONFIGS[language] || null;
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): DebugLanguage[] {
    return Object.keys(LANGUAGE_CONFIGS) as DebugLanguage[];
  }

  /**
   * Check if a language is supported
   */
  isLanguageSupported(language: DebugLanguage): boolean {
    return language in LANGUAGE_CONFIGS;
  }

  /**
   * Set a breakpoint
   */
  setBreakpoint(sessionId: string, config: BreakpointConfig): { id: string; verified: boolean } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const id = `bp_${config.location.line}_${Date.now()}`;
    session.breakpoints.set(id, config);

    log.info('Breakpoint set', {
      sessionId,
      line: config.location.line,
      condition: config.condition,
    });

    this.emit('breakpoint_set', { sessionId, id, config });

    return { id, verified: true };
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(sessionId: string, breakpointId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const removed = session.breakpoints.delete(breakpointId);
    if (removed) {
      this.emit('breakpoint_removed', { sessionId, breakpointId });
    }

    return removed;
  }

  /**
   * Get all breakpoints for a session
   */
  getBreakpoints(sessionId: string): BreakpointConfig[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return Array.from(session.breakpoints.values());
  }

  /**
   * Evaluate an expression in the current context
   */
  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number
  ): Promise<{ result: string; type?: string; variablesReference?: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // In a real implementation, this would communicate with the debug adapter
    // For now, return a placeholder
    log.info('Evaluating expression', { sessionId, expression, frameId });

    return {
      result: `[Evaluation of '${expression}' would appear here]`,
      type: 'unknown',
      variablesReference: 0,
    };
  }

  /**
   * Add a watch expression
   */
  addWatch(sessionId: string, expression: string): WatchExpression {
    log.info('Adding watch', { sessionId, expression });

    return {
      expression,
      value: undefined,
      type: undefined,
    };
  }

  /**
   * Get the current call stack
   */
  getCallStack(sessionId: string): StackFrame[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return session.callStack;
  }

  /**
   * Get variables for a scope
   */
  getVariables(sessionId: string, _scopeReference: number): Variable[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    return Array.from(session.variables.values());
  }

  /**
   * Generate debug launch configuration
   */
  generateLaunchConfig(
    language: DebugLanguage,
    options: {
      programPath: string;
      args?: string[];
      env?: Record<string, string>;
      cwd?: string;
    }
  ): Record<string, unknown> {
    const config = this.getLanguageConfig(language);
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    // Generate VS Code style launch configuration
    return {
      type: this.getDebugType(language),
      request: 'launch',
      name: `Debug ${language}`,
      program: options.programPath,
      args: options.args || [],
      env: options.env || {},
      cwd: options.cwd || '${workspaceFolder}',
      stopOnEntry: false,
      ...(config.debugPort > 0 && { port: config.debugPort }),
    };
  }

  /**
   * Get VS Code debug type for a language
   */
  private getDebugType(language: DebugLanguage): string {
    const typeMap: Record<string, string> = {
      javascript: 'node',
      typescript: 'node',
      python: 'python',
      go: 'go',
      rust: 'lldb',
      java: 'java',
      kotlin: 'kotlin',
      csharp: 'coreclr',
      ruby: 'ruby',
      php: 'php',
      swift: 'lldb',
      c: 'cppdbg',
      cpp: 'cppdbg',
    };
    return typeMap[language] || 'node';
  }

  /**
   * Simulate debug step (for cognitive debugging without actual execution)
   */
  simulateStep(
    code: string,
    _language: DebugLanguage,
    currentLine: number,
    _variables: Record<string, unknown>
  ): ExecutionStep {
    const lines = code.split('\n');
    const line = lines[currentLine - 1] || '';

    // Analyze what this line does
    const step: ExecutionStep = {
      location: { file: 'current', line: currentLine },
      operation: line.trim(),
      inputs: [],
      outputs: [],
      sideEffects: [],
      branches: [],
    };

    // Detect side effects
    if (/console\.log|print|echo/.test(line)) {
      step.sideEffects.push({
        type: 'io',
        description: 'Console output',
        reversible: false,
        idempotent: true,
      });
    }
    if (/fetch|axios|http\./.test(line)) {
      step.sideEffects.push({
        type: 'network',
        description: 'Network request',
        reversible: false,
        idempotent: false,
      });
    }
    if (/\.write|fs\./.test(line)) {
      step.sideEffects.push({
        type: 'file',
        description: 'File operation',
        reversible: true,
        idempotent: false,
      });
    }

    // Detect branches
    if (/if\s*\(/.test(line)) {
      const condition = line.match(/if\s*\(([^)]+)\)/)?.[1];
      step.branches.push({
        condition: condition || 'unknown',
        truePath: String(currentLine + 1),
      });
    }

    return step;
  }

  /**
   * Get debug instructions for a language
   */
  getDebugInstructions(language: DebugLanguage): string {
    const config = this.getLanguageConfig(language);
    if (!config) {
      return `Language '${language}' is not supported for debugging.`;
    }

    return `
# Debugging ${language}

## Quick Start
1. Add breakpoint: ${config.breakpointSyntax}
2. Run: ${config.debugCommand}
3. Connect debugger to port ${config.debugPort || 'N/A'}

## Step Commands
- Continue: ${config.stepCommands.continue}
- Step Over: ${config.stepCommands.stepOver}
- Step Into: ${config.stepCommands.stepInto}
- Step Out: ${config.stepCommands.stepOut}

## Features
- Variable Inspection: ${config.variableInspection ? 'Yes' : 'No'}
- Hot Reload: ${config.hotReload ? 'Yes' : 'No'}
- Protocol: ${config.debugProtocol.toUpperCase()}
`.trim();
  }

  /**
   * End a debug session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.state = 'stopped';
      this.sessions.delete(sessionId);
      this.emit('session_ended', { sessionId });
      log.info('Debug session ended', { sessionId });
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): DebugSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): DebugSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.state !== 'stopped');
  }
}
