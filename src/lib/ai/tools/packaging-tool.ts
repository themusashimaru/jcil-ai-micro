/**
 * PACKAGING TOOL
 * Packaging engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function boxStrength(ect: number, perimeter: number, depth: number): number { return 5.87 * ect * Math.sqrt(perimeter * depth); }
function cushionCurve(g: number, v: number, density: number): number { return 0.5 * density * v * v / g; }
function dropHeight(fragility: number, cushion: number): number { return fragility * cushion / 9.81; }
function stackLoad(layers: number, weight: number, sf: number): number { return (layers - 1) * weight * sf; }
function shelfLife(k: number, t: number): number { return Math.exp(-k * t); }
function permeability(flux: number, thickness: number, dp: number): number { return flux * thickness / dp; }
function palletPattern(l: number, w: number, pl: number, pw: number): number { const a = Math.floor(pl / l) * Math.floor(pw / w); const b = Math.floor(pl / w) * Math.floor(pw / l); return Math.max(a, b); }

export const packagingTool: UnifiedTool = {
  name: 'packaging',
  description: 'Packaging: box_strength, cushion, drop_height, stack_load, shelf_life, permeability, pallet_pattern',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['box_strength', 'cushion', 'drop_height', 'stack_load', 'shelf_life', 'permeability', 'pallet_pattern'] }, ect: { type: 'number' }, perimeter: { type: 'number' }, depth: { type: 'number' }, g: { type: 'number' }, v: { type: 'number' }, density: { type: 'number' }, fragility: { type: 'number' }, cushion: { type: 'number' }, layers: { type: 'number' }, weight: { type: 'number' }, sf: { type: 'number' }, k: { type: 'number' }, t: { type: 'number' }, flux: { type: 'number' }, thickness: { type: 'number' }, dp: { type: 'number' }, l: { type: 'number' }, w: { type: 'number' }, pl: { type: 'number' }, pw: { type: 'number' } }, required: ['operation'] },
};

export async function executePackaging(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'box_strength': result = { kg: boxStrength(args.ect || 30, args.perimeter || 100, args.depth || 30) }; break;
      case 'cushion': result = { thickness_cm: cushionCurve(args.g || 50, args.v || 5, args.density || 30) }; break;
      case 'drop_height': result = { cm: dropHeight(args.fragility || 80, args.cushion || 5) }; break;
      case 'stack_load': result = { kg: stackLoad(args.layers || 5, args.weight || 20, args.sf || 3) }; break;
      case 'shelf_life': result = { quality: shelfLife(args.k || 0.01, args.t || 30) }; break;
      case 'permeability': result = { cc_m2_day: permeability(args.flux || 100, args.thickness || 0.025, args.dp || 1) }; break;
      case 'pallet_pattern': result = { units_layer: palletPattern(args.l || 30, args.w || 20, args.pl || 120, args.pw || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPackagingAvailable(): boolean { return true; }
