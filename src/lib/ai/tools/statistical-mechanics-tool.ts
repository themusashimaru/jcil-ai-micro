/**
 * STATISTICAL MECHANICS TOOL
 *
 * Statistical mechanics: Boltzmann distribution, partition functions,
 * entropy, Fermi-Dirac, Bose-Einstein statistics.
 *
 * Part of TIER PHYSICS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const kB = 1.380649e-23; // Boltzmann constant (J/K)
const _h = 6.62607015e-34; // Planck constant
const _NA = 6.02214076e23; // Avogadro's number

// Boltzmann factor
function boltzmannFactor(E: number, T: number): number {
  return Math.exp(-E / (kB * T));
}

// Boltzmann probability
function boltzmannProbability(E: number, T: number, Z: number): number {
  return boltzmannFactor(E, T) / Z;
}

// Partition function for discrete levels
function partitionFunction(energies: number[], T: number): number {
  return energies.reduce((sum, E) => sum + boltzmannFactor(E, T), 0);
}

// Average energy from partition function
function averageEnergy(energies: number[], T: number): number {
  const Z = partitionFunction(energies, T);
  return energies.reduce((sum, E) => sum + E * boltzmannFactor(E, T), 0) / Z;
}

// Entropy from partition function
function entropyFromZ(Z: number, U: number, T: number): number {
  return kB * (Math.log(Z) + U / (kB * T));
}

// Maxwell-Boltzmann speed distribution
function maxwellSpeed(v: number, T: number, m: number): number {
  const a = Math.sqrt(kB * T / m);
  return (4 * Math.PI / Math.pow(2 * Math.PI * a * a, 1.5)) * v * v * Math.exp(-v * v / (2 * a * a));
}

// Most probable speed
function mostProbableSpeed(T: number, m: number): number {
  return Math.sqrt(2 * kB * T / m);
}

// Mean speed
function meanSpeed(T: number, m: number): number {
  return Math.sqrt(8 * kB * T / (Math.PI * m));
}

// RMS speed
function rmsSpeed(T: number, m: number): number {
  return Math.sqrt(3 * kB * T / m);
}

// Fermi-Dirac distribution
function fermiDirac(E: number, mu: number, T: number): number {
  return 1 / (Math.exp((E - mu) / (kB * T)) + 1);
}

// Bose-Einstein distribution
function boseEinstein(E: number, mu: number, T: number): number {
  return 1 / (Math.exp((E - mu) / (kB * T)) - 1);
}

// Helmholtz free energy
function helmholtzFreeEnergy(Z: number, T: number): number {
  return -kB * T * Math.log(Z);
}

// Heat capacity
function heatCapacity(energies: number[], T: number): number {
  const beta = 1 / (kB * T);
  const Z = partitionFunction(energies, T);
  const E_avg = averageEnergy(energies, T);
  const E2_avg = energies.reduce((sum, E) => sum + E * E * boltzmannFactor(E, T), 0) / Z;
  return (E2_avg - E_avg * E_avg) * beta * beta * kB;
}

export const statisticalMechanicsTool: UnifiedTool = {
  name: 'statistical_mechanics',
  description: `Statistical mechanics calculations.

Operations:
- boltzmann: Boltzmann distribution probability
- partition_function: Calculate partition function Z
- average_energy: Average energy from partition function
- maxwell_boltzmann: Maxwell-Boltzmann speed distribution
- speeds: Most probable, mean, and RMS speeds
- fermi_dirac: Fermi-Dirac distribution for fermions
- bose_einstein: Bose-Einstein distribution for bosons
- thermodynamic: Helmholtz energy, entropy, heat capacity`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['boltzmann', 'partition_function', 'average_energy', 'maxwell_boltzmann', 'speeds', 'fermi_dirac', 'bose_einstein', 'thermodynamic'],
      },
      energy: { type: 'number', description: 'Energy (J)' },
      energies: { type: 'string', description: 'Energy levels as JSON array' },
      T: { type: 'number', description: 'Temperature (K)' },
      mass: { type: 'number', description: 'Particle mass (kg)' },
      velocity: { type: 'number', description: 'Velocity (m/s)' },
      mu: { type: 'number', description: 'Chemical potential (J)' },
    },
    required: ['operation'],
  },
};

export async function executeStatisticalMechanics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, T = 300 } = args;
    let result: Record<string, unknown>;

    switch (operation) {
      case 'boltzmann': {
        const E = args.energy || 4.14e-21; // ~kT at 300K
        const factor = boltzmannFactor(E, T);
        result = {
          operation: 'boltzmann',
          energy_J: E,
          energy_kT: Math.round(E / (kB * T) * 1000) / 1000,
          temperature_K: T,
          boltzmann_factor: factor < 1e-4 ? factor.toExponential(4) : Math.round(factor * 10000) / 10000,
          kT_J: kB * T,
        };
        break;
      }
      case 'partition_function': {
        const energies: number[] = JSON.parse(args.energies || '[0, 4.14e-21, 8.28e-21]');
        const Z = partitionFunction(energies, T);
        const probs = energies.map(E => ({
          energy_J: E,
          probability: Math.round(boltzmannProbability(E, T, Z) * 10000) / 10000,
        }));
        result = {
          operation: 'partition_function',
          temperature_K: T,
          energy_levels: energies.length,
          partition_function_Z: Math.round(Z * 10000) / 10000,
          probabilities: probs,
        };
        break;
      }
      case 'average_energy': {
        const energies: number[] = JSON.parse(args.energies || '[0, 4.14e-21, 8.28e-21]');
        const U = averageEnergy(energies, T);
        const Z = partitionFunction(energies, T);
        result = {
          operation: 'average_energy',
          temperature_K: T,
          partition_function: Math.round(Z * 10000) / 10000,
          average_energy_J: U.toExponential(4),
          average_energy_kT: Math.round(U / (kB * T) * 1000) / 1000,
        };
        break;
      }
      case 'maxwell_boltzmann': {
        const m = args.mass || 4.65e-26; // N2 molecule
        const v = args.velocity || mostProbableSpeed(T, m);
        const prob = maxwellSpeed(v, T, m);
        result = {
          operation: 'maxwell_boltzmann',
          temperature_K: T,
          mass_kg: m,
          velocity_m_s: Math.round(v),
          probability_density: prob.toExponential(4),
        };
        break;
      }
      case 'speeds': {
        const m = args.mass || 4.65e-26;
        const vp = mostProbableSpeed(T, m);
        const vavg = meanSpeed(T, m);
        const vrms = rmsSpeed(T, m);
        result = {
          operation: 'speeds',
          temperature_K: T,
          mass_kg: m,
          most_probable_speed_m_s: Math.round(vp),
          mean_speed_m_s: Math.round(vavg),
          rms_speed_m_s: Math.round(vrms),
          ratio_vp_vavg_vrms: '1 : 1.128 : 1.225',
        };
        break;
      }
      case 'fermi_dirac': {
        const E = args.energy || 0;
        const mu = args.mu || 0;
        const f = fermiDirac(E, mu, T);
        result = {
          operation: 'fermi_dirac',
          energy_J: E,
          chemical_potential_J: mu,
          temperature_K: T,
          occupation_number: Math.round(f * 10000) / 10000,
          at_fermi_level: E === mu ? 'f(E) = 0.5 always' : undefined,
        };
        break;
      }
      case 'bose_einstein': {
        const E = args.energy || 4.14e-21;
        const mu = args.mu || 0;
        if (E <= mu) throw new Error('For Bose-Einstein: E must be > μ');
        const n = boseEinstein(E, mu, T);
        result = {
          operation: 'bose_einstein',
          energy_J: E,
          chemical_potential_J: mu,
          temperature_K: T,
          occupation_number: n < 100 ? Math.round(n * 10000) / 10000 : n.toExponential(4),
        };
        break;
      }
      case 'thermodynamic': {
        const energies: number[] = JSON.parse(args.energies || '[0, 4.14e-21, 8.28e-21]');
        const Z = partitionFunction(energies, T);
        const U = averageEnergy(energies, T);
        const F = helmholtzFreeEnergy(Z, T);
        const S = entropyFromZ(Z, U, T);
        const Cv = heatCapacity(energies, T);
        result = {
          operation: 'thermodynamic',
          temperature_K: T,
          partition_function: Math.round(Z * 10000) / 10000,
          internal_energy_J: U.toExponential(4),
          helmholtz_free_energy_J: F.toExponential(4),
          entropy_J_K: S.toExponential(4),
          heat_capacity_J_K: Cv.toExponential(4),
        };
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Stat Mech Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isStatisticalMechanicsAvailable(): boolean { return true; }
