/**
 * EPIDEMIC-MODEL TOOL
 * Compartmental epidemic models (SIR, SEIR, SIS) with real differential equations
 * Kermack-McKendrick models and R0 calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const epidemicmodelTool: UnifiedTool = {
  name: 'epidemic_model',
  description: `Epidemic modeling and infectious disease dynamics.

Operations:
- info: Epidemiological modeling overview
- sir: SIR model simulation
- seir: SEIR model with exposed compartment
- sis: SIS model (no immunity)
- r0: Basic reproduction number analysis
- herd_immunity: Herd immunity threshold calculation
- intervention: Model interventions (vaccination, distancing)
- compare: Compare epidemic scenarios
- peak: Calculate peak infection timing and magnitude

Parameters:
- operation: The operation to perform
- population: Total population size
- initial_infected: Initial number of infected
- beta: Transmission rate (contact rate × probability)
- gamma: Recovery rate (1/infectious period)
- sigma: Incubation rate for SEIR (1/latent period)
- days: Simulation duration in days`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'sir', 'seir', 'sis', 'r0', 'herd_immunity', 'intervention', 'compare', 'peak'],
        description: 'Operation to perform'
      },
      model: { type: 'string', enum: ['SIR', 'SEIR', 'SIS'], description: 'Epidemic model type' },
      population: { type: 'number', description: 'Total population' },
      initial_infected: { type: 'number', description: 'Initial infected count' },
      beta: { type: 'number', description: 'Transmission rate' },
      gamma: { type: 'number', description: 'Recovery rate' },
      sigma: { type: 'number', description: 'Incubation rate (SEIR)' },
      days: { type: 'number', description: 'Simulation days' },
      vaccination_rate: { type: 'number', description: 'Vaccination rate for intervention' }
    },
    required: ['operation']
  }
};

// ============================================================================
// EPIDEMIC MODEL TYPES
// ============================================================================

interface EpidemicState {
  t: number;
  S: number;
  E?: number;
  I: number;
  R: number;
}

// ============================================================================
// DIFFERENTIAL EQUATION SOLVERS
// ============================================================================

/**
 * 4th-order Runge-Kutta integration step
 */
function rk4Step<T extends Record<string, number>>(
  state: T,
  derivatives: (s: T) => T,
  dt: number
): T {
  const k1 = derivatives(state);

  const state2 = { ...state };
  for (const key in state) {
    state2[key] = state[key] + 0.5 * dt * k1[key];
  }
  const k2 = derivatives(state2);

  const state3 = { ...state };
  for (const key in state) {
    state3[key] = state[key] + 0.5 * dt * k2[key];
  }
  const k3 = derivatives(state3);

  const state4 = { ...state };
  for (const key in state) {
    state4[key] = state[key] + dt * k3[key];
  }
  const k4 = derivatives(state4);

  const result = { ...state };
  for (const key in state) {
    result[key] = state[key] + (dt / 6) * (k1[key] + 2 * k2[key] + 2 * k3[key] + k4[key]);
  }
  return result;
}

// ============================================================================
// SIR MODEL
// ============================================================================

/**
 * SIR Model differential equations
 * dS/dt = -βSI/N
 * dI/dt = βSI/N - γI
 * dR/dt = γI
 */
function sirDerivatives(S: number, I: number, R: number, beta: number, gamma: number, N: number): {
  dS: number; dI: number; dR: number;
} {
  const dS = -beta * S * I / N;
  const dI = beta * S * I / N - gamma * I;
  const dR = gamma * I;
  return { dS, dI, dR };
}

function simulateSIR(
  N: number,
  I0: number,
  beta: number,
  gamma: number,
  days: number,
  dt: number = 0.1
): EpidemicState[] {
  const results: EpidemicState[] = [];
  let S = N - I0;
  let I = I0;
  let R = 0;
  let t = 0;

  results.push({ t, S, I, R });

  while (t < days) {
    const derivatives = (state: { S: number; I: number; R: number }) => {
      const d = sirDerivatives(state.S, state.I, state.R, beta, gamma, N);
      return { S: d.dS, I: d.dI, R: d.dR };
    };

    const newState = rk4Step({ S, I, R }, derivatives, dt);
    S = Math.max(0, newState.S);
    I = Math.max(0, newState.I);
    R = Math.max(0, newState.R);
    t += dt;

    if (Math.floor(t) > Math.floor(t - dt)) {
      results.push({ t: Math.floor(t), S, I, R });
    }
  }

  return results;
}

// ============================================================================
// SEIR MODEL
// ============================================================================

/**
 * SEIR Model with exposed/latent compartment
 * dS/dt = -βSI/N
 * dE/dt = βSI/N - σE
 * dI/dt = σE - γI
 * dR/dt = γI
 */
function simulateSEIR(
  N: number,
  I0: number,
  E0: number,
  beta: number,
  sigma: number,
  gamma: number,
  days: number,
  dt: number = 0.1
): EpidemicState[] {
  const results: EpidemicState[] = [];
  let S = N - I0 - E0;
  let E = E0;
  let I = I0;
  let R = 0;
  let t = 0;

  results.push({ t, S, E, I, R });

  while (t < days) {
    const derivatives = (state: { S: number; E: number; I: number; R: number }) => {
      const force = beta * state.S * state.I / N;
      return {
        S: -force,
        E: force - sigma * state.E,
        I: sigma * state.E - gamma * state.I,
        R: gamma * state.I
      };
    };

    const newState = rk4Step({ S, E, I, R }, derivatives, dt);
    S = Math.max(0, newState.S);
    E = Math.max(0, newState.E);
    I = Math.max(0, newState.I);
    R = Math.max(0, newState.R);
    t += dt;

    if (Math.floor(t) > Math.floor(t - dt)) {
      results.push({ t: Math.floor(t), S, E, I, R });
    }
  }

  return results;
}

// ============================================================================
// SIS MODEL
// ============================================================================

/**
 * SIS Model (no permanent immunity)
 * dS/dt = -βSI/N + γI
 * dI/dt = βSI/N - γI
 */
function simulateSIS(
  N: number,
  I0: number,
  beta: number,
  gamma: number,
  days: number,
  dt: number = 0.1
): EpidemicState[] {
  const results: EpidemicState[] = [];
  let S = N - I0;
  let I = I0;
  let t = 0;

  results.push({ t, S, I, R: 0 });

  while (t < days) {
    const derivatives = (state: { S: number; I: number }) => {
      const force = beta * state.S * state.I / N;
      return {
        S: -force + gamma * state.I,
        I: force - gamma * state.I
      };
    };

    const newState = rk4Step({ S, I }, derivatives, dt);
    S = Math.max(0, newState.S);
    I = Math.max(0, newState.I);
    t += dt;

    if (Math.floor(t) > Math.floor(t - dt)) {
      results.push({ t: Math.floor(t), S, I, R: 0 });
    }
  }

  return results;
}

// ============================================================================
// EPIDEMIC ANALYSIS
// ============================================================================

/**
 * Calculate basic reproduction number R0
 * R0 = β/γ for SIR/SIS
 * R0 = β/(γ+μ) with vital dynamics
 */
function calculateR0(beta: number, gamma: number): number {
  return beta / gamma;
}

/**
 * Calculate effective reproduction number
 * Re = R0 × S/N
 */
function calculateRe(R0: number, S: number, N: number): number {
  return R0 * (S / N);
}

/**
 * Herd immunity threshold
 * H = 1 - 1/R0
 */
function herdImmunityThreshold(R0: number): number {
  if (R0 <= 1) return 0;
  return 1 - 1 / R0;
}

/**
 * Final epidemic size (implicit equation)
 * R_∞/N = 1 - exp(-R0 × R_∞/N)
 */
function finalSize(R0: number): number {
  if (R0 <= 1) return 0;

  // Newton-Raphson to solve
  let z = 0.5;
  for (let i = 0; i < 100; i++) {
    const f = z - (1 - Math.exp(-R0 * z));
    const df = 1 - R0 * Math.exp(-R0 * z);
    z = z - f / df;
    if (Math.abs(f) < 1e-10) break;
  }
  return z;
}

/**
 * Find peak infection time and magnitude from simulation
 */
function findPeak(results: EpidemicState[]): { time: number; infected: number; susceptible: number } {
  let maxI = 0;
  let peakTime = 0;
  let peakS = 0;

  for (const state of results) {
    if (state.I > maxI) {
      maxI = state.I;
      peakTime = state.t;
      peakS = state.S;
    }
  }

  return { time: peakTime, infected: maxI, susceptible: peakS };
}

export async function executeepidemicmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    switch (operation) {
      case 'info': {
        const result = {
          tool: 'Epidemic Model',
          description: 'Compartmental models for infectious disease dynamics',

          models: {
            SIR: {
              compartments: 'Susceptible → Infected → Recovered',
              assumptions: 'Permanent immunity, closed population',
              equations: ['dS/dt = -βSI/N', 'dI/dt = βSI/N - γI', 'dR/dt = γI']
            },
            SEIR: {
              compartments: 'Susceptible → Exposed → Infected → Recovered',
              assumptions: 'Latent period before infectiousness',
              equations: ['dS/dt = -βSI/N', 'dE/dt = βSI/N - σE', 'dI/dt = σE - γI', 'dR/dt = γI']
            },
            SIS: {
              compartments: 'Susceptible → Infected → Susceptible',
              assumptions: 'No lasting immunity',
              equations: ['dS/dt = -βSI/N + γI', 'dI/dt = βSI/N - γI']
            }
          },

          keyParameters: {
            beta: 'Transmission rate = contact rate × probability of transmission',
            gamma: 'Recovery rate = 1 / infectious period',
            sigma: 'Incubation rate = 1 / latent period (SEIR)',
            R0: 'Basic reproduction number = β/γ'
          },

          keyResults: {
            herdImmunity: 'H = 1 - 1/R0 (fraction needed immune)',
            epidemicThreshold: 'Outbreak occurs if R0 > 1',
            finalSize: 'Implicit equation for total infected'
          },

          usage: 'Use operation: sir, seir, sis, r0, herd_immunity, intervention, compare, peak'
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'sir': {
        const N = args.population || 100000;
        const I0 = args.initial_infected || 10;
        const beta = args.beta || 0.3;
        const gamma = args.gamma || 0.1;
        const days = args.days || 200;

        const R0 = calculateR0(beta, gamma);
        const results = simulateSIR(N, I0, beta, gamma, days);
        const peak = findPeak(results);
        const finalSizeRatio = finalSize(R0);

        // Sample results at key points
        const samples = results.filter((_, i) => i % 10 === 0 || i === results.length - 1);

        const result = {
          operation: 'sir',
          model: 'SIR (Susceptible-Infected-Recovered)',

          parameters: {
            population: N,
            initialInfected: I0,
            beta: beta,
            gamma: gamma,
            infectiousPeriod: `${(1/gamma).toFixed(1)} days`,
            R0: R0.toFixed(2)
          },

          epidemicMetrics: {
            basicReproductionNumber: R0.toFixed(2),
            herdImmunityThreshold: `${(herdImmunityThreshold(R0) * 100).toFixed(1)}%`,
            expectedFinalSize: `${(finalSizeRatio * 100).toFixed(1)}% of population`,
            expectedTotalInfected: Math.round(finalSizeRatio * N)
          },

          peakInfection: {
            day: peak.time,
            infected: Math.round(peak.infected),
            percentOfPopulation: `${(peak.infected / N * 100).toFixed(2)}%`
          },

          timeSeries: samples.map(s => ({
            day: s.t,
            susceptible: Math.round(s.S),
            infected: Math.round(s.I),
            recovered: Math.round(s.R)
          })),

          finalState: {
            susceptible: Math.round(results[results.length - 1].S),
            recovered: Math.round(results[results.length - 1].R),
            totalInfected: Math.round(results[results.length - 1].R)
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'seir': {
        const N = args.population || 100000;
        const I0 = args.initial_infected || 10;
        const E0 = args.initial_exposed || 50;
        const beta = args.beta || 0.5;
        const sigma = args.sigma || 0.2; // 5-day incubation
        const gamma = args.gamma || 0.1;
        const days = args.days || 200;

        const R0 = calculateR0(beta, gamma);
        const results = simulateSEIR(N, I0, E0, beta, sigma, gamma, days);
        const peak = findPeak(results);

        const samples = results.filter((_, i) => i % 10 === 0 || i === results.length - 1);

        const result = {
          operation: 'seir',
          model: 'SEIR (Susceptible-Exposed-Infected-Recovered)',

          parameters: {
            population: N,
            initialExposed: E0,
            initialInfected: I0,
            beta: beta,
            sigma: sigma,
            gamma: gamma,
            latentPeriod: `${(1/sigma).toFixed(1)} days`,
            infectiousPeriod: `${(1/gamma).toFixed(1)} days`,
            R0: R0.toFixed(2)
          },

          epidemicMetrics: {
            basicReproductionNumber: R0.toFixed(2),
            serialInterval: `${(1/sigma + 1/gamma).toFixed(1)} days`,
            generationTime: `${(1/sigma + 0.5/gamma).toFixed(1)} days`
          },

          peakInfection: {
            day: peak.time,
            infected: Math.round(peak.infected),
            percentOfPopulation: `${(peak.infected / N * 100).toFixed(2)}%`
          },

          timeSeries: samples.map(s => ({
            day: s.t,
            susceptible: Math.round(s.S),
            exposed: Math.round(s.E || 0),
            infected: Math.round(s.I),
            recovered: Math.round(s.R)
          })),

          covidExample: {
            note: 'COVID-19 approximate parameters',
            R0: '2.5-3.5',
            latentPeriod: '3-5 days',
            infectiousPeriod: '7-10 days'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'sis': {
        const N = args.population || 100000;
        const I0 = args.initial_infected || 100;
        const beta = args.beta || 0.3;
        const gamma = args.gamma || 0.1;
        const days = args.days || 200;

        const R0 = calculateR0(beta, gamma);
        const results = simulateSIS(N, I0, beta, gamma, days);

        // Endemic equilibrium
        const endemicI = R0 > 1 ? N * (1 - 1/R0) : 0;

        const samples = results.filter((_, i) => i % 10 === 0 || i === results.length - 1);

        const result = {
          operation: 'sis',
          model: 'SIS (Susceptible-Infected-Susceptible)',

          parameters: {
            population: N,
            initialInfected: I0,
            beta: beta,
            gamma: gamma,
            R0: R0.toFixed(2)
          },

          equilibrium: {
            type: R0 > 1 ? 'Endemic' : 'Disease-free',
            endemicPrevalence: R0 > 1 ? `${((1 - 1/R0) * 100).toFixed(1)}%` : '0%',
            endemicInfected: Math.round(endemicI),
            condition: R0 > 1 ? 'R0 > 1: disease persists' : 'R0 ≤ 1: disease dies out'
          },

          timeSeries: samples.map(s => ({
            day: s.t,
            susceptible: Math.round(s.S),
            infected: Math.round(s.I)
          })),

          examples: {
            gonorrhea: 'Classic SIS disease (no lasting immunity)',
            commonCold: 'Some respiratory infections',
            malaria: 'In endemic regions'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'r0': {
        const beta = args.beta || 0.3;
        const gamma = args.gamma || 0.1;
        const R0 = calculateR0(beta, gamma);

        const result = {
          operation: 'r0',
          title: 'Basic Reproduction Number Analysis',

          calculation: {
            formula: 'R0 = β/γ',
            beta: beta,
            gamma: gamma,
            R0: R0.toFixed(3)
          },

          interpretation: {
            value: R0.toFixed(2),
            meaning: R0 > 1 ? 'Epidemic will grow' : 'Epidemic will die out',
            threshold: 'R0 = 1 is critical threshold',
            averageInfections: `Each case infects ${R0.toFixed(1)} others on average`
          },

          historicalR0: {
            measles: '12-18 (highly contagious)',
            smallpox: '5-7',
            polio: '5-7',
            covid19_original: '2.5-3.5',
            covid19_delta: '5-8',
            covid19_omicron: '8-15',
            influenza_seasonal: '1.3-1.8',
            ebola: '1.5-2.5',
            mumps: '4-7'
          },

          herdImmunity: {
            threshold: `${(herdImmunityThreshold(R0) * 100).toFixed(1)}%`,
            formula: 'H = 1 - 1/R0',
            meaning: `${(herdImmunityThreshold(R0) * 100).toFixed(0)}% immunity stops transmission`
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'herd_immunity': {
        const R0 = args.beta && args.gamma ? args.beta / args.gamma : 3;
        const population = args.population || 100000;
        const vaccineEfficacy = args.vaccine_efficacy || 0.9;

        const threshold = herdImmunityThreshold(R0);
        const vaccinesNeeded = threshold / vaccineEfficacy;

        const result = {
          operation: 'herd_immunity',
          title: 'Herd Immunity Threshold Analysis',

          R0: R0.toFixed(2),

          threshold: {
            formula: 'H = 1 - 1/R0',
            value: `${(threshold * 100).toFixed(1)}%`,
            meaning: `${(threshold * 100).toFixed(0)}% of population needs immunity`
          },

          vaccination: {
            vaccineEfficacy: `${(vaccineEfficacy * 100).toFixed(0)}%`,
            coverageNeeded: `${(vaccinesNeeded * 100).toFixed(1)}%`,
            populationToVaccinate: Math.ceil(vaccinesNeeded * population),
            absoluteNumber: `${Math.ceil(vaccinesNeeded * population).toLocaleString()} people`
          },

          examples: {
            measles: { R0: 15, threshold: '93.3%', challenge: 'Very high coverage needed' },
            polio: { R0: 6, threshold: '83.3%' },
            covid_omicron: { R0: 10, threshold: '90%', challenge: 'Waning immunity, variants' },
            influenza: { R0: 1.5, threshold: '33%', note: 'Achievable but virus mutates' }
          },

          caveats: [
            'Assumes homogeneous mixing',
            'Vaccine efficacy varies by age/health',
            'Immunity may wane over time',
            'Variants can change R0',
            'Geographic clustering affects local dynamics'
          ]
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'intervention': {
        const N = args.population || 100000;
        const I0 = args.initial_infected || 10;
        const beta_baseline = args.beta || 0.3;
        const gamma = args.gamma || 0.1;
        const days = args.days || 200;
        const vaccinationRate = args.vaccination_rate || 0.5;

        // Baseline scenario
        const baseline = simulateSIR(N, I0, beta_baseline, gamma, days);
        const baselinePeak = findPeak(baseline);

        // Social distancing (reduce beta by 50%)
        const distancing = simulateSIR(N, I0, beta_baseline * 0.5, gamma, days);
        const distancingPeak = findPeak(distancing);

        // Vaccination (reduce susceptible population)
        const vaccinatedN = N * (1 - vaccinationRate);
        const vaccinated = simulateSIR(vaccinatedN, I0, beta_baseline, gamma, days);
        const vaccinatedPeak = findPeak(vaccinated);

        const result = {
          operation: 'intervention',
          title: 'Intervention Comparison',

          baseline: {
            R0: (beta_baseline / gamma).toFixed(2),
            peakDay: baselinePeak.time,
            peakInfected: Math.round(baselinePeak.infected),
            totalInfected: Math.round(baseline[baseline.length - 1].R)
          },

          socialDistancing: {
            intervention: '50% reduction in contacts',
            effectiveR0: (beta_baseline * 0.5 / gamma).toFixed(2),
            peakDay: distancingPeak.time,
            peakInfected: Math.round(distancingPeak.infected),
            totalInfected: Math.round(distancing[distancing.length - 1].R),
            peakReduction: `${((1 - distancingPeak.infected / baselinePeak.infected) * 100).toFixed(0)}%`,
            peakDelay: `${distancingPeak.time - baselinePeak.time} days`
          },

          vaccination: {
            intervention: `${(vaccinationRate * 100).toFixed(0)}% vaccinated before outbreak`,
            effectiveSusceptible: Math.round(vaccinatedN),
            peakDay: vaccinatedPeak.time,
            peakInfected: Math.round(vaccinatedPeak.infected),
            totalInfected: Math.round(vaccinated[vaccinated.length - 1].R),
            livesProtected: Math.round(baseline[baseline.length - 1].R - vaccinated[vaccinated.length - 1].R)
          },

          flatteningTheCurve: {
            concept: 'Reduce peak to stay below healthcare capacity',
            tradeoff: 'Lower peak but longer epidemic duration',
            goal: 'Prevent healthcare system collapse'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'peak': {
        const N = args.population || 100000;
        const I0 = args.initial_infected || 10;
        const beta = args.beta || 0.3;
        const gamma = args.gamma || 0.1;
        const days = args.days || 200;

        const R0 = calculateR0(beta, gamma);
        const results = simulateSIR(N, I0, beta, gamma, days);
        const peak = findPeak(results);

        // Theoretical peak (occurs when S = N/R0)
        const theoreticalPeakS = N / R0;
        const theoreticalPeakI = N - theoreticalPeakS - N * Math.log(theoreticalPeakS / (N - I0)) / R0;

        const result = {
          operation: 'peak',
          title: 'Epidemic Peak Analysis',

          parameters: {
            population: N,
            R0: R0.toFixed(2)
          },

          simulatedPeak: {
            day: peak.time,
            infected: Math.round(peak.infected),
            percentOfPopulation: `${(peak.infected / N * 100).toFixed(2)}%`,
            susceptibleAtPeak: Math.round(peak.susceptible)
          },

          theoreticalPeak: {
            condition: 'Peak occurs when dI/dt = 0, i.e., S = N/R0',
            criticalSusceptible: Math.round(theoreticalPeakS),
            approximatePeakInfected: Math.round(Math.max(0, theoreticalPeakI))
          },

          healthcareImplications: {
            hospitalizedEstimate: `${Math.round(peak.infected * 0.1)} (assuming 10% hospitalization)`,
            icuEstimate: `${Math.round(peak.infected * 0.02)} (assuming 2% ICU)`,
            note: 'Actual rates vary by disease and demographics'
          }
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      case 'compare': {
        const N = args.population || 100000;
        const I0 = args.initial_infected || 10;
        const days = args.days || 200;

        // Compare diseases with different R0
        const diseases = [
          { name: 'Seasonal Flu', R0: 1.5 },
          { name: 'COVID-19 Original', R0: 2.5 },
          { name: 'COVID-19 Delta', R0: 6 },
          { name: 'Measles', R0: 15 }
        ];

        const comparisons = diseases.map(d => {
          const beta = d.R0 * 0.1; // gamma = 0.1
          const results = simulateSIR(N, I0, beta, 0.1, days);
          const peak = findPeak(results);
          return {
            disease: d.name,
            R0: d.R0,
            herdImmunityThreshold: `${(herdImmunityThreshold(d.R0) * 100).toFixed(0)}%`,
            peakDay: peak.time,
            peakInfected: Math.round(peak.infected),
            totalInfected: Math.round(results[results.length - 1].R)
          };
        });

        const result = {
          operation: 'compare',
          title: 'Disease Comparison',
          population: N,
          comparisons
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use: info, sir, seir, sis, r0, herd_immunity, intervention, compare, peak`
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isepidemicmodelAvailable(): boolean { return true; }
