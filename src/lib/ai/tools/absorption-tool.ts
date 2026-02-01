/**
 * ABSORPTION TOOL
 * Gas absorption
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function henrysLaw(p: number, h: number): number { return p / h; }
function absorptionFactor(l: number, m: number, g: number): number { return l / (m * g); }
function htg(g: number, kya: number, s: number): number { return g / (kya * s); }
function htl(l: number, kxa: number, s: number): number { return l / (kxa * s); }
function ntog(y1: number, y2: number, ym: number): number { return Math.log((y1 - ym) / (y2 - ym)); }
function nog(y1: number, y2: number, yStar: number): number { return (y1 - y2) / ((y1 - yStar + y2 - yStar) / 2); }
function packedHeight(htg: number, ntog: number): number { return htg * ntog; }

export const absorptionTool: UnifiedTool = {
  name: 'absorption',
  description: 'Absorption: henrys, factor, htg, htl, ntog, nog, packed_height',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['henrys', 'factor', 'htg', 'htl', 'ntog', 'nog', 'packed_height'] }, p: { type: 'number' }, h: { type: 'number' }, l: { type: 'number' }, m: { type: 'number' }, g: { type: 'number' }, kya: { type: 'number' }, s: { type: 'number' }, kxa: { type: 'number' }, y1: { type: 'number' }, y2: { type: 'number' }, ym: { type: 'number' }, yStar: { type: 'number' }, htgVal: { type: 'number' }, ntogVal: { type: 'number' } }, required: ['operation'] },
};

export async function executeAbsorption(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'henrys': result = { mol_L: henrysLaw(args.p || 101325, args.h || 29000) }; break;
      case 'factor': result = { A: absorptionFactor(args.l || 100, args.m || 2, args.g || 50) }; break;
      case 'htg': result = { m: htg(args.g || 1, args.kya || 0.1, args.s || 1) }; break;
      case 'htl': result = { m: htl(args.l || 1, args.kxa || 0.1, args.s || 1) }; break;
      case 'ntog': result = { NTU: ntog(args.y1 || 0.1, args.y2 || 0.01, args.ym || 0.005) }; break;
      case 'nog': result = { NTU: nog(args.y1 || 0.1, args.y2 || 0.01, args.yStar || 0.005) }; break;
      case 'packed_height': result = { m: packedHeight(args.htgVal || 0.5, args.ntogVal || 5) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isAbsorptionAvailable(): boolean { return true; }
