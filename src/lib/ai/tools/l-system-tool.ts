/**
 * L-SYSTEM TOOL
 * Lindenmayer systems for procedural generation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface LSystemRule { from: string; to: string; probability?: number; }
interface LSystemConfig { axiom: string; rules: LSystemRule[]; iterations: number; }
interface TurtleState { x: number; y: number; angle: number; }
interface DrawCommand { type: 'line' | 'move'; from: { x: number; y: number }; to: { x: number; y: number }; }

const PRESETS: Record<string, LSystemConfig> = {
  tree: { axiom: 'X', rules: [{ from: 'X', to: 'F+[[X]-X]-F[-FX]+X' }, { from: 'F', to: 'FF' }], iterations: 4 },
  koch: { axiom: 'F', rules: [{ from: 'F', to: 'F+F-F-F+F' }], iterations: 4 },
  sierpinski: { axiom: 'F-G-G', rules: [{ from: 'F', to: 'F-G+F+G-F' }, { from: 'G', to: 'GG' }], iterations: 5 },
  dragon: { axiom: 'FX', rules: [{ from: 'X', to: 'X+YF+' }, { from: 'Y', to: '-FX-Y' }], iterations: 10 },
  hilbert: { axiom: 'A', rules: [{ from: 'A', to: '-BF+AFA+FB-' }, { from: 'B', to: '+AF-BFB-FA+' }], iterations: 5 },
  plant: { axiom: 'X', rules: [{ from: 'X', to: 'F-[[X]+X]+F[+FX]-X' }, { from: 'F', to: 'FF' }], iterations: 5 },
  penrose: { axiom: '[7]++[7]++[7]++[7]++[7]', rules: [{ from: '6', to: '81++91----71[-81----61]++' }, { from: '7', to: '+81--91[---61--71]+' }, { from: '8', to: '-61++71[+++81++91]-' }, { from: '9', to: '--81++++61[+91++++71]--71' }, { from: '1', to: '' }], iterations: 4 },
  gosper: { axiom: 'A', rules: [{ from: 'A', to: 'A-B--B+A++AA+B-' }, { from: 'B', to: '+A-BB--B-A++A+B' }], iterations: 4 },
  levy: { axiom: 'F', rules: [{ from: 'F', to: '+F--F+' }], iterations: 12 },
  fern: { axiom: 'X', rules: [{ from: 'X', to: 'F+[[X]-X]-F[-FX]+X' }, { from: 'F', to: 'FF' }], iterations: 6 }
};

function applyRules(input: string, rules: LSystemRule[]): string {
  let result = '';
  for (const char of input) {
    const rule = rules.find(r => r.from === char);
    if (rule) {
      if (rule.probability === undefined || Math.random() < rule.probability) {
        result += rule.to;
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}

function generate(config: LSystemConfig): string {
  let current = config.axiom;
  for (let i = 0; i < config.iterations; i++) {
    current = applyRules(current, config.rules);
  }
  return current;
}

function interpret(lstring: string, angle: number = 25, stepSize: number = 10): DrawCommand[] {
  const commands: DrawCommand[] = [];
  const stack: TurtleState[] = [];
  let state: TurtleState = { x: 0, y: 0, angle: -90 }; // Start pointing up

  for (const char of lstring) {
    switch (char) {
      case 'F':
      case 'G':
      case 'A':
      case 'B':
        const rad = (state.angle * Math.PI) / 180;
        const newX = state.x + stepSize * Math.cos(rad);
        const newY = state.y + stepSize * Math.sin(rad);
        commands.push({ type: 'line', from: { x: state.x, y: state.y }, to: { x: newX, y: newY } });
        state.x = newX;
        state.y = newY;
        break;
      case 'f':
        const rad2 = (state.angle * Math.PI) / 180;
        state.x += stepSize * Math.cos(rad2);
        state.y += stepSize * Math.sin(rad2);
        break;
      case '+':
        state.angle += angle;
        break;
      case '-':
        state.angle -= angle;
        break;
      case '[':
        stack.push({ ...state });
        break;
      case ']':
        if (stack.length > 0) state = stack.pop()!;
        break;
    }
  }
  return commands;
}

function commandsToSVG(commands: DrawCommand[], width: number, height: number): string {
  if (commands.length === 0) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cmd of commands) {
    minX = Math.min(minX, cmd.from.x, cmd.to.x);
    maxX = Math.max(maxX, cmd.from.x, cmd.to.x);
    minY = Math.min(minY, cmd.from.y, cmd.to.y);
    maxY = Math.max(maxY, cmd.from.y, cmd.to.y);
  }

  const scale = Math.min(width / (maxX - minX + 10), height / (maxY - minY + 10));
  const offsetX = -minX * scale + 5;
  const offsetY = -minY * scale + 5;

  const paths = commands.filter(c => c.type === 'line').map(c =>
    `M${c.from.x * scale + offsetX},${c.from.y * scale + offsetY}L${c.to.x * scale + offsetX},${c.to.y * scale + offsetY}`
  ).join(' ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <path d="${paths}" stroke="green" stroke-width="1" fill="none"/>
</svg>`;
}

function commandsToAscii(commands: DrawCommand[], charWidth: number, charHeight: number): string {
  if (commands.length === 0) return '';

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const cmd of commands) {
    minX = Math.min(minX, cmd.from.x, cmd.to.x);
    maxX = Math.max(maxX, cmd.from.x, cmd.to.x);
    minY = Math.min(minY, cmd.from.y, cmd.to.y);
    maxY = Math.max(maxY, cmd.from.y, cmd.to.y);
  }

  const scaleX = (charWidth - 1) / (maxX - minX || 1);
  const scaleY = (charHeight - 1) / (maxY - minY || 1);

  const grid: string[][] = Array(charHeight).fill(null).map(() => Array(charWidth).fill(' '));

  for (const cmd of commands) {
    if (cmd.type === 'line') {
      const x = Math.round((cmd.to.x - minX) * scaleX);
      const y = Math.round((cmd.to.y - minY) * scaleY);
      if (x >= 0 && x < charWidth && y >= 0 && y < charHeight) {
        grid[y][x] = '*';
      }
    }
  }

  return grid.map(row => row.join('')).join('\n');
}

export const lSystemTool: UnifiedTool = {
  name: 'l_system',
  description: 'L-System Generator: generate, interpret, svg, ascii, presets (tree, koch, sierpinski, dragon, plant, fern)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'interpret', 'svg', 'ascii', 'presets'] },
      preset: { type: 'string' },
      axiom: { type: 'string' },
      rules: { type: 'array' },
      iterations: { type: 'number' },
      angle: { type: 'number' },
      stepSize: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeLSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const config: LSystemConfig = args.preset && PRESETS[args.preset]
      ? PRESETS[args.preset]
      : { axiom: args.axiom || 'F', rules: args.rules || [{ from: 'F', to: 'F+F-F-F+F' }], iterations: args.iterations || 3 };

    switch (args.operation) {
      case 'generate':
        const lstring = generate(config);
        result = { lstring, length: lstring.length, config };
        break;
      case 'interpret':
        const cmds = interpret(generate(config), args.angle || 25, args.stepSize || 10);
        result = { commands: cmds.slice(0, 100), totalCommands: cmds.length };
        break;
      case 'svg':
        const svgCmds = interpret(generate(config), args.angle || 25, args.stepSize || 10);
        result = { svg: commandsToSVG(svgCmds, 400, 400) };
        break;
      case 'ascii':
        const asciiCmds = interpret(generate(config), args.angle || 25, args.stepSize || 10);
        result = { ascii: commandsToAscii(asciiCmds, 60, 30) };
        break;
      case 'presets':
        result = { presets: Object.keys(PRESETS), descriptions: {
          tree: 'Fractal tree',
          koch: 'Koch curve/snowflake',
          sierpinski: 'Sierpinski triangle',
          dragon: 'Dragon curve',
          hilbert: 'Hilbert curve',
          plant: 'Realistic plant',
          gosper: 'Gosper curve',
          levy: 'Levy C curve',
          fern: 'Barnsley fern'
        }};
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isLSystemAvailable(): boolean { return true; }
