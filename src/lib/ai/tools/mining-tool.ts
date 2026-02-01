/**
 * MINING TOOL
 * Mining engineering calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function blastHoleSpacing(b: number, s: number): number { return b * s; }
function powderFactor(explosive: number, rock: number): number { return explosive / rock; }
function dilution(ore: number, waste: number): number { return waste / (ore + waste) * 100; }
function recovery(recovered: number, total: number): number { return recovered / total * 100; }
function stripRatio(waste: number, ore: number): number { return waste / ore; }
function ventilation(q: number, p: number): number { return q * p / 1000; }
function groundPressure(h: number, gamma: number): number { return h * gamma / 1000; }

export const miningTool: UnifiedTool = {
  name: 'mining',
  description: 'Mining: blast_spacing, powder_factor, dilution, recovery, strip_ratio, ventilation, ground_pressure',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['blast_spacing', 'powder_factor', 'dilution', 'recovery', 'strip_ratio', 'ventilation', 'ground_pressure'] }, b: { type: 'number' }, s: { type: 'number' }, explosive: { type: 'number' }, rock: { type: 'number' }, ore: { type: 'number' }, waste: { type: 'number' }, recovered: { type: 'number' }, total: { type: 'number' }, q: { type: 'number' }, p: { type: 'number' }, h: { type: 'number' }, gamma: { type: 'number' } }, required: ['operation'] },
};

export async function executeMining(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'blast_spacing': result = { area_m2: blastHoleSpacing(args.b || 3, args.s || 4) }; break;
      case 'powder_factor': result = { kg_m3: powderFactor(args.explosive || 100, args.rock || 300) }; break;
      case 'dilution': result = { percent: dilution(args.ore || 1000, args.waste || 100) }; break;
      case 'recovery': result = { percent: recovery(args.recovered || 950, args.total || 1000) }; break;
      case 'strip_ratio': result = { ratio: stripRatio(args.waste || 5000, args.ore || 1000) }; break;
      case 'ventilation': result = { power_kW: ventilation(args.q || 100, args.p || 500) }; break;
      case 'ground_pressure': result = { MPa: groundPressure(args.h || 500, args.gamma || 27) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isMiningAvailable(): boolean { return true; }
