/**
 * QUANTUM MECHANICS TOOL
 *
 * Quantum mechanics: wavefunctions, operators, hydrogen atom,
 * Schrödinger equation, quantum numbers.
 *
 * Part of TIER PHYSICS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Constants
const h = 6.62607015e-34; // Planck's constant (J·s)
const hbar = h / (2 * Math.PI); // Reduced Planck's constant
const me = 9.10938e-31; // Electron mass (kg)
const e = 1.602176634e-19; // Elementary charge (C)
export const epsilon0 = 8.854187817e-12; // Vacuum permittivity
const a0 = 5.29177210903e-11; // Bohr radius (m)
const Ry = 13.605693122994; // Rydberg energy (eV)

// Hydrogen atom energy levels
function hydrogenEnergy(n: number): { joules: number; eV: number } {
  const E_eV = -Ry / (n * n);
  const E_J = E_eV * e;
  return { joules: E_J, eV: E_eV };
}

// Photon energy from transition
function transitionEnergy(n1: number, n2: number): { energy_eV: number; wavelength_nm: number } {
  const E1 = hydrogenEnergy(n1).eV;
  const E2 = hydrogenEnergy(n2).eV;
  const deltaE = Math.abs(E2 - E1);
  const wavelength = 1240 / deltaE; // nm
  return { energy_eV: deltaE, wavelength_nm: wavelength };
}

// de Broglie wavelength
function deBroglieWavelength(mass: number, velocity: number): number {
  return h / (mass * velocity);
}

// Heisenberg uncertainty
function heisenbergUncertainty(dx: number): number {
  return hbar / (2 * dx);
}

// Particle in a box energy levels
function particleInBox(n: number, L: number, m: number = me): { joules: number; eV: number } {
  const E = (n * n * h * h) / (8 * m * L * L);
  return { joules: E, eV: E / e };
}

// Harmonic oscillator energy
function harmonicOscillator(n: number, omega: number): { joules: number; eV: number } {
  const E = hbar * omega * (n + 0.5);
  return { joules: E, eV: E / e };
}

// Orbital angular momentum
function orbitalAngularMomentum(l: number): number {
  return hbar * Math.sqrt(l * (l + 1));
}

// Spin angular momentum
export function spinAngularMomentum(s: number = 0.5): number {
  return hbar * Math.sqrt(s * (s + 1));
}

// Zeeman splitting
function zeemanSplitting(B: number, ml: number): number {
  const muB = 9.274e-24; // Bohr magneton
  return muB * B * ml;
}

// Tunneling probability
function tunnelingProbability(E: number, V0: number, a: number, m: number = me): number {
  if (E >= V0) return 1;
  const kappa = Math.sqrt(2 * m * (V0 - E)) / hbar;
  return Math.exp(-2 * kappa * a);
}

// Valid quantum numbers
function validateQuantumNumbers(n: number, l: number, ml: number, ms: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (n < 1 || !Number.isInteger(n)) errors.push('n must be positive integer');
  if (l < 0 || l >= n || !Number.isInteger(l)) errors.push('l must be integer from 0 to n-1');
  if (ml < -l || ml > l || !Number.isInteger(ml)) errors.push('ml must be integer from -l to +l');
  if (ms !== 0.5 && ms !== -0.5) errors.push('ms must be +1/2 or -1/2');
  return { valid: errors.length === 0, errors };
}

// Orbital notation
function orbitalNotation(n: number, l: number): string {
  const letters = ['s', 'p', 'd', 'f', 'g', 'h'];
  return `${n}${letters[l] || `l=${l}`}`;
}

// Max electrons in orbital
function maxElectrons(n: number): number {
  return 2 * n * n;
}

export const quantumMechanicsTool: UnifiedTool = {
  name: 'quantum_mechanics',
  description: `Quantum mechanics calculations.

Operations:
- hydrogen: Hydrogen atom energy levels
- transition: Calculate transition energy and wavelength
- de_broglie: Calculate de Broglie wavelength
- uncertainty: Heisenberg uncertainty principle
- particle_box: Particle in infinite square well
- harmonic: Quantum harmonic oscillator
- angular_momentum: Orbital/spin angular momentum
- zeeman: Zeeman effect splitting
- tunneling: Quantum tunneling probability
- quantum_numbers: Validate quantum numbers`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['hydrogen', 'transition', 'de_broglie', 'uncertainty', 'particle_box', 'harmonic', 'angular_momentum', 'zeeman', 'tunneling', 'quantum_numbers'],
      },
      n: { type: 'number', description: 'Principal quantum number' },
      n1: { type: 'number', description: 'Initial energy level' },
      n2: { type: 'number', description: 'Final energy level' },
      l: { type: 'number', description: 'Orbital quantum number' },
      ml: { type: 'number', description: 'Magnetic quantum number' },
      ms: { type: 'number', description: 'Spin quantum number' },
      mass: { type: 'number', description: 'Particle mass (kg)' },
      velocity: { type: 'number', description: 'Velocity (m/s)' },
      dx: { type: 'number', description: 'Position uncertainty (m)' },
      L: { type: 'number', description: 'Box length (m)' },
      omega: { type: 'number', description: 'Angular frequency (rad/s)' },
      B: { type: 'number', description: 'Magnetic field (T)' },
      E: { type: 'number', description: 'Particle energy (J)' },
      V0: { type: 'number', description: 'Barrier height (J)' },
      a: { type: 'number', description: 'Barrier width (m)' },
    },
    required: ['operation'],
  },
};

export async function executeQuantumMechanics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    let result: Record<string, unknown>;

    switch (operation) {
      case 'hydrogen': {
        const { n = 1 } = args;
        const energy = hydrogenEnergy(n);
        result = {
          operation: 'hydrogen',
          n,
          energy_eV: Math.round(energy.eV * 10000) / 10000,
          energy_J: energy.joules.toExponential(4),
          orbital_radius_pm: Math.round(n * n * a0 * 1e12),
          orbital: orbitalNotation(n, 0),
        };
        break;
      }
      case 'transition': {
        const { n1 = 3, n2 = 2 } = args;
        const trans = transitionEnergy(n1, n2);
        const series = n2 === 1 ? 'Lyman' : n2 === 2 ? 'Balmer' : n2 === 3 ? 'Paschen' : 'Other';
        result = {
          operation: 'transition',
          from_n: n1,
          to_n: n2,
          energy_eV: Math.round(trans.energy_eV * 10000) / 10000,
          wavelength_nm: Math.round(trans.wavelength_nm * 100) / 100,
          series,
          emission: n1 > n2,
        };
        break;
      }
      case 'de_broglie': {
        const { mass = me, velocity = 1e6 } = args;
        const lambda = deBroglieWavelength(mass, velocity);
        result = {
          operation: 'de_broglie',
          mass_kg: mass,
          velocity_m_s: velocity,
          wavelength_m: lambda.toExponential(4),
          wavelength_pm: Math.round(lambda * 1e12 * 100) / 100,
        };
        break;
      }
      case 'uncertainty': {
        const { dx = 1e-10 } = args;
        const dp = heisenbergUncertainty(dx);
        result = {
          operation: 'uncertainty',
          position_uncertainty_m: dx,
          minimum_momentum_uncertainty: dp.toExponential(4),
          principle: 'Δx·Δp ≥ ℏ/2',
        };
        break;
      }
      case 'particle_box': {
        const { n = 1, L = 1e-9 } = args;
        const energy = particleInBox(n, L);
        result = {
          operation: 'particle_box',
          n,
          box_length_m: L,
          energy_eV: Math.round(energy.eV * 10000) / 10000,
          energy_J: energy.joules.toExponential(4),
        };
        break;
      }
      case 'harmonic': {
        const { n = 0, omega = 1e14 } = args;
        const energy = harmonicOscillator(n, omega);
        result = {
          operation: 'harmonic',
          n,
          omega_rad_s: omega,
          energy_eV: Math.round(energy.eV * 10000) / 10000,
          zero_point_energy_eV: Math.round(harmonicOscillator(0, omega).eV * 10000) / 10000,
        };
        break;
      }
      case 'angular_momentum': {
        const { l = 1 } = args;
        const L_mag = orbitalAngularMomentum(l);
        result = {
          operation: 'angular_momentum',
          l,
          orbital_L: L_mag.toExponential(4),
          orbital_L_hbar: Math.round(Math.sqrt(l * (l + 1)) * 1000) / 1000,
          spin_S_hbar: Math.round(Math.sqrt(0.75) * 1000) / 1000,
          max_ml: l,
          orbitals_count: 2 * l + 1,
        };
        break;
      }
      case 'zeeman': {
        const { B = 1, ml = 1 } = args;
        const dE = zeemanSplitting(B, ml);
        result = {
          operation: 'zeeman',
          magnetic_field_T: B,
          ml,
          energy_shift_J: dE.toExponential(4),
          energy_shift_eV: (dE / e).toExponential(4),
        };
        break;
      }
      case 'tunneling': {
        const { E = 1e-19, V0 = 2e-19, a = 1e-10 } = args;
        const T = tunnelingProbability(E, V0, a);
        result = {
          operation: 'tunneling',
          particle_energy_J: E,
          barrier_height_J: V0,
          barrier_width_m: a,
          transmission_probability: T < 1e-6 ? T.toExponential(4) : Math.round(T * 10000) / 10000,
        };
        break;
      }
      case 'quantum_numbers': {
        const { n = 2, l = 1, ml = 0, ms = 0.5 } = args;
        const validation = validateQuantumNumbers(n, l, ml, ms);
        result = {
          operation: 'quantum_numbers',
          n, l, ml, ms,
          valid: validation.valid,
          errors: validation.errors,
          orbital: validation.valid ? orbitalNotation(n, l) : 'Invalid',
          max_electrons_in_shell: maxElectrons(n),
        };
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Quantum Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isQuantumMechanicsAvailable(): boolean { return true; }
