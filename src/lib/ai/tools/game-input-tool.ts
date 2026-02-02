/**
 * GAME INPUT TOOL
 * Input handling, key mapping, and input buffering for games
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface KeyBinding { action: string; keys: string[]; modifiers?: string[]; }
interface InputState { pressed: Set<string>; justPressed: Set<string>; justReleased: Set<string>; }
void (0 as unknown as InputState); // For frame-based input tracking
interface InputBuffer { actions: Array<{ action: string; time: number }>; maxSize: number; windowMs: number; }
interface GamepadState { connected: boolean; buttons: boolean[]; axes: number[]; }

const DEFAULT_BINDINGS: KeyBinding[] = [
  { action: 'move_up', keys: ['W', 'ArrowUp'] },
  { action: 'move_down', keys: ['S', 'ArrowDown'] },
  { action: 'move_left', keys: ['A', 'ArrowLeft'] },
  { action: 'move_right', keys: ['D', 'ArrowRight'] },
  { action: 'jump', keys: ['Space'] },
  { action: 'attack', keys: ['J', 'Z'] },
  { action: 'special', keys: ['K', 'X'] },
  { action: 'dodge', keys: ['L', 'C'] },
  { action: 'pause', keys: ['Escape', 'P'] },
  { action: 'interact', keys: ['E', 'Enter'] },
];

const FIGHTING_GAME_INPUTS: Record<string, string[]> = {
  'quarter_circle_forward': ['down', 'down-forward', 'forward', 'attack'],
  'quarter_circle_back': ['down', 'down-back', 'back', 'attack'],
  'dragon_punch': ['forward', 'down', 'down-forward', 'attack'],
  'half_circle_forward': ['back', 'down-back', 'down', 'down-forward', 'forward', 'attack'],
  'charge_forward': ['back_hold', 'forward', 'attack'],
  'double_tap': ['forward', 'forward'],
  '360': ['forward', 'down-forward', 'down', 'down-back', 'back', 'up-back', 'up', 'up-forward', 'attack'],
};

function createInputBuffer(maxSize: number = 20, windowMs: number = 500): InputBuffer {
  return { actions: [], maxSize, windowMs };
}

function addToBuffer(buffer: InputBuffer, action: string, time: number): void {
  buffer.actions.push({ action, time });
  if (buffer.actions.length > buffer.maxSize) buffer.actions.shift();
  buffer.actions = buffer.actions.filter(a => time - a.time < buffer.windowMs);
}

function checkCombo(buffer: InputBuffer, combo: string[], currentTime: number): boolean {
  const recentActions = buffer.actions.filter(a => currentTime - a.time < buffer.windowMs);
  if (recentActions.length < combo.length) return false;
  const actionNames = recentActions.slice(-combo.length).map(a => a.action);
  return combo.every((c, i) => actionNames[i] === c);
}

function simulateInputSequence(sequence: string[]): Array<{ action: string; time: number; detected: string | null }> {
  const buffer = createInputBuffer(20, 500);
  const results: Array<{ action: string; time: number; detected: string | null }> = [];
  let time = 0;

  for (const action of sequence) {
    addToBuffer(buffer, action, time);
    let detected: string | null = null;
    for (const [comboName, comboSequence] of Object.entries(FIGHTING_GAME_INPUTS)) {
      if (checkCombo(buffer, comboSequence, time)) {
        detected = comboName;
        break;
      }
    }
    results.push({ action, time, detected });
    time += 50;
  }
  return results;
}

function getMovementVector(pressed: Set<string>, bindings: KeyBinding[]): { x: number; y: number } {
  let x = 0, y = 0;
  const getBinding = (action: string) => bindings.find(b => b.action === action);

  const up = getBinding('move_up');
  const down = getBinding('move_down');
  const left = getBinding('move_left');
  const right = getBinding('move_right');

  if (up && up.keys.some(k => pressed.has(k))) y -= 1;
  if (down && down.keys.some(k => pressed.has(k))) y += 1;
  if (left && left.keys.some(k => pressed.has(k))) x -= 1;
  if (right && right.keys.some(k => pressed.has(k))) x += 1;

  if (x !== 0 && y !== 0) {
    const len = Math.sqrt(x * x + y * y);
    x /= len;
    y /= len;
  }
  return { x, y };
}

export const gameInputTool: UnifiedTool = {
  name: 'game_input',
  description: 'Game Input: bindings, buffer, combos, movement, gamepad, simulate',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['bindings', 'buffer', 'check_combo', 'movement', 'gamepad', 'simulate', 'fighting_inputs', 'info'] },
      action: { type: 'string' },
      keys: { type: 'array' },
      sequence: { type: 'array' },
      pressedKeys: { type: 'array' },
      combo: { type: 'array' }
    },
    required: ['operation']
  }
};

export async function executeGameInput(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'bindings':
        result = {
          bindings: DEFAULT_BINDINGS,
          customizable: true,
          supportedKeys: ['A-Z', '0-9', 'Arrow keys', 'Space', 'Enter', 'Escape', 'Shift', 'Ctrl', 'Alt']
        };
        break;
      case 'buffer':
        const buffer = createInputBuffer(args.maxSize || 20, args.windowMs || 500);
        result = {
          buffer: { maxSize: buffer.maxSize, windowMs: buffer.windowMs, currentSize: 0 },
          description: 'Input buffer for combo detection and input smoothing'
        };
        break;
      case 'check_combo':
        const testBuffer = createInputBuffer();
        const seq = args.sequence || ['down', 'down-forward', 'forward', 'attack'];
        seq.forEach((a: string, i: number) => addToBuffer(testBuffer, a, i * 50));
        const combo = args.combo || ['down', 'down-forward', 'forward', 'attack'];
        const matched = checkCombo(testBuffer, combo, (seq.length - 1) * 50);
        result = { sequence: seq, combo, matched, bufferWindow: '500ms' };
        break;
      case 'movement':
        const pressed = new Set<string>(args.pressedKeys || ['W', 'D']);
        const vector = getMovementVector(pressed, DEFAULT_BINDINGS);
        result = {
          pressedKeys: Array.from(pressed),
          movementVector: vector,
          normalized: Math.abs(vector.x) <= 1 && Math.abs(vector.y) <= 1,
          direction: vector.x === 0 && vector.y === 0 ? 'none' :
                     `${vector.y < 0 ? 'up' : vector.y > 0 ? 'down' : ''}${vector.x < 0 ? 'left' : vector.x > 0 ? 'right' : ''}`
        };
        break;
      case 'gamepad':
        const gamepad: GamepadState = {
          connected: true,
          buttons: [false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false],
          axes: [0.5, -0.3, 0, 0]
        };
        result = {
          gamepad,
          mapping: {
            buttons: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Back', 'Start', 'L3', 'R3', 'DPadUp', 'DPadDown', 'DPadLeft', 'DPadRight'],
            axes: ['Left X', 'Left Y', 'Right X', 'Right Y']
          },
          activeButtons: gamepad.buttons.map((b, i) => b ? i : -1).filter(i => i >= 0)
        };
        break;
      case 'simulate':
        const simSeq = args.sequence || ['down', 'down-forward', 'forward', 'attack'];
        const simResults = simulateInputSequence(simSeq);
        result = { simulation: simResults, detected: simResults.filter(r => r.detected).map(r => r.detected) };
        break;
      case 'fighting_inputs':
        result = {
          inputs: Object.entries(FIGHTING_GAME_INPUTS).map(([name, seq]) => ({ name, sequence: seq, notation: seq.join(' -> ') }))
        };
        break;
      case 'info':
        result = {
          description: 'Game input handling with buffering and combo detection',
          features: ['Key bindings', 'Input buffering', 'Combo detection', 'Movement vectors', 'Gamepad support'],
          commonPatterns: ['WASD + Mouse', 'Arrow keys', 'Gamepad', 'Touch controls']
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isGameInputAvailable(): boolean { return true; }
