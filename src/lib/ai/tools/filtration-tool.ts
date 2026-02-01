/**
 * FILTRATION TOOL
 * Solid-liquid separation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function darcyLaw(k: number, a: number, dp: number, mu: number, l: number): number { return k * a * dp / (mu * l); }
function cakeResistance(mu: number, v: number, a: number, dp: number, c: number): number { return 2 * dp * a * a / (mu * v * v * c); }
function filterMedium(rm: number, mu: number, a: number, dp: number): number { return rm * mu / (a * dp); }
function washRatio(vw: number, vc: number): number { return vw / vc; }
function filtrationTime(v: number, a: number, alpha: number, c: number, mu: number, dp: number, rm: number): number { return mu * alpha * c * v * v / (2 * a * a * dp) + mu * rm * v / (a * dp); }
function throughput(v: number, a: number, t: number): number { return v / (a * t); }
function cycleTime(tf: number, tw: number, td: number): number { return tf + tw + td; }

export const filtrationTool: UnifiedTool = {
  name: 'filtration',
  description: 'Filtration: darcy, cake_resistance, medium, wash_ratio, time, throughput, cycle',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['darcy', 'cake_resistance', 'medium', 'wash_ratio', 'time', 'throughput', 'cycle'] }, k: { type: 'number' }, a: { type: 'number' }, dp: { type: 'number' }, mu: { type: 'number' }, l: { type: 'number' }, v: { type: 'number' }, c: { type: 'number' }, rm: { type: 'number' }, vw: { type: 'number' }, vc: { type: 'number' }, alpha: { type: 'number' }, t: { type: 'number' }, tf: { type: 'number' }, tw: { type: 'number' }, td: { type: 'number' } }, required: ['operation'] },
};

export async function executeFiltration(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'darcy': result = { m3_s: darcyLaw(args.k || 1e-12, args.a || 1, args.dp || 100000, args.mu || 0.001, args.l || 0.01) }; break;
      case 'cake_resistance': result = { per_m2: cakeResistance(args.mu || 0.001, args.v || 0.1, args.a || 1, args.dp || 100000, args.c || 50) }; break;
      case 'medium': result = { s: filterMedium(args.rm || 1e10, args.mu || 0.001, args.a || 1, args.dp || 100000) }; break;
      case 'wash_ratio': result = { ratio: washRatio(args.vw || 50, args.vc || 100) }; break;
      case 'time': result = { s: filtrationTime(args.v || 100, args.a || 1, args.alpha || 1e11, args.c || 50, args.mu || 0.001, args.dp || 100000, args.rm || 1e10) }; break;
      case 'throughput': result = { m3_m2_hr: throughput(args.v || 100, args.a || 1, args.t || 3600) }; break;
      case 'cycle': result = { min: cycleTime(args.tf || 30, args.tw || 10, args.td || 5) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isFiltrationAvailable(): boolean { return true; }
