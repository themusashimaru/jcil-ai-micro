/**
 * EXTRUSION TOOL
 * Extrusion process calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function extrusionRatio(a0: number, af: number): number { return a0 / af; }
function extrusionForce(k: number, a0: number, ratio: number): number { return k * a0 * Math.log(ratio); }
function ramSpeed(output: number, ratio: number): number { return output / ratio; }
function strain(ratio: number): number { return Math.log(ratio); }
function temperature(t0: number, work: number, rho: number, cp: number): number { return t0 + work / (rho * cp); }
function dieAngle(l: number, d0: number, df: number): number { return Math.atan((d0 - df) / (2 * l)) * 180 / Math.PI; }
function exitSpeed(ram: number, ratio: number): number { return ram * ratio; }

export const extrusionTool: UnifiedTool = {
  name: 'extrusion',
  description: 'Extrusion: ratio, force, ram_speed, strain, temperature, die_angle, exit_speed',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['ratio', 'force', 'ram_speed', 'strain', 'temperature', 'die_angle', 'exit_speed'] }, a0: { type: 'number' }, af: { type: 'number' }, k: { type: 'number' }, ratio: { type: 'number' }, output: { type: 'number' }, t0: { type: 'number' }, work: { type: 'number' }, rho: { type: 'number' }, cp: { type: 'number' }, l: { type: 'number' }, d0: { type: 'number' }, df: { type: 'number' }, ram: { type: 'number' } }, required: ['operation'] },
};

export async function executeExtrusion(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'ratio': result = { R: extrusionRatio(args.a0 || 10000, args.af || 500) }; break;
      case 'force': result = { force_MN: extrusionForce(args.k || 150, args.a0 || 10000, args.ratio || 20) / 1e6 }; break;
      case 'ram_speed': result = { mm_s: ramSpeed(args.output || 1000, args.ratio || 20) }; break;
      case 'strain': result = { epsilon: strain(args.ratio || 20) }; break;
      case 'temperature': result = { celsius: temperature(args.t0 || 450, args.work || 50e6, args.rho || 2700, args.cp || 900) }; break;
      case 'die_angle': result = { degrees: dieAngle(args.l || 50, args.d0 || 100, args.df || 20) }; break;
      case 'exit_speed': result = { mm_s: exitSpeed(args.ram || 10, args.ratio || 20) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isExtrusionAvailable(): boolean { return true; }
