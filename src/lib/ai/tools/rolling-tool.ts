/**
 * ROLLING TOOL
 * Metal rolling calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function rollForce(k: number, w: number, r: number, dh: number): number { return k * w * Math.sqrt(r * dh); }
function reduction(h0: number, h1: number): number { return (h0 - h1) / h0 * 100; }
function rollTorque(f: number, l: number): number { return f * l / 2; }
function rollPower(t: number, n: number): number { return 2 * Math.PI * t * n / 60000; }
function spreadRatio(w1: number, w0: number): number { return w1 / w0; }
function neutralPoint(r: number, dh: number, mu: number): number { return Math.sqrt(r * dh) * (0.5 - mu * Math.sqrt(r / dh) / 4); }
function maxReduction(r: number, mu: number): number { return mu * mu * r; }

export const rollingTool: UnifiedTool = {
  name: 'rolling',
  description: 'Rolling: force, reduction, torque, power, spread, neutral_point, max_reduction',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['force', 'reduction', 'torque', 'power', 'spread', 'neutral_point', 'max_reduction'] }, k: { type: 'number' }, w: { type: 'number' }, r: { type: 'number' }, dh: { type: 'number' }, h0: { type: 'number' }, h1: { type: 'number' }, f: { type: 'number' }, l: { type: 'number' }, t: { type: 'number' }, n: { type: 'number' }, w1: { type: 'number' }, w0: { type: 'number' }, mu: { type: 'number' } }, required: ['operation'] },
};

export async function executeRolling(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'force': result = { force_MN: rollForce(args.k || 200, args.w || 1000, args.r || 300, args.dh || 10) / 1e6 }; break;
      case 'reduction': result = { percent: reduction(args.h0 || 50, args.h1 || 40) }; break;
      case 'torque': result = { kNm: rollTorque(args.f || 5e6, args.l || 0.05) / 1000 }; break;
      case 'power': result = { kW: rollPower(args.t || 50000, args.n || 60) }; break;
      case 'spread': result = { ratio: spreadRatio(args.w1 || 1050, args.w0 || 1000) }; break;
      case 'neutral_point': result = { mm: neutralPoint(args.r || 300, args.dh || 10, args.mu || 0.3) }; break;
      case 'max_reduction': result = { mm: maxReduction(args.r || 300, args.mu || 0.3) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isRollingAvailable(): boolean { return true; }
