/**
 * RELATIVITY TOOL
 *
 * Special and general relativity: Lorentz transformations,
 * time dilation, length contraction, E=mc², spacetime.
 *
 * Part of TIER PHYSICS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const c = 299792458; // Speed of light (m/s)

// Lorentz factor
function gamma(v: number): number {
  return 1 / Math.sqrt(1 - (v * v) / (c * c));
}

// Time dilation
function timeDilation(properTime: number, v: number): number {
  return properTime * gamma(v);
}

// Length contraction
function lengthContraction(properLength: number, v: number): number {
  return properLength / gamma(v);
}

// Relativistic mass
function relativisticMass(restMass: number, v: number): number {
  return restMass * gamma(v);
}

// Relativistic kinetic energy
function relativisticKE(restMass: number, v: number): number {
  return restMass * c * c * (gamma(v) - 1);
}

// Rest energy
function restEnergy(mass: number): number {
  return mass * c * c;
}

// Relativistic momentum
function relativisticMomentum(mass: number, v: number): number {
  return mass * v * gamma(v);
}

// Velocity addition
function velocityAddition(v1: number, v2: number): number {
  return (v1 + v2) / (1 + (v1 * v2) / (c * c));
}

// Doppler effect (relativistic)
function relativisticDoppler(f0: number, v: number, approaching: boolean): number {
  const beta = v / c;
  if (approaching) {
    return f0 * Math.sqrt((1 + beta) / (1 - beta));
  } else {
    return f0 * Math.sqrt((1 - beta) / (1 + beta));
  }
}

// Schwarzschild radius
function schwarzschildRadius(mass: number): number {
  const _G = 6.674e-11;
  return (2 * G * mass) / (c * c);
}

// Gravitational time dilation
function gravitationalTimeDilation(properTime: number, M: number, r: number): number {
  const _G = 6.674e-11;
  const rs = schwarzschildRadius(M);
  return properTime / Math.sqrt(1 - rs / r);
}

// Gravitational redshift
function gravitationalRedshift(lambda0: number, M: number, r: number): number {
  const rs = schwarzschildRadius(M);
  return lambda0 / Math.sqrt(1 - rs / r);
}

export const relativityTool: UnifiedTool = {
  name: 'relativity',
  description: `Special and general relativity calculations.

Operations:
- gamma: Lorentz factor
- time_dilation: Time dilation effect
- length_contraction: Length contraction effect
- mass_energy: E=mc² and relativistic mass
- momentum: Relativistic momentum
- velocity_addition: Relativistic velocity addition
- doppler: Relativistic Doppler effect
- schwarzschild: Black hole Schwarzschild radius
- gravitational_time: Gravitational time dilation
- redshift: Gravitational redshift`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['gamma', 'time_dilation', 'length_contraction', 'mass_energy', 'momentum', 'velocity_addition', 'doppler', 'schwarzschild', 'gravitational_time', 'redshift'],
      },
      velocity: { type: 'number', description: 'Velocity (m/s or fraction of c)' },
      proper_time: { type: 'number', description: 'Proper time (s)' },
      proper_length: { type: 'number', description: 'Proper length (m)' },
      mass: { type: 'number', description: 'Mass (kg)' },
      v1: { type: 'number', description: 'First velocity' },
      v2: { type: 'number', description: 'Second velocity' },
      frequency: { type: 'number', description: 'Source frequency (Hz)' },
      approaching: { type: 'boolean', description: 'Source approaching?' },
      M: { type: 'number', description: 'Central mass (kg)' },
      r: { type: 'number', description: 'Distance from center (m)' },
      wavelength: { type: 'number', description: 'Wavelength (m)' },
    },
    required: ['operation'],
  },
};

export async function executeRelativity(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    let result: Record<string, unknown>;

    // Convert velocity if given as fraction of c
    const normalizeV = (v: number) => v <= 1 ? v * c : v;

    switch (operation) {
      case 'gamma': {
        const v = normalizeV(args.velocity || 0.9 * c);
        const g = gamma(v);
        result = {
          operation: 'gamma',
          velocity_m_s: v,
          velocity_c: Math.round(v / c * 10000) / 10000,
          lorentz_factor: Math.round(g * 10000) / 10000,
        };
        break;
      }
      case 'time_dilation': {
        const v = normalizeV(args.velocity || 0.9 * c);
        const tau = args.proper_time || 1;
        const t = timeDilation(tau, v);
        result = {
          operation: 'time_dilation',
          velocity_c: Math.round(v / c * 10000) / 10000,
          proper_time_s: tau,
          dilated_time_s: Math.round(t * 10000) / 10000,
          factor: Math.round(gamma(v) * 10000) / 10000,
        };
        break;
      }
      case 'length_contraction': {
        const v = normalizeV(args.velocity || 0.9 * c);
        const L0 = args.proper_length || 1;
        const L = lengthContraction(L0, v);
        result = {
          operation: 'length_contraction',
          velocity_c: Math.round(v / c * 10000) / 10000,
          proper_length_m: L0,
          contracted_length_m: Math.round(L * 10000) / 10000,
          factor: Math.round(1 / gamma(v) * 10000) / 10000,
        };
        break;
      }
      case 'mass_energy': {
        const m = args.mass || 1;
        const v = args.velocity ? normalizeV(args.velocity) : 0;
        const E0 = restEnergy(m);
        result = {
          operation: 'mass_energy',
          rest_mass_kg: m,
          rest_energy_J: E0.toExponential(4),
          rest_energy_MeV: (E0 / 1.602e-13).toExponential(4),
          ...(v > 0 ? {
            velocity_c: Math.round(v / c * 10000) / 10000,
            relativistic_mass_kg: (relativisticMass(m, v)).toExponential(4),
            kinetic_energy_J: relativisticKE(m, v).toExponential(4),
            total_energy_J: (E0 + relativisticKE(m, v)).toExponential(4),
          } : {}),
        };
        break;
      }
      case 'momentum': {
        const m = args.mass || 9.109e-31;
        const v = normalizeV(args.velocity || 0.9 * c);
        const p = relativisticMomentum(m, v);
        result = {
          operation: 'momentum',
          mass_kg: m,
          velocity_c: Math.round(v / c * 10000) / 10000,
          relativistic_momentum: p.toExponential(4),
          classical_momentum: (m * v).toExponential(4),
          ratio: Math.round(gamma(v) * 10000) / 10000,
        };
        break;
      }
      case 'velocity_addition': {
        const v1 = normalizeV(args.v1 || 0.5 * c);
        const v2 = normalizeV(args.v2 || 0.5 * c);
        const vSum = velocityAddition(v1, v2);
        result = {
          operation: 'velocity_addition',
          v1_c: Math.round(v1 / c * 10000) / 10000,
          v2_c: Math.round(v2 / c * 10000) / 10000,
          classical_sum_c: Math.round((v1 + v2) / c * 10000) / 10000,
          relativistic_sum_c: Math.round(vSum / c * 10000) / 10000,
          relativistic_sum_m_s: Math.round(vSum),
        };
        break;
      }
      case 'doppler': {
        const v = normalizeV(args.velocity || 0.5 * c);
        const f0 = args.frequency || 1e9;
        const approaching = args.approaching !== false;
        const f = relativisticDoppler(f0, v, approaching);
        result = {
          operation: 'doppler',
          source_frequency_Hz: f0,
          velocity_c: Math.round(v / c * 10000) / 10000,
          approaching,
          observed_frequency_Hz: Math.round(f),
          shift_factor: Math.round(f / f0 * 10000) / 10000,
        };
        break;
      }
      case 'schwarzschild': {
        const M = args.mass || 1.989e30;
        const rs = schwarzschildRadius(M);
        result = {
          operation: 'schwarzschild',
          mass_kg: M,
          mass_solar: Math.round(M / 1.989e30 * 1000) / 1000,
          schwarzschild_radius_m: rs < 1000 ? Math.round(rs * 1000) / 1000 : rs.toExponential(4),
          schwarzschild_radius_km: rs > 1000 ? Math.round(rs / 1000 * 100) / 100 : rs / 1000,
        };
        break;
      }
      case 'gravitational_time': {
        const M = args.M || 5.972e24;
        const r = args.r || 6.371e6;
        const tau = args.proper_time || 1;
        const t = gravitationalTimeDilation(tau, M, r);
        result = {
          operation: 'gravitational_time',
          central_mass_kg: M,
          distance_m: r,
          proper_time_s: tau,
          dilated_time_s: t,
          time_difference_ns: Math.round((t - tau) * 1e9 * 1000) / 1000,
        };
        break;
      }
      case 'redshift': {
        const M = args.M || 1.989e30;
        const r = args.r || 6.96e8;
        const lambda0 = args.wavelength || 500e-9;
        const lambda = gravitationalRedshift(lambda0, M, r);
        result = {
          operation: 'redshift',
          mass_kg: M,
          distance_m: r,
          source_wavelength_nm: Math.round(lambda0 * 1e9 * 1000) / 1000,
          observed_wavelength_nm: Math.round(lambda * 1e9 * 1000) / 1000,
          redshift_z: Math.round((lambda - lambda0) / lambda0 * 10000) / 10000,
        };
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Relativity Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isRelativityAvailable(): boolean { return true; }
