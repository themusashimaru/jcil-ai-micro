/**
 * GLASS TOOL
 * Glass science and engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function refractiveIndex(n: number, lambda: number): number { return n + 0.01 / (lambda * lambda); }
function viscosity(a: number, b: number, t0: number, t: number): number { return Math.pow(10, a + b / (t - t0)); }
function thermalStress(e: number, alpha: number, dT: number, nu: number): number { return e * alpha * dT / (1 - nu); }
function annealing(thickness: number): number { return 5 + Math.pow(thickness, 2) / 10; }
function tempering(t: number): number { return t > 620 ? (t - 620) * 0.5 : 0; }
function uValue(thickness: number, k: number): number { return k / (thickness / 1000); }
function lightTransmission(t: number, k: number, d: number): number { return t * Math.exp(-k * d); }

export const glassTool: UnifiedTool = {
  name: 'glass',
  description: 'Glass: refractive_index, viscosity, thermal_stress, annealing, tempering, u_value, transmission',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['refractive_index', 'viscosity', 'thermal_stress', 'annealing', 'tempering', 'u_value', 'transmission'] }, n: { type: 'number' }, lambda: { type: 'number' }, a: { type: 'number' }, b: { type: 'number' }, t0: { type: 'number' }, t: { type: 'number' }, e: { type: 'number' }, alpha: { type: 'number' }, dT: { type: 'number' }, nu: { type: 'number' }, thickness: { type: 'number' }, k: { type: 'number' }, d: { type: 'number' } }, required: ['operation'] },
};

export async function executeGlass(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'refractive_index': result = { n: refractiveIndex(args.n || 1.52, args.lambda || 0.55) }; break;
      case 'viscosity': result = { log_poise: viscosity(args.a || -6.7, args.b || 8000, args.t0 || 200, args.t || 1000) }; break;
      case 'thermal_stress': result = { MPa: thermalStress(args.e || 70e9, args.alpha || 9e-6, args.dT || 100, args.nu || 0.22) / 1e6 }; break;
      case 'annealing': result = { hours: annealing(args.thickness || 10) }; break;
      case 'tempering': result = { surface_stress_MPa: tempering(args.t || 650) }; break;
      case 'u_value': result = { W_m2K: uValue(args.thickness || 6, args.k || 1.0) }; break;
      case 'transmission': result = { percent: lightTransmission(args.t || 0.9, args.k || 0.01, args.d || 6) * 100 }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isGlassAvailable(): boolean { return true; }
