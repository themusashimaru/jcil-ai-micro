/**
 * NUCLEAR ENGINEERING TOOL
 * Reactor physics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function neutronFlux(p: number, ef: number, sigma_f: number, n: number): number { return p / (ef * sigma_f * n * 1.6e-13); }
function criticality(k_inf: number, l2: number, b2: number): number { return k_inf / (1 + l2 * b2); }
function burnup(e: number, m: number): number { return e / m / 1e6; }
function decayHeat(p0: number, t: number, ts: number): number { return 0.066 * p0 * (Math.pow(t, -0.2) - Math.pow(t + ts, -0.2)); }
function controlRodWorth(rho_in: number, rho_out: number): number { return (rho_out - rho_in) * 100; }
function reactivityCoeff(dk: number, dp: number): number { return dk / dp * 1e5; }
function conversionRatio(c: number, f: number): number { return c / f; }

export const nuclearEngineeringTool: UnifiedTool = {
  name: 'nuclear_engineering',
  description: 'Nuclear: flux, criticality, burnup, decay_heat, rod_worth, reactivity_coeff, conversion',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['flux', 'criticality', 'burnup', 'decay_heat', 'rod_worth', 'reactivity_coeff', 'conversion'] }, p: { type: 'number' }, ef: { type: 'number' }, sigma_f: { type: 'number' }, n: { type: 'number' }, k_inf: { type: 'number' }, l2: { type: 'number' }, b2: { type: 'number' }, e: { type: 'number' }, m: { type: 'number' }, p0: { type: 'number' }, t: { type: 'number' }, ts: { type: 'number' }, rho_in: { type: 'number' }, rho_out: { type: 'number' }, dk: { type: 'number' }, dp: { type: 'number' }, c: { type: 'number' }, f: { type: 'number' } }, required: ['operation'] },
};

export async function executeNuclearEngineering(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'flux': result = { n_cm2_s: neutronFlux(args.p || 3e9, args.ef || 200, args.sigma_f || 580e-24, args.n || 1e22) }; break;
      case 'criticality': result = { k_eff: criticality(args.k_inf || 1.3, args.l2 || 40, args.b2 || 0.003) }; break;
      case 'burnup': result = { MWd_kg: burnup(args.e || 1e15, args.m || 100) }; break;
      case 'decay_heat': result = { W: decayHeat(args.p0 || 3e9, args.t || 100, args.ts || 31536000) }; break;
      case 'rod_worth': result = { pcm: controlRodWorth(args.rho_in || 0.99, args.rho_out || 1.02) }; break;
      case 'reactivity_coeff': result = { pcm_unit: reactivityCoeff(args.dk || -0.001, args.dp || 10) }; break;
      case 'conversion': result = { ratio: conversionRatio(args.c || 50, args.f || 60) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isNuclearEngineeringAvailable(): boolean { return true; }
