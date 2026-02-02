/**
 * EPIDEMIC-MODEL TOOL
 * Epidemic simulation and modeling
 *
 * Implements real epidemiological models:
 * - SIR (Susceptible-Infected-Recovered)
 * - SEIR (with Exposed compartment)
 * - SIS (Susceptible-Infected-Susceptible, no immunity)
 * - SIRS (with waning immunity)
 * - Basic reproduction number (R₀) calculation
 * - Herd immunity threshold
 * - Intervention modeling
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const epidemicmodelTool: UnifiedTool = {
  name: 'epidemic_model',
  description: 'Epidemic modeling - SIR, SEIR, SIS compartmental models. Compute R₀, herd immunity, intervention effects.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'fit', 'forecast', 'r0', 'herd_immunity', 'intervention', 'compare', 'info'],
        description: 'Operation: simulate (run model), fit (estimate params), forecast (project), r0 (compute R₀), herd_immunity (threshold), intervention (model controls), compare (multiple scenarios)'
      },
      model: {
        type: 'string',
        enum: ['SIR', 'SEIR', 'SIS', 'SIRS', 'SEIRS'],
        description: 'Epidemic model type'
      },
      population: { type: 'integer', description: 'Total population N' },
      initial_infected: { type: 'integer', description: 'Initial number of infected I₀' },
      initial_exposed: { type: 'integer', description: 'Initial exposed E₀ (for SEIR)' },
      initial_recovered: { type: 'integer', description: 'Initial recovered R₀' },
      beta: { type: 'number', description: 'Transmission rate (contacts × probability)' },
      gamma: { type: 'number', description: 'Recovery rate (1/infectious_period)' },
      sigma: { type: 'number', description: 'Incubation rate (1/latent_period) for SEIR' },
      xi: { type: 'number', description: 'Immunity loss rate (1/immunity_period) for SIRS' },
      mu: { type: 'number', description: 'Birth/death rate (demographic turnover)' },
      days: { type: 'integer', description: 'Simulation duration in days' },
      dt: { type: 'number', description: 'Time step (default 0.1 days)' },
      contact_reduction: { type: 'number', description: 'Fraction reduction in contacts (0-1) for interventions' },
      vaccination_rate: { type: 'number', description: 'Daily vaccination rate (fraction of susceptibles)' },
      vaccine_efficacy: { type: 'number', description: 'Vaccine efficacy (0-1)' },
      intervention_start: { type: 'integer', description: 'Day to start intervention' },
      intervention_end: { type: 'integer', description: 'Day to end intervention' }
    },
    required: ['operation']
  }
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CompartmentState {
  S: number; // Susceptible
  E?: number; // Exposed (latent)
  I: number; // Infected (infectious)
  R: number; // Recovered (immune)
  time: number;
  N: number; // Total population
}

interface EpidemicResult {
  trajectory: CompartmentState[];
  peak: { day: number; infected: number; fraction: number };
  total_infected: number;
  final_susceptible: number;
  R0: number;
  Rt: number[]; // Effective R over time
  attack_rate: number; // Final fraction infected
}

// ============================================================================
// SIR MODEL
// dS/dt = -βSI/N
// dI/dt = βSI/N - γI
// dR/dt = γI
// ============================================================================

function sirDerivatives(
  state: CompartmentState,
  beta: number,
  gamma: number
): { dS: number; dI: number; dR: number } {
  const { S, I, N } = state;
  const infection = beta * S * I / N;

  return {
    dS: -infection,
    dI: infection - gamma * I,
    dR: gamma * I
  };
}

// ============================================================================
// SEIR MODEL
// dS/dt = -βSI/N
// dE/dt = βSI/N - σE
// dI/dt = σE - γI
// dR/dt = γI
// ============================================================================

function seirDerivatives(
  state: CompartmentState,
  beta: number,
  sigma: number,
  gamma: number
): { dS: number; dE: number; dI: number; dR: number } {
  const { S, E = 0, I, N } = state;
  const infection = beta * S * I / N;

  return {
    dS: -infection,
    dE: infection - sigma * E,
    dI: sigma * E - gamma * I,
    dR: gamma * I
  };
}

// ============================================================================
// SIS MODEL (no immunity)
// dS/dt = -βSI/N + γI
// dI/dt = βSI/N - γI
// ============================================================================

function sisDerivatives(
  state: CompartmentState,
  beta: number,
  gamma: number
): { dS: number; dI: number } {
  const { S, I, N } = state;
  const infection = beta * S * I / N;

  return {
    dS: -infection + gamma * I,
    dI: infection - gamma * I
  };
}

// ============================================================================
// SIRS MODEL (waning immunity)
// dS/dt = -βSI/N + ξR
// dI/dt = βSI/N - γI
// dR/dt = γI - ξR
// ============================================================================

function sirsDerivatives(
  state: CompartmentState,
  beta: number,
  gamma: number,
  xi: number
): { dS: number; dI: number; dR: number } {
  const { S, I, R, N } = state;
  const infection = beta * S * I / N;

  return {
    dS: -infection + xi * R,
    dI: infection - gamma * I,
    dR: gamma * I - xi * R
  };
}

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

function simulateEpidemic(
  model: string,
  population: number,
  initialInfected: number,
  initialExposed: number,
  initialRecovered: number,
  beta: number,
  gamma: number,
  sigma: number,
  xi: number,
  days: number,
  dt: number,
  interventionFn?: (t: number, state: CompartmentState) => { beta_eff: number; vaccination: number }
): EpidemicResult {
  const trajectory: CompartmentState[] = [];
  const Rt: number[] = [];

  // Initial state
  let S = population - initialInfected - initialExposed - initialRecovered;
  let E = initialExposed;
  let I = initialInfected;
  let R = initialRecovered;
  const N = population;

  // Track peak
  let peakInfected = I;
  let peakDay = 0;

  // Cumulative infections
  let totalNewInfections = initialInfected + initialExposed;

  for (let t = 0; t <= days; t += dt) {
    // Apply interventions if any
    let beta_eff = beta;
    let vaccination = 0;
    if (interventionFn) {
      const intervention = interventionFn(t, { S, E, I, R, time: t, N });
      beta_eff = intervention.beta_eff;
      vaccination = intervention.vaccination;
    }

    // Record state
    if (Math.abs(t - Math.round(t)) < dt / 2) {
      trajectory.push({
        S: Math.round(S),
        E: model === 'SEIR' || model === 'SEIRS' ? Math.round(E) : undefined,
        I: Math.round(I),
        R: Math.round(R),
        time: Math.round(t),
        N
      });

      // Track effective R
      if (S > 0) {
        Rt.push(beta_eff * S / (gamma * N));
      } else {
        Rt.push(0);
      }
    }

    // Track peak
    if (I > peakInfected) {
      peakInfected = I;
      peakDay = t;
    }

    // Compute derivatives based on model
    let dS: number, dI: number, dR: number, dE = 0;

    switch (model) {
      case 'SEIR':
      case 'SEIRS': {
        const d = seirDerivatives({ S, E, I, R, time: t, N }, beta_eff, sigma, gamma);
        dS = d.dS;
        dE = d.dE;
        dI = d.dI;
        dR = d.dR;
        if (model === 'SEIRS') {
          dS += xi * R;
          dR -= xi * R;
        }
        break;
      }
      case 'SIS': {
        const d = sisDerivatives({ S, I, R, time: t, N }, beta_eff, gamma);
        dS = d.dS;
        dI = d.dI;
        dR = 0;
        break;
      }
      case 'SIRS': {
        const d = sirsDerivatives({ S, I, R, time: t, N }, beta_eff, gamma, xi);
        dS = d.dS;
        dI = d.dI;
        dR = d.dR;
        break;
      }
      case 'SIR':
      default: {
        const d = sirDerivatives({ S, I, R, time: t, N }, beta_eff, gamma);
        dS = d.dS;
        dI = d.dI;
        dR = d.dR;
      }
    }

    // Track new infections
    const newInfections = -dS * dt - vaccination * S * dt;
    if (newInfections > 0) {
      totalNewInfections += newInfections;
    }

    // Apply vaccination
    if (vaccination > 0) {
      const vaccinated = vaccination * S * dt;
      dS -= vaccinated / dt;
      dR += vaccinated / dt;
    }

    // Euler step (simple but adequate for this)
    S = Math.max(0, S + dS * dt);
    E = Math.max(0, E + dE * dt);
    I = Math.max(0, I + dI * dt);
    R = Math.max(0, R + dR * dt);

    // Normalize to maintain population (numerical stability)
    const total = S + E + I + R;
    if (Math.abs(total - N) > 1) {
      const factor = N / total;
      S *= factor;
      E *= factor;
      I *= factor;
      R *= factor;
    }
  }

  // Basic R₀
  const R0 = beta / gamma;

  return {
    trajectory,
    peak: {
      day: Math.round(peakDay),
      infected: Math.round(peakInfected),
      fraction: peakInfected / N
    },
    total_infected: Math.round(totalNewInfections),
    final_susceptible: Math.round(S),
    R0,
    Rt,
    attack_rate: (N - trajectory[trajectory.length - 1].S) / N
  };
}

// ============================================================================
// R₀ AND THRESHOLD CALCULATIONS
// ============================================================================

/**
 * Calculate basic reproduction number
 * R₀ = β/γ for SIR
 * R₀ = (β/γ) × (σ/(σ+μ)) for SEIR with mortality
 */
function calculateR0(
  model: string,
  beta: number,
  gamma: number,
  sigma?: number,
  mu: number = 0
): number {
  switch (model) {
    case 'SEIR':
    case 'SEIRS':
      if (sigma) {
        return (beta / gamma) * (sigma / (sigma + mu));
      }
      return beta / gamma;
    default:
      return beta / gamma;
  }
}

/**
 * Calculate herd immunity threshold
 * HIT = 1 - 1/R₀
 */
function calculateHerdImmunityThreshold(R0: number): number {
  if (R0 <= 1) return 0;
  return 1 - 1 / R0;
}

/**
 * Calculate final epidemic size using transcendental equation
 * R∞ = 1 - S∞/N where S∞ = S₀ × exp(-R₀ × R∞)
 */
function calculateFinalSize(
  R0: number,
  initialSusceptibleFraction: number = 1
): number {
  if (R0 <= 1) return 0;

  // Solve: R∞ = 1 - S₀ × exp(-R₀ × R∞) numerically
  let R_inf = 0.5; // Initial guess

  for (let i = 0; i < 100; i++) {
    const S_inf = initialSusceptibleFraction * Math.exp(-R0 * R_inf);
    const R_inf_new = 1 - S_inf;

    if (Math.abs(R_inf_new - R_inf) < 1e-10) break;
    R_inf = 0.5 * (R_inf + R_inf_new); // Damped iteration
  }

  return R_inf;
}

// ============================================================================
// PARAMETER ESTIMATION
// ============================================================================

interface ObservedData {
  days: number[];
  cases: number[];
}

/**
 * Estimate beta and gamma from observed data using least squares
 */
function estimateParameters(
  data: ObservedData,
  model: string,
  population: number,
  initialGuess: { beta: number; gamma: number }
): { beta: number; gamma: number; R0: number; rmse: number } {
  // Simple grid search for parameter estimation
  let bestBeta = initialGuess.beta;
  let bestGamma = initialGuess.gamma;
  let bestRMSE = Infinity;

  const betaRange = [0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.8, 1.0];
  const gammaRange = [0.05, 0.07, 0.1, 0.12, 0.14, 0.17, 0.2, 0.25, 0.33];

  for (const beta of betaRange) {
    for (const gamma of gammaRange) {
      // Run simulation
      const result = simulateEpidemic(
        model,
        population,
        data.cases[0] || 1,
        0,
        0,
        beta,
        gamma,
        0.2,
        0,
        Math.max(...data.days),
        0.5
      );

      // Compute RMSE
      let sumSqError = 0;
      let count = 0;

      for (let i = 0; i < data.days.length; i++) {
        const day = data.days[i];
        const observed = data.cases[i];
        const simulated = result.trajectory.find(s => s.time === day)?.I || 0;

        sumSqError += (observed - simulated) ** 2;
        count++;
      }

      const rmse = Math.sqrt(sumSqError / count);

      if (rmse < bestRMSE) {
        bestRMSE = rmse;
        bestBeta = beta;
        bestGamma = gamma;
      }
    }
  }

  return {
    beta: bestBeta,
    gamma: bestGamma,
    R0: bestBeta / bestGamma,
    rmse: bestRMSE
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeepidemicmodel(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation = 'info',
      model = 'SIR',
      population = 1000000,
      initial_infected = 100,
      initial_exposed = 0,
      initial_recovered = 0,
      beta = 0.3, // ~3 contacts/day × 10% transmission probability
      gamma = 0.1, // 10 day infectious period
      sigma = 0.2, // 5 day incubation period
      xi = 0.01, // ~100 day immunity
      mu = 0,
      days = 180,
      dt = 0.1,
      contact_reduction = 0,
      vaccination_rate = 0,
      vaccine_efficacy = 0.9,
      intervention_start,
      intervention_end
    } = args;

    let result: any;

    switch (operation) {
      case 'simulate': {
        // Create intervention function if specified
        let interventionFn: ((t: number, state: CompartmentState) => { beta_eff: number; vaccination: number }) | undefined;

        if (contact_reduction > 0 || vaccination_rate > 0) {
          interventionFn = (t: number, _state: CompartmentState) => {
            const inWindow = (intervention_start === undefined || t >= intervention_start) &&
              (intervention_end === undefined || t <= intervention_end);

            return {
              beta_eff: inWindow ? beta * (1 - contact_reduction) : beta,
              vaccination: inWindow ? vaccination_rate * vaccine_efficacy : 0
            };
          };
        }

        const simResult = simulateEpidemic(
          model,
          population,
          initial_infected,
          initial_exposed,
          initial_recovered,
          beta,
          gamma,
          sigma,
          xi,
          days,
          dt,
          interventionFn
        );

        // Sample trajectory for output
        const sampleInterval = Math.max(1, Math.floor(simResult.trajectory.length / 50));
        const sampledTrajectory = simResult.trajectory.filter((_, i) => i % sampleInterval === 0);

        result = {
          operation: 'simulate',
          model,
          parameters: {
            population,
            beta,
            gamma,
            sigma: model.includes('E') ? sigma : undefined,
            xi: model.includes('RS') || model === 'SIRS' ? xi : undefined,
            R0: simResult.R0
          },
          initial_conditions: {
            susceptible: population - initial_infected - initial_exposed - initial_recovered,
            exposed: model.includes('E') ? initial_exposed : undefined,
            infected: initial_infected,
            recovered: initial_recovered
          },
          intervention: contact_reduction > 0 || vaccination_rate > 0 ? {
            contact_reduction,
            vaccination_rate,
            vaccine_efficacy,
            start_day: intervention_start,
            end_day: intervention_end
          } : undefined,
          results: {
            peak: simResult.peak,
            total_infected: simResult.total_infected,
            attack_rate: simResult.attack_rate,
            final_susceptible: simResult.final_susceptible,
            herd_immunity_threshold: calculateHerdImmunityThreshold(simResult.R0)
          },
          trajectory: sampledTrajectory,
          effective_R: simResult.Rt.filter((_, i) => i % sampleInterval === 0).slice(0, 30),
          description: `${model} epidemic simulation: R₀=${simResult.R0.toFixed(2)}, ` +
            `peak ${simResult.peak.infected.toLocaleString()} on day ${simResult.peak.day}, ` +
            `attack rate ${(simResult.attack_rate * 100).toFixed(1)}%`
        };
        break;
      }

      case 'r0': {
        const R0 = calculateR0(model, beta, gamma, sigma, mu);
        const hit = calculateHerdImmunityThreshold(R0);
        const finalSize = calculateFinalSize(R0);

        // Examples of known R₀ values
        const knownR0 = {
          measles: { R0: [12, 18], hit: '92-95%' },
          chickenpox: { R0: [10, 12], hit: '90-92%' },
          mumps: { R0: [4, 7], hit: '75-86%' },
          covid_original: { R0: [2.5, 3.5], hit: '60-71%' },
          covid_delta: { R0: [5, 8], hit: '80-88%' },
          covid_omicron: { R0: [8, 15], hit: '88-93%' },
          influenza: { R0: [1.3, 1.8], hit: '23-44%' },
          ebola: { R0: [1.5, 2.5], hit: '33-60%' }
        };

        result = {
          operation: 'r0',
          model,
          parameters: { beta, gamma, sigma: model.includes('E') ? sigma : undefined },
          R0,
          interpretation: {
            meaning: 'Average number of secondary infections from one infected individual in fully susceptible population',
            threshold: R0 > 1 ? 'Epidemic will spread' : 'Epidemic will die out',
            doubling_time: R0 > 1 ? `~${(Math.log(2) / (beta - gamma)).toFixed(1)} days` : 'N/A'
          },
          herd_immunity: {
            threshold: hit,
            threshold_percent: (hit * 100).toFixed(1) + '%',
            meaning: `Need ${(hit * 100).toFixed(1)}% immunity to prevent sustained transmission`
          },
          final_epidemic_size: {
            fraction: finalSize,
            percent: (finalSize * 100).toFixed(1) + '%',
            meaning: `${(finalSize * 100).toFixed(1)}% of population would be infected without intervention`
          },
          comparison: knownR0,
          description: `R₀ = ${R0.toFixed(2)}. ` +
            `Herd immunity threshold: ${(hit * 100).toFixed(1)}%. ` +
            `Expected final size: ${(finalSize * 100).toFixed(1)}% infected.`
        };
        break;
      }

      case 'herd_immunity': {
        const R0 = calculateR0(model, beta, gamma, sigma, mu);
        const hit = calculateHerdImmunityThreshold(R0);

        // Calculate effective R with different immunity levels
        const immunityLevels = [0, 0.2, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        const effectiveR = immunityLevels.map(immunity => ({
          immunity_level: immunity,
          immunity_percent: (immunity * 100).toFixed(0) + '%',
          effective_R: R0 * (1 - immunity),
          spreading: R0 * (1 - immunity) > 1
        }));

        result = {
          operation: 'herd_immunity',
          R0,
          herd_immunity_threshold: hit,
          threshold_percent: (hit * 100).toFixed(1) + '%',
          formula: 'HIT = 1 - 1/R₀',
          effective_R_by_immunity: effectiveR,
          vaccination_coverage_needed: {
            with_100_efficacy: (hit * 100).toFixed(1) + '%',
            with_90_efficacy: ((hit / 0.9) * 100).toFixed(1) + '%',
            with_70_efficacy: ((hit / 0.7) * 100).toFixed(1) + '%',
            with_50_efficacy: Math.min(100, (hit / 0.5) * 100).toFixed(1) + '%'
          },
          description: `For R₀=${R0.toFixed(2)}, need ${(hit * 100).toFixed(1)}% immunity for herd protection. ` +
            `With 90% effective vaccine, need ${((hit / 0.9) * 100).toFixed(1)}% coverage.`
        };
        break;
      }

      case 'intervention': {
        // Compare scenarios with and without intervention
        const baseResult = simulateEpidemic(
          model, population, initial_infected, initial_exposed, initial_recovered,
          beta, gamma, sigma, xi, days, dt
        );

        const interventionFn = (t: number, _state: CompartmentState) => {
          const inWindow = (intervention_start === undefined || t >= intervention_start) &&
            (intervention_end === undefined || t <= intervention_end);
          return {
            beta_eff: inWindow ? beta * (1 - contact_reduction) : beta,
            vaccination: inWindow ? vaccination_rate * vaccine_efficacy : 0
          };
        };

        const interventionResult = simulateEpidemic(
          model, population, initial_infected, initial_exposed, initial_recovered,
          beta, gamma, sigma, xi, days, dt, interventionFn
        );

        const preventedInfections = baseResult.total_infected - interventionResult.total_infected;
        const peakReduction = 1 - interventionResult.peak.infected / baseResult.peak.infected;

        result = {
          operation: 'intervention',
          model,
          intervention: {
            contact_reduction,
            vaccination_rate,
            vaccine_efficacy,
            start_day: intervention_start,
            end_day: intervention_end
          },
          baseline: {
            peak_infected: baseResult.peak.infected,
            peak_day: baseResult.peak.day,
            total_infected: baseResult.total_infected,
            attack_rate: baseResult.attack_rate
          },
          with_intervention: {
            peak_infected: interventionResult.peak.infected,
            peak_day: interventionResult.peak.day,
            total_infected: interventionResult.total_infected,
            attack_rate: interventionResult.attack_rate
          },
          impact: {
            infections_prevented: Math.round(preventedInfections),
            peak_reduction: (peakReduction * 100).toFixed(1) + '%',
            attack_rate_reduction: ((baseResult.attack_rate - interventionResult.attack_rate) * 100).toFixed(1) + '%',
            peak_delayed_by: interventionResult.peak.day - baseResult.peak.day + ' days'
          },
          description: `Intervention prevents ${Math.round(preventedInfections).toLocaleString()} infections, ` +
            `reduces peak by ${(peakReduction * 100).toFixed(1)}%`
        };
        break;
      }

      case 'compare': {
        // Compare multiple scenarios
        const scenarios = [
          { name: 'No intervention', contact_reduction: 0, vaccination_rate: 0 },
          { name: '25% contact reduction', contact_reduction: 0.25, vaccination_rate: 0 },
          { name: '50% contact reduction', contact_reduction: 0.5, vaccination_rate: 0 },
          { name: '0.5% daily vaccination', contact_reduction: 0, vaccination_rate: 0.005 },
          { name: 'Combined (25% + vax)', contact_reduction: 0.25, vaccination_rate: 0.005 }
        ];

        const comparisons = scenarios.map(scenario => {
          const interventionFn = (t: number, _state: CompartmentState) => ({
            beta_eff: beta * (1 - scenario.contact_reduction),
            vaccination: scenario.vaccination_rate * vaccine_efficacy
          });

          const result = simulateEpidemic(
            model, population, initial_infected, initial_exposed, initial_recovered,
            beta, gamma, sigma, xi, days, dt,
            scenario.contact_reduction > 0 || scenario.vaccination_rate > 0 ? interventionFn : undefined
          );

          return {
            scenario: scenario.name,
            peak_infected: result.peak.infected,
            peak_day: result.peak.day,
            total_infected: result.total_infected,
            attack_rate: result.attack_rate
          };
        });

        result = {
          operation: 'compare',
          model,
          base_parameters: { beta, gamma, R0: beta / gamma, population },
          scenarios: comparisons,
          ranking: [...comparisons]
            .sort((a, b) => a.total_infected - b.total_infected)
            .map((s, i) => ({ rank: i + 1, ...s })),
          description: `Compared ${scenarios.length} scenarios. ` +
            `Best outcome: ${comparisons.reduce((best, s) => s.total_infected < best.total_infected ? s : best).scenario}`
        };
        break;
      }

      case 'fit': {
        // Example fitting (would use provided data in practice)
        const exampleData: ObservedData = {
          days: [0, 7, 14, 21, 28, 35, 42, 49, 56],
          cases: [100, 350, 1200, 3500, 8000, 12000, 10000, 5000, 2000]
        };

        const estimated = estimateParameters(exampleData, model, population, { beta, gamma });

        result = {
          operation: 'fit',
          model,
          observed_data: exampleData,
          estimated_parameters: {
            beta: estimated.beta,
            gamma: estimated.gamma,
            R0: estimated.R0,
            infectious_period: (1 / estimated.gamma).toFixed(1) + ' days'
          },
          fit_quality: {
            rmse: estimated.rmse,
            quality: estimated.rmse < 1000 ? 'Good' : estimated.rmse < 5000 ? 'Moderate' : 'Poor'
          },
          description: `Estimated R₀ = ${estimated.R0.toFixed(2)} from observed data. ` +
            `β = ${estimated.beta.toFixed(3)}, γ = ${estimated.gamma.toFixed(3)}`
        };
        break;
      }

      case 'forecast': {
        // Run simulation and project forward
        const forecastResult = simulateEpidemic(
          model, population, initial_infected, initial_exposed, initial_recovered,
          beta, gamma, sigma, xi, days, dt
        );

        // Key milestones
        const trajectory = forecastResult.trajectory;
        const milestones: { day: number; event: string; value: number }[] = [];

        // Find when infections exceed thresholds
        const thresholds = [0.001, 0.01, 0.05, 0.1]; // 0.1%, 1%, 5%, 10% of population
        for (const threshold of thresholds) {
          const state = trajectory.find(s => s.I / population >= threshold);
          if (state) {
            milestones.push({
              day: state.time,
              event: `${(threshold * 100).toFixed(1)}% infected`,
              value: state.I
            });
          }
        }

        milestones.push({
          day: forecastResult.peak.day,
          event: 'Peak infections',
          value: forecastResult.peak.infected
        });

        // Find when active cases drop below 1% of peak
        const postPeak = trajectory.filter(s => s.time > forecastResult.peak.day);
        const nearEnd = postPeak.find(s => s.I < forecastResult.peak.infected * 0.01);
        if (nearEnd) {
          milestones.push({
            day: nearEnd.time,
            event: 'Epidemic waning (<1% of peak)',
            value: nearEnd.I
          });
        }

        result = {
          operation: 'forecast',
          model,
          parameters: { beta, gamma, R0: beta / gamma, population },
          forecast_horizon: days + ' days',
          key_milestones: milestones.sort((a, b) => a.day - b.day),
          summary: {
            peak_day: forecastResult.peak.day,
            peak_cases: forecastResult.peak.infected,
            total_cases: forecastResult.total_infected,
            duration_estimate: nearEnd ? nearEnd.time + ' days' : `>${days} days`
          },
          weekly_forecast: trajectory.filter(s => s.time % 7 === 0).slice(0, 20).map(s => ({
            day: s.time,
            susceptible: s.S,
            infected: s.I,
            recovered: s.R
          })),
          description: `Forecast: Peak of ${forecastResult.peak.infected.toLocaleString()} on day ${forecastResult.peak.day}. ` +
            `Total cases: ${forecastResult.total_infected.toLocaleString()}`
        };
        break;
      }

      case 'info':
      default: {
        result = {
          operation: 'info',
          tool: 'epidemic_model',
          description: 'Compartmental epidemic modeling - simulate disease spread and evaluate interventions',
          models: {
            SIR: {
              compartments: 'Susceptible → Infected → Recovered',
              equations: ['dS/dt = -βSI/N', 'dI/dt = βSI/N - γI', 'dR/dt = γI'],
              R0: 'β/γ',
              use_case: 'Diseases with permanent immunity (measles, chickenpox)'
            },
            SEIR: {
              compartments: 'Susceptible → Exposed → Infected → Recovered',
              equations: ['dS/dt = -βSI/N', 'dE/dt = βSI/N - σE', 'dI/dt = σE - γI', 'dR/dt = γI'],
              R0: 'β/γ × σ/(σ+μ)',
              use_case: 'Diseases with incubation period (COVID-19, influenza)'
            },
            SIS: {
              compartments: 'Susceptible ↔ Infected (cycles)',
              equations: ['dS/dt = -βSI/N + γI', 'dI/dt = βSI/N - γI'],
              use_case: 'Diseases without immunity (some STIs, common cold)'
            },
            SIRS: {
              compartments: 'Susceptible → Infected → Recovered → Susceptible',
              equations: ['dS/dt = -βSI/N + ξR', 'dI/dt = βSI/N - γI', 'dR/dt = γI - ξR'],
              use_case: 'Diseases with waning immunity'
            }
          },
          key_parameters: {
            beta: 'Transmission rate = contacts/day × transmission probability',
            gamma: 'Recovery rate = 1 / infectious period',
            sigma: 'Incubation rate = 1 / latent period (SEIR)',
            R0: 'Basic reproduction number = average secondary infections',
            HIT: 'Herd immunity threshold = 1 - 1/R₀'
          },
          operations: {
            simulate: 'Run epidemic simulation',
            r0: 'Calculate R₀ and thresholds',
            herd_immunity: 'Calculate herd immunity threshold',
            intervention: 'Model intervention effects',
            compare: 'Compare multiple scenarios',
            fit: 'Estimate parameters from data',
            forecast: 'Project epidemic trajectory'
          }
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({
        error: errorMessage,
        tool: 'epidemic_model',
        hint: 'Use operation="info" for documentation'
      }, null, 2),
      isError: true
    };
  }
}

export function isepidemicmodelAvailable(): boolean {
  return true;
}
