/**
 * VALUE-AT-RISK TOOL
 * Value at Risk (VaR) calculation for portfolio risk management
 *
 * Implements multiple VaR methodologies: Historical, Parametric (Variance-Covariance),
 * Monte Carlo simulation, and related risk measures like CVaR (Expected Shortfall).
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface Asset {
  symbol: string;
  weight: number;
  returns?: number[];
  expectedReturn?: number;
  volatility?: number;
}

interface Portfolio {
  assets: Asset[];
  value: number;
  historicalReturns?: number[];
  correlationMatrix?: number[][];
}

interface VaRResult {
  method: string;
  confidence: number;
  horizon: number;
  var: number;
  varPercent: number;
  cvar?: number; // Conditional VaR / Expected Shortfall
  cvarPercent?: number;
  details: Record<string, unknown>;
}

interface StressTestResult {
  scenario: string;
  portfolioLoss: number;
  lossPercent: number;
  assetImpacts: { asset: string; loss: number }[];
}

interface BacktestResult {
  violations: number;
  expectedViolations: number;
  kupiecPValue: number;
  christoffersenPValue: number;
  passed: boolean;
  details: Record<string, unknown>;
}

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

// Standard normal CDF approximation (Abramowitz and Stegun)
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// Inverse normal CDF approximation (Beasley-Springer-Moro)
function normalInverseCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
}

// Calculate mean
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Calculate standard deviation
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Calculate percentile
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Calculate covariance
export function covariance(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 2) return 0;
  const mx = mean(x);
  const my = mean(y);
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    sum += (x[i] - mx) * (y[i] - my);
  }
  return sum / (x.length - 1);
}

// Calculate correlation
export function correlation(x: number[], y: number[]): number {
  const cov = covariance(x, y);
  const sx = stdDev(x);
  const sy = stdDev(y);
  if (sx === 0 || sy === 0) return 0;
  return cov / (sx * sy);
}

// Cholesky decomposition for correlation matrix
export function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, matrix[i][i] - sum));
      } else {
        L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }

  return L;
}

// Generate standard normal random
function randomNormal(): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ============================================================================
// VAR CALCULATION METHODS
// ============================================================================

// Historical VaR - uses actual historical returns
function historicalVaR(portfolio: Portfolio, confidence: number, horizon: number = 1): VaRResult {
  const returns = portfolio.historicalReturns || generateSampleReturns(portfolio);
  const adjustedReturns = returns.map((r) => r * Math.sqrt(horizon));

  // Sort returns (losses are negative)
  const sorted = [...adjustedReturns].sort((a, b) => a - b);

  // VaR is the loss at the (1 - confidence) percentile
  const varPercentile = (1 - confidence) * 100;
  const varReturn = percentile(sorted, varPercentile);
  const varAmount = -varReturn * portfolio.value;

  // CVaR (Expected Shortfall) - average of losses beyond VaR
  const cutoffIndex = Math.floor((1 - confidence) * sorted.length);
  const tailReturns = sorted.slice(0, cutoffIndex);
  const cvarReturn = tailReturns.length > 0 ? mean(tailReturns) : varReturn;
  const cvarAmount = -cvarReturn * portfolio.value;

  return {
    method: 'historical',
    confidence,
    horizon,
    var: Math.max(0, varAmount),
    varPercent: Math.max(0, -varReturn * 100),
    cvar: Math.max(0, cvarAmount),
    cvarPercent: Math.max(0, -cvarReturn * 100),
    details: {
      observationsUsed: returns.length,
      worstReturn: sorted[0],
      bestReturn: sorted[sorted.length - 1],
      meanReturn: mean(returns),
      stdDev: stdDev(returns),
      description: 'Historical simulation using actual past returns',
    },
  };
}

// Parametric (Variance-Covariance) VaR
function parametricVaR(portfolio: Portfolio, confidence: number, horizon: number = 1): VaRResult {
  // Calculate portfolio expected return and volatility
  const { portfolioReturn, portfolioVolatility } = calculatePortfolioStats(portfolio);

  // Scale for holding period
  const scaledVolatility = portfolioVolatility * Math.sqrt(horizon);
  const scaledReturn = portfolioReturn * horizon;

  // Z-score for confidence level
  const zScore = normalInverseCDF(1 - confidence);

  // VaR = -μ + σ * z (for loss, not return)
  const varReturn = -(scaledReturn + zScore * scaledVolatility);
  const varAmount = varReturn * portfolio.value;

  // CVaR for normal distribution
  const phi = Math.exp((-zScore * zScore) / 2) / Math.sqrt(2 * Math.PI);
  const cvarReturn = -scaledReturn + (scaledVolatility * phi) / (1 - confidence);
  const cvarAmount = cvarReturn * portfolio.value;

  return {
    method: 'parametric',
    confidence,
    horizon,
    var: Math.max(0, varAmount),
    varPercent: Math.max(0, varReturn * 100),
    cvar: Math.max(0, cvarAmount),
    cvarPercent: Math.max(0, cvarReturn * 100),
    details: {
      zScore,
      portfolioReturn: portfolioReturn * 100,
      portfolioVolatility: portfolioVolatility * 100,
      scaledVolatility: scaledVolatility * 100,
      assumptions: 'Normal distribution of returns',
      description: 'Variance-covariance method assuming normality',
    },
  };
}

// Monte Carlo VaR
function monteCarloVaR(
  portfolio: Portfolio,
  confidence: number,
  horizon: number = 1,
  simulations: number = 10000
): VaRResult {
  const { portfolioReturn, portfolioVolatility } = calculatePortfolioStats(portfolio);

  // Generate simulated returns
  const simulatedReturns: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Geometric Brownian Motion
    const drift = (portfolioReturn - 0.5 * portfolioVolatility * portfolioVolatility) * horizon;
    const diffusion = portfolioVolatility * Math.sqrt(horizon) * randomNormal();
    const simReturn = Math.exp(drift + diffusion) - 1;
    simulatedReturns.push(simReturn);
  }

  // Sort returns
  const sorted = [...simulatedReturns].sort((a, b) => a - b);

  // Calculate VaR
  const varPercentile = (1 - confidence) * 100;
  const varReturn = percentile(sorted, varPercentile);
  const varAmount = -varReturn * portfolio.value;

  // Calculate CVaR
  const cutoffIndex = Math.floor((1 - confidence) * sorted.length);
  const tailReturns = sorted.slice(0, cutoffIndex);
  const cvarReturn = tailReturns.length > 0 ? mean(tailReturns) : varReturn;
  const cvarAmount = -cvarReturn * portfolio.value;

  return {
    method: 'monte_carlo',
    confidence,
    horizon,
    var: Math.max(0, varAmount),
    varPercent: Math.max(0, -varReturn * 100),
    cvar: Math.max(0, cvarAmount),
    cvarPercent: Math.max(0, -cvarReturn * 100),
    details: {
      simulations,
      meanSimulatedReturn: mean(simulatedReturns) * 100,
      stdDevSimulated: stdDev(simulatedReturns) * 100,
      percentile5: percentile(sorted, 5) * 100,
      percentile95: percentile(sorted, 95) * 100,
      model: 'Geometric Brownian Motion',
      description: 'Monte Carlo simulation with GBM model',
    },
  };
}

// Cornish-Fisher VaR (adjusts for skewness and kurtosis)
function cornishFisherVaR(
  portfolio: Portfolio,
  confidence: number,
  horizon: number = 1
): VaRResult {
  const returns = portfolio.historicalReturns || generateSampleReturns(portfolio);

  const mu = mean(returns) * horizon;
  const sigma = stdDev(returns) * Math.sqrt(horizon);

  // Calculate skewness and excess kurtosis
  const m = mean(returns);
  const s = stdDev(returns);
  let skew = 0,
    kurt = 0;

  if (s > 0) {
    for (const r of returns) {
      const z = (r - m) / s;
      skew += z * z * z;
      kurt += z * z * z * z;
    }
    skew /= returns.length;
    kurt = kurt / returns.length - 3; // Excess kurtosis
  }

  // Cornish-Fisher expansion
  const z = normalInverseCDF(1 - confidence);
  const zCF =
    z +
    ((z * z - 1) * skew) / 6 +
    ((z * z * z - 3 * z) * kurt) / 24 -
    ((2 * z * z * z - 5 * z) * skew * skew) / 36;

  const varReturn = -(mu + zCF * sigma);
  const varAmount = varReturn * portfolio.value;

  return {
    method: 'cornish_fisher',
    confidence,
    horizon,
    var: Math.max(0, varAmount),
    varPercent: Math.max(0, varReturn * 100),
    details: {
      skewness: skew,
      excessKurtosis: kurt,
      normalZScore: z,
      adjustedZScore: zCF,
      description: 'Cornish-Fisher expansion adjusting for non-normality',
    },
  };
}

// Component VaR - contribution of each asset
function componentVaR(
  portfolio: Portfolio,
  confidence: number
): {
  totalVaR: number;
  componentVaRs: { asset: string; contribution: number; percent: number }[];
} {
  const { portfolioVolatility } = calculatePortfolioStats(portfolio);
  const zScore = normalInverseCDF(1 - confidence);
  const totalVaR = portfolioVolatility * Math.abs(zScore) * portfolio.value;

  // Marginal VaR for each asset
  const componentVaRs = portfolio.assets.map((asset) => {
    const assetVol = asset.volatility || 0.2;
    const weight = asset.weight;

    // Simplified: assume correlation with portfolio ≈ 1
    const marginalVaR = assetVol * Math.abs(zScore);
    const componentContribution = weight * marginalVaR * portfolio.value;

    return {
      asset: asset.symbol,
      contribution: componentContribution,
      percent: totalVaR > 0 ? (componentContribution / totalVaR) * 100 : 0,
    };
  });

  return { totalVaR, componentVaRs };
}

// Incremental VaR - impact of adding a position
function incrementalVaR(
  portfolio: Portfolio,
  newAsset: Asset,
  confidence: number
): {
  currentVaR: number;
  newVaR: number;
  incrementalVaR: number;
  percentChange: number;
} {
  const currentResult = parametricVaR(portfolio, confidence);

  // Add new asset
  const newPortfolio: Portfolio = {
    ...portfolio,
    assets: [...portfolio.assets, newAsset],
    value: portfolio.value,
  };

  // Renormalize weights
  const totalWeight = newPortfolio.assets.reduce((sum, a) => sum + a.weight, 0);
  newPortfolio.assets.forEach((a) => {
    a.weight /= totalWeight;
  });

  const newResult = parametricVaR(newPortfolio, confidence);

  return {
    currentVaR: currentResult.var,
    newVaR: newResult.var,
    incrementalVaR: newResult.var - currentResult.var,
    percentChange: ((newResult.var - currentResult.var) / currentResult.var) * 100,
  };
}

// ============================================================================
// STRESS TESTING
// ============================================================================

function stressTest(
  portfolio: Portfolio,
  scenarios: Record<string, Record<string, number>>
): StressTestResult[] {
  const results: StressTestResult[] = [];

  for (const [scenarioName, shocks] of Object.entries(scenarios)) {
    let totalLoss = 0;
    const assetImpacts: { asset: string; loss: number }[] = [];

    for (const asset of portfolio.assets) {
      const shock = shocks[asset.symbol] || shocks['market'] || 0;
      const assetValue = portfolio.value * asset.weight;
      const assetLoss = assetValue * shock;
      totalLoss += assetLoss;
      assetImpacts.push({ asset: asset.symbol, loss: assetLoss });
    }

    results.push({
      scenario: scenarioName,
      portfolioLoss: totalLoss,
      lossPercent: (totalLoss / portfolio.value) * 100,
      assetImpacts,
    });
  }

  return results;
}

function predefinedScenarios(): Record<string, Record<string, number>> {
  return {
    market_crash_2008: {
      market: -0.4,
      bonds: 0.05,
      gold: 0.2,
      real_estate: -0.3,
    },
    covid_march_2020: {
      market: -0.34,
      bonds: 0.03,
      gold: 0.08,
      oil: -0.6,
    },
    interest_rate_shock: {
      market: -0.1,
      bonds: -0.15,
      tech: -0.15,
      utilities: -0.08,
    },
    inflation_surge: {
      market: -0.05,
      bonds: -0.2,
      gold: 0.15,
      commodities: 0.25,
      tips: 0.05,
    },
    tech_bubble_burst: {
      tech: -0.5,
      market: -0.2,
      bonds: 0.1,
      value: -0.1,
    },
  };
}

// ============================================================================
// BACKTESTING
// ============================================================================

function backtestVaR(
  historicalReturns: number[],
  varEstimates: number[],
  confidence: number
): BacktestResult {
  const n = Math.min(historicalReturns.length, varEstimates.length);
  let violations = 0;
  const violationIndicators: number[] = [];

  for (let i = 0; i < n; i++) {
    const loss = -historicalReturns[i]; // Convert return to loss
    const exceeded = loss > varEstimates[i] ? 1 : 0;
    violationIndicators.push(exceeded);
    violations += exceeded;
  }

  const expectedViolations = n * (1 - confidence);
  const violationRate = violations / n;
  const expectedRate = 1 - confidence;

  // Kupiec POF test (proportion of failures)
  const kupiecLR =
    -2 *
    Math.log(
      (Math.pow(1 - expectedRate, n - violations) * Math.pow(expectedRate, violations)) /
        (Math.pow(1 - violationRate, n - violations) * Math.pow(violationRate, violations))
    );
  const kupiecPValue = 1 - chiSquaredCDF(kupiecLR, 1);

  // Christoffersen independence test (simplified)
  let n00 = 0,
    n01 = 0,
    n10 = 0,
    n11 = 0;
  for (let i = 1; i < violationIndicators.length; i++) {
    const prev = violationIndicators[i - 1];
    const curr = violationIndicators[i];
    if (prev === 0 && curr === 0) n00++;
    else if (prev === 0 && curr === 1) n01++;
    else if (prev === 1 && curr === 0) n10++;
    else n11++;
  }

  const pi0 = n00 + n01 > 0 ? n01 / (n00 + n01) : 0;
  const pi1 = n10 + n11 > 0 ? n11 / (n10 + n11) : 0;
  const pi = (n01 + n11) / (n00 + n01 + n10 + n11);

  let christoffersenLR = 0;
  if (pi > 0 && pi < 1 && pi0 > 0 && pi0 < 1 && pi1 > 0 && pi1 < 1) {
    christoffersenLR =
      -2 *
      Math.log(
        (Math.pow(1 - pi, n00 + n10) * Math.pow(pi, n01 + n11)) /
          (Math.pow(1 - pi0, n00) *
            Math.pow(pi0, n01) *
            Math.pow(1 - pi1, n10) *
            Math.pow(pi1, n11))
      );
  }
  const christoffersenPValue = 1 - chiSquaredCDF(christoffersenLR, 1);

  // Pass if both tests have p-value > 0.05
  const passed = kupiecPValue > 0.05 && christoffersenPValue > 0.05;

  return {
    violations,
    expectedViolations,
    kupiecPValue,
    christoffersenPValue,
    passed,
    details: {
      violationRate: violationRate * 100,
      expectedRate: expectedRate * 100,
      excessViolations: violations - expectedViolations,
      kupiecStatistic: kupiecLR,
      christoffersenStatistic: christoffersenLR,
    },
  };
}

// Chi-squared CDF approximation
function chiSquaredCDF(x: number, k: number): number {
  if (x < 0) return 0;
  // Using incomplete gamma function approximation
  return gammainc(k / 2, x / 2);
}

function gammainc(a: number, x: number): number {
  // Regularized incomplete gamma function approximation
  if (x < 0) return 0;
  if (x === 0) return 0;

  // Series expansion for small x
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - Math.log(gamma(a)));
  }

  // Continued fraction for large x
  return 1 - gammainc(a, x);
}

function gamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }

  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculatePortfolioStats(portfolio: Portfolio): {
  portfolioReturn: number;
  portfolioVolatility: number;
} {
  let portfolioReturn = 0;
  let portfolioVariance = 0;

  const n = portfolio.assets.length;

  // Expected return
  for (const asset of portfolio.assets) {
    portfolioReturn += asset.weight * (asset.expectedReturn || 0.08); // Default 8%
  }

  // Portfolio variance (using correlation if available)
  if (portfolio.correlationMatrix && portfolio.correlationMatrix.length === n) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const wi = portfolio.assets[i].weight;
        const wj = portfolio.assets[j].weight;
        const sigmaI = portfolio.assets[i].volatility || 0.2;
        const sigmaJ = portfolio.assets[j].volatility || 0.2;
        const rho = portfolio.correlationMatrix[i][j];
        portfolioVariance += wi * wj * sigmaI * sigmaJ * rho;
      }
    }
  } else {
    // Simple weighted average of variances (assumes independence)
    for (const asset of portfolio.assets) {
      const vol = asset.volatility || 0.2;
      portfolioVariance += Math.pow(asset.weight * vol, 2);
    }
    // Add diversification benefit (assume average correlation 0.5)
    const avgCorr = 0.5;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const wi = portfolio.assets[i].weight;
        const wj = portfolio.assets[j].weight;
        const sigmaI = portfolio.assets[i].volatility || 0.2;
        const sigmaJ = portfolio.assets[j].volatility || 0.2;
        portfolioVariance += 2 * wi * wj * sigmaI * sigmaJ * avgCorr;
      }
    }
  }

  return {
    portfolioReturn,
    portfolioVolatility: Math.sqrt(Math.max(0, portfolioVariance)),
  };
}

function generateSampleReturns(portfolio: Portfolio, days: number = 252): number[] {
  const { portfolioReturn, portfolioVolatility } = calculatePortfolioStats(portfolio);
  const dailyReturn = portfolioReturn / 252;
  const dailyVol = portfolioVolatility / Math.sqrt(252);

  const returns: number[] = [];
  for (let i = 0; i < days; i++) {
    const r = dailyReturn + dailyVol * randomNormal();
    returns.push(r);
  }

  return returns;
}

function generateSamplePortfolio(): Portfolio {
  return {
    assets: [
      { symbol: 'SPY', weight: 0.4, expectedReturn: 0.1, volatility: 0.18 },
      { symbol: 'BND', weight: 0.3, expectedReturn: 0.04, volatility: 0.05 },
      { symbol: 'GLD', weight: 0.15, expectedReturn: 0.05, volatility: 0.15 },
      { symbol: 'QQQ', weight: 0.15, expectedReturn: 0.12, volatility: 0.22 },
    ],
    value: 1000000,
    correlationMatrix: [
      [1.0, 0.1, 0.05, 0.85],
      [0.1, 1.0, -0.1, 0.05],
      [0.05, -0.1, 1.0, 0.1],
      [0.85, 0.05, 0.1, 1.0],
    ],
  };
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const valueatriskTool: UnifiedTool = {
  name: 'value_at_risk',
  description:
    'Value at Risk (VaR) calculation - Historical, Parametric, Monte Carlo, CVaR, stress testing',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'calculate',
          'historical',
          'parametric',
          'monte_carlo',
          'cornish_fisher',
          'component',
          'incremental',
          'stress_test',
          'backtest',
          'compare',
          'info',
        ],
        description: 'VaR operation to perform',
      },
      confidence: {
        type: 'number',
        description: 'Confidence level (e.g., 0.95, 0.99)',
      },
      horizon: {
        type: 'number',
        description: 'Holding period in days',
      },
      portfolio: {
        type: 'object',
        properties: {
          assets: {
            type: 'array',
            items: { type: 'object' },
            description:
              'Portfolio assets. Each asset has: symbol (string), weight (number), expectedReturn (number), volatility (number)',
          },
          value: { type: 'number' },
          historicalReturns: { type: 'array', items: { type: 'number' } },
        },
        description: 'Portfolio definition',
      },
      simulations: {
        type: 'number',
        description: 'Number of Monte Carlo simulations',
      },
      scenario: {
        type: 'string',
        enum: [
          'market_crash_2008',
          'covid_march_2020',
          'interest_rate_shock',
          'inflation_surge',
          'tech_bubble_burst',
        ],
        description: 'Predefined stress scenario',
      },
    },
    required: ['operation'],
  },
};

export async function executevalueatrisk(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;
    const confidence = args.confidence || 0.95;
    const horizon = args.horizon || 1;

    // Build portfolio from input or use sample
    const portfolio: Portfolio = args.portfolio || generateSamplePortfolio();

    switch (operation) {
      case 'historical': {
        const result = historicalVaR(portfolio, confidence, horizon);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'historical_var',
              portfolioValue: portfolio.value,
              result,
            },
            null,
            2
          ),
        };
      }

      case 'parametric': {
        const result = parametricVaR(portfolio, confidence, horizon);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'parametric_var',
              portfolioValue: portfolio.value,
              result,
            },
            null,
            2
          ),
        };
      }

      case 'monte_carlo': {
        const simulations = args.simulations || 10000;
        const result = monteCarloVaR(portfolio, confidence, horizon, simulations);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'monte_carlo_var',
              portfolioValue: portfolio.value,
              result,
            },
            null,
            2
          ),
        };
      }

      case 'cornish_fisher': {
        const result = cornishFisherVaR(portfolio, confidence, horizon);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'cornish_fisher_var',
              portfolioValue: portfolio.value,
              result,
            },
            null,
            2
          ),
        };
      }

      case 'component': {
        const result = componentVaR(portfolio, confidence);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'component_var',
              portfolioValue: portfolio.value,
              totalVaR: result.totalVaR,
              components: result.componentVaRs,
              interpretation: 'Shows risk contribution of each asset to total VaR',
            },
            null,
            2
          ),
        };
      }

      case 'incremental': {
        const newAsset = args.new_asset || {
          symbol: 'CRYPTO',
          weight: 0.1,
          expectedReturn: 0.2,
          volatility: 0.6,
        };
        const result = incrementalVaR(portfolio, newAsset, confidence);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'incremental_var',
              newAsset,
              result,
              interpretation: 'Shows how adding a position changes portfolio VaR',
            },
            null,
            2
          ),
        };
      }

      case 'stress_test': {
        const scenarioName = args.scenario;
        const scenarios = scenarioName
          ? { [scenarioName]: predefinedScenarios()[scenarioName] || {} }
          : predefinedScenarios();

        const results = stressTest(portfolio, scenarios);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'stress_test',
              portfolioValue: portfolio.value,
              scenarios: results,
              worstCase: results.reduce(
                (worst, r) => (r.portfolioLoss > worst.portfolioLoss ? r : worst),
                results[0]
              ),
            },
            null,
            2
          ),
        };
      }

      case 'backtest': {
        // Generate sample data for backtesting
        const returns = generateSampleReturns(portfolio, 252);
        const varEstimates = returns.map(() => {
          const result = parametricVaR(portfolio, confidence, 1);
          return result.varPercent / 100;
        });

        const result = backtestVaR(returns, varEstimates, confidence);
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'backtest',
              confidence,
              result,
              interpretation: result.passed
                ? 'VaR model passed backtesting'
                : 'VaR model failed backtesting - consider revising',
            },
            null,
            2
          ),
        };
      }

      case 'compare':
      case 'calculate': {
        const historical = historicalVaR(portfolio, confidence, horizon);
        const parametric = parametricVaR(portfolio, confidence, horizon);
        const monteCarlo = monteCarloVaR(portfolio, confidence, horizon, 5000);
        const cornishFisher = cornishFisherVaR(portfolio, confidence, horizon);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'compare',
              portfolioValue: portfolio.value,
              confidence,
              horizon,
              methods: {
                historical: {
                  var: historical.var,
                  varPercent: historical.varPercent,
                  cvar: historical.cvar,
                },
                parametric: {
                  var: parametric.var,
                  varPercent: parametric.varPercent,
                  cvar: parametric.cvar,
                },
                monte_carlo: {
                  var: monteCarlo.var,
                  varPercent: monteCarlo.varPercent,
                  cvar: monteCarlo.cvar,
                },
                cornish_fisher: {
                  var: cornishFisher.var,
                  varPercent: cornishFisher.varPercent,
                },
              },
              summary: {
                averageVaR:
                  (historical.var + parametric.var + monteCarlo.var + cornishFisher.var) / 4,
                maxVaR: Math.max(historical.var, parametric.var, monteCarlo.var, cornishFisher.var),
                minVaR: Math.min(historical.var, parametric.var, monteCarlo.var, cornishFisher.var),
              },
            },
            null,
            2
          ),
        };
      }

      case 'info':
      default: {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'value_at_risk',
              description:
                'Comprehensive Value at Risk (VaR) analysis for portfolio risk management',
              methods: {
                historical: {
                  description: 'Uses actual historical returns distribution',
                  pros: ['No distributional assumptions', 'Captures fat tails'],
                  cons: ['Requires extensive data', 'Past may not predict future'],
                },
                parametric: {
                  description: 'Assumes normal distribution (variance-covariance)',
                  pros: ['Fast computation', 'Easy to implement'],
                  cons: ['Assumes normality', 'Underestimates tail risk'],
                },
                monte_carlo: {
                  description: 'Simulates random paths using stochastic models',
                  pros: ['Flexible', 'Can model complex instruments'],
                  cons: ['Computationally intensive', 'Model-dependent'],
                },
                cornish_fisher: {
                  description: 'Adjusts for skewness and kurtosis',
                  pros: ['Better for non-normal returns', 'Semi-parametric'],
                  cons: ['Requires higher moments estimation'],
                },
              },
              relatedMeasures: {
                cvar: 'Conditional VaR (Expected Shortfall) - average loss beyond VaR',
                componentVaR: 'Risk contribution of each portfolio component',
                incrementalVaR: 'Change in VaR from adding a new position',
                marginalVaR: 'Rate of change of VaR with respect to position size',
              },
              regulatoryFrameworks: [
                'Basel III/IV - banks use VaR for market risk capital',
                'Solvency II - insurers use VaR for capital requirements',
                'SEC Rule 15c3-1 - broker-dealers report VaR',
              ],
              operations: [
                'calculate',
                'historical',
                'parametric',
                'monte_carlo',
                'cornish_fisher',
                'component',
                'incremental',
                'stress_test',
                'backtest',
                'compare',
              ],
            },
            null,
            2
          ),
        };
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isvalueatriskAvailable(): boolean {
  return true;
}
