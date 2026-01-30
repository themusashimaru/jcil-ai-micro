/**
 * DYNAMIC TOOL CREATION - Main Chat
 *
 * Allows Sonnet to create custom tools on-the-fly when existing tools
 * aren't sufficient. Runs in E2B sandbox with strict cost controls.
 *
 * COST CONTROLS:
 * - Max $0.15 per dynamic tool execution
 * - Max 3 dynamic tools per session
 * - 30 second timeout per execution
 * - Code validation before execution
 *
 * SAFETY:
 * - All code runs in isolated E2B sandbox
 * - Dangerous patterns are blocked
 * - Output is sanitized
 */

import { Sandbox } from '@e2b/code-interpreter';
import { logger } from '@/lib/logger';
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { getChatSessionCosts, CHAT_COST_LIMITS } from './safety';

const log = logger('DynamicTool');

// ============================================================================
// COST LIMITS FOR DYNAMIC TOOLS
// ============================================================================

export const DYNAMIC_TOOL_LIMITS = {
  // Max cost per dynamic tool execution (generous for real work)
  maxCostPerExecution: 0.50,

  // Max dynamic tools per session (allow complex workflows)
  maxDynamicToolsPerSession: 10,

  // Execution timeout (ms) - 45s is safe for Vercel, leaves buffer
  executionTimeoutMs: 45000,

  // Max code length (allow more complex tools)
  maxCodeLength: 10000,

  // Max output length (allow larger results)
  maxOutputLength: 50000,
};

// ============================================================================
// SESSION TRACKING
// ============================================================================

interface DynamicToolSession {
  toolsCreated: number;
  totalCost: number;
  lastUsed: number;
}

const dynamicToolSessions = new Map<string, DynamicToolSession>();
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSession(sessionId: string): DynamicToolSession {
  // Cleanup old sessions
  const now = Date.now();
  for (const [id, session] of dynamicToolSessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      dynamicToolSessions.delete(id);
    }
  }

  if (!dynamicToolSessions.has(sessionId)) {
    dynamicToolSessions.set(sessionId, {
      toolsCreated: 0,
      totalCost: 0,
      lastUsed: now,
    });
  }

  const session = dynamicToolSessions.get(sessionId)!;
  session.lastUsed = now;
  return session;
}

// ============================================================================
// DANGEROUS CODE PATTERNS
// ============================================================================

const DANGEROUS_PATTERNS = [
  // System access
  /os\.system/i,
  /subprocess\./i,
  /exec\(/i,
  /eval\(/i,
  /spawn\(/i,
  /child_process/i,

  // Environment/secrets
  /process\.env/i,
  /os\.environ/i,
  /getenv\(/i,
  /\.env\b/i,
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /credential/i,

  // Network attacks
  /socket\./i,
  /ddos/i,
  /flood/i,

  // File system abuse
  /\/etc\//i,
  /\/root\//i,
  /\.ssh/i,
  /rm\s+-rf/i,

  // Crypto mining
  /miner/i,
  /mining/i,
  /monero/i,
  /xmr/i,

  // Dangerous imports
  /import\s+pickle/i,
  /import\s+ctypes/i,
  /__import__/i,
];

function validateCode(code: string): { valid: boolean; reason?: string } {
  // Check length
  if (code.length > DYNAMIC_TOOL_LIMITS.maxCodeLength) {
    return { valid: false, reason: `Code too long (max ${DYNAMIC_TOOL_LIMITS.maxCodeLength} chars)` };
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: 'Code contains blocked pattern' };
    }
  }

  return { valid: true };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const dynamicToolTool: UnifiedTool = {
  name: 'create_and_run_tool',
  description: `Create and execute a custom Python tool when existing tools aren't sufficient.
Use this for:
- Custom calculations, data transformations, or analysis
- Specialized data processing and formatting
- Multi-step automation tasks
- Complex computations that need code

The code runs in a secure Python sandbox with numpy, pandas, and common libraries.
You have up to ${DYNAMIC_TOOL_LIMITS.maxDynamicToolsPerSession} tool creations per session and 45 seconds per execution.`,
  parameters: {
    type: 'object' as const,
    properties: {
      purpose: {
        type: 'string',
        description: 'What this tool should accomplish (1-2 sentences)',
      },
      code: {
        type: 'string',
        description: 'Python code to execute. Must define a main() function that returns the result.',
      },
      inputs: {
        type: 'object',
        description: 'Input values to pass to the code (available as `inputs` dict)',
        additionalProperties: true,
      },
    },
    required: ['purpose', 'code'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeDynamicTool(
  toolCall: UnifiedToolCall & { sessionId?: string }
): Promise<UnifiedToolResult> {
  const startTime = Date.now();
  const sessionId = toolCall.sessionId || 'default';

  log.info('Dynamic tool execution requested', { sessionId });

  try {
    // Parse arguments
    const args =
      typeof toolCall.arguments === 'string'
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;

    const { purpose, code, inputs = {} } = args as {
      purpose: string;
      code: string;
      inputs?: Record<string, unknown>;
    };

    // Check session limits
    const session = getSession(sessionId);
    if (session.toolsCreated >= DYNAMIC_TOOL_LIMITS.maxDynamicToolsPerSession) {
      return {
        toolCallId: toolCall.id,
        content: `Dynamic tool limit reached (${DYNAMIC_TOOL_LIMITS.maxDynamicToolsPerSession} per session). Use existing tools instead.`,
        isError: true,
      };
    }

    // Check overall session cost
    const chatSession = getChatSessionCosts(sessionId);
    if (chatSession.totalCost + DYNAMIC_TOOL_LIMITS.maxCostPerExecution > CHAT_COST_LIMITS.maxCostPerSession) {
      return {
        toolCallId: toolCall.id,
        content: 'Session cost limit would be exceeded. Cannot create dynamic tool.',
        isError: true,
      };
    }

    // Validate code
    const validation = validateCode(code);
    if (!validation.valid) {
      log.warn('Dynamic tool code validation failed', { reason: validation.reason });
      return {
        toolCallId: toolCall.id,
        content: `Code validation failed: ${validation.reason}`,
        isError: true,
      };
    }

    log.info('Executing dynamic tool', { purpose, codeLength: code.length });

    // Execute in E2B sandbox
    let sandbox: Sandbox | null = null;
    try {
      sandbox = await Sandbox.create({
        timeoutMs: DYNAMIC_TOOL_LIMITS.executionTimeoutMs,
      });

      // Wrap user code with inputs injection and main() call
      const wrappedCode = `
import json

# User inputs
inputs = json.loads('''${JSON.stringify(inputs)}''')

# User code
${code}

# Execute and capture result
if 'main' in dir():
    result = main()
    print("__RESULT__")
    print(json.dumps(result) if result is not None else "null")
else:
    print("__ERROR__")
    print("Code must define a main() function")
`;

      const execution = await sandbox.runCode(wrappedCode);

      // Parse output
      const stdout = execution.logs.stdout.join('\n');
      const stderr = execution.logs.stderr.join('\n');

      if (stderr && !stdout.includes('__RESULT__')) {
        return {
          toolCallId: toolCall.id,
          content: `Execution error: ${stderr.slice(0, 500)}`,
          isError: true,
        };
      }

      if (stdout.includes('__ERROR__')) {
        const errorMsg = stdout.split('__ERROR__')[1]?.trim() || 'Unknown error';
        return {
          toolCallId: toolCall.id,
          content: errorMsg,
          isError: true,
        };
      }

      // Extract result
      let result = 'No output';
      if (stdout.includes('__RESULT__')) {
        result = stdout.split('__RESULT__')[1]?.trim() || 'null';
        try {
          // Try to parse and pretty-print JSON
          const parsed = JSON.parse(result);
          result = JSON.stringify(parsed, null, 2);
        } catch {
          // Keep as-is if not valid JSON
        }
      }

      // Truncate if too long
      if (result.length > DYNAMIC_TOOL_LIMITS.maxOutputLength) {
        result = result.slice(0, DYNAMIC_TOOL_LIMITS.maxOutputLength) + '\n... (truncated)';
      }

      // Update session tracking
      session.toolsCreated++;
      session.totalCost += DYNAMIC_TOOL_LIMITS.maxCostPerExecution;

      const duration = Date.now() - startTime;
      log.info('Dynamic tool executed successfully', {
        purpose,
        duration,
        sessionToolsUsed: session.toolsCreated,
      });

      return {
        toolCallId: toolCall.id,
        content: `Tool executed successfully.\n\nPurpose: ${purpose}\n\nResult:\n${result}`,
        isError: false,
      };
    } finally {
      if (sandbox) {
        try {
          await sandbox.kill();
        } catch (e) {
          log.warn('Failed to kill sandbox', { error: (e as Error).message });
        }
      }
    }
  } catch (error) {
    const err = error as Error;
    log.error('Dynamic tool execution failed', { error: err.message });

    return {
      toolCallId: toolCall.id,
      content: `Failed to execute dynamic tool: ${err.message}`,
      isError: true,
    };
  }
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export async function isDynamicToolAvailable(): Promise<boolean> {
  // Dynamic tool requires E2B API key
  return Boolean(process.env.E2B_API_KEY);
}

// ============================================================================
// SESSION INFO
// ============================================================================

export function getDynamicToolSessionInfo(sessionId: string): {
  toolsCreated: number;
  remaining: number;
  totalCost: number;
} {
  const session = getSession(sessionId);
  return {
    toolsCreated: session.toolsCreated,
    remaining: DYNAMIC_TOOL_LIMITS.maxDynamicToolsPerSession - session.toolsCreated,
    totalCost: session.totalCost,
  };
}
