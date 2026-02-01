/**
 * NUCLEAR PHYSICS TOOL
 *
 * Nuclear calculations: decay, binding energy, cross sections,
 * radiation, and nuclear reactions.
 *
 * Part of TIER PHYSICS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const _AMU = 1.66054e-27;      // kg (atomic mass unit)
const _C = 2.998e8;            // m/s (speed of light)
const EV = 1.602e-19;         // J (electron volt)
const _MEV = EV * 1e6;         // J (MeV)
const _AVOGADRO = 6.022e23;    // mol⁻¹

// ============================================================================
// RADIOACTIVE DECAY
// ============================================================================

function decayConstant(halfLife: number): number {
  return Math.log(2) / halfLife;
}

function activity(N: number, halfLife: number): number {
  // A = λN (Bq)
  const lambda = decayConstant(halfLife);
  return lambda * N;
}

function remainingNuclei(N0: number, halfLife: number, time: number): number {
  // N(t) = N0 × e^(-λt)
  const lambda = decayConstant(halfLife);
  return N0 * Math.exp(-lambda * time);
}

function decayedNuclei(N0: number, halfLife: number, time: number): number {
  return N0 - remainingNuclei(N0, halfLife, time);
}

function _timeToDecay(N0: number, Nf: number, halfLife: number): number {
  // t = -ln(Nf/N0) / λ
  const lambda = decayConstant(halfLife);
  return -Math.log(Nf / N0) / lambda;
}

// ============================================================================
// BINDING ENERGY
// ============================================================================

function massDefect(Z: number, N: number, atomicMass: number): number {
  // Δm = Z×mp + N×mn - M_atom
  const mp = 1.007825; // proton mass (amu)
  const mn = 1.008665; // neutron mass (amu)
  return Z * mp + N * mn - atomicMass;
}

function bindingEnergy(massDefectAmu: number): number {
  // E = Δm × c²
  return massDefectAmu * 931.5; // MeV
}

function bindingEnergyPerNucleon(Z: number, N: number, atomicMass: number): number {
  const A = Z + N;
  const defect = massDefect(Z, N, atomicMass);
  return bindingEnergy(defect) / A;
}

// Semi-empirical mass formula (Bethe-Weizsäcker)
function semiEmpiricalMass(Z: number, A: number): number {
  const N = A - Z;
  const av = 15.67; // Volume term (MeV)
  const as = 17.23; // Surface term
  const ac = 0.75;  // Coulomb term
  const aa = 93.2;  // Asymmetry term
  const ap = 12.0;  // Pairing term

  const volume = av * A;
  const surface = -as * Math.pow(A, 2/3);
  const coulomb = -ac * Z * (Z - 1) / Math.pow(A, 1/3);
  const asymmetry = -aa * Math.pow(N - Z, 2) / A;

  let pairing = 0;
  if (Z % 2 === 0 && N % 2 === 0) pairing = ap / Math.sqrt(A);
  else if (Z % 2 === 1 && N % 2 === 1) pairing = -ap / Math.sqrt(A);

  return volume + surface + coulomb + asymmetry + pairing;
}

// ============================================================================
// RADIATION
// ============================================================================

function doseEquivalent(absorbed: number, qualityFactor: number): number {
  // H = D × Q (Sv)
  return absorbed * qualityFactor;
}

function halfValueLayer(attenuationCoeff: number): number {
  // HVL = ln(2) / μ
  return Math.log(2) / attenuationCoeff;
}

function shieldingAttenuation(intensity0: number, mu: number, thickness: number): number {
  // I = I0 × e^(-μx)
  return intensity0 * Math.exp(-mu * thickness);
}

// ============================================================================
// NUCLEAR REACTIONS
// ============================================================================

function qValue(massReactants: number, massProducts: number): number {
  // Q = (M_reactants - M_products) × c²
  return (massReactants - massProducts) * 931.5; // MeV
}

function _thresholdEnergy(Q: number, massProjectile: number, massTarget: number): number {
  // E_th = -Q × (1 + m_p/m_t) for Q < 0
  if (Q >= 0) return 0;
  return -Q * (1 + massProjectile / massTarget);
}

// ============================================================================
// FISSION & FUSION
// ============================================================================

function _fissionEnergy(initialMass: number, productMass: number): number {
  // Energy from U-235 fission ~200 MeV
  const massDefect = initialMass - productMass;
  return massDefect * 931.5;
}

function _fusionEnergy(reactantMasses: number[], productMasses: number[]): number {
  const totalReactants = reactantMasses.reduce((a, b) => a + b, 0);
  const totalProducts = productMasses.reduce((a, b) => a + b, 0);
  return (totalReactants - totalProducts) * 931.5;
}

// ============================================================================
// COMMON ISOTOPES
// ============================================================================

const ISOTOPES: Record<string, { Z: number; A: number; mass: number; halfLife: number | null }> = {
  'H-1': { Z: 1, A: 1, mass: 1.007825, halfLife: null },
  'H-2': { Z: 1, A: 2, mass: 2.014102, halfLife: null },
  'H-3': { Z: 1, A: 3, mass: 3.016049, halfLife: 3.89e8 },
  'He-4': { Z: 2, A: 4, mass: 4.002603, halfLife: null },
  'C-12': { Z: 6, A: 12, mass: 12.0, halfLife: null },
  'C-14': { Z: 6, A: 14, mass: 14.003242, halfLife: 1.81e11 },
  'U-235': { Z: 92, A: 235, mass: 235.043930, halfLife: 2.22e16 },
  'U-238': { Z: 92, A: 238, mass: 238.050788, halfLife: 1.41e17 },
  'Pu-239': { Z: 94, A: 239, mass: 239.052163, halfLife: 7.61e11 },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const nuclearPhysicsTool: UnifiedTool = {
  name: 'nuclear_physics',
  description: `Nuclear physics calculations.

Operations:
- decay: Radioactive decay calculations
- binding: Nuclear binding energy
- radiation: Radiation dose and shielding
- reaction: Nuclear reaction Q-values
- isotope: Isotope information lookup`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['decay', 'binding', 'radiation', 'reaction', 'isotope'],
        description: 'Nuclear physics operation',
      },
      half_life: { type: 'number', description: 'Half-life (seconds)' },
      initial_amount: { type: 'number', description: 'Initial number of nuclei' },
      time: { type: 'number', description: 'Time elapsed (seconds)' },
      Z: { type: 'number', description: 'Atomic number (protons)' },
      A: { type: 'number', description: 'Mass number (protons + neutrons)' },
      atomic_mass: { type: 'number', description: 'Atomic mass (amu)' },
      absorbed_dose: { type: 'number', description: 'Absorbed dose (Gy)' },
      quality_factor: { type: 'number', description: 'Radiation quality factor' },
      attenuation_coeff: { type: 'number', description: 'Attenuation coefficient (1/cm)' },
      thickness: { type: 'number', description: 'Shielding thickness (cm)' },
      isotope: { type: 'string', description: 'Isotope name (e.g., U-235)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeNuclearPhysics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'decay': {
        const { half_life = 5730 * 365.25 * 24 * 3600, initial_amount = 1e20, time } = args;
        const lambda = decayConstant(half_life);

        if (time !== undefined) {
          const remaining = remainingNuclei(initial_amount, half_life, time);
          const decayed = decayedNuclei(initial_amount, half_life, time);
          const act = activity(remaining, half_life);

          result = {
            operation: 'decay',
            half_life_s: half_life,
            half_life_years: half_life / (365.25 * 24 * 3600),
            decay_constant_per_s: lambda.toExponential(4),
            initial_nuclei: initial_amount.toExponential(3),
            time_s: time,
            remaining_nuclei: remaining.toExponential(3),
            decayed_nuclei: decayed.toExponential(3),
            fraction_remaining: (remaining / initial_amount * 100).toFixed(2) + '%',
            activity_Bq: act.toExponential(3),
            activity_Ci: (act / 3.7e10).toExponential(3),
          };
        } else {
          const act = activity(initial_amount, half_life);
          result = {
            operation: 'decay',
            half_life_s: half_life,
            half_life_years: half_life / (365.25 * 24 * 3600),
            decay_constant_per_s: lambda.toExponential(4),
            mean_lifetime_s: (1 / lambda).toExponential(3),
            initial_nuclei: initial_amount.toExponential(3),
            initial_activity_Bq: act.toExponential(3),
            initial_activity_Ci: (act / 3.7e10).toExponential(3),
          };
        }
        break;
      }

      case 'binding': {
        const { Z = 26, A = 56, atomic_mass } = args;
        const N = A - Z;

        // Use provided mass or estimate from SEMF
        const semf = semiEmpiricalMass(Z, A);

        if (atomic_mass !== undefined) {
          const defect = massDefect(Z, N, atomic_mass);
          const BE = bindingEnergy(defect);
          const BEperA = bindingEnergyPerNucleon(Z, N, atomic_mass);

          result = {
            operation: 'binding',
            nucleus: { Z, N, A },
            atomic_mass_amu: atomic_mass,
            mass_defect_amu: defect.toFixed(6),
            binding_energy_MeV: BE.toFixed(3),
            binding_energy_per_nucleon_MeV: BEperA.toFixed(3),
            stability: BEperA > 8 ? 'Very stable' : BEperA > 7 ? 'Stable' : 'Less stable',
          };
        } else {
          result = {
            operation: 'binding',
            nucleus: { Z, N, A },
            semi_empirical_binding_MeV: semf.toFixed(3),
            binding_per_nucleon_MeV: (semf / A).toFixed(3),
            note: 'Provide atomic_mass for precise calculation',
            peak_stability: 'Fe-56 has highest binding energy per nucleon (~8.8 MeV)',
          };
        }
        break;
      }

      case 'radiation': {
        const { absorbed_dose = 0.001, quality_factor = 1, attenuation_coeff = 0.1, thickness = 10 } = args;
        const equivalent = doseEquivalent(absorbed_dose, quality_factor);
        const hvl = halfValueLayer(attenuation_coeff);
        const attenuated = shieldingAttenuation(1, attenuation_coeff, thickness);

        result = {
          operation: 'radiation',
          dose: {
            absorbed_dose_Gy: absorbed_dose,
            absorbed_dose_mGy: absorbed_dose * 1000,
            quality_factor: quality_factor,
            equivalent_dose_Sv: equivalent,
            equivalent_dose_mSv: equivalent * 1000,
          },
          quality_factors: {
            'gamma/X-rays': 1,
            'beta': 1,
            'protons': 2,
            'alpha': 20,
            'neutrons': '5-20 (energy dependent)',
          },
          shielding: {
            attenuation_coefficient_per_cm: attenuation_coeff,
            half_value_layer_cm: hvl.toFixed(2),
            thickness_cm: thickness,
            transmission: (attenuated * 100).toFixed(2) + '%',
            reduction_factor: (1 / attenuated).toFixed(1),
          },
        };
        break;
      }

      case 'reaction': {
        // D-T fusion example
        const dMass = 2.014102;
        const tMass = 3.016049;
        const heMass = 4.002603;
        const nMass = 1.008665;

        const fusionQ = qValue(dMass + tMass, heMass + nMass);

        // U-235 fission example
        const u235 = 235.04393;
        const fissionProducts = 234.0; // approximate
        const _fissionQ = qValue(u235, fissionProducts);

        result = {
          operation: 'reaction',
          dt_fusion: {
            reaction: 'D + T → He-4 + n',
            q_value_MeV: fusionQ.toFixed(2),
            energy_released: '17.6 MeV',
            exothermic: true,
          },
          u235_fission: {
            reaction: 'n + U-235 → fission products + neutrons',
            q_value_MeV: '~200',
            neutrons_released: '2-3',
            chain_reaction: 'possible with critical mass',
          },
          energy_comparison: {
            chemical_bond_eV: '1-10',
            fission_MeV: '~200',
            fusion_MeV: '~17.6 per reaction',
            fusion_per_nucleon: 'Higher (3.5 MeV/nucleon vs 0.85 for fission)',
          },
        };
        break;
      }

      case 'isotope': {
        const { isotope = 'U-235' } = args;
        const iso = ISOTOPES[isotope];

        if (iso) {
          const N = iso.A - iso.Z;
          const semf = semiEmpiricalMass(iso.Z, iso.A);

          result = {
            operation: 'isotope',
            name: isotope,
            protons_Z: iso.Z,
            neutrons_N: N,
            mass_number_A: iso.A,
            atomic_mass_amu: iso.mass,
            half_life: iso.halfLife ? {
              seconds: iso.halfLife,
              years: iso.halfLife / (365.25 * 24 * 3600),
            } : 'Stable',
            binding_energy_per_nucleon_MeV: (semf / iso.A).toFixed(2),
          };
        } else {
          result = {
            operation: 'isotope',
            name: isotope,
            found: false,
            available_isotopes: Object.keys(ISOTOPES),
          };
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Nuclear Physics Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isNuclearPhysicsAvailable(): boolean { return true; }
