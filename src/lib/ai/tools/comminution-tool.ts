/**
 * COMMINUTION TOOL
 * Size reduction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function bondWork(wi: number, p80: number, f80: number): number { return 10 * wi * (1/Math.sqrt(p80) - 1/Math.sqrt(f80)); }
function reductionRatio(f: number, p: number): number { return f / p; }
function rittinger(kr: number, sp: number, sf: number): number { return kr * (1/sp - 1/sf); }
function kick(kk: number, f: number, p: number): number { return kk * Math.log(f / p); }
function rosinRammler(d: number, d63: number, n: number): number { return 1 - Math.exp(-Math.pow(d/d63, n)); }
function circuitLoad(f: number, p: number, c: number): number { return f / (p - c); }
function millPower(d: number, l: number, nc: number, j: number): number { return 7.33 * d * d * d * l * nc * j; }

export const comminutionTool: UnifiedTool = {
  name: 'comminution',
  description: 'Comminution: bond_work, reduction, rittinger, kick, rosin_rammler, circuit_load, mill_power',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['bond_work', 'reduction', 'rittinger', 'kick', 'rosin_rammler', 'circuit_load', 'mill_power'] }, wi: { type: 'number' }, p80: { type: 'number' }, f80: { type: 'number' }, f: { type: 'number' }, p: { type: 'number' }, kr: { type: 'number' }, sp: { type: 'number' }, sf: { type: 'number' }, kk: { type: 'number' }, d: { type: 'number' }, d63: { type: 'number' }, n: { type: 'number' }, c: { type: 'number' }, l: { type: 'number' }, nc: { type: 'number' }, j: { type: 'number' } }, required: ['operation'] },
};

export async function executeComminution(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'bond_work': result = { kWh_t: bondWork(args.wi || 15, args.p80 || 100, args.f80 || 10000) }; break;
      case 'reduction': result = { ratio: reductionRatio(args.f || 10000, args.p || 100) }; break;
      case 'rittinger': result = { kWh_t: rittinger(args.kr || 0.1, args.sp || 100, args.sf || 10000) }; break;
      case 'kick': result = { kWh_t: kick(args.kk || 1, args.f || 10000, args.p || 100) }; break;
      case 'rosin_rammler': result = { fraction: rosinRammler(args.d || 100, args.d63 || 150, args.n || 1.5) }; break;
      case 'circuit_load': result = { ratio: circuitLoad(args.f || 100, args.p || 80, args.c || 50) }; break;
      case 'mill_power': result = { kW: millPower(args.d || 3, args.l || 4, args.nc || 0.75, args.j || 0.4) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isComminutionAvailable(): boolean { return true; }
