/**
 * MONTE CARLO SIMULATION TOOL
 *
 * Stochastic simulation and risk analysis.
 * Essential for finance, physics, and engineering.
 *
 * Features:
 * - Random sampling from distributions
 * - Monte Carlo integration
 * - Risk analysis (VaR, CVaR)
 * - Option pricing (Black-Scholes Monte Carlo)
 * - Path-dependent simulations
 * - Bootstrap resampling
 * - Sensitivity analysis
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// RANDOM NUMBER GENERATION
// ============================================================================

// Box-Muller transform for normal distribution
function normalRandom(mean: number = 0, std: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// Uniform distribution
function uniformRandom(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ============================================================================
// MONTE CARLO METHODS
// ============================================================================

// Monte Carlo integration
function monteCarloIntegrate(
  f: (x: number) => number,
  a: number,
  b: number,
  n: number
): { estimate: number; standardError: number } {
  let sum = 0;
  let sumSquares = 0;

  for (let i = 0; i < n; i++) {
    const x = uniformRandom(a, b);
    const fx = f(x);
    sum += fx;
    sumSquares += fx * fx;
  }

  const mean = sum / n;
  const variance = sumSquares / n - mean * mean;
  const estimate = (b - a) * mean;
  const standardError = (b - a) * Math.sqrt(variance / n);

  return { estimate, standardError };
}

// Multi-dimensional Monte Carlo integration
function monteCarloIntegrateND(
  f: (x: number[]) => number,
  bounds: [number, number][],
  n: number
): { estimate: number; standardError: number } {
  let sum = 0;
  let sumSquares = 0;
  let volume = 1;

  for (const [a, b] of bounds) {
    volume *= b - a;
  }

  for (let i = 0; i < n; i++) {
    const x = bounds.map(([a, b]) => uniformRandom(a, b));
    const fx = f(x);
    sum += fx;
    sumSquares += fx * fx;
  }

  const mean = sum / n;
  const variance = sumSquares / n - mean * mean;
  const estimate = volume * mean;
  const standardError = volume * Math.sqrt(variance / n);

  return { estimate, standardError };
}

// Geometric Brownian Motion for stock prices
function geometricBrownianMotion(
  S0: number,
  mu: number,
  sigma: number,
  T: number,
  steps: number
): number[] {
  const dt = T / steps;
  const path = [S0];

  for (let i = 1; i <= steps; i++) {
    const dW = normalRandom() * Math.sqrt(dt);
    const S_prev = path[i - 1];
    const S_next = S_prev * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * dW);
    path.push(S_next);
  }

  return path;
}

// Black-Scholes Monte Carlo option pricing
function monteCarloOptionPrice(
  S0: number,
  K: number,
  r: number,
  sigma: number,
  T: number,
  n: number,
  optionType: 'call' | 'put'
): { price: number; standardError: number; paths: number[][] } {
  const paths: number[][] = [];
  const payoffs: number[] = [];

  for (let i = 0; i < n; i++) {
    const path = geometricBrownianMotion(S0, r, sigma, T, 100);
    if (i < 10) paths.push(path); // Keep first 10 paths for visualization

    const ST = path[path.length - 1];
    const payoff = optionType === 'call' ? Math.max(ST - K, 0) : Math.max(K - ST, 0);
    payoffs.push(payoff);
  }

  const mean = payoffs.reduce((a, b) => a + b, 0) / n;
  const variance = payoffs.reduce((sum, p) => sum + (p - mean) ** 2, 0) / (n - 1);
  const standardError = Math.sqrt(variance / n);

  // Discount to present value
  const price = Math.exp(-r * T) * mean;
  const priceError = Math.exp(-r * T) * standardError;

  return { price, standardError: priceError, paths };
}

// Value at Risk (VaR) calculation
function calculateVaR(
  returns: number[],
  confidence: number
): { VaR: number; CVaR: number; statistics: Record<string, number> } {
  const sorted = [...returns].sort((a, b) => a - b);
  const n = sorted.length;
  const index = Math.floor((1 - confidence) * n);

  const VaR = -sorted[index]; // Negative of percentile (loss)

  // Conditional VaR (Expected Shortfall)
  const tailLosses = sorted.slice(0, index + 1);
  const CVaR = -tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length;

  // Statistics
  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const skewness = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 3), 0) / n;
  const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 4), 0) / n - 3;

  return {
    VaR,
    CVaR,
    statistics: {
      mean,
      std,
      skewness,
      kurtosis,
      min: sorted[0],
      max: sorted[n - 1],
    },
  };
}

// Bootstrap resampling
function bootstrap(
  data: number[],
  statistic: (sample: number[]) => number,
  nBootstrap: number
): { estimate: number; standardError: number; confidenceInterval: [number, number] } {
  const bootstrapStats: number[] = [];
  const n = data.length;

  for (let i = 0; i < nBootstrap; i++) {
    const sample: number[] = [];
    for (let j = 0; j < n; j++) {
      sample.push(data[Math.floor(Math.random() * n)]);
    }
    bootstrapStats.push(statistic(sample));
  }

  bootstrapStats.sort((a, b) => a - b);

  const mean = bootstrapStats.reduce((a, b) => a + b, 0) / nBootstrap;
  const variance = bootstrapStats.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (nBootstrap - 1);

  // 95% confidence interval
  const lower = bootstrapStats[Math.floor(0.025 * nBootstrap)];
  const upper = bootstrapStats[Math.floor(0.975 * nBootstrap)];

  return {
    estimate: mean,
    standardError: Math.sqrt(variance),
    confidenceInterval: [lower, upper],
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const monteCarloTool: UnifiedTool = {
  name: 'monte_carlo_sim',
  description: `Monte Carlo simulation for risk analysis, option pricing, and numerical integration.

Available operations:
- integrate: Monte Carlo integration of function
- integrate_nd: Multi-dimensional integration
- option_price: Black-Scholes Monte Carlo option pricing
- var_analysis: Value at Risk and Expected Shortfall
- simulate_gbm: Geometric Brownian Motion paths
- bootstrap: Bootstrap resampling for statistics
- sensitivity: Sensitivity analysis

Applications: Finance (options, VaR), Physics (particle simulation), Engineering (reliability)`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'integrate',
          'integrate_nd',
          'option_price',
          'var_analysis',
          'simulate_gbm',
          'bootstrap',
          'sensitivity',
        ],
        description: 'Monte Carlo operation',
      },
      function_str: {
        type: 'string',
        description: 'Function as string (e.g., "x*x" or "Math.sin(x)")',
      },
      a: {
        type: 'number',
        description: 'Lower bound for integration',
      },
      b: {
        type: 'number',
        description: 'Upper bound for integration',
      },
      bounds: {
        type: 'array',
        description: 'Bounds for multi-dim integration: [[a1,b1], [a2,b2], ...]',
      },
      n: {
        type: 'number',
        description: 'Number of samples/simulations (default: 10000)',
      },
      S0: {
        type: 'number',
        description: 'Initial stock price',
      },
      K: {
        type: 'number',
        description: 'Strike price',
      },
      r: {
        type: 'number',
        description: 'Risk-free rate',
      },
      sigma: {
        type: 'number',
        description: 'Volatility',
      },
      T: {
        type: 'number',
        description: 'Time to maturity (years)',
      },
      mu: {
        type: 'number',
        description: 'Drift rate for GBM',
      },
      option_type: {
        type: 'string',
        enum: ['call', 'put'],
        description: 'Option type',
      },
      returns: {
        type: 'array',
        items: { type: 'number' },
        description: 'Return series for VaR analysis',
      },
      confidence: {
        type: 'number',
        description: 'Confidence level for VaR (e.g., 0.95)',
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Data for bootstrap',
      },
      statistic: {
        type: 'string',
        enum: ['mean', 'median', 'std', 'variance'],
        description: 'Statistic for bootstrap',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMonteCarloAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeMonteCarlo(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    function_str?: string;
    a?: number;
    b?: number;
    bounds?: [number, number][];
    n?: number;
    S0?: number;
    K?: number;
    r?: number;
    sigma?: number;
    T?: number;
    mu?: number;
    option_type?: 'call' | 'put';
    returns?: number[];
    confidence?: number;
    data?: number[];
    statistic?: string;
  };

  const {
    operation,
    function_str,
    a = 0,
    b = 1,
    bounds,
    n = 10000,
    S0 = 100,
    K = 100,
    r = 0.05,
    sigma = 0.2,
    T = 1,
    mu = 0.1,
    option_type = 'call',
    returns,
    confidence = 0.95,
    data,
    statistic = 'mean',
  } = args;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'integrate': {
        if (!function_str) throw new Error('function_str is required');

        // Parse function safely
        // eslint-disable-next-line no-new-func
        const f = new Function('x', 'Math', `return ${function_str};`) as (
          x: number,
          math: typeof Math
        ) => number;
        const testF = (x: number) => f(x, Math);

        const integration = monteCarloIntegrate(testF, a, b, n);

        result.function = function_str;
        result.bounds = [a, b];
        result.n_samples = n;
        result.estimate = integration.estimate;
        result.standard_error = integration.standardError;
        result.confidence_interval_95 = [
          integration.estimate - 1.96 * integration.standardError,
          integration.estimate + 1.96 * integration.standardError,
        ];
        break;
      }

      case 'integrate_nd': {
        if (!function_str || !bounds) {
          throw new Error('function_str and bounds are required');
        }

        const dims = bounds.length;
        // eslint-disable-next-line no-new-func
        const f = new Function('x', 'Math', `return ${function_str};`) as (
          x: number[],
          math: typeof Math
        ) => number;
        const testF = (x: number[]) => f(x, Math);

        const integration = monteCarloIntegrateND(testF, bounds, n);

        result.function = function_str;
        result.dimensions = dims;
        result.bounds = bounds;
        result.n_samples = n;
        result.estimate = integration.estimate;
        result.standard_error = integration.standardError;
        break;
      }

      case 'option_price': {
        const pricing = monteCarloOptionPrice(S0, K, r, sigma, T, n, option_type);

        // Black-Scholes analytical for comparison
        const d1 = (Math.log(S0 / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        const N = (x: number) => 0.5 * (1 + erf(x / Math.sqrt(2)));
        const analyticalPrice =
          option_type === 'call'
            ? S0 * N(d1) - K * Math.exp(-r * T) * N(d2)
            : K * Math.exp(-r * T) * N(-d2) - S0 * N(-d1);

        result.option_type = option_type;
        result.parameters = { S0, K, r, sigma, T };
        result.n_simulations = n;
        result.monte_carlo_price = pricing.price;
        result.standard_error = pricing.standardError;
        result.analytical_price = analyticalPrice;
        result.price_difference = Math.abs(pricing.price - analyticalPrice);
        result.sample_paths = pricing.paths
          .slice(0, 3)
          .map((p) => p.filter((_, i) => i % 10 === 0));
        break;
      }

      case 'var_analysis': {
        if (!returns || returns.length === 0) {
          // Generate sample returns if not provided
          const sampleReturns: number[] = [];
          for (let i = 0; i < 1000; i++) {
            sampleReturns.push(normalRandom(0.001, 0.02));
          }
          args.returns = sampleReturns;
        }

        const varResult = calculateVaR(args.returns!, confidence);

        result.confidence_level = confidence;
        result.n_observations = args.returns!.length;
        result.value_at_risk = varResult.VaR;
        result.conditional_var = varResult.CVaR;
        result.statistics = varResult.statistics;
        result.interpretation = {
          VaR: `With ${confidence * 100}% confidence, losses will not exceed ${(varResult.VaR * 100).toFixed(2)}%`,
          CVaR: `Expected loss when VaR is exceeded: ${(varResult.CVaR * 100).toFixed(2)}%`,
        };
        break;
      }

      case 'simulate_gbm': {
        const paths: number[][] = [];
        const finalValues: number[] = [];

        for (let i = 0; i < Math.min(n, 1000); i++) {
          const path = geometricBrownianMotion(S0, mu, sigma, T, 100);
          if (i < 10) paths.push(path.filter((_, j) => j % 10 === 0));
          finalValues.push(path[path.length - 1]);
        }

        const meanFinal = finalValues.reduce((a, b) => a + b, 0) / finalValues.length;
        const stdFinal = Math.sqrt(
          finalValues.reduce((sum, v) => sum + (v - meanFinal) ** 2, 0) / finalValues.length
        );

        result.parameters = { S0, mu, sigma, T };
        result.n_paths = Math.min(n, 1000);
        result.sample_paths = paths;
        result.final_value_stats = {
          mean: meanFinal,
          std: stdFinal,
          min: Math.min(...finalValues),
          max: Math.max(...finalValues),
          expected_analytical: S0 * Math.exp(mu * T),
        };
        break;
      }

      case 'bootstrap': {
        if (!data || data.length === 0) {
          throw new Error('data array is required');
        }

        const statFunctions: Record<string, (sample: number[]) => number> = {
          mean: (s) => s.reduce((a, b) => a + b, 0) / s.length,
          median: (s) => {
            const sorted = [...s].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length / 2)];
          },
          std: (s) => {
            const mean = s.reduce((a, b) => a + b, 0) / s.length;
            return Math.sqrt(s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / s.length);
          },
          variance: (s) => {
            const mean = s.reduce((a, b) => a + b, 0) / s.length;
            return s.reduce((sum, v) => sum + (v - mean) ** 2, 0) / s.length;
          },
        };

        const statFunc = statFunctions[statistic] || statFunctions.mean;
        const bootResult = bootstrap(data, statFunc, Math.min(n, 10000));

        result.statistic = statistic;
        result.n_bootstrap = Math.min(n, 10000);
        result.original_statistic = statFunc(data);
        result.bootstrap_estimate = bootResult.estimate;
        result.standard_error = bootResult.standardError;
        result.confidence_interval_95 = bootResult.confidenceInterval;
        break;
      }

      case 'sensitivity': {
        // Sensitivity analysis on option pricing
        const basePrice = monteCarloOptionPrice(S0, K, r, sigma, T, 5000, option_type).price;

        const sensitivities = {
          delta:
            (monteCarloOptionPrice(S0 * 1.01, K, r, sigma, T, 5000, option_type).price -
              basePrice) /
            (S0 * 0.01),
          gamma:
            (monteCarloOptionPrice(S0 * 1.01, K, r, sigma, T, 5000, option_type).price -
              2 * basePrice +
              monteCarloOptionPrice(S0 * 0.99, K, r, sigma, T, 5000, option_type).price) /
            (S0 * 0.01) ** 2,
          vega:
            (monteCarloOptionPrice(S0, K, r, sigma + 0.01, T, 5000, option_type).price -
              basePrice) /
            0.01,
          theta:
            -(
              monteCarloOptionPrice(S0, K, r, sigma, T - 1 / 365, 5000, option_type).price -
              basePrice
            ) * 365,
          rho:
            (monteCarloOptionPrice(S0, K, r + 0.01, sigma, T, 5000, option_type).price -
              basePrice) /
            0.01,
        };

        result.base_price = basePrice;
        result.parameters = { S0, K, r, sigma, T, option_type };
        result.greeks = sensitivities;
        result.interpretation = {
          delta: 'Price change per $1 change in underlying',
          gamma: 'Delta change per $1 change in underlying',
          vega: 'Price change per 1% change in volatility',
          theta: 'Price decay per day',
          rho: 'Price change per 1% change in interest rate',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}

// Error function approximation
function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}
