/**
 * MICROBIOLOGY TOOL
 * Microbial science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function bacterialGrowth(n0: number, k: number, t: number): number { return n0 * Math.exp(k * t); }
function generationTime(k: number): number { return Math.log(2) / k; }
function od600ToCfu(od: number): number { return od * 8e8; }
function dilutionFactor(colonies: number, volume: number, dilution: number): number { return colonies / (volume * dilution); }
function moi(virus: number, cells: number): number { return virus / cells; }
function killRate(n0: number, nt: number, t: number): number { return Math.log10(n0 / nt) / t; }
function biofilmMass(dry: number, wet: number): number { return dry / wet * 100; }

export const microbiologyTool: UnifiedTool = {
  name: 'microbiology',
  description: 'Microbiology: growth, generation_time, od_to_cfu, dilution, moi, kill_rate, biofilm',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['growth', 'generation_time', 'od_to_cfu', 'dilution', 'moi', 'kill_rate', 'biofilm'] }, n0: { type: 'number' }, k: { type: 'number' }, t: { type: 'number' }, od: { type: 'number' }, colonies: { type: 'number' }, volume: { type: 'number' }, dilution: { type: 'number' }, virus: { type: 'number' }, cells: { type: 'number' }, nt: { type: 'number' }, dry: { type: 'number' }, wet: { type: 'number' } }, required: ['operation'] },
};

export async function executeMicrobiology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'growth': result = { cells: bacterialGrowth(args.n0 || 1000, args.k || 0.5, args.t || 5) }; break;
      case 'generation_time': result = { hours: generationTime(args.k || 0.5) }; break;
      case 'od_to_cfu': result = { cfu_mL: od600ToCfu(args.od || 0.5) }; break;
      case 'dilution': result = { cfu_mL: dilutionFactor(args.colonies || 150, args.volume || 0.1, args.dilution || 1e-6) }; break;
      case 'moi': result = { MOI: moi(args.virus || 1e7, args.cells || 1e6) }; break;
      case 'kill_rate': result = { log_hr: killRate(args.n0 || 1e6, args.nt || 1e3, args.t || 1) }; break;
      case 'biofilm': result = { percent_dry: biofilmMass(args.dry || 5, args.wet || 50) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isMicrobiologyAvailable(): boolean { return true; }
