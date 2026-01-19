/**
 * Hook Executor
 *
 * Executes hook commands (bash or prompt-based) and handles results.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import type { HookContext, HookDefinition, HookExecutionOptions, HookResult } from './types';

const execAsync = promisify(exec);

/**
 * Execute a single hook
 */
export async function executeHook(
  hook: HookDefinition,
  context: HookContext,
  options: HookExecutionOptions = {}
): Promise<HookResult> {
  const hookId = hook.id || generateHookId(hook);
  const startTime = Date.now();

  try {
    // Check if we should skip this hook
    if (options.skipHooks?.includes(hookId)) {
      return {
        hookId,
        success: true,
        action: 'continue',
        output: 'Skipped',
      };
    }

    // Execute bash command
    if (hook.command) {
      const result = await executeBashHook(hook, context, options);
      return {
        ...result,
        hookId,
        duration: Date.now() - startTime,
      };
    }

    // Execute prompt-based hook (returns JSON decision)
    if (hook.prompt) {
      const result = await executePromptHook(hook, context);
      return {
        ...result,
        hookId,
        duration: Date.now() - startTime,
      };
    }

    // No action defined
    return {
      hookId,
      success: true,
      action: 'continue',
      output: 'No action defined',
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      hookId,
      success: false,
      action: getActionOnFailure(hook),
      error: errorMessage,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute a bash command hook
 */
async function executeBashHook(
  hook: HookDefinition,
  context: HookContext,
  options: HookExecutionOptions
): Promise<Omit<HookResult, 'hookId' | 'duration'>> {
  const command = expandVariables(hook.command!, context);
  const timeout = hook.timeout || 30000;

  // Build environment variables
  const baseEnv: Record<string, string | undefined> = {
    ...process.env,
    ...options.env,
    // Expose context as environment variables
    HOOK_EVENT: context.event,
    HOOK_SESSION_ID: context.sessionId,
    HOOK_WORKSPACE_ID: context.workspaceId,
    HOOK_TOOL: context.tool || '',
    HOOK_FILE_PATH: context.filePath || '',
    HOOK_USER_PROMPT: context.userPrompt || '',
  };

  // Add tool input as JSON
  if (context.toolInput) {
    baseEnv.HOOK_TOOL_INPUT = JSON.stringify(context.toolInput);
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd: options.cwd || process.cwd(),
      env: baseEnv as NodeJS.ProcessEnv,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    return {
      success: true,
      exitCode: 0,
      output: stdout + (stderr ? `\n${stderr}` : ''),
      action: 'continue',
    };
  } catch (error) {
    const execError = error as {
      code?: number;
      killed?: boolean;
      stdout?: string;
      stderr?: string;
      message?: string;
    };

    const exitCode = execError.code || 1;
    const output = (execError.stdout || '') + (execError.stderr ? `\n${execError.stderr}` : '');

    // Determine action based on exit code and onFailure setting
    const action = getActionOnFailure(hook);

    return {
      success: false,
      exitCode,
      output,
      error: execError.message || 'Command failed',
      action,
    };
  }
}

/**
 * Execute a prompt-based hook (expects JSON output)
 */
async function executePromptHook(
  hook: HookDefinition,
  context: HookContext
): Promise<Omit<HookResult, 'hookId' | 'duration'>> {
  // For now, prompt hooks are a placeholder
  // In a full implementation, this would call Claude with the prompt
  // and parse the JSON response

  const prompt = expandVariables(hook.prompt!, context);

  // Return a decision to continue
  return {
    success: true,
    action: 'continue',
    output: `Prompt hook: ${prompt}`,
  };
}

/**
 * Determine action based on hook's onFailure setting
 */
function getActionOnFailure(hook: HookDefinition): 'continue' | 'block' | 'warn' {
  switch (hook.onFailure) {
    case 'block':
      return 'block';
    case 'warn':
      return 'warn';
    case 'continue':
    default:
      return 'continue';
  }
}

/**
 * Expand variables in a command string
 */
export function expandVariables(template: string, context: HookContext): string {
  let result = template;

  // Replace context variables (longer patterns first to avoid partial matches)
  result = result.replace(/\$\{SESSION_ID\}|\$SESSION_ID/g, context.sessionId);
  result = result.replace(/\$\{WORKSPACE_ID\}|\$WORKSPACE_ID/g, context.workspaceId);
  result = result.replace(/\$\{FILE_PATH\}|\$FILE_PATH/g, context.filePath || '');
  result = result.replace(/\$\{USER_PROMPT\}|\$USER_PROMPT/g, context.userPrompt || '');
  result = result.replace(/\$\{EVENT\}|\$EVENT/g, context.event);
  result = result.replace(/\$\{TOOL\}|\$TOOL/g, context.tool || '');
  result = result.replace(/\$\{FILE\}|\$FILE/g, context.filePath || '');

  // Replace tool input fields
  if (context.toolInput) {
    result = result.replace(
      /\$\{COMMAND\}|\$COMMAND/g,
      (context.toolInput.command as string) || ''
    );
    result = result.replace(/\$\{PATH\}|\$PATH/g, (context.toolInput.path as string) || '');
    result = result.replace(
      /\$\{CONTENT\}|\$CONTENT/g,
      (context.toolInput.content as string) || ''
    );
  }

  return result;
}

/**
 * Generate a unique ID for a hook
 */
function generateHookId(hook: HookDefinition): string {
  const base = hook.command || hook.prompt || 'unknown';
  const hash = simpleHash(base);
  return `hook_${hash}`;
}

/**
 * Simple string hash
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Execute multiple hooks in sequence
 */
export async function executeHooks(
  hooks: HookDefinition[],
  context: HookContext,
  options: HookExecutionOptions = {}
): Promise<HookResult[]> {
  const results: HookResult[] = [];

  for (const hook of hooks) {
    const result = await executeHook(hook, context, options);
    results.push(result);

    // Stop if a hook blocks
    if (result.action === 'block') {
      break;
    }
  }

  return results;
}
