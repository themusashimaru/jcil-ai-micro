// ============================================================================
// EPIDEMIOLOGY TOOL - TIER BEYOND
// ============================================================================
// Disease modeling: SIR/SEIR models, R0 calculations, herd immunity, outbreaks.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// SIR Model: dS/dt = -βSI, dI/dt = βSI - γI, dR/dt = γI
function simulateSIR(
  S0: number,
  I0: number,
  R0: number,
  beta: number,
  gamma: number,
  days: number,
  dt: number = 0.1
): { day: number; S: number; I: number; R: number }[] {
  const results = [];
  let S = S0,
    I = I0,
    R = R0;
  const N = S0 + I0 + R0;

  for (let t = 0; t <= days; t += dt) {
    if (Math.abs(t - Math.round(t)) < dt / 2) {
      results.push({ day: Math.round(t), S: +S.toFixed(0), I: +I.toFixed(0), R: +R.toFixed(0) });
    }
    const dS = (-beta * S * I) / N;
    const dI = (beta * S * I) / N - gamma * I;
    const dR = gamma * I;
    S += dS * dt;
    I += dI * dt;
    R += dR * dt;
  }
  return results;
}

// SEIR Model: adds Exposed compartment
function simulateSEIR(
  S0: number,
  E0: number,
  I0: number,
  R0: number,
  beta: number,
  sigma: number,
  gamma: number,
  days: number,
  dt: number = 0.1
): { day: number; S: number; E: number; I: number; R: number }[] {
  const results = [];
  let S = S0,
    E = E0,
    I = I0,
    R = R0;
  const N = S0 + E0 + I0 + R0;

  for (let t = 0; t <= days; t += dt) {
    if (Math.abs(t - Math.round(t)) < dt / 2) {
      results.push({
        day: Math.round(t),
        S: +S.toFixed(0),
        E: +E.toFixed(0),
        I: +I.toFixed(0),
        R: +R.toFixed(0),
      });
    }
    const dS = (-beta * S * I) / N;
    const dE = (beta * S * I) / N - sigma * E;
    const dI = sigma * E - gamma * I;
    const dR = gamma * I;
    S += dS * dt;
    E += dE * dt;
    I += dI * dt;
    R += dR * dt;
  }
  return results;
}

// Effective reproduction number
function calculateRe(R0: number, susceptibleFraction: number): number {
  return R0 * susceptibleFraction;
}

// Herd immunity threshold
function herdImmunityThreshold(R0: number): number {
  return 1 - 1 / R0;
}

// Final size equation (iterative solution)
function finalSize(R0: number, S0Fraction: number = 1): number {
  let R = 0.5;
  for (let i = 0; i < 100; i++) {
    const newR = 1 - S0Fraction * Math.exp(-R0 * R);
    if (Math.abs(newR - R) < 1e-8) break;
    R = newR;
  }
  return R;
}

// Doubling time
function doublingTime(R0: number, gamma: number): number {
  const growthRate = gamma * (R0 - 1);
  return Math.log(2) / growthRate;
}

const DISEASES: Record<string, { R0: number; incubation_days: number; infectious_days: number }> = {
  measles: { R0: 15, incubation_days: 10, infectious_days: 8 },
  chickenpox: { R0: 10, incubation_days: 14, infectious_days: 7 },
  mumps: { R0: 7, incubation_days: 17, infectious_days: 7 },
  covid_original: { R0: 2.5, incubation_days: 5, infectious_days: 10 },
  covid_delta: { R0: 5, incubation_days: 4, infectious_days: 10 },
  covid_omicron: { R0: 10, incubation_days: 3, infectious_days: 7 },
  influenza: { R0: 1.5, incubation_days: 2, infectious_days: 5 },
  ebola: { R0: 1.8, incubation_days: 10, infectious_days: 8 },
  smallpox: { R0: 5, incubation_days: 12, infectious_days: 14 },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const epidemiologyTool: UnifiedTool = {
  name: 'epidemiology',
  description: `Epidemiology and disease modeling: SIR/SEIR, R0, herd immunity.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['sir', 'seir', 'r0', 'herd_immunity', 'final_size', 'doubling_time', 'diseases'],
        description: 'Epidemiological calculation to perform',
      },
      population: { type: 'number', description: 'Total population' },
      initial_infected: { type: 'number', description: 'Initial infected count' },
      initial_exposed: { type: 'number', description: 'Initial exposed count' },
      initial_recovered: { type: 'number', description: 'Initial recovered count' },
      beta: { type: 'number', description: 'Transmission rate' },
      gamma: { type: 'number', description: 'Recovery rate (1/infectious_period)' },
      sigma: { type: 'number', description: 'Incubation rate (1/incubation_period)' },
      R0: { type: 'number', description: 'Basic reproduction number' },
      days: { type: 'number', description: 'Simulation days' },
      disease: { type: 'string', description: 'Disease name for preset parameters' },
      vaccinated_fraction: { type: 'number', description: 'Fraction of population vaccinated' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeEpidemiology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // Get disease parameters if specified
    let diseaseParams = null;
    if (args.disease && DISEASES[args.disease]) {
      diseaseParams = DISEASES[args.disease];
    }

    const R0val = args.R0 || diseaseParams?.R0 || 2.5;
    const gamma = args.gamma || (diseaseParams ? 1 / diseaseParams.infectious_days : 0.1);
    const sigma = args.sigma || (diseaseParams ? 1 / diseaseParams.incubation_days : 0.2);
    const beta = args.beta || R0val * gamma;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'sir': {
        const N = args.population || 1000000;
        const I0 = args.initial_infected || 1;
        const R0_init = args.initial_recovered || 0;
        const S0 = N - I0 - R0_init;
        const days = args.days || 180;

        const results = simulateSIR(S0, I0, R0_init, beta, gamma, days);
        const peak = results.reduce((max, r) => (r.I > max.I ? r : max), results[0]);

        result = {
          operation: 'sir',
          parameters: {
            population: N,
            R0: R0val,
            beta: +beta.toFixed(4),
            gamma: +gamma.toFixed(4),
          },
          peak_infected: {
            day: peak.day,
            count: peak.I,
            percent: +((peak.I / N) * 100).toFixed(2),
          },
          final_recovered: results[results.length - 1].R,
          attack_rate: +((results[results.length - 1].R / N) * 100).toFixed(1) + '%',
          trajectory: results.filter((_, i) => i % 7 === 0),
        };
        break;
      }
      case 'seir': {
        const N = args.population || 1000000;
        const E0 = args.initial_exposed || 10;
        const I0 = args.initial_infected || 1;
        const R0_init = args.initial_recovered || 0;
        const S0 = N - E0 - I0 - R0_init;
        const days = args.days || 180;

        const results = simulateSEIR(S0, E0, I0, R0_init, beta, sigma, gamma, days);
        const peak = results.reduce((max, r) => (r.I > max.I ? r : max), results[0]);

        result = {
          operation: 'seir',
          parameters: {
            population: N,
            R0: R0val,
            beta: +beta.toFixed(4),
            sigma: +sigma.toFixed(4),
            gamma: +gamma.toFixed(4),
          },
          incubation_period_days: +(1 / sigma).toFixed(1),
          infectious_period_days: +(1 / gamma).toFixed(1),
          peak_infected: { day: peak.day, count: peak.I },
          trajectory: results.filter((_, i) => i % 7 === 0),
        };
        break;
      }
      case 'r0': {
        const Re = calculateRe(R0val, 1 - (args.vaccinated_fraction || 0));
        result = {
          operation: 'r0',
          R0: R0val,
          vaccinated_fraction: args.vaccinated_fraction || 0,
          effective_R: +Re.toFixed(2),
          epidemic_growth: Re > 1 ? 'growing' : Re < 1 ? 'declining' : 'stable',
          interpretation: `Each infected person infects ${Re.toFixed(1)} others on average`,
        };
        break;
      }
      case 'herd_immunity': {
        const threshold = herdImmunityThreshold(R0val);
        const vaccinated = args.vaccinated_fraction || 0;
        result = {
          operation: 'herd_immunity',
          R0: R0val,
          herd_immunity_threshold: +(threshold * 100).toFixed(1) + '%',
          current_immunity: +(vaccinated * 100).toFixed(1) + '%',
          additional_needed: +((threshold - vaccinated) * 100).toFixed(1) + '%',
          herd_immunity_achieved: vaccinated >= threshold,
        };
        break;
      }
      case 'final_size': {
        const attackRate = finalSize(R0val);
        const N = args.population || 1000000;
        result = {
          operation: 'final_size',
          R0: R0val,
          final_attack_rate: +(attackRate * 100).toFixed(1) + '%',
          total_infected: Math.round(N * attackRate),
          remaining_susceptible: Math.round(N * (1 - attackRate)),
        };
        break;
      }
      case 'doubling_time': {
        const dt = doublingTime(R0val, gamma);
        result = {
          operation: 'doubling_time',
          R0: R0val,
          gamma,
          doubling_time_days: +dt.toFixed(1),
          growth_rate_per_day: +(gamma * (R0val - 1)).toFixed(3),
        };
        break;
      }
      case 'diseases': {
        result = {
          operation: 'diseases',
          available: Object.entries(DISEASES).map(([k, v]) => ({
            disease: k,
            ...v,
            herd_immunity_threshold: +((1 - 1 / v.R0) * 100).toFixed(0) + '%',
          })),
        };
        break;
      }
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isEpidemiologyAvailable(): boolean {
  return true;
}
