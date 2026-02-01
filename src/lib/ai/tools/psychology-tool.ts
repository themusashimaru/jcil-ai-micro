/**
 * PSYCHOLOGY TOOL
 *
 * Psychological calculations: statistical tests for research,
 * effect sizes, reliability, and cognitive metrics.
 *
 * Part of TIER SOCIAL SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// EFFECT SIZES
// ============================================================================

function cohensD(mean1: number, mean2: number, sd1: number, sd2: number, n1: number, n2: number): number {
  // Pooled standard deviation
  const sp = Math.sqrt(((n1 - 1) * sd1 * sd1 + (n2 - 1) * sd2 * sd2) / (n1 + n2 - 2));
  return (mean1 - mean2) / sp;
}

function hedgesG(d: number, n1: number, n2: number): number {
  // Corrected Cohen's d for small samples
  const df = n1 + n2 - 2;
  const correction = 1 - 3 / (4 * df - 1);
  return d * correction;
}

function interpretEffectSize(d: number): string {
  const absD = Math.abs(d);
  if (absD < 0.2) return 'Negligible';
  if (absD < 0.5) return 'Small';
  if (absD < 0.8) return 'Medium';
  return 'Large';
}

function pearsonsR(x: number[], y: number[]): number {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
  const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return num / den;
}

function rSquared(r: number): number {
  return r * r;
}

// ============================================================================
// RELIABILITY
// ============================================================================

function cronbachAlpha(itemVariances: number[], totalVariance: number, k: number): number {
  // α = (k / (k-1)) × (1 - Σσi² / σt²)
  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0);
  return (k / (k - 1)) * (1 - sumItemVar / totalVariance);
}

function spearmanBrown(r: number, n: number): number {
  // Predicted reliability after changing test length by factor n
  return (n * r) / (1 + (n - 1) * r);
}

function standardErrorMeasurement(sd: number, reliability: number): number {
  // SEM = SD × √(1 - r)
  return sd * Math.sqrt(1 - reliability);
}

// ============================================================================
// T-TEST CALCULATIONS
// ============================================================================

function independentTTest(mean1: number, mean2: number, sd1: number, sd2: number, n1: number, n2: number): {
  t: number;
  df: number;
  se: number;
} {
  const se = Math.sqrt((sd1 * sd1 / n1) + (sd2 * sd2 / n2));
  const t = (mean1 - mean2) / se;
  // Welch-Satterthwaite df
  const df = Math.pow(sd1 * sd1 / n1 + sd2 * sd2 / n2, 2) /
             (Math.pow(sd1 * sd1 / n1, 2) / (n1 - 1) + Math.pow(sd2 * sd2 / n2, 2) / (n2 - 1));

  return { t, df: Math.floor(df), se };
}

function pairedTTest(diffs: number[]): { t: number; df: number; meanDiff: number; sdDiff: number } {
  const n = diffs.length;
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
  const sdDiff = Math.sqrt(diffs.reduce((acc, d) => acc + Math.pow(d - meanDiff, 2), 0) / (n - 1));
  const se = sdDiff / Math.sqrt(n);
  const t = meanDiff / se;

  return { t, df: n - 1, meanDiff, sdDiff };
}

// ============================================================================
// SAMPLE SIZE / POWER
// ============================================================================

function sampleSizeForMeans(d: number, alpha: number, power: number): number {
  // Approximation using normal distribution
  // z values for common alpha and power
  const zAlpha = alpha === 0.05 ? 1.96 : alpha === 0.01 ? 2.576 : 1.645;
  const zPower = power === 0.8 ? 0.84 : power === 0.9 ? 1.28 : 1.04;

  const n = 2 * Math.pow((zAlpha + zPower) / d, 2);
  return Math.ceil(n);
}

function powerAnalysis(n: number, d: number, alpha: number): number {
  // Approximation
  const se = Math.sqrt(2 / n);
  const ncp = d / se;
  const zAlpha = alpha === 0.05 ? 1.96 : 2.576;
  const zBeta = ncp - zAlpha;

  // Approximate power from z
  return 0.5 * (1 + erf(zBeta / Math.sqrt(2)));
}

function erf(x: number): number {
  // Approximation of error function
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

// ============================================================================
// STANDARDIZED SCORES
// ============================================================================

function zScore(x: number, mean: number, sd: number): number {
  return (x - mean) / sd;
}

function tScore(z: number): number {
  return z * 10 + 50;
}

function percentileFromZ(z: number): number {
  // Approximation using cumulative normal
  return 50 * (1 + erf(z / Math.sqrt(2)));
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const psychologyTool: UnifiedTool = {
  name: 'psychology',
  description: `Psychology research and statistics calculations.

Operations:
- effect_size: Cohen's d, Hedges' g, correlation
- reliability: Cronbach's alpha, SEM
- t_test: Independent and paired t-tests
- power: Sample size and power analysis
- scores: Z-scores, T-scores, percentiles`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['effect_size', 'reliability', 't_test', 'power', 'scores'],
        description: 'Psychology operation',
      },
      mean1: { type: 'number', description: 'Group 1 mean' },
      mean2: { type: 'number', description: 'Group 2 mean' },
      sd1: { type: 'number', description: 'Group 1 standard deviation' },
      sd2: { type: 'number', description: 'Group 2 standard deviation' },
      n1: { type: 'number', description: 'Group 1 sample size' },
      n2: { type: 'number', description: 'Group 2 sample size' },
      r: { type: 'number', description: 'Correlation coefficient' },
      k: { type: 'number', description: 'Number of items' },
      item_variances: { type: 'array', items: { type: 'number' }, description: 'Item variances' },
      total_variance: { type: 'number', description: 'Total scale variance' },
      effect_size_d: { type: 'number', description: 'Expected effect size (d)' },
      alpha: { type: 'number', description: 'Alpha level (e.g., 0.05)' },
      power: { type: 'number', description: 'Desired power (e.g., 0.8)' },
      raw_score: { type: 'number', description: 'Raw score' },
      mean: { type: 'number', description: 'Population mean' },
      sd: { type: 'number', description: 'Standard deviation' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePsychology(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'effect_size': {
        const { mean1 = 75, mean2 = 70, sd1 = 10, sd2 = 12, n1 = 30, n2 = 30, r } = args;

        if (r !== undefined) {
          const r2 = rSquared(r);
          result = {
            operation: 'effect_size',
            mode: 'correlation',
            pearsons_r: r,
            r_squared: Math.round(r2 * 1000) / 1000,
            variance_explained_percent: Math.round(r2 * 100),
            interpretation: Math.abs(r) < 0.3 ? 'Weak' : Math.abs(r) < 0.5 ? 'Moderate' : 'Strong',
          };
        } else {
          const d = cohensD(mean1, mean2, sd1, sd2, n1, n2);
          const g = hedgesG(d, n1, n2);

          result = {
            operation: 'effect_size',
            mode: 'means_comparison',
            group1: { mean: mean1, sd: sd1, n: n1 },
            group2: { mean: mean2, sd: sd2, n: n2 },
            cohens_d: Math.round(d * 1000) / 1000,
            hedges_g: Math.round(g * 1000) / 1000,
            interpretation: interpretEffectSize(d),
            guidelines: {
              small: '0.2',
              medium: '0.5',
              large: '0.8',
            },
          };
        }
        break;
      }

      case 'reliability': {
        const { item_variances = [1.2, 1.5, 1.1, 1.3, 1.4], total_variance = 15, k, r = 0.7, sd = 10 } = args;
        const numItems = k || item_variances.length;

        const alpha = cronbachAlpha(item_variances, total_variance, numItems);
        const sem = standardErrorMeasurement(sd, r);
        const reliabilityDouble = spearmanBrown(r, 2);

        result = {
          operation: 'reliability',
          cronbachs_alpha: Math.round(alpha * 1000) / 1000,
          alpha_interpretation: alpha >= 0.9 ? 'Excellent' : alpha >= 0.8 ? 'Good' : alpha >= 0.7 ? 'Acceptable' : alpha >= 0.6 ? 'Questionable' : 'Poor',
          number_of_items: numItems,
          reliability_coefficient: r,
          standard_error_measurement: Math.round(sem * 100) / 100,
          confidence_interval_95: `±${Math.round(1.96 * sem * 100) / 100}`,
          spearman_brown_doubled: Math.round(reliabilityDouble * 1000) / 1000,
        };
        break;
      }

      case 't_test': {
        const { mean1 = 75, mean2 = 70, sd1 = 10, sd2 = 12, n1 = 30, n2 = 30 } = args;
        const tTest = independentTTest(mean1, mean2, sd1, sd2, n1, n2);
        const d = cohensD(mean1, mean2, sd1, sd2, n1, n2);

        result = {
          operation: 't_test',
          type: 'independent_samples',
          group1: { mean: mean1, sd: sd1, n: n1 },
          group2: { mean: mean2, sd: sd2, n: n2 },
          mean_difference: mean1 - mean2,
          standard_error: Math.round(tTest.se * 1000) / 1000,
          t_statistic: Math.round(tTest.t * 1000) / 1000,
          degrees_of_freedom: tTest.df,
          effect_size_d: Math.round(d * 1000) / 1000,
          note: 'Use appropriate t-distribution table or software for p-value',
          critical_t_05_two_tailed: 2.0, // Approximate
        };
        break;
      }

      case 'power': {
        const { effect_size_d = 0.5, alpha = 0.05, power = 0.8, n1 } = args;

        if (n1 !== undefined) {
          // Calculate power given n
          const computedPower = powerAnalysis(n1, effect_size_d, alpha);

          result = {
            operation: 'power',
            mode: 'compute_power',
            sample_size_per_group: n1,
            effect_size_d: effect_size_d,
            alpha: alpha,
            estimated_power: Math.round(computedPower * 1000) / 1000,
            adequate_power: computedPower >= 0.8,
          };
        } else {
          // Calculate required n
          const n = sampleSizeForMeans(effect_size_d, alpha, power);

          result = {
            operation: 'power',
            mode: 'compute_sample_size',
            effect_size_d: effect_size_d,
            alpha: alpha,
            desired_power: power,
            required_n_per_group: n,
            total_n: n * 2,
            recommendation: 'Add 10-20% for attrition',
          };
        }
        break;
      }

      case 'scores': {
        const { raw_score = 85, mean = 100, sd = 15 } = args;
        const z = zScore(raw_score, mean, sd);
        const t = tScore(z);
        const percentile = percentileFromZ(z);

        result = {
          operation: 'scores',
          raw_score: raw_score,
          population_mean: mean,
          population_sd: sd,
          z_score: Math.round(z * 100) / 100,
          t_score: Math.round(t),
          percentile_rank: Math.round(percentile),
          interpretation: percentile >= 98 ? 'Very Superior' :
                          percentile >= 91 ? 'Superior' :
                          percentile >= 75 ? 'High Average' :
                          percentile >= 25 ? 'Average' :
                          percentile >= 9 ? 'Low Average' :
                          percentile >= 2 ? 'Borderline' : 'Extremely Low',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Psychology Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isPsychologyAvailable(): boolean { return true; }
