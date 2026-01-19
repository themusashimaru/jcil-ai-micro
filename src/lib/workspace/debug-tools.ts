/**
 * DEBUG TOOLS FOR WORKSPACE AGENT - EPIC MULTI-LANGUAGE SUPPORT
 *
 * Provides AI-accessible debugging tools that connect to the DebugManager.
 * Supports 30+ programming languages!
 *
 * Enables Claude to:
 * - Start/stop debug sessions for any supported language
 * - Set breakpoints with conditions
 * - Step through code
 * - Inspect variables and stack frames
 * - Evaluate expressions
 *
 * Supported Languages:
 * - node (JavaScript/TypeScript), python, go, rust
 * - java, kotlin, scala, groovy, clojure
 * - c, cpp, ruby, php, csharp, fsharp, swift
 * - perl, lua, r, julia, elixir, erlang
 * - haskell, dart, zig, nim, crystal
 * - ocaml, v, odin, bash, powershell
 */

import Anthropic from '@anthropic-ai/sdk';
import { DebugSessionInfo, getDebugManager } from '@/lib/debugger/debug-manager';
import {
  DebugConfiguration,
  Source,
  getSupportedLanguages,
  getLanguageDisplayNames,
  DebugLanguage,
} from '@/lib/debugger/debug-adapter';
import { logger } from '@/lib/logger';

const log = logger('DebugTools');

// All supported languages for debugging
const SUPPORTED_DEBUG_LANGUAGES = getSupportedLanguages();
const LANGUAGE_NAMES = getLanguageDisplayNames();

// Track active debug sessions per workspace
const workspaceDebugSessions = new Map<string, string>();

/**
 * Debug tool definitions for the workspace agent - supports 30+ languages
 */
export function getDebugTools(): Anthropic.Tool[] {
  // Build the language enum dynamically from supported languages
  const languageEnum = SUPPORTED_DEBUG_LANGUAGES;

  // Build description with all language names
  const languageDescriptions = Object.entries(LANGUAGE_NAMES)
    .map(([key, name]) => `${key} (${name})`)
    .join(', ');

  return [
    {
      name: 'debug_start',
      description: `Start a debug session for a program. Supports 30+ programming languages including: ${languageDescriptions}. The debugger will pause at the first line or breakpoint.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          type: {
            type: 'string',
            enum: languageEnum,
            description: `Language/debugger type. Supported: node (JS/TS), python, go, rust, java, kotlin, scala, groovy, clojure, c, cpp, ruby, php, csharp, fsharp, swift, perl, lua, r, julia, elixir, erlang, haskell, dart, zig, nim, crystal, ocaml, v, odin, bash, powershell`,
          },
          program: {
            type: 'string',
            description: 'Path to the program to debug (e.g., "index.js", "main.py", "main.go")',
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
      name: 'debug_languages',
      description: 'List all 30+ supported debugging languages with their capabilities.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
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

        const debugType = input.type as DebugLanguage;

        // Validate that the language is supported
        if (!SUPPORTED_DEBUG_LANGUAGES.includes(debugType)) {
          return `Unsupported debug language: ${debugType}. Supported languages: ${SUPPORTED_DEBUG_LANGUAGES.join(', ')}`;
        }

        const config: DebugConfiguration = {
          type: debugType,
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

      case 'debug_languages': {
        return formatSupportedLanguages();
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

function formatSupportedLanguages(): string {
  const categories = {
    'Web/Scripting': ['node', 'python', 'ruby', 'php', 'perl', 'lua', 'bash', 'powershell'],
    'Systems Programming': ['go', 'rust', 'c', 'cpp', 'zig', 'nim', 'crystal', 'v', 'odin'],
    'JVM Languages': ['java', 'kotlin', 'scala', 'groovy', 'clojure'],
    '.NET Languages': ['csharp', 'fsharp'],
    'Apple Ecosystem': ['swift'],
    'Functional Languages': ['haskell', 'ocaml', 'elixir', 'erlang'],
    'Data Science': ['r', 'julia'],
    'Mobile/Cross-platform': ['dart'],
  };

  const lines: string[] = ['**Code Lab Debugger - 30+ Supported Languages**', ''];

  for (const [category, langs] of Object.entries(categories)) {
    lines.push(`**${category}:**`);
    for (const lang of langs) {
      const name = LANGUAGE_NAMES[lang as DebugLanguage] || lang;
      lines.push(`  - \`${lang}\` - ${name}`);
    }
    lines.push('');
  }

  lines.push('**Usage:** `debug_start` with `type` set to any of the above language codes.');
  lines.push('');
  lines.push('Example: `debug_start({ type: "go", program: "main.go" })`');

  return lines.join('\n');
}

function formatDebugSessionInfo(session: DebugSessionInfo): string {
  const langName = LANGUAGE_NAMES[session.type as DebugLanguage] || session.type;
  return `Debug session started:
  ID: ${session.id}
  Language: ${langName} (${session.type})
  State: ${session.state}
  Program: ${session.configuration.program}

The debugger is now attached. Use:
- debug_breakpoint to set breakpoints
- debug_step to control execution
- debug_inspect to view state
- debug_evaluate to check values
- debug_languages to list all 30+ supported languages`;
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
  return toolName.startsWith('debug_') || toolName.startsWith('cognitive_');
}

/**
 * Get the active debug session ID for a workspace
 */
export function getActiveDebugSession(workspaceId: string): string | undefined {
  return workspaceDebugSessions.get(workspaceId);
}

// ============================================================================
// ADVANCED COGNITIVE DEBUGGING TOOLS
// ============================================================================

import { getCognitiveDebugger } from '@/lib/cognitive-debugger';
import type { DebugLanguage as CognitiveDebugLanguage } from '@/lib/cognitive-debugger/types';

// Track cognitive debug sessions
const workspaceCognitiveSessions = new Map<string, string>();

/**
 * Cognitive debugging tools - AI-powered predictive analysis
 */
export function getCognitiveDebugTools(): Anthropic.Tool[] {
  return [
    {
      name: 'cognitive_analyze',
      description: `Advanced AI-powered code analysis that thinks like a senior engineer. Predicts runtime issues, security vulnerabilities, performance bottlenecks, logic errors, and more BEFORE code runs. Returns prioritized recommendations with fixes.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string',
            description: 'The code to analyze',
          },
          language: {
            type: 'string',
            enum: [
              'javascript',
              'typescript',
              'python',
              'go',
              'rust',
              'java',
              'kotlin',
              'swift',
              'c',
              'cpp',
              'csharp',
              'ruby',
              'php',
            ],
            description: 'Programming language of the code',
          },
          userIntent: {
            type: 'string',
            description:
              'What the user is trying to achieve with this code (optional but recommended)',
          },
          focusAreas: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'security',
                'performance',
                'logic',
                'architecture',
                'maintainability',
                'testability',
                'reliability',
              ],
            },
            description: 'Specific areas to focus the analysis on (optional)',
          },
        },
        required: ['code', 'language'],
      },
    },
    {
      name: 'cognitive_predict',
      description: `Quick prediction of potential issues in code. Use this for real-time feedback as the user is coding. Faster than full analysis but still catches major issues.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string',
            description: 'The code to analyze',
          },
          language: {
            type: 'string',
            enum: [
              'javascript',
              'typescript',
              'python',
              'go',
              'rust',
              'java',
              'kotlin',
              'swift',
              'c',
              'cpp',
              'csharp',
              'ruby',
              'php',
            ],
            description: 'Programming language of the code',
          },
          cursorLine: {
            type: 'number',
            description: 'Current cursor line (optional - focuses analysis around this area)',
          },
        },
        required: ['code', 'language'],
      },
    },
    {
      name: 'cognitive_explain',
      description: `Get a senior engineer-level explanation of what code does, how it executes, and what could go wrong. Great for understanding complex code or debugging issues.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string',
            description: 'The code to explain',
          },
          language: {
            type: 'string',
            enum: [
              'javascript',
              'typescript',
              'python',
              'go',
              'rust',
              'java',
              'kotlin',
              'swift',
              'c',
              'cpp',
              'csharp',
              'ruby',
              'php',
            ],
            description: 'Programming language of the code',
          },
          question: {
            type: 'string',
            description: 'Specific question about the code (optional)',
          },
        },
        required: ['code', 'language'],
      },
    },
    {
      name: 'cognitive_intent_analysis',
      description: `Map user intent to potential failure points. Describe what you want to achieve, and get a detailed analysis of all the ways it could fail with mitigations.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string',
            description: 'The code to analyze',
          },
          language: {
            type: 'string',
            enum: [
              'javascript',
              'typescript',
              'python',
              'go',
              'rust',
              'java',
              'kotlin',
              'swift',
              'c',
              'cpp',
              'csharp',
              'ruby',
              'php',
            ],
            description: 'Programming language of the code',
          },
          intent: {
            type: 'string',
            description:
              'What you are trying to achieve (e.g., "process user payments securely", "handle file uploads without memory issues")',
          },
        },
        required: ['code', 'language', 'intent'],
      },
    },
    {
      name: 'cognitive_visualize',
      description: `Generate visual diagrams of code flow, execution paths, and data transformations. Returns Mermaid diagrams and ASCII art.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          code: {
            type: 'string',
            description: 'The code to visualize',
          },
          language: {
            type: 'string',
            enum: [
              'javascript',
              'typescript',
              'python',
              'go',
              'rust',
              'java',
              'kotlin',
              'swift',
              'c',
              'cpp',
              'csharp',
              'ruby',
              'php',
            ],
            description: 'Programming language of the code',
          },
        },
        required: ['code', 'language'],
      },
    },
  ];
}

/**
 * Execute a cognitive debug tool
 */
export async function executeCognitiveDebugTool(
  toolName: string,
  input: Record<string, unknown>,
  workspaceId: string,
  userId: string
): Promise<string> {
  const cognitiveDebugger = getCognitiveDebugger();

  try {
    // Get or create cognitive session
    let sessionId = workspaceCognitiveSessions.get(workspaceId);
    if (!sessionId) {
      const session = cognitiveDebugger.startSession(workspaceId, userId);
      sessionId = session.id;
      workspaceCognitiveSessions.set(workspaceId, sessionId);
    }

    const code = input.code as string;
    const language = input.language as CognitiveDebugLanguage;

    switch (toolName) {
      case 'cognitive_analyze': {
        const result = await cognitiveDebugger.analyzeCode(sessionId, code, language, {
          userIntent: input.userIntent as string | undefined,
          focusAreas: input.focusAreas as
            | ('security' | 'performance' | 'logic' | 'reliability')[]
            | undefined,
        });

        return formatCognitiveAnalysis(result);
      }

      case 'cognitive_predict': {
        const predictions = await cognitiveDebugger.quickPredict(
          code,
          language,
          input.cursorLine ? { line: input.cursorLine as number, column: 0 } : undefined
        );

        return formatPredictions(predictions);
      }

      case 'cognitive_explain': {
        const explanation = await cognitiveDebugger.explainCode(
          code,
          language,
          input.question as string | undefined
        );

        return formatExplanation(explanation);
      }

      case 'cognitive_intent_analysis': {
        const { IntentFailureMapper } = await import(
          '@/lib/cognitive-debugger/intent-failure-mapper'
        );
        const mapper = new IntentFailureMapper();

        const parsedIntent = await mapper.parseIntent(input.intent as string);
        const result = await cognitiveDebugger.analyzeWithIntent(
          sessionId,
          code,
          language,
          parsedIntent
        );

        return formatIntentAnalysis(result);
      }

      case 'cognitive_visualize': {
        const visualization = await cognitiveDebugger.visualizeCodeFlow(sessionId, code, language);

        return formatVisualization(visualization);
      }

      default:
        return `Unknown cognitive debug tool: ${toolName}`;
    }
  } catch (error) {
    log.error('Cognitive debug tool error', { toolName, error });
    return `Cognitive debug error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// ============================================================================
// COGNITIVE DEBUG FORMATTING HELPERS
// ============================================================================

function formatCognitiveAnalysis(result: {
  predictions: Array<{
    type: string;
    description: string;
    location: { line: number };
    severity: string;
    confidence: string;
  }>;
  patterns: Array<{ pattern: { name: string; description: string }; location: { line: number } }>;
  multiDimensional?: {
    overallScore: number;
    security: { score: number };
    performance: { score: number };
    logic: { score: number };
  };
  recommendations: Array<{ title: string; description: string; priority: string }>;
  fixes: Array<{ location: { line: number }; newCode: string; explanation: string }>;
}): string {
  const lines: string[] = ['# Cognitive Analysis Report', ''];

  // Overall scores
  if (result.multiDimensional) {
    lines.push('## Overall Scores');
    lines.push(`- **Overall:** ${result.multiDimensional.overallScore}/100`);
    lines.push(`- Security: ${result.multiDimensional.security.score}/100`);
    lines.push(`- Performance: ${result.multiDimensional.performance.score}/100`);
    lines.push(`- Logic: ${result.multiDimensional.logic.score}/100`);
    lines.push('');
  }

  // Predictions
  if (result.predictions.length > 0) {
    lines.push('## Predicted Issues');
    for (const pred of result.predictions.slice(0, 10)) {
      const icon = pred.severity === 'critical' ? '🔴' : pred.severity === 'high' ? '🟠' : '🟡';
      lines.push(`${icon} **Line ${pred.location.line}** [${pred.type}]: ${pred.description}`);
      lines.push(`   Severity: ${pred.severity}, Confidence: ${pred.confidence}`);
    }
    lines.push('');
  }

  // Patterns
  if (result.patterns.length > 0) {
    lines.push('## Known Bug Patterns Detected');
    for (const pattern of result.patterns.slice(0, 5)) {
      lines.push(`- **${pattern.pattern.name}** (Line ${pattern.location.line})`);
      lines.push(`  ${pattern.pattern.description}`);
    }
    lines.push('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('## Prioritized Recommendations');
    for (let i = 0; i < Math.min(result.recommendations.length, 5); i++) {
      const rec = result.recommendations[i];
      const priority = rec.priority === 'critical' ? '🚨' : rec.priority === 'high' ? '⚠️' : '💡';
      lines.push(`${i + 1}. ${priority} **${rec.title}** [${rec.priority}]`);
      lines.push(`   ${rec.description}`);
    }
    lines.push('');
  }

  // Fixes
  if (result.fixes.length > 0) {
    lines.push('## Suggested Fixes');
    for (const fix of result.fixes.slice(0, 3)) {
      lines.push(`- **Line ${fix.location.line}**: ${fix.explanation}`);
      if (fix.newCode) {
        lines.push('  ```');
        lines.push(`  ${fix.newCode.slice(0, 200)}${fix.newCode.length > 200 ? '...' : ''}`);
        lines.push('  ```');
      }
    }
  }

  return lines.join('\n');
}

function formatPredictions(
  predictions: Array<{
    type: string;
    description: string;
    location: { line: number };
    severity: string;
    probability: number;
    preventionStrategy: string;
  }>
): string {
  if (predictions.length === 0) {
    return '✅ No issues predicted! Code looks good.';
  }

  const lines: string[] = ['# Quick Predictions', ''];

  for (const pred of predictions) {
    const icon =
      pred.severity === 'critical'
        ? '🔴'
        : pred.severity === 'high'
          ? '🟠'
          : pred.severity === 'medium'
            ? '🟡'
            : '🔵';
    const probability = Math.round(pred.probability * 100);

    lines.push(`${icon} **Line ${pred.location.line}** - ${pred.type} (${probability}% likely)`);
    lines.push(`   ${pred.description}`);
    lines.push(`   💡 Prevention: ${pred.preventionStrategy}`);
    lines.push('');
  }

  return lines.join('\n');
}

function formatExplanation(explanation: {
  explanation: string;
  executionFlow: string;
  dataTransformations: string;
  potentialIssues: string[];
  suggestions: string[];
}): string {
  const lines: string[] = ['# Code Explanation', ''];

  lines.push('## What This Code Does');
  lines.push(explanation.explanation);
  lines.push('');

  if (explanation.executionFlow) {
    lines.push('## Execution Flow');
    lines.push(explanation.executionFlow);
    lines.push('');
  }

  if (explanation.dataTransformations) {
    lines.push('## Data Transformations');
    lines.push(explanation.dataTransformations);
    lines.push('');
  }

  if (explanation.potentialIssues.length > 0) {
    lines.push('## Potential Issues');
    for (const issue of explanation.potentialIssues) {
      lines.push(`- ⚠️ ${issue}`);
    }
    lines.push('');
  }

  if (explanation.suggestions.length > 0) {
    lines.push('## Suggestions');
    for (const suggestion of explanation.suggestions) {
      lines.push(`- 💡 ${suggestion}`);
    }
  }

  return lines.join('\n');
}

function formatIntentAnalysis(result: {
  intent: { description: string; goals: string[] };
  possibleFailures: Array<{
    description: string;
    severity: string;
    likelihood: number;
    mitigations: Array<{ strategy: string }>;
  }>;
  criticalPaths: Array<{ steps: Array<{ description: string }> }>;
  assumptionRisks: Array<{ assumption: string; validity: string; consequence: string }>;
  edgeCases: Array<{ description: string; handled: boolean }>;
  successProbability: number;
}): string {
  const lines: string[] = ['# Intent-to-Failure Analysis', ''];

  lines.push('## Your Intent');
  lines.push(`**Goal:** ${result.intent.description}`);
  lines.push('');
  lines.push(`**Success Probability:** ${Math.round(result.successProbability * 100)}%`);
  lines.push('');

  if (result.possibleFailures.length > 0) {
    lines.push('## Possible Failures');
    for (const failure of result.possibleFailures.slice(0, 5)) {
      const likelihood = Math.round(failure.likelihood * 100);
      lines.push(`- **${failure.description}** (${failure.severity}, ${likelihood}% likely)`);
      if (failure.mitigations.length > 0) {
        lines.push(`  - Mitigation: ${failure.mitigations[0].strategy}`);
      }
    }
    lines.push('');
  }

  if (result.assumptionRisks.length > 0) {
    lines.push('## Risky Assumptions');
    for (const risk of result.assumptionRisks.filter((r) => r.validity !== 'valid')) {
      const icon = risk.validity === 'invalid' ? '🔴' : '🟡';
      lines.push(`${icon} **Assumption:** ${risk.assumption}`);
      lines.push(`   **If wrong:** ${risk.consequence}`);
    }
    lines.push('');
  }

  if (result.edgeCases.length > 0) {
    lines.push('## Edge Cases to Test');
    for (const edge of result.edgeCases) {
      const status = edge.handled ? '✅' : '❌';
      lines.push(`${status} ${edge.description}`);
    }
  }

  return lines.join('\n');
}

function formatVisualization(visualization: {
  mermaid: string;
  ascii: string;
  hotspots: Array<{ line: number; severity: string; reason: string }>;
}): string {
  const lines: string[] = ['# Code Flow Visualization', ''];

  lines.push('## ASCII Visualization');
  lines.push('```');
  lines.push(visualization.ascii);
  lines.push('```');
  lines.push('');

  if (visualization.hotspots.length > 0) {
    lines.push('## Hotspots (High-Risk Areas)');
    for (const hotspot of visualization.hotspots) {
      const icon = hotspot.severity === 'high' ? '🔴' : hotspot.severity === 'medium' ? '🟠' : '🟡';
      lines.push(`${icon} **Line ${hotspot.line}**: ${hotspot.reason}`);
    }
    lines.push('');
  }

  lines.push('## Mermaid Diagram');
  lines.push('```mermaid');
  lines.push(visualization.mermaid);
  lines.push('```');

  return lines.join('\n');
}

/**
 * Get all debug tools (standard + cognitive)
 */
export function getAllDebugTools(): Anthropic.Tool[] {
  return [...getDebugTools(), ...getCognitiveDebugTools()];
}

/**
 * Execute any debug tool (standard or cognitive)
 */
export async function executeAnyDebugTool(
  toolName: string,
  input: Record<string, unknown>,
  workspaceId: string,
  userId: string
): Promise<string> {
  if (toolName.startsWith('cognitive_')) {
    return executeCognitiveDebugTool(toolName, input, workspaceId, userId);
  }
  return executeDebugTool(toolName, input, workspaceId, userId);
}
