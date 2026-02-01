/**
 * PLASMA PHYSICS TOOL
 *
 * Plasma calculations: Debye length, plasma frequency,
 * cyclotron motion, MHD, and fusion parameters.
 *
 * Part of TIER PHYSICS - Ultimate Tool Arsenal
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const EPSILON_0 = 8.854e-12;  // F/m (permittivity)
const K_B = 1.381e-23;        // J/K (Boltzmann)
const E_CHARGE = 1.602e-19;   // C (electron charge)
const M_ELECTRON = 9.109e-31; // kg (electron mass)
const M_PROTON = 1.673e-27;   // kg (proton mass)
const MU_0 = 4 * Math.PI * 1e-7; // H/m (permeability)

// ============================================================================
// BASIC PLASMA PARAMETERS
// ============================================================================

function debyeLength(temperature: number, density: number): number {
  // λD = √(ε₀ kB T / (n e²))
  return Math.sqrt((EPSILON_0 * K_B * temperature) / (density * E_CHARGE * E_CHARGE));
}

function plasmaFrequency(density: number): number {
  // ωpe = √(n e² / (ε₀ me))
  return Math.sqrt((density * E_CHARGE * E_CHARGE) / (EPSILON_0 * M_ELECTRON));
}

function thermalVelocity(temperature: number, mass: number): number {
  // vth = √(2 kB T / m)
  return Math.sqrt((2 * K_B * temperature) / mass);
}

function plasmaParameter(temperature: number, density: number): number {
  // Λ = (4π/3) n λD³
  const lambdaD = debyeLength(temperature, density);
  return (4 * Math.PI / 3) * density * Math.pow(lambdaD, 3);
}

// ============================================================================
// CYCLOTRON MOTION
// ============================================================================

function cyclotronFrequency(B: number, mass: number, charge: number): number {
  // ωc = |q|B / m
  return Math.abs(charge) * B / mass;
}

function larmorRadius(velocity: number, B: number, mass: number, charge: number): number {
  // rL = m v⊥ / (|q| B)
  return (mass * velocity) / (Math.abs(charge) * B);
}

// ============================================================================
// MHD PARAMETERS
// ============================================================================

function alfvenVelocity(B: number, density: number): number {
  // vA = B / √(μ₀ ρ)
  const rho = density * M_PROTON; // mass density
  return B / Math.sqrt(MU_0 * rho);
}

function magneticPressure(B: number): number {
  // Pm = B² / (2μ₀)
  return (B * B) / (2 * MU_0);
}

function beta(thermalPressure: number, B: number): number {
  // β = 2μ₀ P / B²
  return (2 * MU_0 * thermalPressure) / (B * B);
}

function magneticReynolds(velocity: number, length: number, conductivity: number): number {
  // Rm = μ₀ σ v L
  return MU_0 * conductivity * velocity * length;
}

// ============================================================================
// FUSION PARAMETERS
// ============================================================================

function lawsonCriterion(density: number, confinementTime: number, temperature: number): {
  nTauT: number;
  ignition: boolean;
} {
  // Triple product: n × τE × T
  const nTauT = density * confinementTime * temperature;
  // Ignition threshold approximately 5 × 10²¹ keV·s/m³
  const threshold = 5e21 * E_CHARGE * 1000; // Convert keV to J
  return {
    nTauT,
    ignition: nTauT >= threshold,
  };
}

function fusionPower(density: number, temperature: number, volume: number): number {
  // Simplified D-T fusion power estimate
  // P ∝ n² <σv> E
  const sigmaV = 1e-22 * Math.exp(-Math.pow(temperature / 1e8 - 1, 2)); // Peak at ~10 keV
  const energyPerFusion = 17.6e6 * E_CHARGE; // 17.6 MeV
  return 0.25 * density * density * sigmaV * energyPerFusion * volume;
}

// ============================================================================
// PLASMA CLASSIFICATION
// ============================================================================

function classifyPlasma(temperature: number, density: number): {
  type: string;
  coupling: string;
  degeneracy: string;
} {
  // const lambdaD = debyeLength(temperature, density);
  const Lambda = plasmaParameter(temperature, density);

  // Coupling parameter Γ = (e²/4πε₀) / (kB T × a)
  const a = Math.pow(3 / (4 * Math.PI * density), 1/3);
  const Gamma = (E_CHARGE * E_CHARGE / (4 * Math.PI * EPSILON_0)) / (K_B * temperature * a);

  // Degeneracy: compare Fermi energy to thermal energy
  const E_F = (Math.pow(3 * Math.PI * Math.PI * density, 2/3) * Math.pow(1.055e-34, 2)) / (2 * M_ELECTRON);
  const degenerate = E_F > K_B * temperature;

  return {
    type: Lambda > 1 ? 'Ideal (weakly coupled)' : 'Non-ideal (strongly coupled)',
    coupling: Gamma < 1 ? 'Weakly coupled' : Gamma < 100 ? 'Moderately coupled' : 'Strongly coupled',
    degeneracy: degenerate ? 'Degenerate' : 'Classical',
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const plasmaPhysicsTool: UnifiedTool = {
  name: 'plasma_physics',
  description: `Plasma physics calculations.

Operations:
- parameters: Basic plasma parameters (Debye length, frequency)
- cyclotron: Cyclotron/Larmor motion
- mhd: Magnetohydrodynamics parameters
- fusion: Fusion-relevant calculations
- classify: Plasma classification`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parameters', 'cyclotron', 'mhd', 'fusion', 'classify'],
        description: 'Plasma physics operation',
      },
      temperature: { type: 'number', description: 'Temperature (K)' },
      density: { type: 'number', description: 'Electron density (m⁻³)' },
      magnetic_field: { type: 'number', description: 'Magnetic field (T)' },
      velocity: { type: 'number', description: 'Velocity (m/s)' },
      particle: { type: 'string', enum: ['electron', 'proton', 'ion'], description: 'Particle type' },
      pressure: { type: 'number', description: 'Thermal pressure (Pa)' },
      confinement_time: { type: 'number', description: 'Energy confinement time (s)' },
      volume: { type: 'number', description: 'Plasma volume (m³)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePlasmaPhysics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'parameters': {
        const { temperature = 1e6, density = 1e19 } = args;
        const lambdaD = debyeLength(temperature, density);
        const omega_pe = plasmaFrequency(density);
        const v_th_e = thermalVelocity(temperature, M_ELECTRON);
        const Lambda = plasmaParameter(temperature, density);

        result = {
          operation: 'parameters',
          inputs: {
            temperature_K: temperature,
            temperature_eV: temperature * K_B / E_CHARGE,
            density_m3: density,
          },
          debye_length_m: lambdaD.toExponential(3),
          debye_length_mm: (lambdaD * 1000).toExponential(3),
          plasma_frequency_rad_s: omega_pe.toExponential(3),
          plasma_frequency_Hz: (omega_pe / (2 * Math.PI)).toExponential(3),
          electron_thermal_velocity_m_s: v_th_e.toExponential(3),
          plasma_parameter: Lambda.toExponential(3),
          ideal_plasma: Lambda > 1 ? 'Yes (Λ >> 1)' : 'No (strongly coupled)',
        };
        break;
      }

      case 'cyclotron': {
        const { magnetic_field = 1, temperature = 1e6, particle = 'electron' } = args;
        const mass = particle === 'electron' ? M_ELECTRON : M_PROTON;
        const charge = E_CHARGE;

        const omega_c = cyclotronFrequency(magnetic_field, mass, charge);
        const v_th = thermalVelocity(temperature, mass);
        const r_L = larmorRadius(v_th, magnetic_field, mass, charge);

        result = {
          operation: 'cyclotron',
          particle: particle,
          magnetic_field_T: magnetic_field,
          temperature_K: temperature,
          cyclotron_frequency_rad_s: omega_c.toExponential(3),
          cyclotron_frequency_Hz: (omega_c / (2 * Math.PI)).toExponential(3),
          cyclotron_period_s: (2 * Math.PI / omega_c).toExponential(3),
          thermal_velocity_m_s: v_th.toExponential(3),
          larmor_radius_m: r_L.toExponential(3),
          larmor_radius_mm: (r_L * 1000).toExponential(3),
        };
        break;
      }

      case 'mhd': {
        const { magnetic_field = 1, density = 1e19, pressure = 1e5, velocity = 1e5 } = args;
        const v_A = alfvenVelocity(magnetic_field, density);
        const P_m = magneticPressure(magnetic_field);
        const beta_value = beta(pressure, magnetic_field);
        const conductivity = 1e6; // typical
        const length = 1; // 1 m
        const Rm = magneticReynolds(velocity, length, conductivity);

        result = {
          operation: 'mhd',
          inputs: {
            magnetic_field_T: magnetic_field,
            density_m3: density,
            thermal_pressure_Pa: pressure,
          },
          alfven_velocity_m_s: Math.round(v_A),
          alfven_velocity_km_s: Math.round(v_A / 1000),
          magnetic_pressure_Pa: P_m.toExponential(3),
          plasma_beta: Math.round(beta_value * 1000) / 1000,
          beta_interpretation: beta_value > 1 ? 'Plasma pressure dominated' : 'Magnetic pressure dominated',
          magnetic_reynolds: Rm.toExponential(3),
          frozen_in: Rm > 1 ? 'Yes (flux frozen in)' : 'No (resistive regime)',
        };
        break;
      }

      case 'fusion': {
        const { temperature = 1e8, density = 1e20, confinement_time = 1, volume = 100 } = args;
        const lawson = lawsonCriterion(density, confinement_time, temperature);
        const power = fusionPower(density, temperature, volume);

        result = {
          operation: 'fusion',
          inputs: {
            temperature_K: temperature,
            temperature_keV: (temperature * K_B / E_CHARGE / 1000).toFixed(2),
            density_m3: density,
            confinement_time_s: confinement_time,
            volume_m3: volume,
          },
          lawson_triple_product: lawson.nTauT.toExponential(3),
          ignition_achieved: lawson.ignition ? 'Yes' : 'No',
          fusion_power_estimate_W: power.toExponential(3),
          fusion_power_MW: (power / 1e6).toFixed(2),
          optimal_temperature: '10-20 keV (~100-200 million K)',
          note: 'Simplified estimates - actual fusion more complex',
        };
        break;
      }

      case 'classify': {
        const { temperature = 1e6, density = 1e19 } = args;
        const classification = classifyPlasma(temperature, density);

        // Examples
        const examples = [
          { name: 'Solar corona', T: 1e6, n: 1e15 },
          { name: 'Tokamak', T: 1e8, n: 1e20 },
          { name: 'Fluorescent lamp', T: 1e4, n: 1e18 },
          { name: 'White dwarf', T: 1e7, n: 1e36 },
        ];

        result = {
          operation: 'classify',
          inputs: {
            temperature_K: temperature,
            density_m3: density,
          },
          classification: classification,
          plasma_examples: examples.map(ex => ({
            name: ex.name,
            temperature_K: ex.T,
            density_m3: ex.n,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Plasma Physics Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isPlasmaPhysicsAvailable(): boolean { return true; }
