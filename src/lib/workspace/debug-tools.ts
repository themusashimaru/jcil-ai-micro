/**
 * DEBUG TOOLS FOR WORKSPACE AGENT
 *
 * Provides AI-accessible debugging tools that connect to the DebugManager.
 * Enables Claude to:
 * - Start/stop debug sessions
 * - Set breakpoints
 * - Step through code
 * - Inspect variables
 * - Evaluate expressions
 */

import Anthropic from '@anthropic-ai/sdk';
import { DebugSessionInfo, getDebugManager } from '@/lib/debugger/debug-manager';
import { DebugConfiguration, Source } from '@/lib/debugger/debug-adapter';
import { logger } from '@/lib/logger';

const log = logger('DebugTools');

// Track active debug sessions per workspace
const workspaceDebugSessions = new Map<string, string>();

/**
 * Debug tool definitions for the workspace agent
 */
export function getDebugTools(): Anthropic.Tool[] {
  return [
    {
      name: 'debug_start',
      description:
        'Start a debug session for a program. Supports Node.js and Python. The debugger will pause at the first line or breakpoint.',
      input_schema: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            enum: ['node', 'python'],
            description: 'Type of debugger (node for JavaScript/TypeScript, python for Python)',
          },
          program: {
            type: 'string',
            description: 'Path to the program to debug (e.g., "index.js", "main.py")',
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command line arguments to pass to the program',
          },
          cwd: {
            type: 'string',
            description: 'Working directory (default: /workspace)',
          },
          env: {
            type: 'object',
            description: 'Environment variables to set',
          },
        },
        required: ['type', 'program'],
      },
    },
    {
      name: 'debug_stop',
      description: 'Stop the active debug session.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'debug_breakpoint',
      description:
        'Set or remove breakpoints in a file. Breakpoints cause execution to pause at that line.',
      input_schema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['set', 'remove', 'list'],
            description: 'Action to perform (set, remove, or list breakpoints)',
          },
          file: {
            type: 'string',
            description: 'File path for the breakpoint',
          },
          lines: {
            type: 'array',
            items: { type: 'number' },
            description: 'Line numbers for breakpoints',
          },
          condition: {
            type: 'string',
            description: 'Conditional expression - breakpoint only triggers when true',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'debug_step',
      description:
        'Control execution stepping when paused. Step over skips into functions, step into enters functions, step out exits the current function.',
      input_schema: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['continue', 'stepOver', 'stepInto', 'stepOut', 'pause'],
            description: 'Step action to perform',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'debug_inspect',
      description:
        'Inspect the current debug state. Get stack trace, variables, or evaluate expressions.',
      input_schema: {
        type: 'object' as const,
        properties: {
          what: {
            type: 'string',
            enum: ['stackTrace', 'variables', 'scopes', 'threads'],
            description: 'What to inspect',
          },
          frameId: {
            type: 'number',
            description: 'Stack frame ID for variables/scopes (default: current frame)',
          },
          variablesReference: {
            type: 'number',
            description: 'Variables reference for nested objects',
          },
        },
        required: ['what'],
      },
    },
    {
      name: 'debug_evaluate',
      description:
        'Evaluate an expression in the current debug context. Use to check variable values or execute code.',
      input_schema: {
        type: 'object' as const,
        properties: {
          expression: {
            type: 'string',
            description: 'Expression to evaluate',
          },
          frameId: {
            type: 'number',
            description: 'Stack frame ID for evaluation context',
          },
          context: {
            type: 'string',
            enum: ['watch', 'repl', 'hover'],
            description: 'Evaluation context (default: watch)',
          },
        },
        required: ['expression'],
      },
    },
  ];
}

/**
 * Execute a debug tool
 */
export async function executeDebugTool(
  toolName: string,
  input: Record<string, unknown>,
  workspaceId: string,
  userId: string
): Promise<string> {
  const debugManager = getDebugManager();

  try {
    switch (toolName) {
      case 'debug_start': {
        // Check if there's already an active session for this workspace
        const existingSessionId = workspaceDebugSessions.get(workspaceId);
        if (existingSessionId) {
          try {
            await debugManager.stopSession(existingSessionId);
          } catch {
            // Ignore errors from stopping old session
          }
        }

        const config: DebugConfiguration = {
          type: input.type as 'node' | 'python',
          name: `Debug ${input.program}`,
          request: 'launch',
          program: input.program as string,
          args: (input.args as string[]) || [],
          cwd: (input.cwd as string) || '/workspace',
          env: (input.env as Record<string, string>) || {},
        };

        const session = await debugManager.startSession(userId, workspaceId, config);
        workspaceDebugSessions.set(workspaceId, session.id);

        log.info('Debug session started', { sessionId: session.id, program: config.program });

        return formatDebugSessionInfo(session);
      }

      case 'debug_stop': {
        const sessionId = workspaceDebugSessions.get(workspaceId);
        if (!sessionId) {
          return 'No active debug session.';
        }

        await debugManager.stopSession(sessionId);
        workspaceDebugSessions.delete(workspaceId);

        return 'Debug session stopped.';
      }

      case 'debug_breakpoint': {
        const sessionId = workspaceDebugSessions.get(workspaceId);
        if (!sessionId) {
          return 'No active debug session. Start a debug session first with debug_start.';
        }

        const action = input.action as string;

        if (action === 'list') {
          const info = debugManager.getSession(sessionId);
          if (!info) return 'Session not found.';
          // Note: Would need to track breakpoints in manager to list them
          return 'Breakpoint listing not yet implemented. Use debug_inspect to see current state.';
        }

        if (!input.file || !input.lines) {
          return 'File and lines are required for set/remove actions.';
        }

        const source: Source = { path: input.file as string };
        const lines = input.lines as number[];
        const condition = input.condition as string | undefined;

        const breakpoints = await debugManager.setBreakpoints(
          sessionId,
          source,
          lines.map((line) => ({
            line,
            condition,
          }))
        );

        return formatBreakpoints(breakpoints, input.file as string);
      }

      case 'debug_step': {
        const sessionId = workspaceDebugSessions.get(workspaceId);
        if (!sessionId) {
          return 'No active debug session. Start a debug session first with debug_start.';
        }

        const action = input.action as string;

        switch (action) {
          case 'continue':
            await debugManager.continue(sessionId);
            return 'Continuing execution...';
          case 'stepOver':
            await debugManager.stepOver(sessionId);
            return 'Stepped over (F10)';
          case 'stepInto':
            await debugManager.stepInto(sessionId);
            return 'Stepped into (F11)';
          case 'stepOut':
            await debugManager.stepOut(sessionId);
            return 'Stepped out (Shift+F11)';
          case 'pause':
            await debugManager.pause(sessionId);
            return 'Pausing execution...';
          default:
            return `Unknown step action: ${action}`;
        }
      }

      case 'debug_inspect': {
        const sessionId = workspaceDebugSessions.get(workspaceId);
        if (!sessionId) {
          return 'No active debug session. Start a debug session first with debug_start.';
        }

        const what = input.what as string;

        switch (what) {
          case 'stackTrace': {
            const frames = await debugManager.getStackTrace(sessionId);
            return formatStackTrace(frames);
          }
          case 'variables': {
            const frameId = (input.frameId as number) || 0;
            const scopes = await debugManager.getScopes(sessionId, frameId);
            const allVars: Array<{
              scope: string;
              variables: Array<{ name: string; value: string; type?: string }>;
            }> = [];

            for (const scope of scopes) {
              const variables = await debugManager.getVariables(
                sessionId,
                scope.variablesReference
              );
              allVars.push({ scope: scope.name, variables });
            }

            return formatVariables(allVars);
          }
          case 'scopes': {
            const frameId = (input.frameId as number) || 0;
            const scopes = await debugManager.getScopes(sessionId, frameId);
            return formatScopes(scopes);
          }
          case 'threads': {
            const threads = await debugManager.getThreads(sessionId);
            return formatThreads(threads);
          }
          default:
            return `Unknown inspection target: ${what}`;
        }
      }

      case 'debug_evaluate': {
        const sessionId = workspaceDebugSessions.get(workspaceId);
        if (!sessionId) {
          return 'No active debug session. Start a debug session first with debug_start.';
        }

        const expression = input.expression as string;
        const frameId = input.frameId as number | undefined;
        const context = (input.context as 'watch' | 'repl' | 'hover') || 'watch';

        const result = await debugManager.evaluate(sessionId, expression, frameId, context);
        return formatEvaluationResult(expression, result);
      }

      default:
        return `Unknown debug tool: ${toolName}`;
    }
  } catch (error) {
    log.error('Debug tool error', { toolName, error });
    return `Debug error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatDebugSessionInfo(session: DebugSessionInfo): string {
  return `Debug session started:
  ID: ${session.id}
  Type: ${session.type}
  State: ${session.state}
  Program: ${session.configuration.program}

The debugger is now attached. Use:
- debug_breakpoint to set breakpoints
- debug_step to control execution
- debug_inspect to view state
- debug_evaluate to check values`;
}

function formatBreakpoints(
  breakpoints: Array<{ id?: number; line: number; verified: boolean }>,
  file: string
): string {
  if (breakpoints.length === 0) {
    return `All breakpoints cleared for ${file}`;
  }

  const lines = breakpoints.map((bp) => {
    const status = bp.verified ? '✓' : '○';
    return `  ${status} Line ${bp.line}`;
  });

  return `Breakpoints in ${file}:\n${lines.join('\n')}`;
}

function formatStackTrace(
  frames: Array<{
    id: number;
    name: string;
    source?: { path?: string };
    line: number;
    column: number;
  }>
): string {
  if (frames.length === 0) {
    return 'No stack frames available. The program may not be paused at a breakpoint.';
  }

  const lines = frames.map((frame, i) => {
    const location = frame.source?.path
      ? `${frame.source.path}:${frame.line}:${frame.column}`
      : `<unknown>:${frame.line}`;
    const marker = i === 0 ? '→' : ' ';
    return `${marker} [${frame.id}] ${frame.name} at ${location}`;
  });

  return `Call Stack:\n${lines.join('\n')}`;
}

function formatVariables(
  scopedVars: Array<{
    scope: string;
    variables: Array<{ name: string; value: string; type?: string }>;
  }>
): string {
  const sections = scopedVars.map(({ scope, variables }) => {
    if (variables.length === 0) {
      return `${scope}: (empty)`;
    }

    const varLines = variables.map((v) => {
      const typeStr = v.type ? ` (${v.type})` : '';
      const value = v.value.length > 100 ? v.value.substring(0, 100) + '...' : v.value;
      return `  ${v.name}${typeStr} = ${value}`;
    });

    return `${scope}:\n${varLines.join('\n')}`;
  });

  return `Variables:\n${sections.join('\n\n')}`;
}

function formatScopes(
  scopes: Array<{ name: string; variablesReference: number; expensive: boolean }>
): string {
  const lines = scopes.map((scope) => {
    const expensive = scope.expensive ? ' (expensive to evaluate)' : '';
    return `  - ${scope.name}${expensive} [ref: ${scope.variablesReference}]`;
  });

  return `Scopes:\n${lines.join('\n')}`;
}

function formatThreads(threads: Array<{ id: number; name: string }>): string {
  const lines = threads.map((thread) => `  [${thread.id}] ${thread.name}`);
  return `Threads:\n${lines.join('\n')}`;
}

function formatEvaluationResult(
  expression: string,
  result: { result: string; type?: string }
): string {
  const typeStr = result.type ? ` (${result.type})` : '';
  return `${expression}${typeStr} = ${result.result}`;
}

/**
 * Check if a tool name is a debug tool
 */
export function isDebugTool(toolName: string): boolean {
  return toolName.startsWith('debug_');
}

/**
 * Get the active debug session ID for a workspace
 */
export function getActiveDebugSession(workspaceId: string): string | undefined {
  return workspaceDebugSessions.get(workspaceId);
}
