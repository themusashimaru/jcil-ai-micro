/**
 * COSMOLOGY TOOL
 * Cosmological calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const C = 3e8;
const H0 = 70; // km/s/Mpc

function hubbleDistance(z: number): number { const d = z * C / (H0 * 1000); return d; }
function comovingDistance(z: number, OmegaM: number): number { const integrand = (z: number) => 1 / Math.sqrt(OmegaM * Math.pow(1+z, 3) + (1 - OmegaM)); let d = 0; const dz = z / 1000; for (let i = 0; i < 1000; i++) d += integrand(i * dz) * dz; return d * C / (H0 * 1000); }
function lookbackTime(z: number): number { return (z / (1 + z)) * 13.8e9 / (H0 / 70); }
function redshiftFromVelocity(v: number): number { return v / C; }
function velocityFromRedshift(z: number): number { return z * C; }
function luminosityDistance(z: number): number { return (1 + z) * hubbleDistance(z); }
function angularDiameterDistance(z: number): number { return hubbleDistance(z) / (1 + z); }
function hubbleTime(): number { return 1 / (H0 * 3.241e-20); }
function criticalDensity(): number { const G = 6.674e-11; return 3 * Math.pow(H0 * 1000 / 3.086e22, 2) / (8 * Math.PI * G); }

export const cosmologyTool: UnifiedTool = {
  name: 'cosmology',
  description: 'Cosmology: hubble_distance, comoving_distance, lookback_time, redshift, luminosity_distance, angular_diameter_distance, hubble_time, critical_density',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['hubble_distance', 'comoving_distance', 'lookback_time', 'redshift_from_velocity', 'velocity_from_redshift', 'luminosity_distance', 'angular_diameter_distance', 'hubble_time', 'critical_density'] }, z: { type: 'number' }, v: { type: 'number' }, OmegaM: { type: 'number' } }, required: ['operation'] },
};

export async function executeCosmology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'hubble_distance': result = { distance_Mpc: hubbleDistance(args.z || 0.1) }; break;
      case 'comoving_distance': result = { distance_Mpc: comovingDistance(args.z || 0.1, args.OmegaM || 0.3) }; break;
      case 'lookback_time': result = { time_Gyr: lookbackTime(args.z || 1) / 1e9 }; break;
      case 'redshift_from_velocity': result = { z: redshiftFromVelocity(args.v || 3e7) }; break;
      case 'velocity_from_redshift': result = { v_m_s: velocityFromRedshift(args.z || 0.1) }; break;
      case 'luminosity_distance': result = { distance_Mpc: luminosityDistance(args.z || 0.1) }; break;
      case 'angular_diameter_distance': result = { distance_Mpc: angularDiameterDistance(args.z || 0.1) }; break;
      case 'hubble_time': result = { time_Gyr: hubbleTime() / (365.25 * 24 * 3600 * 1e9) }; break;
      case 'critical_density': result = { rho_kg_m3: criticalDensity() }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCosmologyAvailable(): boolean { return true; }
