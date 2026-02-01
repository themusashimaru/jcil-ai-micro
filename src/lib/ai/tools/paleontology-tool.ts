/**
 * PALEONTOLOGY TOOL
 * Fossil and ancient life science
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function radiometricAge(half: number, parent: number, daughter: number): number { return half * Math.log(1 + daughter / parent) / Math.log(2); }
function stratPosition(rate: number, depth: number): number { return depth / rate / 1e6; }
function bodyMass(femur: number): number { return Math.pow(10, 2.411 * Math.log10(femur) - 0.065); }
function metabolicRate(mass: number, ecto: boolean): number { return (ecto ? 10 : 70) * Math.pow(mass, 0.75); }
function populationSize(area: number, density: number): number { return area * density; }
function extinctionRate(extinct: number, total: number, time: number): number { return extinct / total / time * 100; }
function taphonomy(orig: number, decay: number, time: number): number { return orig * Math.exp(-decay * time); }

export const paleontologyTool: UnifiedTool = {
  name: 'paleontology',
  description: 'Paleontology: radiometric, strat_age, body_mass, metabolic, population, extinction_rate, taphonomy',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['radiometric', 'strat_age', 'body_mass', 'metabolic', 'population', 'extinction_rate', 'taphonomy'] }, half: { type: 'number' }, parent: { type: 'number' }, daughter: { type: 'number' }, rate: { type: 'number' }, depth: { type: 'number' }, femur: { type: 'number' }, mass: { type: 'number' }, ecto: { type: 'boolean' }, area: { type: 'number' }, density: { type: 'number' }, extinct: { type: 'number' }, total: { type: 'number' }, time: { type: 'number' }, orig: { type: 'number' }, decay: { type: 'number' } }, required: ['operation'] },
};

export async function executePaleontology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'radiometric': result = { Ma: radiometricAge(args.half || 1250, args.parent || 100, args.daughter || 50) }; break;
      case 'strat_age': result = { Ma: stratPosition(args.rate || 10, args.depth || 500) }; break;
      case 'body_mass': result = { kg: bodyMass(args.femur || 500) }; break;
      case 'metabolic': result = { W: metabolicRate(args.mass || 1000, args.ecto || false) }; break;
      case 'population': result = { individuals: populationSize(args.area || 1e6, args.density || 0.01) }; break;
      case 'extinction_rate': result = { percent_Myr: extinctionRate(args.extinct || 100, args.total || 1000, args.time || 10) }; break;
      case 'taphonomy': result = { preserved: taphonomy(args.orig || 1000, args.decay || 0.01, args.time || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPaleontologyAvailable(): boolean { return true; }
