/**
 * DRYING TOOL
 * Industrial drying
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function moistureContent(mw: number, md: number): number { return (mw - md) / md; }
function dryingRate(m: number, a: number, t: number): number { return m / (a * t); }
function equilibriumMoisture(rh: number, k: number, n: number): number { return Math.pow(-Math.log(1 - rh) / k, 1/n); }
function criticalMoisture(nc: number, a: number): number { return nc / a; }
function psychrometric(tw: number, td: number, p: number): number { return 0.622 * (2500 - 2.38 * tw) * (tw - td) / ((2500 + 1.84 * tw - 4.18 * td) * p); }
function lewisNumber(alpha: number, d: number, rho: number, cp: number): number { return alpha / (d * rho * cp); }
function diffusionCoeff(t: number, p: number): number { return 2.2e-5 * Math.pow(t / 273, 1.75) * (101325 / p); }

export const dryingTool: UnifiedTool = {
  name: 'drying',
  description: 'Drying: moisture, rate, equilibrium, critical, psychrometric, lewis, diffusion',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['moisture', 'rate', 'equilibrium', 'critical', 'psychrometric', 'lewis', 'diffusion'] }, mw: { type: 'number' }, md: { type: 'number' }, m: { type: 'number' }, a: { type: 'number' }, t: { type: 'number' }, rh: { type: 'number' }, k: { type: 'number' }, n: { type: 'number' }, nc: { type: 'number' }, tw: { type: 'number' }, td: { type: 'number' }, p: { type: 'number' }, alpha: { type: 'number' }, d: { type: 'number' }, rho: { type: 'number' }, cp: { type: 'number' } }, required: ['operation'] },
};

export async function executeDrying(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'moisture': result = { kg_kg: moistureContent(args.mw || 100, args.md || 80) }; break;
      case 'rate': result = { kg_m2_s: dryingRate(args.m || 10, args.a || 100, args.t || 3600) }; break;
      case 'equilibrium': result = { kg_kg: equilibriumMoisture(args.rh || 0.6, args.k || 0.1, args.n || 2) }; break;
      case 'critical': result = { kg_kg: criticalMoisture(args.nc || 0.001, args.a || 0.01) }; break;
      case 'psychrometric': result = { kg_kg: psychrometric(args.tw || 30, args.td || 20, args.p || 101325) }; break;
      case 'lewis': result = { Le: lewisNumber(args.alpha || 2e-5, args.d || 2.5e-5, args.rho || 1.2, args.cp || 1000) }; break;
      case 'diffusion': result = { m2_s: diffusionCoeff(args.t || 350, args.p || 101325) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isDryingAvailable(): boolean { return true; }
