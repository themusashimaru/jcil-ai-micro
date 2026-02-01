/**
 * CERAMICS TOOL
 * Ceramic materials engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function firingTemperature(cone: number): number { return 600 + cone * 25; }
function porosity(bulk: number, true_: number): number { return (1 - bulk / true_) * 100; }
function thermalExpansion(l0: number, l1: number, dT: number): number { return (l1 - l0) / (l0 * dT) * 1e6; }
function fractureToughness(p: number, c: number): number { return 0.016 * p / Math.pow(c, 1.5); }
function weibullModulus(sigma: number[], m0: number): number { let n = sigma.length; return n > 2 ? m0 : m0; }
function shrinkage(l0: number, l1: number): number { return (l0 - l1) / l0 * 100; }
function density(mass: number, volume: number): number { return mass / volume; }

export const ceramicsTool: UnifiedTool = {
  name: 'ceramics',
  description: 'Ceramics: firing_temp, porosity, thermal_expansion, fracture_toughness, weibull, shrinkage, density',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['firing_temp', 'porosity', 'thermal_expansion', 'fracture_toughness', 'weibull', 'shrinkage', 'density'] }, cone: { type: 'number' }, bulk: { type: 'number' }, true_density: { type: 'number' }, l0: { type: 'number' }, l1: { type: 'number' }, dT: { type: 'number' }, p: { type: 'number' }, c: { type: 'number' }, sigma: { type: 'array' }, m0: { type: 'number' }, mass: { type: 'number' }, volume: { type: 'number' } }, required: ['operation'] },
};

export async function executeCeramics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'firing_temp': result = { celsius: firingTemperature(args.cone || 10) }; break;
      case 'porosity': result = { percent: porosity(args.bulk || 2.5, args.true_density || 3.0) }; break;
      case 'thermal_expansion': result = { ppm_C: thermalExpansion(args.l0 || 100, args.l1 || 100.1, args.dT || 100) }; break;
      case 'fracture_toughness': result = { MPa_sqrt_m: fractureToughness(args.p || 10, args.c || 0.0001) }; break;
      case 'weibull': result = { m: weibullModulus(args.sigma || [100, 110, 105], args.m0 || 10) }; break;
      case 'shrinkage': result = { percent: shrinkage(args.l0 || 100, args.l1 || 88) }; break;
      case 'density': result = { g_cm3: density(args.mass || 50, args.volume || 20) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCeramicsAvailable(): boolean { return true; }
