/**
 * FORGING TOOL
 * Metal forging calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function forgingForce(k: number, a: number, mu: number, h: number, d: number): number { return k * a * (1 + mu * d / (3 * h)); }
function flashThickness(w: number, f: number): number { return 0.015 * Math.sqrt(w * f); }
function upsetRatio(h0: number, h1: number): number { return h0 / h1; }
function strain(h0: number, h1: number): number { return Math.log(h0 / h1); }
function forgeabilityIndex(ductility: number, strength: number): number { return ductility / strength * 100; }
function dieLife(hardness: number, temp: number): number { return hardness * 1000 / temp; }
function trimForce(perimeter: number, thickness: number, shear: number): number { return perimeter * thickness * shear; }

export const forgingTool: UnifiedTool = {
  name: 'forging',
  description: 'Forging: forging_force, flash_thickness, upset_ratio, strain, forgeability, die_life, trim_force',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['forging_force', 'flash_thickness', 'upset_ratio', 'strain', 'forgeability', 'die_life', 'trim_force'] }, k: { type: 'number' }, a: { type: 'number' }, mu: { type: 'number' }, h: { type: 'number' }, d: { type: 'number' }, w: { type: 'number' }, f: { type: 'number' }, h0: { type: 'number' }, h1: { type: 'number' }, ductility: { type: 'number' }, strength: { type: 'number' }, hardness: { type: 'number' }, temp: { type: 'number' }, perimeter: { type: 'number' }, thickness: { type: 'number' }, shear: { type: 'number' } }, required: ['operation'] },
};

export async function executeForging(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'forging_force': result = { force_kN: forgingForce(args.k || 200, args.a || 5000, args.mu || 0.3, args.h || 20, args.d || 80) / 1000 }; break;
      case 'flash_thickness': result = { mm: flashThickness(args.w || 10, args.f || 100) }; break;
      case 'upset_ratio': result = { ratio: upsetRatio(args.h0 || 100, args.h1 || 50) }; break;
      case 'strain': result = { true_strain: strain(args.h0 || 100, args.h1 || 50) }; break;
      case 'forgeability': result = { index: forgeabilityIndex(args.ductility || 40, args.strength || 500) }; break;
      case 'die_life': result = { cycles_k: dieLife(args.hardness || 50, args.temp || 1100) }; break;
      case 'trim_force': result = { force_kN: trimForce(args.perimeter || 500, args.thickness || 5, args.shear || 300) / 1000 }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isForgingAvailable(): boolean { return true; }
