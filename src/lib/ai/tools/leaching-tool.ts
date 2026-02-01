/**
 * LEACHING TOOL
 * Solid-liquid extraction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function stageEquilibrium(x0: number, xn: number, y0: number, m: number): number { return Math.log((x0 - y0/m) / (xn - y0/m)) / Math.log(1 + 1/m); }
function leachingRate(k: number, a: number, dc: number): number { return k * a * dc; }
function penetrationDepth(d: number, t: number): number { return Math.sqrt(4 * d * t); }
function shrinkingCore(r: number, k: number, c: number, rho: number): number { return rho * r / (3 * k * c); }
function particleDissolution(dp: number, rho: number, k: number, c: number): number { return rho * dp / (6 * k * c); }
function countercurrentStages(xf: number, xr: number, yn1: number, y1: number): number { return Math.log((xf - y1) / (xr - yn1)) / Math.log((xf - xr) / (y1 - yn1)); }
function solventRatio(l: number, s: number): number { return l / s; }

export const leachingTool: UnifiedTool = {
  name: 'leaching',
  description: 'Leaching: stages, rate, penetration, shrinking_core, dissolution, countercurrent, solvent_ratio',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['stages', 'rate', 'penetration', 'shrinking_core', 'dissolution', 'countercurrent', 'solvent_ratio'] }, x0: { type: 'number' }, xn: { type: 'number' }, y0: { type: 'number' }, m: { type: 'number' }, k: { type: 'number' }, a: { type: 'number' }, dc: { type: 'number' }, d: { type: 'number' }, t: { type: 'number' }, r: { type: 'number' }, c: { type: 'number' }, rho: { type: 'number' }, dp: { type: 'number' }, xf: { type: 'number' }, xr: { type: 'number' }, yn1: { type: 'number' }, y1: { type: 'number' }, l: { type: 'number' }, s: { type: 'number' } }, required: ['operation'] },
};

export async function executeLeaching(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'stages': result = { N: stageEquilibrium(args.x0 || 0.3, args.xn || 0.01, args.y0 || 0, args.m || 1) }; break;
      case 'rate': result = { kg_s: leachingRate(args.k || 1e-5, args.a || 100, args.dc || 100) }; break;
      case 'penetration': result = { m: penetrationDepth(args.d || 1e-9, args.t || 3600) }; break;
      case 'shrinking_core': result = { s: shrinkingCore(args.r || 0.01, args.k || 1e-4, args.c || 100, args.rho || 2000) }; break;
      case 'dissolution': result = { s: particleDissolution(args.dp || 0.001, args.rho || 2000, args.k || 1e-4, args.c || 100) }; break;
      case 'countercurrent': result = { N: countercurrentStages(args.xf || 0.3, args.xr || 0.01, args.yn1 || 0, args.y1 || 0.25) }; break;
      case 'solvent_ratio': result = { ratio: solventRatio(args.l || 500, args.s || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isLeachingAvailable(): boolean { return true; }
