/**
 * PHOTONICS TOOL
 * Optics and photonics calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const C = 3e8;
const H = 6.626e-34;

function wavelengthToFrequency(lambda: number): number { return C / lambda; }
function frequencyToWavelength(f: number): number { return C / f; }
function photonEnergy(lambda: number): number { return H * C / lambda; }
function snellsLaw(n1: number, theta1: number, n2: number): number { const sin2 = n1 * Math.sin(theta1 * Math.PI / 180) / n2; return Math.asin(sin2) * 180 / Math.PI; }
function criticalAngle(n1: number, n2: number): number { return Math.asin(n2 / n1) * 180 / Math.PI; }
function brewsterAngle(n1: number, n2: number): number { return Math.atan(n2 / n1) * 180 / Math.PI; }
function fresnelReflection(n1: number, n2: number): number { return Math.pow((n1 - n2) / (n1 + n2), 2); }
function numericalAperture(n1: number, n2: number): number { return Math.sqrt(n1 * n1 - n2 * n2); }
function diffractionLimit(lambda: number, D: number): number { return 1.22 * lambda / D; }

export const photonicsTool: UnifiedTool = {
  name: 'photonics',
  description: 'Photonics: wavelength_frequency, photon_energy, snells_law, critical_angle, brewster_angle, fresnel, numerical_aperture, diffraction_limit',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['wavelength_to_frequency', 'frequency_to_wavelength', 'photon_energy', 'snells_law', 'critical_angle', 'brewster_angle', 'fresnel', 'numerical_aperture', 'diffraction_limit'] }, lambda: { type: 'number' }, f: { type: 'number' }, n1: { type: 'number' }, n2: { type: 'number' }, theta1: { type: 'number' }, D: { type: 'number' } }, required: ['operation'] },
};

export async function executePhotonics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'wavelength_to_frequency': result = { frequency_Hz: wavelengthToFrequency(args.lambda || 500e-9) }; break;
      case 'frequency_to_wavelength': result = { wavelength_m: frequencyToWavelength(args.f || 6e14) }; break;
      case 'photon_energy': result = { energy_J: photonEnergy(args.lambda || 500e-9), energy_eV: photonEnergy(args.lambda || 500e-9) / 1.602e-19 }; break;
      case 'snells_law': result = { theta2_deg: snellsLaw(args.n1 || 1, args.theta1 || 30, args.n2 || 1.5) }; break;
      case 'critical_angle': result = { critical_angle_deg: criticalAngle(args.n1 || 1.5, args.n2 || 1) }; break;
      case 'brewster_angle': result = { brewster_angle_deg: brewsterAngle(args.n1 || 1, args.n2 || 1.5) }; break;
      case 'fresnel': result = { reflectance: fresnelReflection(args.n1 || 1, args.n2 || 1.5) }; break;
      case 'numerical_aperture': result = { NA: numericalAperture(args.n1 || 1.48, args.n2 || 1.46) }; break;
      case 'diffraction_limit': result = { angular_resolution_rad: diffractionLimit(args.lambda || 500e-9, args.D || 0.1) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isPhotonicsAvailable(): boolean { return true; }
