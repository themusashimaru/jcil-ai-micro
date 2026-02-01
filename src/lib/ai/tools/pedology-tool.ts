/**
 * PEDOLOGY TOOL
 * Soil formation and classification
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function soilAge(depth: number, rate: number): number { return depth / rate; }
function horizonThickness(parent: number, weathering: number, time: number): number { return parent * weathering * time; }
function carbonDating(c14: number, c14_0: number): number { return -8033 * Math.log(c14 / c14_0); }
function soilOrder(om: number, clay: number, ph: number): string { if (om > 20) return 'Histosol'; if (clay > 60) return 'Vertisol'; if (ph > 8.5) return 'Aridisol'; return 'Alfisol'; }
function landCapability(slope: number, erosion: number, drainage: number): number { if (slope > 25 || erosion > 3) return 7; if (slope > 15) return 6; if (drainage < 2) return 5; return 3; }
function erosionRate(k: number, r: number, ls: number, c: number, p: number): number { return k * r * ls * c * p; }
function organicMatter(carbon: number): number { return carbon * 1.72; }

export const pedologyTool: UnifiedTool = {
  name: 'pedology',
  description: 'Pedology: soil_age, horizon, carbon_dating, soil_order, land_capability, erosion_usle, organic_matter',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['soil_age', 'horizon', 'carbon_dating', 'soil_order', 'land_capability', 'erosion_usle', 'organic_matter'] }, depth: { type: 'number' }, rate: { type: 'number' }, parent: { type: 'number' }, weathering: { type: 'number' }, time: { type: 'number' }, c14: { type: 'number' }, c14_0: { type: 'number' }, om: { type: 'number' }, clay: { type: 'number' }, ph: { type: 'number' }, slope: { type: 'number' }, erosion: { type: 'number' }, drainage: { type: 'number' }, k: { type: 'number' }, r: { type: 'number' }, ls: { type: 'number' }, c: { type: 'number' }, p: { type: 'number' }, carbon: { type: 'number' } }, required: ['operation'] },
};

export async function executePedology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'soil_age': result = { years: soilAge(args.depth || 100, args.rate || 0.01) }; break;
      case 'horizon': result = { cm: horizonThickness(args.parent || 100, args.weathering || 0.001, args.time || 10000) }; break;
      case 'carbon_dating': result = { years: carbonDating(args.c14 || 50, args.c14_0 || 100) }; break;
      case 'soil_order': result = { order: soilOrder(args.om || 5, args.clay || 25, args.ph || 6.5) }; break;
      case 'land_capability': result = { class: landCapability(args.slope || 10, args.erosion || 2, args.drainage || 4) }; break;
      case 'erosion_usle': result = { ton_ha_yr: erosionRate(args.k || 0.3, args.r || 200, args.ls || 1, args.c || 0.5, args.p || 1) }; break;
      case 'organic_matter': result = { percent: organicMatter(args.carbon || 2) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPedologyAvailable(): boolean { return true; }
