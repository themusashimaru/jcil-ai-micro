/**
 * DENDROLOGY TOOL
 * Tree science and forestry
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function treeVolume(dbh: number, height: number, form: number): number { return Math.PI * Math.pow(dbh / 200, 2) * height * form; }
function basalArea(dbh: number): number { return Math.PI * Math.pow(dbh / 2, 2) / 10000; }
function siteIndex(height: number, age: number): number { return height * Math.pow(50 / age, 0.5); }
function standDensity(trees: number, area: number): number { return trees / area; }
function carbonStock(volume: number, density: number, carbon: number): number { return volume * density * carbon; }
function growthRate(v2: number, v1: number, years: number): number { return (v2 - v1) / years; }
function crownRatio(crown: number, height: number): number { return crown / height * 100; }

export const dendrologyTool: UnifiedTool = {
  name: 'dendrology',
  description: 'Dendrology: tree_volume, basal_area, site_index, stand_density, carbon_stock, growth_rate, crown_ratio',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['tree_volume', 'basal_area', 'site_index', 'stand_density', 'carbon_stock', 'growth_rate', 'crown_ratio'] }, dbh: { type: 'number' }, height: { type: 'number' }, form: { type: 'number' }, trees: { type: 'number' }, area: { type: 'number' }, volume: { type: 'number' }, density: { type: 'number' }, carbon: { type: 'number' }, v2: { type: 'number' }, v1: { type: 'number' }, years: { type: 'number' }, crown: { type: 'number' }, age: { type: 'number' } }, required: ['operation'] },
};

export async function executeDendrology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'tree_volume': result = { m3: treeVolume(args.dbh || 30, args.height || 20, args.form || 0.4) }; break;
      case 'basal_area': result = { m2: basalArea(args.dbh || 30) }; break;
      case 'site_index': result = { SI: siteIndex(args.height || 25, args.age || 30) }; break;
      case 'stand_density': result = { trees_ha: standDensity(args.trees || 500, args.area || 1) }; break;
      case 'carbon_stock': result = { tonnes: carbonStock(args.volume || 200, args.density || 0.5, args.carbon || 0.5) }; break;
      case 'growth_rate': result = { m3_yr: growthRate(args.v2 || 150, args.v1 || 100, args.years || 5) }; break;
      case 'crown_ratio': result = { percent: crownRatio(args.crown || 8, args.height || 20) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isDendrologyAvailable(): boolean { return true; }
