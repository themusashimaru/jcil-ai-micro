/**
 * SEMICONDUCTOR TOOL
 * Semiconductor physics calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const K_B = 1.381e-23;
const Q = 1.602e-19;

function intrinsicCarrier(Nc: number, Nv: number, Eg: number, T: number): number { return Math.sqrt(Nc * Nv) * Math.exp(-Eg / (2 * K_B * T / Q)); }
function fermiLevel(Ec: number, kT: number, n: number, Nc: number): number { return Ec - kT * Math.log(Nc / n); }
function mobility(mu0: number, T: number, T0: number, alpha: number): number { return mu0 * Math.pow(T0 / T, alpha); }
function diffusionCoeff(mu: number, T: number): number { return mu * K_B * T / Q; }
function debyeLength(epsilon: number, n: number, T: number): number { return Math.sqrt(epsilon * 8.854e-12 * K_B * T / (Q * Q * n)); }
function builtInVoltage(Na: number, Nd: number, ni: number, T: number): number { return (K_B * T / Q) * Math.log(Na * Nd / (ni * ni)); }
function depletionWidth(Vbi: number, epsilon: number, Na: number, Nd: number, V: number): number { return Math.sqrt(2 * epsilon * 8.854e-12 * (Vbi - V) * (1/Na + 1/Nd) / Q); }
function thresholdVoltage(phiM: number, phiS: number, Qox: number, Cox: number, phiF: number): number { return phiM - phiS - Qox / Cox + 2 * phiF; }

export const semiconductorTool: UnifiedTool = {
  name: 'semiconductor',
  description: 'Semiconductor: intrinsic_carrier, fermi_level, mobility, diffusion, debye_length, built_in_voltage, depletion_width, threshold_voltage',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['intrinsic_carrier', 'fermi_level', 'mobility', 'diffusion', 'debye_length', 'built_in_voltage', 'depletion_width', 'threshold_voltage'] }, Nc: { type: 'number' }, Nv: { type: 'number' }, Eg: { type: 'number' }, T: { type: 'number' }, Ec: { type: 'number' }, kT: { type: 'number' }, n: { type: 'number' }, mu0: { type: 'number' }, T0: { type: 'number' }, alpha: { type: 'number' }, mu: { type: 'number' }, epsilon: { type: 'number' }, Na: { type: 'number' }, Nd: { type: 'number' }, ni: { type: 'number' }, Vbi: { type: 'number' }, V: { type: 'number' }, phiM: { type: 'number' }, phiS: { type: 'number' }, Qox: { type: 'number' }, Cox: { type: 'number' }, phiF: { type: 'number' } }, required: ['operation'] },
};

export async function executeSemiconductor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'intrinsic_carrier': result = { ni_cm3: intrinsicCarrier(args.Nc || 2.8e19, args.Nv || 1e19, args.Eg || 1.12, args.T || 300) / 1e6 }; break;
      case 'fermi_level': result = { Ef_eV: fermiLevel(args.Ec || 0, args.kT || 0.026, args.n || 1e16, args.Nc || 2.8e19) }; break;
      case 'mobility': result = { mu_cm2_Vs: mobility(args.mu0 || 1400, args.T || 300, args.T0 || 300, args.alpha || 2.4) }; break;
      case 'diffusion': result = { D_cm2_s: diffusionCoeff(args.mu || 1400, args.T || 300) * 1e4 }; break;
      case 'debye_length': result = { Ld_nm: debyeLength(args.epsilon || 11.7, args.n || 1e16 * 1e6, args.T || 300) * 1e9 }; break;
      case 'built_in_voltage': result = { Vbi_V: builtInVoltage(args.Na || 1e17 * 1e6, args.Nd || 1e16 * 1e6, args.ni || 1e10 * 1e6, args.T || 300) }; break;
      case 'depletion_width': result = { W_um: depletionWidth(args.Vbi || 0.7, args.epsilon || 11.7, args.Na || 1e17 * 1e6, args.Nd || 1e16 * 1e6, args.V || 0) * 1e6 }; break;
      case 'threshold_voltage': result = { Vth_V: thresholdVoltage(args.phiM || 4.1, args.phiS || 4.05, args.Qox || 0, args.Cox || 1e-7, args.phiF || 0.3) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSemiconductorAvailable(): boolean { return true; }
