/**
 * REACTION KINETICS TOOL
 *
 * Chemical reaction kinetics: rate laws, Arrhenius equation,
 * reaction mechanisms, and equilibrium.
 *
 * Part of TIER CHEMISTRY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// RATE LAWS
// ============================================================================

interface _RateLaw {
  order: number;
  rateConstant: number;
  concentration: number;
  time: number;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _RateLawType = _RateLaw; // reserved for future typed operations

function zeroOrderRate(k: number, A0: number, t: number): { concentration: number; halfLife: number } {
  const A = Math.max(0, A0 - k * t);
  const halfLife = A0 / (2 * k);
  return { concentration: A, halfLife };
}

function firstOrderRate(k: number, A0: number, t: number): { concentration: number; halfLife: number } {
  const A = A0 * Math.exp(-k * t);
  const halfLife = Math.log(2) / k;
  return { concentration: A, halfLife };
}

function secondOrderRate(k: number, A0: number, t: number): { concentration: number; halfLife: number } {
  const A = A0 / (1 + k * A0 * t);
  const halfLife = 1 / (k * A0);
  return { concentration: A, halfLife };
}

// ============================================================================
// ARRHENIUS EQUATION
// ============================================================================

const R = 8.314; // J/(mol·K)

function arrheniusRate(A: number, Ea: number, T: number): number {
  // k = A * exp(-Ea / RT)
  return A * Math.exp(-Ea / (R * T));
}

function activationEnergy(k1: number, k2: number, T1: number, T2: number): number {
  // Ea = R * ln(k2/k1) / (1/T1 - 1/T2)
  return R * Math.log(k2 / k1) / (1 / T1 - 1 / T2);
}

function _arrhenius2Temps(k1: number, T1: number, Ea: number, T2: number): number {
  // k2 = k1 * exp(-Ea/R * (1/T2 - 1/T1))
  return k1 * Math.exp(-Ea / R * (1 / T2 - 1 / T1));
}
void _arrhenius2Temps; // reserved for temperature extrapolation

// ============================================================================
// EQUILIBRIUM
// ============================================================================

function _equilibriumConstant(products: number[], reactants: number[], coeffProducts: number[], coeffReactants: number[]): number {
  let K = 1;
  for (let i = 0; i < products.length; i++) {
    K *= Math.pow(products[i], coeffProducts[i]);
  }
  for (let i = 0; i < reactants.length; i++) {
    K /= Math.pow(reactants[i], coeffReactants[i]);
  }
  return K;
}
void _equilibriumConstant; // reserved for multi-species equilibrium

function gibbsFromK(K: number, T: number): number {
  // ΔG = -RT ln(K)
  return -R * T * Math.log(K);
}

function KfromGibbs(deltaG: number, T: number): number {
  // K = exp(-ΔG / RT)
  return Math.exp(-deltaG / (R * T));
}

// ============================================================================
// REACTION MECHANISMS
// ============================================================================

interface ElementaryStep {
  reactants: string[];
  products: string[];
  k: number;
  order: number;
}

function _steadyStateApprox(steps: ElementaryStep[], intermediate: string): string {
  // Returns the rate expression for steady-state approximation
  const forming: string[] = [];
  const consuming: string[] = [];

  for (const step of steps) {
    if (step.products.includes(intermediate)) {
      forming.push(`k${steps.indexOf(step) + 1}[${step.reactants.join('][')}]`);
    }
    if (step.reactants.includes(intermediate)) {
      consuming.push(`k${steps.indexOf(step) + 1}[${step.reactants.join('][')}]`);
    }
  }

  return `d[${intermediate}]/dt = ${forming.join(' + ')} - ${consuming.join(' - ')} ≈ 0`;
}
void _steadyStateApprox; // reserved for mechanism analysis

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeConcentration(k: number, A0: number, order: number, tMax: number): string {
  const lines: string[] = ['Concentration vs Time:', ''];
  const height = 10;
  const width = 40;

  const getConc = (t: number): number => {
    switch (order) {
      case 0: return zeroOrderRate(k, A0, t).concentration;
      case 1: return firstOrderRate(k, A0, t).concentration;
      case 2: return secondOrderRate(k, A0, t).concentration;
      default: return firstOrderRate(k, A0, t).concentration;
    }
  };

  const concentrations: number[] = [];
  for (let i = 0; i <= width; i++) {
    concentrations.push(getConc(i / width * tMax));
  }

  for (let h = height; h >= 0; h--) {
    let line = '';
    const threshold = h / height * A0;
    for (let i = 0; i <= width; i++) {
      if (concentrations[i] >= threshold) {
        line += '█';
      } else {
        line += ' ';
      }
    }
    lines.push(`${(threshold).toFixed(2).padStart(5)} │${line}`);
  }
  lines.push(`      └${'─'.repeat(width + 1)}`);
  lines.push(`       0${''.padStart(width / 2)}${tMax}`);
  lines.push(`            Time (s)`);

  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const reactionKineticsTool: UnifiedTool = {
  name: 'reaction_kinetics',
  description: `Chemical reaction kinetics calculations.

Operations:
- rate_law: Calculate concentration over time for 0th, 1st, 2nd order
- arrhenius: Calculate rate constant from Arrhenius equation
- activation_energy: Calculate Ea from two rate constants
- equilibrium: Calculate equilibrium constant K
- gibbs: Calculate ΔG from K or K from ΔG
- visualize: Visualize concentration decay`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['rate_law', 'arrhenius', 'activation_energy', 'equilibrium', 'gibbs', 'visualize'],
        description: 'Kinetics operation',
      },
      order: { type: 'number', description: 'Reaction order (0, 1, 2)' },
      k: { type: 'number', description: 'Rate constant' },
      A0: { type: 'number', description: 'Initial concentration (M)' },
      t: { type: 'number', description: 'Time (s)' },
      A: { type: 'number', description: 'Pre-exponential factor' },
      Ea: { type: 'number', description: 'Activation energy (J/mol)' },
      T: { type: 'number', description: 'Temperature (K)' },
      T1: { type: 'number', description: 'Temperature 1 (K)' },
      T2: { type: 'number', description: 'Temperature 2 (K)' },
      k1: { type: 'number', description: 'Rate constant at T1' },
      k2: { type: 'number', description: 'Rate constant at T2' },
      K: { type: 'number', description: 'Equilibrium constant' },
      deltaG: { type: 'number', description: 'Gibbs free energy change (J/mol)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeReactionKinetics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'rate_law': {
        const { order = 1, k = 0.1, A0 = 1.0, t = 10 } = args;
        let data: { concentration: number; halfLife: number };

        switch (order) {
          case 0:
            data = zeroOrderRate(k, A0, t);
            break;
          case 2:
            data = secondOrderRate(k, A0, t);
            break;
          default:
            data = firstOrderRate(k, A0, t);
        }

        result = {
          operation: 'rate_law',
          order,
          rate_constant: k,
          initial_concentration: A0,
          time: t,
          final_concentration: Math.round(data.concentration * 10000) / 10000,
          half_life: Math.round(data.halfLife * 1000) / 1000,
          units: { concentration: 'M', time: 's', rate_constant: order === 0 ? 'M/s' : order === 1 ? '1/s' : '1/(M·s)' },
        };
        break;
      }

      case 'arrhenius': {
        const { A = 1e13, Ea = 50000, T = 298 } = args;
        const k = arrheniusRate(A, Ea, T);

        result = {
          operation: 'arrhenius',
          pre_exponential_factor: A,
          activation_energy_J_mol: Ea,
          activation_energy_kJ_mol: Math.round(Ea / 1000 * 100) / 100,
          temperature_K: T,
          rate_constant: k < 0.0001 ? k.toExponential(4) : Math.round(k * 10000) / 10000,
        };
        break;
      }

      case 'activation_energy': {
        const { k1 = 0.01, k2 = 0.1, T1 = 298, T2 = 323 } = args;
        const Ea = activationEnergy(k1, k2, T1, T2);

        result = {
          operation: 'activation_energy',
          k1,
          k2,
          T1,
          T2,
          activation_energy_J_mol: Math.round(Ea),
          activation_energy_kJ_mol: Math.round(Ea / 100) / 10,
        };
        break;
      }

      case 'equilibrium': {
        const { K = 100, T = 298 } = args;
        const deltaG = gibbsFromK(K, T);

        result = {
          operation: 'equilibrium',
          K,
          temperature_K: T,
          delta_G_J_mol: Math.round(deltaG),
          delta_G_kJ_mol: Math.round(deltaG / 100) / 10,
          direction: K > 1 ? 'Products favored' : K < 1 ? 'Reactants favored' : 'At equilibrium',
        };
        break;
      }

      case 'gibbs': {
        if (args.K) {
          const { K, T = 298 } = args;
          const deltaG = gibbsFromK(K, T);
          result = {
            operation: 'gibbs',
            mode: 'K_to_deltaG',
            K,
            temperature_K: T,
            delta_G_J_mol: Math.round(deltaG),
            delta_G_kJ_mol: Math.round(deltaG / 100) / 10,
          };
        } else {
          const { deltaG = -5700, T = 298 } = args;
          const K = KfromGibbs(deltaG, T);
          result = {
            operation: 'gibbs',
            mode: 'deltaG_to_K',
            delta_G_J_mol: deltaG,
            temperature_K: T,
            K: Math.round(K * 1000) / 1000,
          };
        }
        break;
      }

      case 'visualize': {
        const { order = 1, k = 0.1, A0 = 1.0, t = 30 } = args;
        const viz = visualizeConcentration(k, A0, order, t);

        let data: { concentration: number; halfLife: number };
        switch (order) {
          case 0: data = zeroOrderRate(k, A0, t); break;
          case 2: data = secondOrderRate(k, A0, t); break;
          default: data = firstOrderRate(k, A0, t);
        }

        result = {
          operation: 'visualize',
          order,
          rate_constant: k,
          initial_concentration: A0,
          time_range: `0-${t}s`,
          half_life: Math.round(data.halfLife * 100) / 100,
          visualization: viz,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Kinetics Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isReactionKineticsAvailable(): boolean { return true; }
