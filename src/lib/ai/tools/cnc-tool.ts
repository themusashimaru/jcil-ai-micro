/**
 * CNC TOOL
 * CNC machining calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function spindleSpeed(vc: number, d: number): number { return 1000 * vc / (Math.PI * d); }
function feedRate(n: number, fz: number, z: number): number { return n * fz * z; }
function machiningTime(l: number, f: number): number { return l / f; }
function mrr(ap: number, ae: number, vf: number): number { return ap * ae * vf / 1000; }
function cuttingForce(kc: number, ap: number, fz: number): number { return kc * ap * fz; }
function power(fc: number, vc: number): number { return fc * vc / 60000; }
function surfaceRoughness(fz: number, r: number): number { return fz * fz / (8 * r) * 1000; }

export const cncTool: UnifiedTool = {
  name: 'cnc',
  description: 'CNC: spindle_speed, feed_rate, machining_time, mrr, cutting_force, power, roughness',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['spindle_speed', 'feed_rate', 'machining_time', 'mrr', 'cutting_force', 'power', 'roughness'] }, vc: { type: 'number' }, d: { type: 'number' }, n: { type: 'number' }, fz: { type: 'number' }, z: { type: 'number' }, l: { type: 'number' }, f: { type: 'number' }, ap: { type: 'number' }, ae: { type: 'number' }, vf: { type: 'number' }, kc: { type: 'number' }, fc: { type: 'number' }, r: { type: 'number' } }, required: ['operation'] },
};

export async function executeCnc(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'spindle_speed': result = { rpm: spindleSpeed(args.vc || 100, args.d || 10) }; break;
      case 'feed_rate': result = { mm_min: feedRate(args.n || 3000, args.fz || 0.1, args.z || 4) }; break;
      case 'machining_time': result = { min: machiningTime(args.l || 500, args.f || 1000) }; break;
      case 'mrr': result = { cm3_min: mrr(args.ap || 2, args.ae || 5, args.vf || 1000) }; break;
      case 'cutting_force': result = { N: cuttingForce(args.kc || 2000, args.ap || 2, args.fz || 0.1) }; break;
      case 'power': result = { kW: power(args.fc || 500, args.vc || 100) }; break;
      case 'roughness': result = { Ra_um: surfaceRoughness(args.fz || 0.1, args.r || 0.8) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCncAvailable(): boolean { return true; }
