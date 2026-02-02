/**
 * RADIOACTIVE-DECAY TOOL
 * Radioactive decay chains and nuclear physics calculations
 * Implements decay laws, half-lives, activity, and decay chain simulation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS AND DATA
// ============================================================================

const AVOGADRO = 6.02214076e23; // mol^-1
const SECONDS_PER_YEAR = 3.156e7;
const SECONDS_PER_DAY = 86400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

// Decay types with their characteristics
interface DecayType {
  name: string;
  symbol: string;
  deltaZ: number; // Change in atomic number
  deltaA: number; // Change in mass number
  emittedParticle: string;
  typicalEnergy: string;
  description: string;
}

const DECAY_TYPES: Record<string, DecayType> = {
  alpha: {
    name: 'Alpha Decay',
    symbol: 'α',
    deltaZ: -2,
    deltaA: -4,
    emittedParticle: 'He-4 nucleus (2p + 2n)',
    typicalEnergy: '4-9 MeV',
    description: 'Emission of helium-4 nucleus, common in heavy nuclei'
  },
  beta_minus: {
    name: 'Beta-minus Decay',
    symbol: 'β⁻',
    deltaZ: 1,
    deltaA: 0,
    emittedParticle: 'electron + antineutrino',
    typicalEnergy: '0.01-10 MeV',
    description: 'Neutron converts to proton, emits electron and antineutrino'
  },
  beta_plus: {
    name: 'Beta-plus Decay',
    symbol: 'β⁺',
    deltaZ: -1,
    deltaA: 0,
    emittedParticle: 'positron + neutrino',
    typicalEnergy: '0.01-10 MeV',
    description: 'Proton converts to neutron, emits positron and neutrino'
  },
  gamma: {
    name: 'Gamma Decay',
    symbol: 'γ',
    deltaZ: 0,
    deltaA: 0,
    emittedParticle: 'high-energy photon',
    typicalEnergy: '0.1-10 MeV',
    description: 'Excited nucleus releases energy as electromagnetic radiation'
  },
  electron_capture: {
    name: 'Electron Capture',
    symbol: 'EC',
    deltaZ: -1,
    deltaA: 0,
    emittedParticle: 'neutrino (+ X-rays)',
    typicalEnergy: '0.01-5 MeV',
    description: 'Nucleus absorbs inner orbital electron, proton becomes neutron'
  },
  neutron_emission: {
    name: 'Neutron Emission',
    symbol: 'n',
    deltaZ: 0,
    deltaA: -1,
    emittedParticle: 'neutron',
    typicalEnergy: '0.1-5 MeV',
    description: 'Direct emission of neutron from neutron-rich nucleus'
  },
  proton_emission: {
    name: 'Proton Emission',
    symbol: 'p',
    deltaZ: -1,
    deltaA: -1,
    emittedParticle: 'proton',
    typicalEnergy: '1-10 MeV',
    description: 'Direct emission of proton from proton-rich nucleus'
  },
  spontaneous_fission: {
    name: 'Spontaneous Fission',
    symbol: 'SF',
    deltaZ: -46, // Approximate for heavy nuclei
    deltaA: -118,
    emittedParticle: 'fission fragments + neutrons',
    typicalEnergy: '~200 MeV',
    description: 'Nucleus splits into two smaller nuclei plus neutrons'
  }
};

// Common isotopes database
interface Isotope {
  symbol: string;
  name: string;
  atomicNumber: number;
  massNumber: number;
  halfLife: number; // in seconds
  halfLifeUnit: string;
  decayModes: Array<{ type: string; branchingRatio: number; daughter?: string }>;
  atomicMass: number; // in amu
  specificActivity?: number; // Bq/g (optional, calculated if not provided)
}

const ISOTOPES: Record<string, Isotope> = {
  'U-238': {
    symbol: 'U-238',
    name: 'Uranium-238',
    atomicNumber: 92,
    massNumber: 238,
    halfLife: 4.468e9 * SECONDS_PER_YEAR,
    halfLifeUnit: '4.468 billion years',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'Th-234' }],
    atomicMass: 238.05079
  },
  'U-235': {
    symbol: 'U-235',
    name: 'Uranium-235',
    atomicNumber: 92,
    massNumber: 235,
    halfLife: 7.04e8 * SECONDS_PER_YEAR,
    halfLifeUnit: '704 million years',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'Th-231' }],
    atomicMass: 235.04393
  },
  'Th-234': {
    symbol: 'Th-234',
    name: 'Thorium-234',
    atomicNumber: 90,
    massNumber: 234,
    halfLife: 24.1 * SECONDS_PER_DAY,
    halfLifeUnit: '24.1 days',
    decayModes: [{ type: 'beta_minus', branchingRatio: 1.0, daughter: 'Pa-234m' }],
    atomicMass: 234.04360
  },
  'Ra-226': {
    symbol: 'Ra-226',
    name: 'Radium-226',
    atomicNumber: 88,
    massNumber: 226,
    halfLife: 1600 * SECONDS_PER_YEAR,
    halfLifeUnit: '1600 years',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'Rn-222' }],
    atomicMass: 226.02541
  },
  'Rn-222': {
    symbol: 'Rn-222',
    name: 'Radon-222',
    atomicNumber: 86,
    massNumber: 222,
    halfLife: 3.8235 * SECONDS_PER_DAY,
    halfLifeUnit: '3.8235 days',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'Po-218' }],
    atomicMass: 222.01758
  },
  'Po-210': {
    symbol: 'Po-210',
    name: 'Polonium-210',
    atomicNumber: 84,
    massNumber: 210,
    halfLife: 138.376 * SECONDS_PER_DAY,
    halfLifeUnit: '138.376 days',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'Pb-206' }],
    atomicMass: 209.98287
  },
  'Pb-210': {
    symbol: 'Pb-210',
    name: 'Lead-210',
    atomicNumber: 82,
    massNumber: 210,
    halfLife: 22.3 * SECONDS_PER_YEAR,
    halfLifeUnit: '22.3 years',
    decayModes: [{ type: 'beta_minus', branchingRatio: 1.0, daughter: 'Bi-210' }],
    atomicMass: 209.98419
  },
  'C-14': {
    symbol: 'C-14',
    name: 'Carbon-14',
    atomicNumber: 6,
    massNumber: 14,
    halfLife: 5730 * SECONDS_PER_YEAR,
    halfLifeUnit: '5730 years',
    decayModes: [{ type: 'beta_minus', branchingRatio: 1.0, daughter: 'N-14' }],
    atomicMass: 14.00324
  },
  'Co-60': {
    symbol: 'Co-60',
    name: 'Cobalt-60',
    atomicNumber: 27,
    massNumber: 60,
    halfLife: 5.2714 * SECONDS_PER_YEAR,
    halfLifeUnit: '5.2714 years',
    decayModes: [
      { type: 'beta_minus', branchingRatio: 1.0, daughter: 'Ni-60' },
      { type: 'gamma', branchingRatio: 1.0 }
    ],
    atomicMass: 59.93382
  },
  'I-131': {
    symbol: 'I-131',
    name: 'Iodine-131',
    atomicNumber: 53,
    massNumber: 131,
    halfLife: 8.02 * SECONDS_PER_DAY,
    halfLifeUnit: '8.02 days',
    decayModes: [{ type: 'beta_minus', branchingRatio: 1.0, daughter: 'Xe-131' }],
    atomicMass: 130.90612
  },
  'Cs-137': {
    symbol: 'Cs-137',
    name: 'Cesium-137',
    atomicNumber: 55,
    massNumber: 137,
    halfLife: 30.17 * SECONDS_PER_YEAR,
    halfLifeUnit: '30.17 years',
    decayModes: [{ type: 'beta_minus', branchingRatio: 1.0, daughter: 'Ba-137m' }],
    atomicMass: 136.90709
  },
  'Sr-90': {
    symbol: 'Sr-90',
    name: 'Strontium-90',
    atomicNumber: 38,
    massNumber: 90,
    halfLife: 28.8 * SECONDS_PER_YEAR,
    halfLifeUnit: '28.8 years',
    decayModes: [{ type: 'beta_minus', branchingRatio: 1.0, daughter: 'Y-90' }],
    atomicMass: 89.90773
  },
  'Pu-239': {
    symbol: 'Pu-239',
    name: 'Plutonium-239',
    atomicNumber: 94,
    massNumber: 239,
    halfLife: 24110 * SECONDS_PER_YEAR,
    halfLifeUnit: '24,110 years',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'U-235' }],
    atomicMass: 239.05216
  },
  'Am-241': {
    symbol: 'Am-241',
    name: 'Americium-241',
    atomicNumber: 95,
    massNumber: 241,
    halfLife: 432.2 * SECONDS_PER_YEAR,
    halfLifeUnit: '432.2 years',
    decayModes: [{ type: 'alpha', branchingRatio: 1.0, daughter: 'Np-237' }],
    atomicMass: 241.05682
  },
  'Tc-99m': {
    symbol: 'Tc-99m',
    name: 'Technetium-99m',
    atomicNumber: 43,
    massNumber: 99,
    halfLife: 6.01 * SECONDS_PER_HOUR,
    halfLifeUnit: '6.01 hours',
    decayModes: [{ type: 'gamma', branchingRatio: 0.88, daughter: 'Tc-99' }],
    atomicMass: 98.9063
  },
  'K-40': {
    symbol: 'K-40',
    name: 'Potassium-40',
    atomicNumber: 19,
    massNumber: 40,
    halfLife: 1.248e9 * SECONDS_PER_YEAR,
    halfLifeUnit: '1.248 billion years',
    decayModes: [
      { type: 'beta_minus', branchingRatio: 0.893, daughter: 'Ca-40' },
      { type: 'electron_capture', branchingRatio: 0.107, daughter: 'Ar-40' }
    ],
    atomicMass: 39.96400
  }
};

// ============================================================================
// DECAY CALCULATIONS
// ============================================================================

/**
 * Calculate decay constant from half-life
 */
function decayConstant(halfLife: number): number {
  return Math.LN2 / halfLife;
}

/**
 * Calculate remaining amount after time t
 * N(t) = N0 * e^(-λt)
 */
function remainingAmount(N0: number, lambda: number, time: number): number {
  return N0 * Math.exp(-lambda * time);
}

/**
 * Calculate time for amount to decay to fraction
 */
function timeToDecay(fraction: number, lambda: number): number {
  return -Math.log(fraction) / lambda;
}

/**
 * Calculate activity (Bq) from amount and decay constant
 * A = λN
 */
function activity(amount: number, lambda: number): number {
  return lambda * amount;
}

/**
 * Calculate specific activity (Bq/g)
 */
function specificActivity(halfLife: number, atomicMass: number): number {
  const lambda = decayConstant(halfLife);
  const atomsPerGram = AVOGADRO / atomicMass;
  return lambda * atomsPerGram;
}

/**
 * Convert activity between units
 */
function convertActivity(value: number, fromUnit: string, toUnit: string): number {
  // Convert to Bq first
  let bq = value;
  switch (fromUnit.toLowerCase()) {
    case 'ci':
    case 'curie':
      bq = value * 3.7e10;
      break;
    case 'mci':
      bq = value * 3.7e7;
      break;
    case 'μci':
    case 'uci':
      bq = value * 3.7e4;
      break;
    case 'gbq':
      bq = value * 1e9;
      break;
    case 'mbq':
      bq = value * 1e6;
      break;
    case 'kbq':
      bq = value * 1e3;
      break;
    case 'bq':
    default:
      bq = value;
  }

  // Convert from Bq to target
  switch (toUnit.toLowerCase()) {
    case 'ci':
    case 'curie':
      return bq / 3.7e10;
    case 'mci':
      return bq / 3.7e7;
    case 'μci':
    case 'uci':
      return bq / 3.7e4;
    case 'gbq':
      return bq / 1e9;
    case 'mbq':
      return bq / 1e6;
    case 'kbq':
      return bq / 1e3;
    case 'bq':
    default:
      return bq;
  }
}

/**
 * Format time with appropriate units
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(2)} seconds`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(2)} minutes`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(2)} hours`;
  if (seconds < 31536000) return `${(seconds / 86400).toFixed(2)} days`;
  if (seconds < 31536000000) return `${(seconds / 31536000).toFixed(2)} years`;
  return `${(seconds / 31536000e9).toFixed(2)} billion years`;
}

/**
 * Parse time string to seconds
 */
function parseTime(value: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return value;
    case 'min':
    case 'minute':
    case 'minutes':
      return value * 60;
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return value * 3600;
    case 'd':
    case 'day':
    case 'days':
      return value * 86400;
    case 'y':
    case 'yr':
    case 'year':
    case 'years':
      return value * 31536000;
    default:
      return value;
  }
}

// ============================================================================
// DECAY CHAIN SIMULATION
// ============================================================================

interface DecayChainStep {
  isotope: string;
  decayType: string;
  halfLife: string;
  daughter: string;
}

interface DecayChainResult {
  parent: string;
  chain: DecayChainStep[];
  stableEnd: string;
  totalSteps: number;
}

/**
 * Build decay chain from parent isotope
 */
function buildDecayChain(parentSymbol: string): DecayChainResult {
  const chain: DecayChainStep[] = [];
  let current = parentSymbol;
  const visited = new Set<string>();

  while (ISOTOPES[current] && !visited.has(current)) {
    visited.add(current);
    const isotope = ISOTOPES[current];
    const primaryDecay = isotope.decayModes[0];

    if (!primaryDecay.daughter) {
      break; // Stable or no daughter defined
    }

    chain.push({
      isotope: current,
      decayType: primaryDecay.type,
      halfLife: isotope.halfLifeUnit,
      daughter: primaryDecay.daughter
    });

    current = primaryDecay.daughter;
  }

  return {
    parent: parentSymbol,
    chain,
    stableEnd: current,
    totalSteps: chain.length
  };
}

/**
 * Simulate decay chain activity over time
 */
function simulateDecayChain(
  parentSymbol: string,
  initialAtoms: number,
  time: number,
  steps: number
): Array<{ time: number; populations: Record<string, number>; activities: Record<string, number> }> {
  // Build chain first
  const chainInfo = buildDecayChain(parentSymbol);
  const isotopes = [parentSymbol, ...chainInfo.chain.map(c => c.daughter)];

  // Initialize populations
  const populations: Record<string, number> = {};
  for (const iso of isotopes) {
    populations[iso] = iso === parentSymbol ? initialAtoms : 0;
  }

  const results: Array<{ time: number; populations: Record<string, number>; activities: Record<string, number> }> = [];
  const dt = time / steps;

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const currentPop = { ...populations };
    const activities: Record<string, number> = {};

    // Calculate activities
    for (const iso of isotopes) {
      if (ISOTOPES[iso]) {
        const lambda = decayConstant(ISOTOPES[iso].halfLife);
        activities[iso] = lambda * currentPop[iso];
      }
    }

    results.push({
      time: t,
      populations: { ...currentPop },
      activities
    });

    // Update populations using Bateman equations (simple Euler for now)
    for (let j = 0; j < isotopes.length; j++) {
      const iso = isotopes[j];
      if (!ISOTOPES[iso]) continue;

      const lambda = decayConstant(ISOTOPES[iso].halfLife);
      const decay = populations[iso] * lambda * dt;
      populations[iso] -= decay;

      // Add to daughter
      if (j < isotopes.length - 1) {
        populations[isotopes[j + 1]] += decay;
      }
    }
  }

  return results;
}

// ============================================================================
// BATEMAN EQUATIONS
// ============================================================================

/**
 * Bateman equation for nth member of decay chain
 * Exact solution for chain: A -> B -> C -> ...
 */
function batemanNth(
  lambdas: number[],
  N0: number,
  n: number,
  t: number
): number {
  if (n === 0) {
    return N0 * Math.exp(-lambdas[0] * t);
  }

  let sum = 0;
  for (let i = 0; i <= n; i++) {
    let product = 1;
    for (let j = 0; j <= n; j++) {
      if (j !== i) {
        product *= lambdas[j] / (lambdas[j] - lambdas[i]);
      }
    }
    sum += product * Math.exp(-lambdas[i] * t);
  }

  // Product of all lambda_j for j < n
  let lambdaProduct = 1;
  for (let j = 0; j < n; j++) {
    lambdaProduct *= lambdas[j];
  }

  return N0 * lambdaProduct * sum;
}

// ============================================================================
// DATING CALCULATIONS
// ============================================================================

interface DatingResult {
  age: number;
  ageFormatted: string;
  method: string;
  parentIsotope: string;
  daughterIsotope: string;
  halfLife: string;
  ratio: number;
}

/**
 * Calculate age using parent-daughter ratio
 */
function radiometricDating(
  parentSymbol: string,
  parentAmount: number,
  daughterAmount: number
): DatingResult {
  const isotope = ISOTOPES[parentSymbol];
  if (!isotope) {
    throw new Error(`Unknown isotope: ${parentSymbol}`);
  }

  const daughter = isotope.decayModes[0].daughter || 'unknown';
  const lambda = decayConstant(isotope.halfLife);

  // Age = (1/λ) * ln(1 + D/P)
  const ratio = daughterAmount / parentAmount;
  const age = Math.log(1 + ratio) / lambda;

  return {
    age,
    ageFormatted: formatTime(age),
    method: 'Parent-Daughter Ratio',
    parentIsotope: parentSymbol,
    daughterIsotope: daughter,
    halfLife: isotope.halfLifeUnit,
    ratio
  };
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const radioactivedecayTool: UnifiedTool = {
  name: 'radioactive_decay',
  description: 'Radioactive decay - half-life calculations, decay chains, activity, Bateman equations, radiometric dating, and isotope database',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['decay', 'half_life', 'chain', 'activity', 'dating', 'isotope', 'simulate', 'info'],
        description: 'Operation: decay (calculate remaining), half_life (decay constant), chain (build decay chain), activity (calculate activity), dating (radiometric age), isotope (lookup), simulate (chain dynamics), info (documentation)'
      },
      isotope: {
        type: 'string',
        description: 'Isotope symbol (e.g., "U-238", "C-14", "Co-60")'
      },
      initial_amount: {
        type: 'number',
        description: 'Initial amount (atoms or mass in grams)'
      },
      time: {
        type: 'number',
        description: 'Time elapsed'
      },
      time_unit: {
        type: 'string',
        description: 'Time unit (seconds, minutes, hours, days, years)'
      },
      decay_type: {
        type: 'string',
        enum: ['alpha', 'beta_minus', 'beta_plus', 'gamma', 'electron_capture', 'neutron_emission', 'proton_emission', 'spontaneous_fission'],
        description: 'Type of decay'
      },
      activity_value: {
        type: 'number',
        description: 'Activity value for conversion'
      },
      from_unit: {
        type: 'string',
        description: 'Source activity unit (Bq, kBq, MBq, GBq, Ci, mCi, μCi)'
      },
      to_unit: {
        type: 'string',
        description: 'Target activity unit'
      },
      parent_amount: {
        type: 'number',
        description: 'Parent isotope amount for dating'
      },
      daughter_amount: {
        type: 'number',
        description: 'Daughter isotope amount for dating'
      },
      simulation_steps: {
        type: 'number',
        description: 'Number of time steps for simulation'
      }
    },
    required: ['operation']
  }
};

export async function executeradioactivedecay(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'decay': {
        const isoSymbol = args.isotope;
        if (!isoSymbol || !ISOTOPES[isoSymbol]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Unknown or missing isotope',
              availableIsotopes: Object.keys(ISOTOPES)
            }, null, 2),
            isError: true
          };
        }

        const isotope = ISOTOPES[isoSymbol];
        const N0 = args.initial_amount || 1e6;
        const timeValue = args.time || 1;
        const timeUnit = args.time_unit || 'years';
        const time = parseTime(timeValue, timeUnit);

        const lambda = decayConstant(isotope.halfLife);
        const remaining = remainingAmount(N0, lambda, time);
        const decayed = N0 - remaining;
        const activityInitial = activity(N0, lambda);
        const activityFinal = activity(remaining, lambda);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'decay',
            isotope: {
              symbol: isotope.symbol,
              name: isotope.name,
              halfLife: isotope.halfLifeUnit,
              decayModes: isotope.decayModes.map(d => d.type)
            },
            calculation: {
              initialAmount: N0,
              timeElapsed: `${timeValue} ${timeUnit}`,
              timeInSeconds: time,
              decayConstant: lambda,
              remainingAmount: remaining,
              decayedAmount: decayed,
              fractionRemaining: remaining / N0,
              percentRemaining: ((remaining / N0) * 100).toFixed(4) + '%',
              halfLivesElapsed: (time / isotope.halfLife).toFixed(4)
            },
            activity: {
              initial: { Bq: activityInitial, Ci: convertActivity(activityInitial, 'Bq', 'Ci') },
              final: { Bq: activityFinal, Ci: convertActivity(activityFinal, 'Bq', 'Ci') }
            }
          }, null, 2)
        };
      }

      case 'half_life': {
        const isoSymbol = args.isotope;
        if (!isoSymbol || !ISOTOPES[isoSymbol]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Unknown or missing isotope',
              availableIsotopes: Object.keys(ISOTOPES)
            }, null, 2),
            isError: true
          };
        }

        const isotope = ISOTOPES[isoSymbol];
        const lambda = decayConstant(isotope.halfLife);
        const meanLife = 1 / lambda;
        const specActivity = specificActivity(isotope.halfLife, isotope.atomicMass);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'half_life',
            isotope: {
              symbol: isotope.symbol,
              name: isotope.name,
              atomicNumber: isotope.atomicNumber,
              massNumber: isotope.massNumber,
              atomicMass: isotope.atomicMass
            },
            decay: {
              halfLife: isotope.halfLifeUnit,
              halfLifeSeconds: isotope.halfLife,
              decayConstant: lambda,
              decayConstantUnit: 'per second',
              meanLifetime: formatTime(meanLife),
              meanLifetimeSeconds: meanLife
            },
            specificActivity: {
              BqPerGram: specActivity,
              CiPerGram: specActivity / 3.7e10
            },
            decayModes: isotope.decayModes.map(d => ({
              type: d.type,
              branchingRatio: d.branchingRatio,
              daughter: d.daughter,
              ...DECAY_TYPES[d.type]
            }))
          }, null, 2)
        };
      }

      case 'chain': {
        const isoSymbol = args.isotope || 'U-238';

        if (!ISOTOPES[isoSymbol]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Unknown isotope',
              availableIsotopes: Object.keys(ISOTOPES)
            }, null, 2),
            isError: true
          };
        }

        const chain = buildDecayChain(isoSymbol);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'chain',
            result: chain,
            chainDescription: chain.chain.map((step, i) =>
              `${i + 1}. ${step.isotope} --[${step.decayType}, t½=${step.halfLife}]--> ${step.daughter}`
            ).join('\n')
          }, null, 2)
        };
      }

      case 'activity': {
        if (args.activity_value !== undefined && args.from_unit && args.to_unit) {
          const converted = convertActivity(args.activity_value, args.from_unit, args.to_unit);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'activity_conversion',
              original: { value: args.activity_value, unit: args.from_unit },
              converted: { value: converted, unit: args.to_unit }
            }, null, 2)
          };
        }

        const isoSymbol = args.isotope;
        if (!isoSymbol || !ISOTOPES[isoSymbol]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Provide isotope for activity calculation or value/from_unit/to_unit for conversion',
              example: { isotope: 'Co-60', initial_amount: 1e15 }
            }, null, 2),
            isError: true
          };
        }

        const isotope = ISOTOPES[isoSymbol];
        const amount = args.initial_amount || 1e15;
        const lambda = decayConstant(isotope.halfLife);
        const act = activity(amount, lambda);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'activity',
            isotope: isotope.symbol,
            numberOfAtoms: amount,
            decayConstant: lambda,
            activity: {
              Bq: act,
              kBq: act / 1e3,
              MBq: act / 1e6,
              GBq: act / 1e9,
              Ci: act / 3.7e10,
              mCi: act / 3.7e7
            },
            formula: 'A = λN where λ = ln(2)/t½'
          }, null, 2)
        };
      }

      case 'dating': {
        const isoSymbol = args.isotope || 'C-14';
        const parentAmt = args.parent_amount;
        const daughterAmt = args.daughter_amount;

        if (parentAmt === undefined || daughterAmt === undefined) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Both parent_amount and daughter_amount are required',
              example: { isotope: 'C-14', parent_amount: 0.5, daughter_amount: 0.5 }
            }, null, 2),
            isError: true
          };
        }

        const dating = radiometricDating(isoSymbol, parentAmt, daughterAmt);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'dating',
            result: dating,
            interpretation: {
              formula: 'Age = (1/λ) × ln(1 + D/P)',
              explanation: 'The age is calculated from the ratio of daughter to parent isotope amounts'
            }
          }, null, 2)
        };
      }

      case 'isotope': {
        const isoSymbol = args.isotope;
        if (isoSymbol && ISOTOPES[isoSymbol]) {
          const isotope = ISOTOPES[isoSymbol];
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'isotope',
              data: isotope,
              decayTypes: isotope.decayModes.map(d => DECAY_TYPES[d.type])
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'isotope',
            availableIsotopes: Object.entries(ISOTOPES).map(([k, v]) => ({
              symbol: k,
              name: v.name,
              halfLife: v.halfLifeUnit
            }))
          }, null, 2)
        };
      }

      case 'simulate': {
        const isoSymbol = args.isotope || 'Ra-226';
        const N0 = args.initial_amount || 1e10;
        const timeValue = args.time || 100;
        const timeUnit = args.time_unit || 'years';
        const time = parseTime(timeValue, timeUnit);
        const steps = args.simulation_steps || 20;

        if (!ISOTOPES[isoSymbol]) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Unknown isotope',
              availableIsotopes: Object.keys(ISOTOPES)
            }, null, 2),
            isError: true
          };
        }

        const simulation = simulateDecayChain(isoSymbol, N0, time, steps);
        const chain = buildDecayChain(isoSymbol);

        // Summarize key time points
        const summary = [
          simulation[0],
          simulation[Math.floor(steps / 4)],
          simulation[Math.floor(steps / 2)],
          simulation[Math.floor(3 * steps / 4)],
          simulation[steps]
        ].map(s => ({
          time: formatTime(s.time),
          populations: Object.fromEntries(
            Object.entries(s.populations).map(([k, v]) => [k, v.toExponential(3)])
          ),
          activities: Object.fromEntries(
            Object.entries(s.activities)
              .filter(([_, v]) => v > 0)
              .map(([k, v]) => [k, v.toExponential(3) + ' Bq'])
          )
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate',
            parent: isoSymbol,
            decayChain: chain.chain.map(c => c.isotope + ' → ' + c.daughter).join(' → ') + ' → ' + chain.stableEnd,
            initialAtoms: N0,
            totalTime: `${timeValue} ${timeUnit}`,
            timeSteps: steps,
            summary
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Radioactive Decay',
            description: 'Nuclear decay calculations, chain simulation, and radiometric dating',

            fundamentalLaws: {
              decayLaw: 'N(t) = N₀e^(-λt) where λ = ln(2)/t½',
              activity: 'A = λN (disintegrations per second)',
              specificActivity: 'A/m = λNₐ/M (Bq/g)',
              batemanEquations: 'Exact solution for secular equilibrium in decay chains'
            },

            decayTypes: Object.values(DECAY_TYPES),

            operations: [
              'decay: Calculate remaining amount and activity after time',
              'half_life: Get decay constants and specific activity',
              'chain: Build decay chain from parent isotope',
              'activity: Calculate or convert activity units',
              'dating: Radiometric age from parent/daughter ratio',
              'isotope: Lookup isotope data',
              'simulate: Simulate decay chain dynamics over time',
              'info: This documentation'
            ],

            activityUnits: {
              SI: ['Bq (becquerel)', 'kBq', 'MBq', 'GBq'],
              conventional: ['Ci (curie) = 3.7×10¹⁰ Bq', 'mCi', 'μCi']
            },

            availableIsotopes: Object.keys(ISOTOPES),

            examples: [
              { operation: 'decay', isotope: 'C-14', initial_amount: 1e6, time: 5730, time_unit: 'years' },
              { operation: 'chain', isotope: 'U-238' },
              { operation: 'activity', isotope: 'Co-60', initial_amount: 1e15 },
              { operation: 'dating', isotope: 'K-40', parent_amount: 0.8, daughter_amount: 0.2 }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            validOperations: ['decay', 'half_life', 'chain', 'activity', 'dating', 'isotope', 'simulate', 'info']
          }, null, 2),
          isError: true
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in radioactive decay: ${errorMessage}`,
      isError: true
    };
  }
}

export function isradioactivedecayAvailable(): boolean {
  return true;
}
