/**
 * ELECTROCHEMISTRY TOOL
 *
 * Electrochemistry: Nernst equation, cell potentials,
 * electrolysis, Faraday's laws, batteries.
 *
 * Part of TIER CHEMISTRY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const F = 96485; // Faraday constant (C/mol)
const R = 8.314; // Gas constant (J/(mol·K))

// ============================================================================
// STANDARD REDUCTION POTENTIALS (V vs SHE)
// ============================================================================

const STANDARD_POTENTIALS: Record<string, { equation: string; E0: number }> = {
  'Li': { equation: 'Li⁺ + e⁻ → Li', E0: -3.04 },
  'K': { equation: 'K⁺ + e⁻ → K', E0: -2.93 },
  'Ca': { equation: 'Ca²⁺ + 2e⁻ → Ca', E0: -2.87 },
  'Na': { equation: 'Na⁺ + e⁻ → Na', E0: -2.71 },
  'Mg': { equation: 'Mg²⁺ + 2e⁻ → Mg', E0: -2.37 },
  'Al': { equation: 'Al³⁺ + 3e⁻ → Al', E0: -1.66 },
  'Zn': { equation: 'Zn²⁺ + 2e⁻ → Zn', E0: -0.76 },
  'Fe': { equation: 'Fe²⁺ + 2e⁻ → Fe', E0: -0.44 },
  'Ni': { equation: 'Ni²⁺ + 2e⁻ → Ni', E0: -0.26 },
  'Sn': { equation: 'Sn²⁺ + 2e⁻ → Sn', E0: -0.14 },
  'H2': { equation: '2H⁺ + 2e⁻ → H₂', E0: 0.00 },
  'Cu': { equation: 'Cu²⁺ + 2e⁻ → Cu', E0: 0.34 },
  'I2': { equation: 'I₂ + 2e⁻ → 2I⁻', E0: 0.54 },
  'Ag': { equation: 'Ag⁺ + e⁻ → Ag', E0: 0.80 },
  'Br2': { equation: 'Br₂ + 2e⁻ → 2Br⁻', E0: 1.07 },
  'Cl2': { equation: 'Cl₂ + 2e⁻ → 2Cl⁻', E0: 1.36 },
  'Au': { equation: 'Au³⁺ + 3e⁻ → Au', E0: 1.50 },
  'F2': { equation: 'F₂ + 2e⁻ → 2F⁻', E0: 2.87 },
};

// ============================================================================
// NERNST EQUATION
// ============================================================================

function nernstPotential(E0: number, n: number, Q: number, T: number = 298): number {
  // E = E0 - (RT/nF) * ln(Q)
  return E0 - (R * T / (n * F)) * Math.log(Q);
}

function cellPotential(E0_cathode: number, E0_anode: number): number {
  // E_cell = E_cathode - E_anode
  return E0_cathode - E0_anode;
}

function gibbsFromCell(E: number, n: number): number {
  // ΔG = -nFE
  return -n * F * E;
}

function KfromCell(E0: number, n: number, T: number = 298): number {
  // ln(K) = nFE0/RT
  return Math.exp(n * F * E0 / (R * T));
}

// ============================================================================
// FARADAY'S LAWS
// ============================================================================

function electrolysis(I: number, t: number, n: number, M: number): { moles: number; mass: number; charge: number } {
  // Q = It, moles = Q/(nF), mass = moles * M
  const Q = I * t;
  const moles = Q / (n * F);
  const mass = moles * M;
  return { moles, mass, charge: Q };
}

function _currentForDeposition(mass: number, M: number, n: number, t: number): number {
  // I = nFm/(Mt)
  return n * F * mass / (M * t);
}
void _currentForDeposition; // reserved for future use

// ============================================================================
// BATTERIES
// ============================================================================

interface BatteryInfo {
  name: string;
  anode: string;
  cathode: string;
  voltage: number;
  energy_density: string;
  rechargeable: boolean;
}

const BATTERIES: Record<string, BatteryInfo> = {
  'lead_acid': { name: 'Lead-Acid', anode: 'Pb', cathode: 'PbO₂', voltage: 2.0, energy_density: '30-50 Wh/kg', rechargeable: true },
  'alkaline': { name: 'Alkaline', anode: 'Zn', cathode: 'MnO₂', voltage: 1.5, energy_density: '100-150 Wh/kg', rechargeable: false },
  'lithium_ion': { name: 'Lithium-ion', anode: 'Graphite', cathode: 'LiCoO₂', voltage: 3.7, energy_density: '150-250 Wh/kg', rechargeable: true },
  'nicad': { name: 'NiCd', anode: 'Cd', cathode: 'NiOOH', voltage: 1.2, energy_density: '45-80 Wh/kg', rechargeable: true },
  'nimh': { name: 'NiMH', anode: 'MH alloy', cathode: 'NiOOH', voltage: 1.2, energy_density: '60-120 Wh/kg', rechargeable: true },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const electrochemistryTool: UnifiedTool = {
  name: 'electrochemistry',
  description: `Electrochemistry calculations.

Operations:
- nernst: Calculate cell potential with Nernst equation
- cell_potential: Calculate standard cell potential
- electrolysis: Faraday's laws for electrolysis
- gibbs: Calculate ΔG from cell potential
- equilibrium_constant: Calculate K from E0
- standard_potentials: Look up standard reduction potentials
- battery_info: Get battery chemistry information`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['nernst', 'cell_potential', 'electrolysis', 'gibbs', 'equilibrium_constant', 'standard_potentials', 'battery_info'],
        description: 'Electrochemistry operation',
      },
      E0: { type: 'number', description: 'Standard potential (V)' },
      n: { type: 'number', description: 'Number of electrons transferred' },
      Q: { type: 'number', description: 'Reaction quotient' },
      T: { type: 'number', description: 'Temperature (K)' },
      cathode: { type: 'string', description: 'Cathode element' },
      anode: { type: 'string', description: 'Anode element' },
      current: { type: 'number', description: 'Current (A)' },
      time: { type: 'number', description: 'Time (s)' },
      molar_mass: { type: 'number', description: 'Molar mass (g/mol)' },
      element: { type: 'string', description: 'Element symbol' },
      battery_type: { type: 'string', description: 'Battery type' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeElectrochemistry(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'nernst': {
        const { E0 = 0.34, n = 2, Q = 0.01, T = 298 } = args;
        const E = nernstPotential(E0, n, Q, T);

        result = {
          operation: 'nernst',
          E0_V: E0,
          n_electrons: n,
          reaction_quotient: Q,
          temperature_K: T,
          cell_potential_V: Math.round(E * 10000) / 10000,
          equation: 'E = E° - (RT/nF)ln(Q)',
        };
        break;
      }

      case 'cell_potential': {
        const cathodeKey = args.cathode || 'Cu';
        const anodeKey = args.anode || 'Zn';
        const cathodeData = STANDARD_POTENTIALS[cathodeKey];
        const anodeData = STANDARD_POTENTIALS[anodeKey];

        if (!cathodeData || !anodeData) {
          throw new Error(`Unknown element. Available: ${Object.keys(STANDARD_POTENTIALS).join(', ')}`);
        }

        const Ecell = cellPotential(cathodeData.E0, anodeData.E0);

        result = {
          operation: 'cell_potential',
          cathode: { element: cathodeKey, ...cathodeData },
          anode: { element: anodeKey, ...anodeData },
          cell_potential_V: Math.round(Ecell * 1000) / 1000,
          spontaneous: Ecell > 0,
        };
        break;
      }

      case 'electrolysis': {
        const { current = 2, time = 3600, n = 2, molar_mass = 63.55 } = args;
        const data = electrolysis(current, time, n, molar_mass);

        result = {
          operation: 'electrolysis',
          current_A: current,
          time_s: time,
          time_h: Math.round(time / 360) / 10,
          n_electrons: n,
          molar_mass: molar_mass,
          charge_C: Math.round(data.charge),
          moles_deposited: Math.round(data.moles * 10000) / 10000,
          mass_deposited_g: Math.round(data.mass * 1000) / 1000,
        };
        break;
      }

      case 'gibbs': {
        const { E0 = 1.1, n = 2 } = args;
        const deltaG = gibbsFromCell(E0, n);

        result = {
          operation: 'gibbs',
          cell_potential_V: E0,
          n_electrons: n,
          delta_G_J_mol: Math.round(deltaG),
          delta_G_kJ_mol: Math.round(deltaG / 100) / 10,
          spontaneous: deltaG < 0,
        };
        break;
      }

      case 'equilibrium_constant': {
        const { E0 = 1.1, n = 2, T = 298 } = args;
        const K = KfromCell(E0, n, T);

        result = {
          operation: 'equilibrium_constant',
          E0_V: E0,
          n_electrons: n,
          temperature_K: T,
          K: K > 1e10 ? K.toExponential(4) : Math.round(K * 1000) / 1000,
          log_K: Math.round(Math.log10(K) * 100) / 100,
        };
        break;
      }

      case 'standard_potentials': {
        const element = args.element;
        if (element && STANDARD_POTENTIALS[element]) {
          result = {
            operation: 'standard_potentials',
            element,
            ...STANDARD_POTENTIALS[element],
          };
        } else {
          const sorted = Object.entries(STANDARD_POTENTIALS).sort((a, b) => a[1].E0 - b[1].E0);
          result = {
            operation: 'standard_potentials',
            table: sorted.map(([elem, data]) => ({
              element: elem,
              equation: data.equation,
              E0: data.E0,
            })),
            note: 'Ordered from most easily oxidized to least',
          };
        }
        break;
      }

      case 'battery_info': {
        const type = args.battery_type || 'lithium_ion';
        const info = BATTERIES[type];

        if (info) {
          result = { operation: 'battery_info', type, ...info };
        } else {
          result = {
            operation: 'battery_info',
            available_types: Object.keys(BATTERIES),
            batteries: BATTERIES,
          };
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Electrochemistry Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isElectrochemistryAvailable(): boolean { return true; }
