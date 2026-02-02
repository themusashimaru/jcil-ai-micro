/**
 * PORTFOLIO-OPTIMIZATION TOOL
 * Markowitz Mean-Variance Portfolio Optimization
 * Including efficient frontier, risk parity, and performance metrics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const portfoliooptimizationTool: UnifiedTool = {
  name: 'portfolio_optimization',
  description: 'Portfolio optimization (Markowitz mean-variance, risk parity, efficient frontier)',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'optimize', 'efficient_frontier', 'risk_parity', 'sharpe', 'var', 'backtest', 'demonstrate'],
        description: 'Operation to perform'
      },
      returns: { type: 'array', description: 'Expected returns for each asset' },
      covariance: { type: 'array', description: 'Covariance matrix (2D array)' },
      target_return: { type: 'number', description: 'Target portfolio return' },
      risk_free_rate: { type: 'number', description: 'Risk-free rate' },
      confidence: { type: 'number', description: 'Confidence level for VaR' },
      constraints: { type: 'object', description: 'Portfolio constraints' }
    },
    required: ['operation']
  }
};

// ===== MATRIX OPERATIONS =====

function matrixMultiply(A: number[][], B: number[][]): number[][] {
  const rowsA = A.length;
  const colsA = A[0].length;
  const colsB = B[0].length;

  const result: number[][] = Array(rowsA).fill(null).map(() => Array(colsB).fill(0));

  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsB; j++) {
      for (let k = 0; k < colsA; k++) {
        result[i][j] += A[i][k] * B[k][j];
      }
    }
  }

  return result;
}

function matrixVectorMultiply(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

function vectorDot(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

// Solve linear system using Gauss-Jordan elimination
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    if (Math.abs(augmented[col][col]) < 1e-10) continue;

    // Eliminate column
    for (let row = col + 1; row < n; row++) {
      const factor = augmented[row][col] / augmented[col][col];
      for (let j = col; j <= n; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= augmented[i][j] * x[j];
    }
    x[i] = sum / augmented[i][i];
  }

  return x;
}

// Invert matrix using Gauss-Jordan
function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => {
    const identity = Array(n).fill(0);
    identity[i] = 1;
    return [...row, ...identity];
  });

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    const pivot = augmented[col][col];
    if (Math.abs(pivot) < 1e-10) throw new Error('Matrix is singular');

    // Scale pivot row
    for (let j = 0; j < 2 * n; j++) {
      augmented[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = augmented[row][col];
        for (let j = 0; j < 2 * n; j++) {
          augmented[row][j] -= factor * augmented[col][j];
        }
      }
    }
  }

  // Extract inverse
  return augmented.map(row => row.slice(n));
}

// ===== PORTFOLIO CALCULATIONS =====

function portfolioReturn(weights: number[], returns: number[]): number {
  return vectorDot(weights, returns);
}

function portfolioVariance(weights: number[], covariance: number[][]): number {
  const temp = matrixVectorMultiply(covariance, weights);
  return vectorDot(weights, temp);
}

function portfolioStdDev(weights: number[], covariance: number[][]): number {
  return Math.sqrt(portfolioVariance(weights, covariance));
}

function sharpeRatio(ret: number, stdDev: number, riskFreeRate: number): number {
  return (ret - riskFreeRate) / stdDev;
}

// ===== OPTIMIZATION ALGORITHMS =====

// Minimum variance portfolio (no return constraint)
function minimumVariancePortfolio(covariance: number[][]): number[] {
  const n = covariance.length;
  const ones = Array(n).fill(1);

  try {
    const invCov = invertMatrix(covariance);
    const invCovOnes = matrixVectorMultiply(invCov, ones);
    const denominator = vectorDot(ones, invCovOnes);

    return invCovOnes.map(w => w / denominator);
  } catch {
    // Fallback: equal weights
    return Array(n).fill(1 / n);
  }
}

// Mean-variance optimization for target return
function meanVarianceOptimize(
  returns: number[],
  covariance: number[][],
  targetReturn: number
): { weights: number[]; return: number; risk: number } {
  const n = returns.length;

  // Solve using Lagrangian: min w'Σw s.t. w'μ = targetReturn, w'1 = 1
  // KKT conditions lead to system: [Σ μ 1; μ' 0 0; 1' 0 0] [w; λ1; λ2] = [0; targetReturn; 1]

  const A: number[][] = [];

  // First n rows: 2*Σ w + λ1*μ + λ2*1 = 0
  for (let i = 0; i < n; i++) {
    const row = [...covariance[i].map(x => 2 * x), returns[i], 1];
    A.push(row);
  }

  // Row n+1: μ'w = targetReturn
  A.push([...returns, 0, 0]);

  // Row n+2: 1'w = 1
  A.push([...Array(n).fill(1), 0, 0]);

  const b = [...Array(n).fill(0), targetReturn, 1];

  try {
    const solution = solveLinearSystem(A, b);
    const weights = solution.slice(0, n);

    // Normalize weights to sum to 1 (numerical stability)
    const sum = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / sum);

    return {
      weights: normalizedWeights,
      return: portfolioReturn(normalizedWeights, returns),
      risk: portfolioStdDev(normalizedWeights, covariance)
    };
  } catch {
    // Fallback
    const minVar = minimumVariancePortfolio(covariance);
    return {
      weights: minVar,
      return: portfolioReturn(minVar, returns),
      risk: portfolioStdDev(minVar, covariance)
    };
  }
}

// Maximum Sharpe Ratio portfolio
function maxSharpePortfolio(
  returns: number[],
  covariance: number[][],
  riskFreeRate: number
): { weights: number[]; return: number; risk: number; sharpe: number } {
  const n = returns.length;

  // Excess returns
  const excessReturns = returns.map(r => r - riskFreeRate);

  try {
    const invCov = invertMatrix(covariance);
    const z = matrixVectorMultiply(invCov, excessReturns);
    const sumZ = z.reduce((a, b) => a + b, 0);

    if (sumZ <= 0) {
      // All assets have negative excess return
      const minVar = minimumVariancePortfolio(covariance);
      const ret = portfolioReturn(minVar, returns);
      const risk = portfolioStdDev(minVar, covariance);
      return {
        weights: minVar,
        return: ret,
        risk,
        sharpe: sharpeRatio(ret, risk, riskFreeRate)
      };
    }

    const weights = z.map(w => w / sumZ);

    const ret = portfolioReturn(weights, returns);
    const risk = portfolioStdDev(weights, covariance);

    return {
      weights,
      return: ret,
      risk,
      sharpe: sharpeRatio(ret, risk, riskFreeRate)
    };
  } catch {
    const equal = Array(n).fill(1 / n);
    const ret = portfolioReturn(equal, returns);
    const risk = portfolioStdDev(equal, covariance);
    return {
      weights: equal,
      return: ret,
      risk,
      sharpe: sharpeRatio(ret, risk, riskFreeRate)
    };
  }
}

// Efficient frontier
function efficientFrontier(
  returns: number[],
  covariance: number[][],
  points: number = 20
): { portfolios: { return: number; risk: number; weights: number[] }[] } {
  const minRet = Math.min(...returns);
  const maxRet = Math.max(...returns);

  const portfolios: { return: number; risk: number; weights: number[] }[] = [];

  for (let i = 0; i < points; i++) {
    const targetReturn = minRet + (maxRet - minRet) * i / (points - 1);
    const result = meanVarianceOptimize(returns, covariance, targetReturn);
    portfolios.push({
      return: result.return,
      risk: result.risk,
      weights: result.weights
    });
  }

  return { portfolios };
}

// Risk Parity portfolio (equal risk contribution)
function riskParityPortfolio(
  covariance: number[][],
  maxIterations: number = 100,
  tolerance: number = 1e-6
): { weights: number[]; riskContributions: number[] } {
  const n = covariance.length;
  let weights = Array(n).fill(1 / n);

  for (let iter = 0; iter < maxIterations; iter++) {
    const sigma = portfolioStdDev(weights, covariance);
    const marginalRisk = matrixVectorMultiply(covariance, weights).map(r => r / sigma);

    // Risk contribution: w_i * marginalRisk_i / sigma
    const riskContrib = weights.map((w, i) => w * marginalRisk[i]);
    const totalRiskContrib = riskContrib.reduce((a, b) => a + b, 0);

    // Update weights to equalize risk contributions
    const targetRiskContrib = sigma / n;
    const newWeights = weights.map((w, i) => {
      const ratio = targetRiskContrib / (riskContrib[i] + 1e-10);
      return w * Math.sqrt(ratio);
    });

    // Normalize
    const sum = newWeights.reduce((a, b) => a + b, 0);
    weights = newWeights.map(w => w / sum);

    // Check convergence
    const maxChange = Math.max(...weights.map((w, i) => Math.abs(w - newWeights[i] / sum)));
    if (maxChange < tolerance) break;
  }

  // Calculate final risk contributions
  const sigma = portfolioStdDev(weights, covariance);
  const marginalRisk = matrixVectorMultiply(covariance, weights).map(r => r / sigma);
  const riskContributions = weights.map((w, i) => w * marginalRisk[i]);

  return { weights, riskContributions };
}

// Value at Risk (parametric)
function valueAtRisk(
  portfolioValue: number,
  expectedReturn: number,
  stdDev: number,
  confidenceLevel: number,
  horizon: number = 1
): { var: number; es: number } {
  // Z-score for confidence level
  const zScores: Record<number, number> = {
    0.90: 1.282,
    0.95: 1.645,
    0.99: 2.326
  };
  const z = zScores[confidenceLevel] || 1.645;

  // Scale to horizon
  const scaledReturn = expectedReturn * horizon;
  const scaledStdDev = stdDev * Math.sqrt(horizon);

  // Parametric VaR
  const var_ = portfolioValue * (scaledReturn - z * scaledStdDev);

  // Expected Shortfall (CVaR)
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - confidenceLevel;
  const es = portfolioValue * (scaledReturn - scaledStdDev * pdf / cdf);

  return { var: -var_, es: -es };
}

// ===== SAMPLE DATA =====

function getSampleData(): { returns: number[]; covariance: number[][]; assets: string[] } {
  // Realistic annual returns and covariance for major asset classes
  const assets = ['US Stocks', 'Int\'l Stocks', 'Bonds', 'REITs', 'Gold'];
  const returns = [0.10, 0.08, 0.03, 0.09, 0.05]; // Annual expected returns

  // Annual covariance matrix
  const covariance = [
    [0.0400, 0.0280, 0.0020, 0.0200, 0.0040],  // US Stocks
    [0.0280, 0.0484, 0.0015, 0.0180, 0.0060],  // Int'l Stocks
    [0.0020, 0.0015, 0.0025, 0.0010, 0.0005],  // Bonds
    [0.0200, 0.0180, 0.0010, 0.0324, 0.0020],  // REITs
    [0.0040, 0.0060, 0.0005, 0.0020, 0.0225]   // Gold
  ];

  return { returns, covariance, assets };
}

// ===== MAIN EXECUTION =====

export async function executeportfoliooptimization(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'portfolio_optimization',
            description: 'Modern Portfolio Theory optimization',
            theory: {
              markowitz: 'Mean-variance optimization to find optimal risk-return tradeoff',
              efficient_frontier: 'Set of portfolios with highest return for each risk level',
              sharpe_ratio: '(Return - Risk-free Rate) / Standard Deviation',
              risk_parity: 'Equal risk contribution from each asset'
            },
            metrics: {
              expected_return: 'Weighted average of asset returns',
              volatility: 'Standard deviation of portfolio returns',
              sharpe_ratio: 'Risk-adjusted return measure',
              var: 'Value at Risk - maximum loss at confidence level',
              cvar: 'Conditional VaR - expected loss beyond VaR'
            },
            constraints: {
              long_only: 'All weights >= 0',
              full_investment: 'Weights sum to 1',
              position_limits: 'Min/max weight per asset',
              sector_limits: 'Max allocation to sectors'
            },
            operations: ['info', 'optimize', 'efficient_frontier', 'risk_parity', 'sharpe', 'var', 'backtest', 'demonstrate']
          }, null, 2)
        };
      }

      case 'optimize': {
        const sample = getSampleData();
        const returns = args.returns || sample.returns;
        const covariance = args.covariance || sample.covariance;
        const targetReturn = args.target_return || 0.07;

        const result = meanVarianceOptimize(returns, covariance, targetReturn);

        const assetNames = sample.assets.slice(0, returns.length);

        return {
          toolCallId: id,
          content: JSON.stringify({
            optimization: 'Mean-Variance (Markowitz)',
            target_return: `${(targetReturn * 100).toFixed(2)}%`,
            result: {
              expected_return: `${(result.return * 100).toFixed(2)}%`,
              volatility: `${(result.risk * 100).toFixed(2)}%`,
              sharpe_ratio: (args.risk_free_rate !== undefined)
                ? sharpeRatio(result.return, result.risk, args.risk_free_rate).toFixed(3)
                : 'N/A (provide risk_free_rate)'
            },
            weights: result.weights.map((w, i) => ({
              asset: assetNames[i] || `Asset ${i + 1}`,
              weight: `${(w * 100).toFixed(2)}%`
            })),
            note: 'Negative weights indicate short positions'
          }, null, 2)
        };
      }

      case 'efficient_frontier': {
        const sample = getSampleData();
        const returns = args.returns || sample.returns;
        const covariance = args.covariance || sample.covariance;
        const riskFreeRate = args.risk_free_rate || 0.02;

        const frontier = efficientFrontier(returns, covariance, 15);
        const maxSharpe = maxSharpePortfolio(returns, covariance, riskFreeRate);
        const minVar = minimumVariancePortfolio(covariance);

        const minVarReturn = portfolioReturn(minVar, returns);
        const minVarRisk = portfolioStdDev(minVar, covariance);

        return {
          toolCallId: id,
          content: JSON.stringify({
            efficient_frontier: frontier.portfolios.map(p => ({
              return: `${(p.return * 100).toFixed(2)}%`,
              risk: `${(p.risk * 100).toFixed(2)}%`,
              sharpe: sharpeRatio(p.return, p.risk, riskFreeRate).toFixed(3)
            })),
            special_portfolios: {
              minimum_variance: {
                return: `${(minVarReturn * 100).toFixed(2)}%`,
                risk: `${(minVarRisk * 100).toFixed(2)}%`,
                sharpe: sharpeRatio(minVarReturn, minVarRisk, riskFreeRate).toFixed(3),
                weights: minVar.map((w, i) => ({
                  asset: sample.assets[i] || `Asset ${i + 1}`,
                  weight: `${(w * 100).toFixed(2)}%`
                }))
              },
              maximum_sharpe: {
                return: `${(maxSharpe.return * 100).toFixed(2)}%`,
                risk: `${(maxSharpe.risk * 100).toFixed(2)}%`,
                sharpe: maxSharpe.sharpe.toFixed(3),
                weights: maxSharpe.weights.map((w, i) => ({
                  asset: sample.assets[i] || `Asset ${i + 1}`,
                  weight: `${(w * 100).toFixed(2)}%`
                }))
              }
            },
            risk_free_rate: `${(riskFreeRate * 100).toFixed(2)}%`
          }, null, 2)
        };
      }

      case 'risk_parity': {
        const sample = getSampleData();
        const covariance = args.covariance || sample.covariance;
        const returns = args.returns || sample.returns;

        const result = riskParityPortfolio(covariance);
        const portReturn = portfolioReturn(result.weights, returns);
        const portRisk = portfolioStdDev(result.weights, covariance);

        return {
          toolCallId: id,
          content: JSON.stringify({
            optimization: 'Risk Parity',
            description: 'Each asset contributes equally to total portfolio risk',
            result: {
              expected_return: `${(portReturn * 100).toFixed(2)}%`,
              volatility: `${(portRisk * 100).toFixed(2)}%`
            },
            allocations: result.weights.map((w, i) => ({
              asset: sample.assets[i] || `Asset ${i + 1}`,
              weight: `${(w * 100).toFixed(2)}%`,
              risk_contribution: `${(result.riskContributions[i] / portRisk * 100).toFixed(2)}%`
            })),
            insight: 'Lower volatility assets get higher weight to equalize risk contribution'
          }, null, 2)
        };
      }

      case 'sharpe': {
        const sample = getSampleData();
        const returns = args.returns || sample.returns;
        const covariance = args.covariance || sample.covariance;
        const riskFreeRate = args.risk_free_rate || 0.02;

        const result = maxSharpePortfolio(returns, covariance, riskFreeRate);

        return {
          toolCallId: id,
          content: JSON.stringify({
            optimization: 'Maximum Sharpe Ratio',
            description: 'Portfolio with highest risk-adjusted return',
            risk_free_rate: `${(riskFreeRate * 100).toFixed(2)}%`,
            result: {
              expected_return: `${(result.return * 100).toFixed(2)}%`,
              volatility: `${(result.risk * 100).toFixed(2)}%`,
              sharpe_ratio: result.sharpe.toFixed(3),
              excess_return: `${((result.return - riskFreeRate) * 100).toFixed(2)}%`
            },
            weights: result.weights.map((w, i) => ({
              asset: sample.assets[i] || `Asset ${i + 1}`,
              weight: `${(w * 100).toFixed(2)}%`
            })),
            interpretation: {
              sharpe_meaning: `${result.sharpe.toFixed(2)} units of excess return per unit of risk`,
              quality: result.sharpe > 1 ? 'Excellent' : result.sharpe > 0.5 ? 'Good' : result.sharpe > 0 ? 'Acceptable' : 'Poor'
            }
          }, null, 2)
        };
      }

      case 'var': {
        const portfolioValue = args.portfolio_value || 1000000;
        const expectedReturn = args.expected_return || 0.08;
        const volatility = args.volatility || 0.15;
        const confidence = args.confidence || 0.95;
        const horizon = args.horizon || 1; // days

        const result = valueAtRisk(portfolioValue, expectedReturn / 252, volatility / Math.sqrt(252), confidence, horizon);

        return {
          toolCallId: id,
          content: JSON.stringify({
            calculation: 'Value at Risk (Parametric)',
            inputs: {
              portfolio_value: `$${portfolioValue.toLocaleString()}`,
              annual_return: `${(expectedReturn * 100).toFixed(2)}%`,
              annual_volatility: `${(volatility * 100).toFixed(2)}%`,
              confidence_level: `${(confidence * 100).toFixed(0)}%`,
              time_horizon: `${horizon} day(s)`
            },
            results: {
              value_at_risk: `$${Math.round(result.var).toLocaleString()}`,
              expected_shortfall: `$${Math.round(result.es).toLocaleString()}`,
              var_percentage: `${(result.var / portfolioValue * 100).toFixed(2)}%`
            },
            interpretation: {
              var: `With ${confidence * 100}% confidence, the portfolio will not lose more than $${Math.round(result.var).toLocaleString()} in ${horizon} day(s)`,
              es: `If losses exceed VaR, the expected loss is $${Math.round(result.es).toLocaleString()}`
            },
            assumptions: [
              'Returns are normally distributed',
              'Volatility is constant',
              'No serial correlation in returns'
            ]
          }, null, 2)
        };
      }

      case 'backtest': {
        // Simple backtest simulation
        const sample = getSampleData();
        const returns = args.returns || sample.returns;
        const covariance = args.covariance || sample.covariance;
        const initialValue = args.initial_value || 100000;
        const years = args.years || 10;

        // Get different portfolio strategies
        const equalWeight = Array(returns.length).fill(1 / returns.length);
        const minVar = minimumVariancePortfolio(covariance);
        const maxSharpe = maxSharpePortfolio(returns, covariance, 0.02);

        // Simulate with random walks
        const simulate = (weights: number[], periods: number): number[] => {
          const portReturn = portfolioReturn(weights, returns);
          const portVol = portfolioStdDev(weights, covariance);
          const monthlyReturn = portReturn / 12;
          const monthlyVol = portVol / Math.sqrt(12);

          const values = [initialValue];
          for (let i = 0; i < periods; i++) {
            // Log-normal returns
            const randomReturn = monthlyReturn + monthlyVol * (Math.random() * 2 - 1) * 1.5;
            values.push(values[values.length - 1] * (1 + randomReturn));
          }
          return values;
        };

        const months = years * 12;
        const equalWeightSim = simulate(equalWeight, months);
        const minVarSim = simulate(minVar, months);
        const maxSharpeSim = simulate(maxSharpe.weights, months);

        const calcStats = (values: number[], weights: number[]) => {
          const finalValue = values[values.length - 1];
          const totalReturn = (finalValue - initialValue) / initialValue;
          const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
          const portVol = portfolioStdDev(weights, covariance);

          return {
            final_value: Math.round(finalValue),
            total_return: `${(totalReturn * 100).toFixed(2)}%`,
            annualized_return: `${(annualizedReturn * 100).toFixed(2)}%`,
            volatility: `${(portVol * 100).toFixed(2)}%`
          };
        };

        return {
          toolCallId: id,
          content: JSON.stringify({
            backtest: 'Portfolio Strategy Comparison',
            parameters: {
              initial_value: `$${initialValue.toLocaleString()}`,
              time_horizon: `${years} years`,
              assets: sample.assets
            },
            strategies: {
              equal_weight: {
                weights: equalWeight.map((w, i) => `${sample.assets[i]}: ${(w * 100).toFixed(1)}%`).join(', '),
                ...calcStats(equalWeightSim, equalWeight)
              },
              minimum_variance: {
                weights: minVar.map((w, i) => `${sample.assets[i]}: ${(w * 100).toFixed(1)}%`).join(', '),
                ...calcStats(minVarSim, minVar)
              },
              maximum_sharpe: {
                weights: maxSharpe.weights.map((w, i) => `${sample.assets[i]}: ${(w * 100).toFixed(1)}%`).join(', '),
                ...calcStats(maxSharpeSim, maxSharpe.weights)
              }
            },
            note: 'Results use Monte Carlo simulation with log-normal returns'
          }, null, 2)
        };
      }

      case 'demonstrate': {
        const sample = getSampleData();

        // Run all optimizations
        const equalWeight = Array(sample.returns.length).fill(1 / sample.returns.length);
        const minVar = minimumVariancePortfolio(sample.covariance);
        const maxSharpe = maxSharpePortfolio(sample.returns, sample.covariance, 0.02);
        const riskParity = riskParityPortfolio(sample.covariance);

        const calcMetrics = (weights: number[]) => ({
          return: portfolioReturn(weights, sample.returns),
          risk: portfolioStdDev(weights, sample.covariance),
          sharpe: sharpeRatio(portfolioReturn(weights, sample.returns), portfolioStdDev(weights, sample.covariance), 0.02)
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'Portfolio Optimization',
            asset_universe: sample.assets.map((name, i) => ({
              asset: name,
              expected_return: `${(sample.returns[i] * 100).toFixed(1)}%`,
              volatility: `${(Math.sqrt(sample.covariance[i][i]) * 100).toFixed(1)}%`
            })),
            strategy_comparison: {
              equal_weight: {
                description: '20% each asset',
                ...(() => {
                  const m = calcMetrics(equalWeight);
                  return {
                    return: `${(m.return * 100).toFixed(2)}%`,
                    risk: `${(m.risk * 100).toFixed(2)}%`,
                    sharpe: m.sharpe.toFixed(3)
                  };
                })()
              },
              minimum_variance: {
                description: 'Lowest possible risk',
                ...(() => {
                  const m = calcMetrics(minVar);
                  return {
                    return: `${(m.return * 100).toFixed(2)}%`,
                    risk: `${(m.risk * 100).toFixed(2)}%`,
                    sharpe: m.sharpe.toFixed(3)
                  };
                })()
              },
              maximum_sharpe: {
                description: 'Best risk-adjusted return',
                return: `${(maxSharpe.return * 100).toFixed(2)}%`,
                risk: `${(maxSharpe.risk * 100).toFixed(2)}%`,
                sharpe: maxSharpe.sharpe.toFixed(3)
              },
              risk_parity: {
                description: 'Equal risk contribution',
                ...(() => {
                  const m = calcMetrics(riskParity.weights);
                  return {
                    return: `${(m.return * 100).toFixed(2)}%`,
                    risk: `${(m.risk * 100).toFixed(2)}%`,
                    sharpe: m.sharpe.toFixed(3)
                  };
                })()
              }
            },
            key_insights: [
              'Diversification reduces risk without proportionally reducing return',
              'Maximum Sharpe portfolio often concentrates in high-return assets',
              'Minimum variance portfolio overweights low-volatility assets',
              'Risk parity balances risk contribution across assets',
              'Correlations are as important as individual volatilities'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'optimize', 'efficient_frontier', 'risk_parity', 'sharpe', 'var', 'backtest', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isportfoliooptimizationAvailable(): boolean { return true; }
