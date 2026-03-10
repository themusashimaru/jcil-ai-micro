/**
 * ANTHROPIC COMPUTER USE AGENT
 *
 * Implements the Anthropic Computer Use agentic loop:
 * Claude sees a screenshot → decides an action → executes it → sees result → repeats.
 *
 * Uses Anthropic's native `computer_20250124` tool type for pixel-perfect desktop
 * interaction. Claude is specifically trained for this — it understands coordinates,
 * UI elements, and can zoom into small targets.
 *
 * Architecture:
 * 1. E2B provides the sandboxed Linux desktop (screenshot, click, type, etc.)
 * 2. Anthropic's API provides Claude with computer_use tool definitions
 * 3. This agent orchestrates the loop: screenshot → Claude → action → screenshot → ...
 *
 * @see https://docs.anthropic.com/en/docs/agents-and-tools/computer-use
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('ComputerUseAgent');

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_STEPS = 25; // Max actions before stopping
const SCREENSHOT_DELAY_MS = 1500; // Wait after action before screenshot
const DISPLAY_WIDTH = 1920;
const DISPLAY_HEIGHT = 1080;

// ============================================================================
// TYPES
// ============================================================================

export interface ComputerUseResult {
  success: boolean;
  steps: ComputerUseStep[];
  finalScreenshot?: string;
  summary: string;
  error?: string;
}

export interface ComputerUseStep {
  action: string;
  coordinates?: [number, number];
  text?: string;
  screenshot?: string;
  reasoning?: string;
}

/**
 * Desktop controller interface — abstracts E2B sandbox operations.
 * This allows the agent to work with any desktop backend.
 */
export interface DesktopController {
  screenshot(): Promise<Buffer>;
  click(x: number, y: number): Promise<void>;
  doubleClick(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  pressKey(key: string): Promise<void>;
  scroll(x: number, y: number, direction: 'up' | 'down', amount?: number): Promise<void>;
  moveMouse(x: number, y: number): Promise<void>;
  drag(startX: number, startY: number, endX: number, endY: number): Promise<void>;
  runCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

// ============================================================================
// COMPUTER USE AGENT
// ============================================================================

/**
 * Run an Anthropic Computer Use agentic loop.
 *
 * @param task - Natural language description of what to accomplish
 * @param desktop - Desktop controller (E2B sandbox wrapper)
 * @param onStep - Optional callback for real-time progress updates
 */
export async function runComputerUseAgent(
  task: string,
  desktop: DesktopController,
  onStep?: (step: ComputerUseStep, stepNumber: number) => void
): Promise<ComputerUseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      steps: [],
      summary: 'ANTHROPIC_API_KEY not configured',
      error: 'ANTHROPIC_API_KEY not configured',
    };
  }

  const client = new Anthropic({ apiKey });
  const steps: ComputerUseStep[] = [];

  log.info('Starting computer use agent', { task });

  // Take initial screenshot
  const initialScreenshot = await desktop.screenshot();
  const initialBase64 = initialScreenshot.toString('base64');

  // Build the messages with the task and initial screenshot
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Please complete this task on the desktop: ${task}\n\nHere is the current state of the screen. Analyze it and take the appropriate actions to complete the task.`,
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: initialBase64,
          },
        },
      ],
    },
  ];

  // Define the computer use tool
  const tools: Anthropic.Tool[] = [
    {
      type: 'computer_20250124' as unknown as 'custom',
      name: 'computer',
      display_width_px: DISPLAY_WIDTH,
      display_height_px: DISPLAY_HEIGHT,
      display_number: 1,
    } as unknown as Anthropic.Tool,
  ];

  // Agentic loop
  for (let stepNum = 0; stepNum < MAX_STEPS; stepNum++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 4096,
        system:
          "You are a computer use agent. Complete the user's task by interacting with the desktop. " +
          'Be precise with coordinates. After completing the task, respond with a text message summarizing what you did. ' +
          'If you encounter an error or cannot proceed, explain why.',
        tools,
        messages,
      });

      // Check if Claude wants to use a tool or is done
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ContentBlockParam & { type: 'tool_use' } =>
          block.type === 'tool_use'
      );
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );

      // If no tool use, Claude is done
      if (toolUseBlocks.length === 0) {
        const summary = textBlocks.map((b) => b.text).join('\n') || 'Task completed';
        log.info('Computer use agent completed', { steps: steps.length, summary });
        return {
          success: true,
          steps,
          finalScreenshot: steps[steps.length - 1]?.screenshot,
          summary,
        };
      }

      // Process each tool use
      const toolResults: Anthropic.MessageParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const input = toolUse.input as Record<string, unknown>;
        const action = input.action as string;

        const step: ComputerUseStep = {
          action,
          reasoning: textBlocks.map((b) => b.text).join('\n') || undefined,
        };

        // Execute the action
        try {
          await executeComputerAction(desktop, input);
        } catch (err) {
          log.error('Action failed', { action, error: (err as Error).message });
          step.action = `${action} (failed: ${(err as Error).message})`;
        }

        // Wait for UI to settle, then take screenshot
        await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_DELAY_MS));
        const screenshotBuffer = await desktop.screenshot();
        const screenshotBase64 = screenshotBuffer.toString('base64');
        step.screenshot = screenshotBase64;

        if (input.coordinate) {
          step.coordinates = input.coordinate as [number, number];
        }
        if (input.text) {
          step.text = input.text as string;
        }

        steps.push(step);
        onStep?.(step, stepNum);

        // Add tool result with screenshot
        toolResults.push({
          role: 'user',
          content: [
            {
              type: 'tool_result' as unknown as 'text',
              tool_use_id: toolUse.id,
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png' as const,
                    data: screenshotBase64,
                  },
                },
              ],
            } as unknown as Anthropic.TextBlockParam,
          ],
        });
      }

      // Add assistant response and tool results to conversation
      messages.push({ role: 'assistant', content: response.content });
      messages.push(...toolResults);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      log.error('Computer use step failed', { stepNum, error: errorMsg });
      return {
        success: false,
        steps,
        summary: `Failed at step ${stepNum + 1}: ${errorMsg}`,
        error: errorMsg,
      };
    }
  }

  // Reached max steps
  return {
    success: false,
    steps,
    finalScreenshot: steps[steps.length - 1]?.screenshot,
    summary: `Reached maximum of ${MAX_STEPS} steps without completing the task.`,
    error: 'Max steps reached',
  };
}

// ============================================================================
// ACTION EXECUTOR
// ============================================================================

async function executeComputerAction(
  desktop: DesktopController,
  input: Record<string, unknown>
): Promise<void> {
  const action = input.action as string;
  const coordinate = input.coordinate as [number, number] | undefined;

  switch (action) {
    case 'screenshot':
      // Just take a screenshot (handled after switch)
      break;

    case 'left_click':
    case 'click':
      if (!coordinate) throw new Error('Coordinates required for click');
      await desktop.click(coordinate[0], coordinate[1]);
      break;

    case 'double_click':
      if (!coordinate) throw new Error('Coordinates required for double_click');
      await desktop.doubleClick(coordinate[0], coordinate[1]);
      break;

    case 'right_click':
      if (!coordinate) throw new Error('Coordinates required for right_click');
      // Most desktop controllers don't have right_click, fall back to click
      await desktop.click(coordinate[0], coordinate[1]);
      break;

    case 'type':
      if (!input.text) throw new Error('Text required for type action');
      await desktop.type(input.text as string);
      break;

    case 'key':
      if (!input.text) throw new Error('Key required for key action');
      await desktop.pressKey(input.text as string);
      break;

    case 'scroll':
      if (!coordinate) throw new Error('Coordinates required for scroll');
      const direction =
        (input.direction as string) === 'up' || (input.scroll_direction as string) === 'up'
          ? 'up'
          : 'down';
      const amount = (input.scroll_amount as number) || 3;
      await desktop.scroll(coordinate[0], coordinate[1], direction, amount);
      break;

    case 'mouse_move':
      if (!coordinate) throw new Error('Coordinates required for mouse_move');
      await desktop.moveMouse(coordinate[0], coordinate[1]);
      break;

    case 'left_click_drag':
    case 'drag':
      if (!coordinate) throw new Error('Start coordinates required for drag');
      const endCoordinate = input.end_coordinate as [number, number] | undefined;
      if (!endCoordinate) throw new Error('End coordinates required for drag');
      await desktop.drag(coordinate[0], coordinate[1], endCoordinate[0], endCoordinate[1]);
      break;

    default:
      log.warn('Unknown computer use action', { action });
      break;
  }
}

// ============================================================================
// E2B DESKTOP ADAPTER
// ============================================================================

/**
 * Creates a DesktopController from an E2B Desktop sandbox instance.
 */
export function createE2BDesktopController(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sandbox: any
): DesktopController {
  return {
    async screenshot(): Promise<Buffer> {
      const image = await sandbox.screenshot();
      return Buffer.from(image);
    },

    async click(x: number, y: number): Promise<void> {
      await sandbox.leftClick(x, y);
    },

    async doubleClick(x: number, y: number): Promise<void> {
      await sandbox.doubleClick(x, y);
    },

    async type(text: string): Promise<void> {
      await sandbox.write(text);
    },

    async pressKey(key: string): Promise<void> {
      await sandbox.press(key);
    },

    async scroll(_x: number, _y: number, direction: 'up' | 'down', amount = 3): Promise<void> {
      await sandbox.scroll(direction, amount);
    },

    async moveMouse(x: number, y: number): Promise<void> {
      await sandbox.moveTo(x, y);
    },

    async drag(startX: number, startY: number, endX: number, endY: number): Promise<void> {
      await sandbox.leftClick(startX, startY);
      await new Promise((resolve) => setTimeout(resolve, 200));
      await sandbox.moveTo(endX, endY);
      await new Promise((resolve) => setTimeout(resolve, 100));
    },

    async runCommand(
      command: string
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
      const result = await sandbox.commands.run(command, { timeoutMs: 30000 });
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode ?? 0,
      };
    },
  };
}
