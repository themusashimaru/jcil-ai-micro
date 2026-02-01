/**
 * COMPOSITES TOOL
 * Composite materials engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function ruleOfMixtures(vf: number, ef: number, em: number): number { return vf * ef + (1 - vf) * em; }
function transverseModulus(vf: number, ef: number, em: number): number { return (ef * em) / (vf * em + (1 - vf) * ef); }
function shearModulus(vf: number, gf: number, gm: number): number { return (gf * gm) / (vf * gm + (1 - vf) * gf); }
function poissonsRatio(vf: number, nuf: number, num: number): number { return vf * nuf + (1 - vf) * num; }
function density(vf: number, rhof: number, rhom: number): number { return vf * rhof + (1 - vf) * rhom; }
function thermalConductivity(vf: number, kf: number, km: number): number { return vf * kf + (1 - vf) * km; }
function failureStress(vf: number, sigf: number, sigm: number): number { return vf * sigf + (1 - vf) * sigm; }

export const compositesTool: UnifiedTool = {
  name: 'composites',
  description: 'Composites: rule_of_mixtures, transverse_E, shear_G, poisson, density, thermal_k, failure_stress',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['rule_of_mixtures', 'transverse_E', 'shear_G', 'poisson', 'density', 'thermal_k', 'failure_stress'] }, vf: { type: 'number' }, ef: { type: 'number' }, em: { type: 'number' }, gf: { type: 'number' }, gm: { type: 'number' }, nuf: { type: 'number' }, num: { type: 'number' }, rhof: { type: 'number' }, rhom: { type: 'number' }, kf: { type: 'number' }, km: { type: 'number' }, sigf: { type: 'number' }, sigm: { type: 'number' } }, required: ['operation'] },
};

export async function executeComposites(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'rule_of_mixtures': result = { E_GPa: ruleOfMixtures(args.vf || 0.6, args.ef || 230, args.em || 3.5) }; break;
      case 'transverse_E': result = { E_GPa: transverseModulus(args.vf || 0.6, args.ef || 230, args.em || 3.5) }; break;
      case 'shear_G': result = { G_GPa: shearModulus(args.vf || 0.6, args.gf || 90, args.gm || 1.3) }; break;
      case 'poisson': result = { nu: poissonsRatio(args.vf || 0.6, args.nuf || 0.2, args.num || 0.35) }; break;
      case 'density': result = { g_cm3: density(args.vf || 0.6, args.rhof || 1.8, args.rhom || 1.2) }; break;
      case 'thermal_k': result = { W_mK: thermalConductivity(args.vf || 0.6, args.kf || 10, args.km || 0.2) }; break;
      case 'failure_stress': result = { MPa: failureStress(args.vf || 0.6, args.sigf || 3500, args.sigm || 80) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCompositesAvailable(): boolean { return true; }
