/**
 * GEOTECHNICAL TOOL
 * Soil mechanics and foundation engineering
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function effectiveStress(totalStress: number, porePressure: number): number { return totalStress - porePressure; }
function bearingCapacity(c: number, Nc: number, gamma: number, B: number, Nq: number, q: number, Ng: number): number { return c * Nc + q * Nq + 0.5 * gamma * B * Ng; }
function consolidation(Cv: number, H: number, t: number): number { const Tv = Cv * t / (H * H); return Tv < 0.2 ? Math.sqrt(4 * Tv / Math.PI) : 1 - (8 / (Math.PI * Math.PI)) * Math.exp(-Math.PI * Math.PI * Tv / 4); }
function settlement(sigma: number, H: number, E: number): number { return sigma * H / E; }
function activePressure(gamma: number, H: number, phi: number): number { const Ka = Math.pow(Math.tan(Math.PI/4 - phi * Math.PI / 360), 2); return 0.5 * Ka * gamma * H * H; }
function passivePressure(gamma: number, H: number, phi: number): number { const Kp = Math.pow(Math.tan(Math.PI/4 + phi * Math.PI / 360), 2); return 0.5 * Kp * gamma * H * H; }
function sptCorrection(N: number, sigma: number): number { const CN = Math.sqrt(100 / sigma); return N * CN; }

export const geotechnicalTool: UnifiedTool = {
  name: 'geotechnical',
  description: 'Geotechnical: effective_stress, bearing_capacity, consolidation, settlement, active_pressure, passive_pressure, spt_correction',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['effective_stress', 'bearing_capacity', 'consolidation', 'settlement', 'active_pressure', 'passive_pressure', 'spt_correction'] }, totalStress: { type: 'number' }, porePressure: { type: 'number' }, c: { type: 'number' }, Nc: { type: 'number' }, gamma: { type: 'number' }, B: { type: 'number' }, Nq: { type: 'number' }, q: { type: 'number' }, Ng: { type: 'number' }, Cv: { type: 'number' }, H: { type: 'number' }, t: { type: 'number' }, sigma: { type: 'number' }, E: { type: 'number' }, phi: { type: 'number' }, N: { type: 'number' } }, required: ['operation'] },
};

export async function executeGeotechnical(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'effective_stress': result = { sigma_eff_kPa: effectiveStress(args.totalStress || 200, args.porePressure || 50) }; break;
      case 'bearing_capacity': result = { qult_kPa: bearingCapacity(args.c || 20, args.Nc || 25, args.gamma || 18, args.B || 2, args.Nq || 12, args.q || 20, args.Ng || 8) }; break;
      case 'consolidation': result = { U_percent: consolidation(args.Cv || 1e-7, args.H || 5, args.t || 31536000) * 100 }; break;
      case 'settlement': result = { S_m: settlement(args.sigma || 100000, args.H || 10, args.E || 10e6) }; break;
      case 'active_pressure': result = { Pa_kN_m: activePressure(args.gamma || 18, args.H || 5, args.phi || 30) }; break;
      case 'passive_pressure': result = { Pp_kN_m: passivePressure(args.gamma || 18, args.H || 5, args.phi || 30) }; break;
      case 'spt_correction': result = { N_corrected: sptCorrection(args.N || 15, args.sigma || 100) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isGeotechnicalAvailable(): boolean { return true; }
