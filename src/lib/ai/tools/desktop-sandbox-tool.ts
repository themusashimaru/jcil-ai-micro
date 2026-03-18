/**
 * E2B DESKTOP SANDBOX TOOL
 *
 * Provides a full virtual Linux desktop with GUI that AI can see and interact with.
 * Uses E2B Desktop SDK for computer-use capabilities: screenshot, click, type, scroll.
 *
 * Use cases:
 * - Browse websites with a real graphical browser
 * - Interact with desktop applications
 * - Take screenshots of rendered pages/apps
 * - Fill forms, click buttons, navigate
 * - Visual verification of web pages or applications
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';
import { canExecuteTool, recordToolCost, isUrlSafe } from './safety';

const log = logger('DesktopSandboxTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const TOOL_COST = 0.05; // $0.05 per desktop action (heavier than browser_visit)
const DESKTOP_TIMEOUT_MS = 60000; // 60 seconds per action
const MAX_OUTPUT_LENGTH = 200000; // 200KB max (screenshots can be large)
const SANDBOX_IDLE_CLEANUP_MS = 180000; // 3 min idle cleanup
const SANDBOX_TIMEOUT_MS = 600000; // 10 min max lifetime

// E2B Desktop lazy loading
let desktopAvailable: boolean | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DesktopSandbox: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeSandbox: any = null;
let sandboxLastUsed = 0;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const desktopSandboxTool: UnifiedTool = {
  name: 'desktop_sandbox',
  description: `Interact with a full virtual Linux desktop. Use this when:
- You need to interact with a graphical application or website in a real browser
- You need to take high-fidelity screenshots of web pages or desktop applications
- You need to fill complex forms, navigate multi-page flows, or interact with JavaScript-heavy apps
- You need to open and interact with desktop applications
- The user wants visual proof of what a website looks like

Available actions:
- screenshot: Take a screenshot of the current desktop state
- open_url: Open a URL in the desktop browser (Chrome)
- click: Click at specific coordinates (x, y)
- type_text: Type text on the desktop (into focused element)
- press_key: Press a keyboard key (Enter, Tab, Escape, etc.)
- scroll: Scroll up or down
- run_command: Run a terminal command on the desktop

The desktop runs a full Linux environment with Chrome, Firefox, and common tools pre-installed.
Returns base64 PNG screenshots for visual actions.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'The action to perform on the desktop',
        enum: [
          'screenshot',
          'open_url',
          'click',
          'type_text',
          'press_key',
          'scroll',
          'run_command',
        ],
      },
      url: {
        type: 'string',
        description: 'URL to open (for open_url action)',
      },
      x: {
        type: 'number',
        description: 'X coordinate for click action',
      },
      y: {
        type: 'number',
        description: 'Y coordinate for click action',
      },
      text: {
        type: 'string',
        description: 'Text to type (for type_text action) or command to run (for run_command)',
      },
      key: {
        type: 'string',
        description: 'Key to press (for press_key action): Enter, Tab, Escape, Backspace, etc.',
      },
      direction: {
        type: 'string',
        description: 'Scroll direction (for scroll action)',
        enum: ['up', 'down'],
        default: 'down',
      },
      scroll_amount: {
        type: 'number',
        description: 'Number of scroll ticks (for scroll action)',
        default: 3,
      },
    },
    required: ['action'],
  },
};

// ============================================================================
// E2B DESKTOP INITIALIZATION
// ============================================================================

async function initDesktop(): Promise<boolean> {
  if (desktopAvailable !== null) {
    return desktopAvailable;
  }

  try {
    if (!process.env.E2B_API_KEY) {
      log.warn('E2B_API_KEY not configured - desktop sandbox disabled');
      desktopAvailable = false;
      return false;
    }

    const desktopModule = await import('@e2b/desktop');
    DesktopSandbox = desktopModule.Sandbox;
    desktopAvailable = true;
    log.info('E2B Desktop sandbox available');
    return true;
  } catch (error) {
    log.error('Failed to initialize E2B Desktop — dynamic import failed. Install @e2b/desktop.', {
      error: (error as Error).message,
      stack: (error as Error).stack?.split('\n').slice(0, 3).join(' | '),
    });
    desktopAvailable = false;
    return false;
  }
}

/**
 * Get or create a desktop sandbox
 */
async function getDesktopSandbox() {
  if (!DesktopSandbox) {
    throw new Error('E2B Desktop not initialized');
  }

  const now = Date.now();

  // Clean up idle sandbox
  if (activeSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
    try {
      await activeSandbox.kill();
    } catch {
      // Ignore cleanup errors
    }
    activeSandbox = null;
  }

  // Create new sandbox if needed
  if (!activeSandbox) {
    log.info('Creating new E2B Desktop sandbox');
    activeSandbox = await DesktopSandbox.create({
      timeoutMs: SANDBOX_TIMEOUT_MS,
      resolution: [1920, 1080],
      dpi: 96,
    });
    log.info('Desktop sandbox ready');
  }

  sandboxLastUsed = now;
  return activeSandbox;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeDesktopSandbox(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'desktop_sandbox') {
    return { toolCallId: id, content: `Unknown tool: ${name}`, isError: true };
  }

  // Initialize E2B Desktop
  const available = await initDesktop();
  if (!available) {
    return {
      toolCallId: id,
      content:
        'Desktop sandbox is not available. Install @e2b/desktop package and set E2B_API_KEY.',
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? {} : rawArgs;
  const action = args.action as string;

  if (!action) {
    return { toolCallId: id, content: 'No action specified.', isError: true };
  }

  // Cost check
  const sessionId = toolCall.sessionId || `desktop_${Date.now()}`;
  const costCheck = canExecuteTool(sessionId, 'desktop_sandbox', TOOL_COST);
  if (!costCheck.allowed) {
    return { toolCallId: id, content: `Cannot execute: ${costCheck.reason}`, isError: true };
  }

  try {
    const desktop = await getDesktopSandbox();
    let result = '';

    switch (action) {
      case 'screenshot': {
        const image = await desktop.screenshot();
        const base64 = Buffer.from(image).toString('base64');
        result = `Desktop screenshot captured:\n\n[Desktop Screenshot](data:image/png;base64,${base64.slice(0, MAX_OUTPUT_LENGTH)})`;
        break;
      }

      case 'open_url': {
        const url = args.url as string;
        if (!url) {
          return { toolCallId: id, content: 'URL is required for open_url action.', isError: true };
        }
        // Safety check
        const safety = isUrlSafe(url);
        if (!safety.safe) {
          return {
            toolCallId: id,
            content: `URL blocked: ${safety.reason}`,
            isError: true,
          };
        }
        // Launch Chrome with the URL
        await desktop.commands.run(`google-chrome --no-sandbox --disable-gpu "${url}" &`, {
          timeoutMs: DESKTOP_TIMEOUT_MS,
        });
        // Wait for page to load
        await new Promise((resolve) => setTimeout(resolve, 5000));
        // Take screenshot after opening
        const pageImage = await desktop.screenshot();
        const pageBase64 = Buffer.from(pageImage).toString('base64');
        result = `Opened ${url} in Chrome.\n\n[Screenshot of ${new URL(url).hostname}](data:image/png;base64,${pageBase64.slice(0, MAX_OUTPUT_LENGTH)})`;
        break;
      }

      case 'click': {
        const x = args.x as number;
        const y = args.y as number;
        if (x === undefined || y === undefined) {
          return {
            toolCallId: id,
            content: 'x and y coordinates are required for click action.',
            isError: true,
          };
        }
        await desktop.leftClick(x, y);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const clickImage = await desktop.screenshot();
        const clickBase64 = Buffer.from(clickImage).toString('base64');
        result = `Clicked at (${x}, ${y}).\n\n[Screenshot after click](data:image/png;base64,${clickBase64.slice(0, MAX_OUTPUT_LENGTH)})`;
        break;
      }

      case 'type_text': {
        const text = args.text as string;
        if (!text) {
          return {
            toolCallId: id,
            content: 'text is required for type_text action.',
            isError: true,
          };
        }
        await desktop.write(text);
        result = `Typed: "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`;
        break;
      }

      case 'press_key': {
        const key = args.key as string;
        if (!key) {
          return {
            toolCallId: id,
            content: 'key is required for press_key action.',
            isError: true,
          };
        }
        await desktop.press(key);
        result = `Pressed key: ${key}`;
        break;
      }

      case 'scroll': {
        const direction = (args.direction as string) || 'down';
        const amount = (args.scroll_amount as number) || 3;
        await desktop.scroll(direction, amount);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const scrollImage = await desktop.screenshot();
        const scrollBase64 = Buffer.from(scrollImage).toString('base64');
        result = `Scrolled ${direction} ${amount} ticks.\n\n[Screenshot after scroll](data:image/png;base64,${scrollBase64.slice(0, MAX_OUTPUT_LENGTH)})`;
        break;
      }

      case 'run_command': {
        const cmd = args.text as string;
        if (!cmd) {
          return {
            toolCallId: id,
            content: 'text (command) is required for run_command action.',
            isError: true,
          };
        }
        const cmdResult = await desktop.commands.run(cmd, {
          timeoutMs: DESKTOP_TIMEOUT_MS,
        });
        result = `Command: ${cmd}\nExit code: ${cmdResult.exitCode}\nStdout:\n${cmdResult.stdout.slice(0, MAX_OUTPUT_LENGTH)}\nStderr:\n${cmdResult.stderr.slice(0, 10000)}`;
        break;
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown action: ${action}. Use: screenshot, open_url, click, type_text, press_key, scroll, run_command.`,
          isError: true,
        };
    }

    recordToolCost(sessionId, 'desktop_sandbox', TOOL_COST);
    log.info('Desktop action complete', { action });

    return { toolCallId: id, content: result, isError: false };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Desktop sandbox action failed', { action, error: errMsg });
    return {
      toolCallId: id,
      content: `Desktop action '${action}' failed: ${errMsg}`,
      isError: true,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

export async function isDesktopSandboxAvailable(): Promise<boolean> {
  return initDesktop();
}

export async function cleanupDesktopSandbox(): Promise<void> {
  if (activeSandbox) {
    try {
      await activeSandbox.kill();
      activeSandbox = null;
      log.info('Desktop sandbox cleaned up');
    } catch (error) {
      log.warn('Error cleaning up desktop sandbox', { error: (error as Error).message });
    }
  }
}
