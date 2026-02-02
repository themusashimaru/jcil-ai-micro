/**
 * ECOLOGY TOOL
 *
 * Ecological calculations: population dynamics, biodiversity indices,
 * carrying capacity, food webs, and ecosystem analysis.
 *
 * Part of TIER BIOLOGY - Ultimate Tool Arsenal
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// POPULATION DYNAMICS
// ============================================================================

function exponentialGrowth(N0: number, r: number, t: number): number {
  // N(t) = N0 × e^(rt)
  return N0 * Math.exp(r * t);
}

function logisticGrowth(N0: number, r: number, K: number, t: number): number {
  // N(t) = K / (1 + ((K - N0) / N0) × e^(-rt))
  return K / (1 + ((K - N0) / N0) * Math.exp(-r * t));
}

function doublingTime(r: number): number {
  return Math.log(2) / r;
}

export function carryingCapacity(birthRate: number, deathRate: number, maxPop: number): number {
  const r = birthRate - deathRate;
  if (r <= 0) return 0;
  return maxPop;
}

// ============================================================================
// BIODIVERSITY INDICES
// ============================================================================

function simpsonIndex(abundances: number[]): { D: number; complement: number; reciprocal: number } {
  const N = abundances.reduce((a, b) => a + b, 0);
  if (N <= 1) return { D: 0, complement: 1, reciprocal: Infinity };

  let sumNiNi1 = 0;
  for (const n of abundances) {
    sumNiNi1 += n * (n - 1);
  }
  const D = sumNiNi1 / (N * (N - 1));

  return {
    D: Math.round(D * 10000) / 10000,
    complement: Math.round((1 - D) * 10000) / 10000,
    reciprocal: Math.round(1 / D * 100) / 100,
  };
}

function shannonIndex(abundances: number[]): { H: number; Hmax: number; evenness: number } {
  const N = abundances.reduce((a, b) => a + b, 0);
  if (N === 0) return { H: 0, Hmax: 0, evenness: 0 };

  let H = 0;
  for (const n of abundances) {
    if (n > 0) {
      const p = n / N;
      H -= p * Math.log(p);
    }
  }

  const S = abundances.filter(n => n > 0).length;
  const Hmax = Math.log(S);
  const evenness = Hmax > 0 ? H / Hmax : 0;

  return {
    H: Math.round(H * 1000) / 1000,
    Hmax: Math.round(Hmax * 1000) / 1000,
    evenness: Math.round(evenness * 1000) / 1000,
  };
}

function speciesRichness(abundances: number[]): number {
  return abundances.filter(n => n > 0).length;
}

// ============================================================================
// LOTKA-VOLTERRA PREDATOR-PREY
// ============================================================================

function lotkaVolterra(
  prey: number, predator: number,
  alpha: number, beta: number, gamma: number, delta: number,
  dt: number
): { prey: number; predator: number } {
  // dx/dt = αx - βxy (prey)
  // dy/dt = δxy - γy (predator)
  const dPrey = (alpha * prey - beta * prey * predator) * dt;
  const dPredator = (delta * prey * predator - gamma * predator) * dt;

  return {
    prey: Math.max(0, prey + dPrey),
    predator: Math.max(0, predator + dPredator),
  };
}

// ============================================================================
// ECOLOGICAL FOOTPRINT
// ============================================================================

function ecologicalFootprint(
  carbonTons: number,
  foodHectares: number,
  housingHectares: number,
  goodsHectares: number
): { totalHectares: number; earths: number } {
  // Carbon footprint converted to forest hectares needed to absorb
  const carbonHectares = carbonTons / 0.73; // avg forest absorption

  const total = carbonHectares + foodHectares + housingHectares + goodsHectares;
  const earths = total / 1.63; // global hectares per person available

  return {
    totalHectares: Math.round(total * 100) / 100,
    earths: Math.round(earths * 100) / 100,
  };
}

// ============================================================================
// FOOD WEB METRICS
// ============================================================================

export function trophicEfficiency(energyIn: number, energyOut: number): number {
  return (energyOut / energyIn) * 100;
}

function biomassAtLevel(primaryProduction: number, level: number, efficiency: number = 0.1): number {
  return primaryProduction * Math.pow(efficiency, level - 1);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const ecologyTool: UnifiedTool = {
  name: 'ecology',
  description: `Ecological and ecosystem calculations.

Operations:
- population: Population growth models (exponential, logistic)
- biodiversity: Simpson and Shannon diversity indices
- predator_prey: Lotka-Volterra predator-prey dynamics
- footprint: Ecological footprint calculation
- trophic: Food web and trophic level analysis`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['population', 'biodiversity', 'predator_prey', 'footprint', 'trophic'],
        description: 'Ecology operation',
      },
      N0: { type: 'number', description: 'Initial population' },
      r: { type: 'number', description: 'Growth rate' },
      K: { type: 'number', description: 'Carrying capacity' },
      t: { type: 'number', description: 'Time' },
      abundances: { type: 'array', items: { type: 'number' }, description: 'Species abundances array' },
      prey: { type: 'number', description: 'Prey population' },
      predator: { type: 'number', description: 'Predator population' },
      alpha: { type: 'number', description: 'Prey growth rate' },
      beta: { type: 'number', description: 'Predation rate' },
      gamma: { type: 'number', description: 'Predator death rate' },
      delta: { type: 'number', description: 'Predator reproduction rate' },
      carbon_tons: { type: 'number', description: 'Carbon emissions (tons/year)' },
      primary_production: { type: 'number', description: 'Primary production energy' },
      trophic_level: { type: 'number', description: 'Trophic level (1=producer)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeEcology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'population': {
        const { N0 = 100, r = 0.1, K = 1000, t = 10 } = args;
        const expPop = exponentialGrowth(N0, r, t);
        const logPop = logisticGrowth(N0, r, K, t);
        const dt = doublingTime(r);

        // Generate growth curves
        const curve: Array<{ time: number; exponential: number; logistic: number }> = [];
        for (let i = 0; i <= t; i++) {
          curve.push({
            time: i,
            exponential: Math.round(exponentialGrowth(N0, r, i)),
            logistic: Math.round(logisticGrowth(N0, r, K, i)),
          });
        }

        result = {
          operation: 'population',
          initial_population: N0,
          growth_rate: r,
          carrying_capacity: K,
          time: t,
          exponential_growth: {
            final_population: Math.round(expPop),
            doubling_time: Math.round(dt * 100) / 100,
            unlimited: true,
          },
          logistic_growth: {
            final_population: Math.round(logPop),
            percent_of_K: Math.round(logPop / K * 100),
            density_dependent: true,
          },
          growth_curve: curve,
        };
        break;
      }

      case 'biodiversity': {
        const { abundances = [50, 30, 15, 3, 2] } = args;
        const simpson = simpsonIndex(abundances);
        const shannon = shannonIndex(abundances);
        const richness = speciesRichness(abundances);
        const total = (abundances as number[]).reduce((a: number, b: number) => a + b, 0);

        result = {
          operation: 'biodiversity',
          species_count: richness,
          total_individuals: total,
          simpson_index: {
            D: simpson.D,
            complement_1_D: simpson.complement,
            reciprocal_1_over_D: simpson.reciprocal,
            interpretation: simpson.complement > 0.8 ? 'High diversity' : simpson.complement > 0.5 ? 'Moderate diversity' : 'Low diversity',
          },
          shannon_index: {
            H: shannon.H,
            H_max: shannon.Hmax,
            evenness_J: shannon.evenness,
            interpretation: shannon.H > 2 ? 'High diversity' : shannon.H > 1 ? 'Moderate diversity' : 'Low diversity',
          },
          species_abundances: (abundances as number[]).map((n: number, i: number) => ({
            species: i + 1,
            count: n,
            relative_abundance: Math.round(n / total * 10000) / 100,
          })),
        };
        break;
      }

      case 'predator_prey': {
        const { prey = 100, predator = 20, alpha = 0.1, beta = 0.01, gamma = 0.1, delta = 0.005 } = args;

        // Simulate for 100 time steps
        const simulation: Array<{ t: number; prey: number; predator: number }> = [];
        let p = prey;
        let q = predator;
        const dt = 1;

        for (let t = 0; t <= 100; t += 5) {
          simulation.push({ t, prey: Math.round(p), predator: Math.round(q) });
          for (let i = 0; i < 5; i++) {
            const next = lotkaVolterra(p, q, alpha, beta, gamma, delta, dt);
            p = next.prey;
            q = next.predator;
          }
        }

        result = {
          operation: 'predator_prey',
          model: 'Lotka-Volterra',
          initial: { prey, predator },
          parameters: {
            alpha_prey_growth: alpha,
            beta_predation_rate: beta,
            gamma_predator_death: gamma,
            delta_predator_reproduction: delta,
          },
          simulation: simulation,
          equilibrium: {
            prey_equilibrium: gamma / delta,
            predator_equilibrium: alpha / beta,
          },
        };
        break;
      }

      case 'footprint': {
        const { carbon_tons = 10 } = args;
        const food = (args.food_hectares ?? 1.5) as number;
        const housing = (args.housing_hectares ?? 0.5) as number;
        const goods = (args.goods_hectares ?? 1) as number;

        const fp = ecologicalFootprint(carbon_tons, food, housing, goods);

        result = {
          operation: 'footprint',
          components: {
            carbon_tons_per_year: carbon_tons,
            food_hectares: food,
            housing_hectares: housing,
            goods_hectares: goods,
          },
          total_ecological_footprint_hectares: fp.totalHectares,
          earths_needed: fp.earths,
          sustainability: fp.earths <= 1 ? 'Sustainable' : fp.earths <= 2 ? 'Above average' : 'Unsustainable',
          global_average_comparison: {
            world_average_hectares: 2.75,
            your_footprint: fp.totalHectares > 2.75 ? 'Above average' : 'Below average',
          },
        };
        break;
      }

      case 'trophic': {
        const { primary_production = 10000, trophic_level = 3 } = args;
        const eff = (args.efficiency ?? 0.1) as number;

        const levels = [];
        for (let i = 1; i <= 5; i++) {
          const biomass = biomassAtLevel(primary_production, i, eff);
          levels.push({
            level: i,
            name: i === 1 ? 'Producers' : i === 2 ? 'Primary consumers' : i === 3 ? 'Secondary consumers' : i === 4 ? 'Tertiary consumers' : 'Apex predators',
            energy_available: Math.round(biomass * 100) / 100,
            percent_of_primary: Math.round(biomass / primary_production * 10000) / 100,
          });
        }

        result = {
          operation: 'trophic',
          primary_production: primary_production,
          transfer_efficiency: eff * 100,
          trophic_levels: levels,
          ten_percent_rule: 'Only ~10% of energy transfers between trophic levels',
          energy_at_level: {
            level: trophic_level,
            energy: Math.round(biomassAtLevel(primary_production, trophic_level, eff) * 100) / 100,
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Ecology Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isEcologyAvailable(): boolean { return true; }
void _carryingCapacity; void _trophicEfficiency;
