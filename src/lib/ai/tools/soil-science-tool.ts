/**
 * SOIL SCIENCE TOOL
 * Soil properties and analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function soilTexture(sand: number, silt: number, clay: number): string { if (clay > 40) return 'clay'; if (sand > 85) return 'sand'; if (silt > 80) return 'silt'; return 'loam'; }
function bulkDensity(mass: number, volume: number): number { return mass / volume; }
function porosity(bulk: number, particle: number): number { return (1 - bulk / particle) * 100; }
function waterContent(wet: number, dry: number): number { return (wet - dry) / dry * 100; }
function hydraulicConductivity(k: number, gradient: number): number { return k * gradient; }
function cec(clay: number, om: number): number { return clay * 0.5 + om * 2; }
function soilPh(h: number): number { return -Math.log10(h); }

export const soilScienceTool: UnifiedTool = {
  name: 'soil_science',
  description: 'Soil: texture, bulk_density, porosity, water_content, hydraulic_k, cec, ph',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['texture', 'bulk_density', 'porosity', 'water_content', 'hydraulic_k', 'cec', 'ph'] }, sand: { type: 'number' }, silt: { type: 'number' }, clay: { type: 'number' }, mass: { type: 'number' }, volume: { type: 'number' }, bulk: { type: 'number' }, particle: { type: 'number' }, wet: { type: 'number' }, dry: { type: 'number' }, k: { type: 'number' }, gradient: { type: 'number' }, om: { type: 'number' }, h: { type: 'number' } }, required: ['operation'] },
};

export async function executeSoilScience(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'texture': result = { class: soilTexture(args.sand || 40, args.silt || 40, args.clay || 20) }; break;
      case 'bulk_density': result = { g_cm3: bulkDensity(args.mass || 150, args.volume || 100) }; break;
      case 'porosity': result = { percent: porosity(args.bulk || 1.4, args.particle || 2.65) }; break;
      case 'water_content': result = { percent: waterContent(args.wet || 120, args.dry || 100) }; break;
      case 'hydraulic_k': result = { cm_hr: hydraulicConductivity(args.k || 1, args.gradient || 0.1) }; break;
      case 'cec': result = { meq_100g: cec(args.clay || 20, args.om || 3) }; break;
      case 'ph': result = { pH: soilPh(args.h || 1e-7) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSoilScienceAvailable(): boolean { return true; }
