/**
 * DISTILLATION TOOL
 * Separation engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function raoultsLaw(x: number, psat: number): number { return x * psat; }
function relativeVol(p1: number, p2: number): number { return p1 / p2; }
function fenskeMin(xd: number, xb: number, alpha: number): number { return Math.log((xd/(1-xd)) * ((1-xb)/xb)) / Math.log(alpha); }
function underwood(alpha: number, q: number, xf: number): number { return (alpha * xf) / (alpha - q) + ((1 - xf) * 1) / (1 - q); }
function refluxRatio(r: number, rmin: number): number { return r / rmin; }
function murphreeEff(yn: number, yn1: number, yStar: number): number { return (yn - yn1) / (yStar - yn1); }
function hetp(h: number, ntp: number): number { return h / ntp; }

export const distillationTool: UnifiedTool = {
  name: 'distillation',
  description: 'Distillation: raoults, relative_vol, fenske, underwood, reflux_ratio, murphree, hetp',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['raoults', 'relative_vol', 'fenske', 'underwood', 'reflux_ratio', 'murphree', 'hetp'] }, x: { type: 'number' }, psat: { type: 'number' }, p1: { type: 'number' }, p2: { type: 'number' }, xd: { type: 'number' }, xb: { type: 'number' }, alpha: { type: 'number' }, q: { type: 'number' }, xf: { type: 'number' }, r: { type: 'number' }, rmin: { type: 'number' }, yn: { type: 'number' }, yn1: { type: 'number' }, yStar: { type: 'number' }, h: { type: 'number' }, ntp: { type: 'number' } }, required: ['operation'] },
};

export async function executeDistillation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'raoults': result = { Pa: raoultsLaw(args.x || 0.5, args.psat || 101325) }; break;
      case 'relative_vol': result = { alpha: relativeVol(args.p1 || 150000, args.p2 || 100000) }; break;
      case 'fenske': result = { Nmin: fenskeMin(args.xd || 0.95, args.xb || 0.05, args.alpha || 2.5) }; break;
      case 'underwood': result = { theta: underwood(args.alpha || 2.5, args.q || 1, args.xf || 0.5) }; break;
      case 'reflux_ratio': result = { ratio: refluxRatio(args.r || 2, args.rmin || 1.5) }; break;
      case 'murphree': result = { EMV: murphreeEff(args.yn || 0.7, args.yn1 || 0.5, args.yStar || 0.75) }; break;
      case 'hetp': result = { m: hetp(args.h || 10, args.ntp || 20) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isDistillationAvailable(): boolean { return true; }
