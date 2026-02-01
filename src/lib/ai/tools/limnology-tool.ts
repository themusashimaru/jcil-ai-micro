/**
 * LIMNOLOGY TOOL
 * Lake and freshwater science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function lakeVolume(area: number, depth: number): number { return area * depth / 3; }
function residenceTime(volume: number, outflow: number): number { return volume / outflow; }
function thermocline(temp: number[], depths: number[]): number { let maxGrad = 0, pos = 0; for (let i = 1; i < temp.length; i++) { const grad = Math.abs(temp[i] - temp[i-1]) / (depths[i] - depths[i-1]); if (grad > maxGrad) { maxGrad = grad; pos = (depths[i] + depths[i-1]) / 2; } } return pos; }
function secchiDepth(turbidity: number): number { return 1.5 / turbidity; }
function trophicState(tp: number): string { if (tp < 10) return 'oligotrophic'; if (tp < 30) return 'mesotrophic'; return 'eutrophic'; }
function oxygenSaturation(temp: number, elev: number): number { return (14.6 - 0.4 * temp) * Math.exp(-elev / 8000); }
function stratification(top: number, bottom: number): number { return (bottom - top) / 4; }

export const limnologyTool: UnifiedTool = {
  name: 'limnology',
  description: 'Limnology: lake_volume, residence_time, thermocline, secchi, trophic_state, oxygen_sat, stratification',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['lake_volume', 'residence_time', 'thermocline', 'secchi', 'trophic_state', 'oxygen_sat', 'stratification'] }, area: { type: 'number' }, depth: { type: 'number' }, volume: { type: 'number' }, outflow: { type: 'number' }, temp: { type: 'array' }, depths: { type: 'array' }, turbidity: { type: 'number' }, tp: { type: 'number' }, elev: { type: 'number' }, top: { type: 'number' }, bottom: { type: 'number' } }, required: ['operation'] },
};

export async function executeLimnology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'lake_volume': result = { m3: lakeVolume(args.area || 1e6, args.depth || 20) }; break;
      case 'residence_time': result = { years: residenceTime(args.volume || 1e9, args.outflow || 1e8) }; break;
      case 'thermocline': result = { depth_m: thermocline(args.temp || [25, 20, 10, 5], args.depths || [0, 5, 10, 20]) }; break;
      case 'secchi': result = { m: secchiDepth(args.turbidity || 0.5) }; break;
      case 'trophic_state': result = { state: trophicState(args.tp || 25) }; break;
      case 'oxygen_sat': result = { mg_L: oxygenSaturation(args.temp || 20, args.elev || 0) }; break;
      case 'stratification': result = { C_m: stratification(args.top || 22, args.bottom || 8) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isLimnologyAvailable(): boolean { return true; }
