/**
 * PORTFOLIO-OPTIMIZATION TOOL
 * Complete portfolio optimization implementation
 * Supports Markowitz mean-variance, Black-Litterman, risk parity, and efficient frontier
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const portfoliooptimizationTool: UnifiedTool = {
  name: 'portfolio_optimization',
  description: 'Portfolio optimization - Markowitz mean-variance, Black-Litterman, risk parity, efficient frontier',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['optimize', 'efficient_frontier', 'risk_parity', 'black_litterman', 'sharpe_ratio', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      returns: {
        type: 'array',
        description: 'Expected returns for each asset'
      },
      covariance: {
        type: 'array',
        description: 'Covariance matrix (2D array)'
      },
      historical_returns: {
        type: 'array',
        description: 'Historical returns matrix (time x assets)'
      },
      target_return: {
        type: 'number',
        description: 'Target portfolio return'
      },
      target_risk: {
        type: 'number',
        description: 'Target portfolio risk (std dev)'
      },
      risk_free_rate: {
        type: 'number',
        description: 'Risk-free rate (annual)'
      },
      constraints: {
        type: 'object',
        description: 'Constraints: min_weight, max_weight, sum_to_one'
      },
      views: {
        type: 'array',
        description: 'Black-Litterman views [{asset, view, confidence}]'
      },
      num_points: {
        type: 'number',
        description: 'Number of points on efficient frontier'
      }
    },
    required: ['operation']
  }
};

// Matrix utilities
function transpose(matrix: number[][]): number[][] {
  if (matrix.length === 0) return [];
  return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

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

function vectorDot(a: number[], b: number[]): number {
  return a.reduce((sum, val, i) => sum + val * b[i], 0);
}

function matrixVectorMultiply(M: number[][], v: number[]): number[] {
  return M.map(row => vectorDot(row, v));
}

function vectorAdd(a: number[], b: number[]): number[] {
  return a.map((val, i) => val + b[i]);
}

function vectorScale(v: number[], s: number): number[] {
  return v.map(val => val * s);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function vectorSubtract(a: number[], b: number[]): number[] {
  return a.map((val, i) => val - b[i]);
}

// Matrix inverse using Gauss-Jordan elimination
function matrixInverse(matrix: number[][]): number[][] {
  const n = matrix.length;
  const augmented: number[][] = matrix.map((row, i) => {
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

    // Swap rows
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    // Check for singular matrix
    if (Math.abs(augmented[col][col]) < 1e-10) {
      throw new Error('Matrix is singular or near-singular');
    }

    // Scale pivot row
    const pivot = augmented[col][col];
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

// Calculate covariance matrix from historical returns
function calculateCovariance(returns: number[][]): number[][] {
  const n = returns[0].length; // number of assets
  const T = returns.length; // number of time periods

  // Calculate means
  const means = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let t = 0; t < T; t++) {
      means[j] += returns[t][j];
    }
    means[j] /= T;
  }

  // Calculate covariance
  const cov: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let t = 0; t < T; t++) {
        cov[i][j] += (returns[t][i] - means[i]) * (returns[t][j] - means[j]);
      }
      cov[i][j] /= (T - 1);
    }
  }

  return cov;
}

// Calculate expected returns from historical data
function calculateExpectedReturns(returns: number[][]): number[] {
  const n = returns[0].length;
  const T = returns.length;

  const means = Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let t = 0; t < T; t++) {
      means[j] += returns[t][j];
    }
    means[j] /= T;
  }

  return means;
}

// Portfolio variance
function portfolioVariance(weights: number[], cov: number[][]): number {
  const Sw = matrixVectorMultiply(cov, weights);
  return vectorDot(weights, Sw);
}

// Portfolio return
function portfolioReturn(weights: number[], returns: number[]): number {
  return vectorDot(weights, returns);
}

// Markowitz mean-variance optimization
function markowitzOptimize(
  expectedReturns: number[],
  cov: number[][],
  targetReturn?: number,
  constraints?: { min_weight?: number; max_weight?: number }
): { weights: number[]; return: number; risk: number; sharpe?: number } {
  const n = expectedReturns.length;
  const minWeight = constraints?.min_weight ?? 0;
  const maxWeight = constraints?.max_weight ?? 1;

  // Solve using quadratic programming (simplified lagrangian approach)
  // For target return: minimize w'Σw subject to w'μ = r, Σw = 1

  if (targetReturn !== undefined) {
    // Create augmented system for Lagrangian
    // [2Σ  μ  1] [w ]   [0]
    // [μ'  0  0] [λ1] = [r]
    // [1'  0  0] [λ2]   [1]

    const augSize = n + 2;
    const A: number[][] = Array(augSize).fill(null).map(() => Array(augSize).fill(0));
    const b: number[] = Array(augSize).fill(0);

    // Fill 2Σ
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        A[i][j] = 2 * cov[i][j];
      }
    }

    // Fill μ column and row
    for (let i = 0; i < n; i++) {
      A[i][n] = expectedReturns[i];
      A[n][i] = expectedReturns[i];
    }

    // Fill 1 column and row
    for (let i = 0; i < n; i++) {
      A[i][n + 1] = 1;
      A[n + 1][i] = 1;
    }

    b[n] = targetReturn;
    b[n + 1] = 1;

    // Solve system
    const Ainv = matrixInverse(A);
    const solution = matrixVectorMultiply(Ainv, b);
    let weights = solution.slice(0, n);

    // Apply constraints
    weights = weights.map(w => Math.max(minWeight, Math.min(maxWeight, w)));

    // Normalize
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / sum);

    const ret = portfolioReturn(weights, expectedReturns);
    const risk = Math.sqrt(portfolioVariance(weights, cov));

    return { weights, return: ret, risk };
  }

  // Minimum variance portfolio
  const ones = Array(n).fill(1);
  const covInv = matrixInverse(cov);
  const covInvOnes = matrixVectorMultiply(covInv, ones);
  const denom = vectorDot(ones, covInvOnes);

  let weights = covInvOnes.map(w => w / denom);

  // Apply constraints
  weights = weights.map(w => Math.max(minWeight, Math.min(maxWeight, w)));
  const sum = weights.reduce((a, b) => a + b, 0);
  weights = weights.map(w => w / sum);

  const ret = portfolioReturn(weights, expectedReturns);
  const risk = Math.sqrt(portfolioVariance(weights, cov));

  return { weights, return: ret, risk };
}

// Maximum Sharpe ratio portfolio
function maxSharpeRatio(
  expectedReturns: number[],
  cov: number[][],
  riskFreeRate: number = 0
): { weights: number[]; return: number; risk: number; sharpe: number } {
  const n = expectedReturns.length;

  // Excess returns
  const excessReturns = expectedReturns.map(r => r - riskFreeRate);

  // Tangency portfolio: w ∝ Σ^(-1)(μ - r_f)
  const covInv = matrixInverse(cov);
  const rawWeights = matrixVectorMultiply(covInv, excessReturns);

  // Normalize to sum to 1
  const sum = rawWeights.reduce((a, b) => a + b, 0);

  // Handle negative sum (all negative excess returns)
  if (Math.abs(sum) < 1e-10) {
    // Return equal weights
    const weights = Array(n).fill(1 / n);
    const ret = portfolioReturn(weights, expectedReturns);
    const risk = Math.sqrt(portfolioVariance(weights, cov));
    const sharpe = (ret - riskFreeRate) / risk;
    return { weights, return: ret, risk, sharpe };
  }

  let weights = rawWeights.map(w => w / sum);

  // Handle negative weights (short selling not allowed)
  if (weights.some(w => w < 0)) {
    weights = weights.map(w => Math.max(0, w));
    const newSum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map(w => w / newSum);
  }

  const ret = portfolioReturn(weights, expectedReturns);
  const risk = Math.sqrt(portfolioVariance(weights, cov));
  const sharpe = (ret - riskFreeRate) / risk;

  return { weights, return: ret, risk, sharpe };
}

// Efficient frontier
function efficientFrontier(
  expectedReturns: number[],
  cov: number[][],
  numPoints: number = 20
): Array<{ weights: number[]; return: number; risk: number }> {
  const minVar = markowitzOptimize(expectedReturns, cov);
  const maxRet = Math.max(...expectedReturns);
  const minRet = minVar.return;

  const frontier: Array<{ weights: number[]; return: number; risk: number }> = [];

  for (let i = 0; i < numPoints; i++) {
    const targetReturn = minRet + (i / (numPoints - 1)) * (maxRet - minRet);
    try {
      const portfolio = markowitzOptimize(expectedReturns, cov, targetReturn);
      frontier.push(portfolio);
    } catch {
      // Skip if optimization fails
    }
  }

  return frontier;
}

// Risk parity portfolio
function riskParity(cov: number[][]): { weights: number[]; risk: number; risk_contributions: number[] } {
  const n = cov.length;

  // Start with equal weights
  let weights = Array(n).fill(1 / n);

  // Iterative optimization (Newton-Raphson simplified)
  const maxIter = 100;
  const tolerance = 1e-8;

  for (let iter = 0; iter < maxIter; iter++) {
    const Sw = matrixVectorMultiply(cov, weights);
    const portfolioVol = Math.sqrt(vectorDot(weights, Sw));

    // Marginal risk contributions
    const marginalRisk = Sw.map(s => s / portfolioVol);

    // Risk contributions
    const riskContrib = weights.map((w, i) => w * marginalRisk[i]);

    // Target: equal risk contribution
    const targetRisk = portfolioVol / n;

    // Update weights
    const newWeights = weights.map((w, i) => {
      const rc = riskContrib[i];
      return w * Math.sqrt(targetRisk / (rc + 1e-10));
    });

    // Normalize
    const sum = newWeights.reduce((a, b) => a + b, 0);
    weights = newWeights.map(w => w / sum);

    // Check convergence
    const maxDiff = Math.max(...riskContrib.map(rc => Math.abs(rc - targetRisk)));
    if (maxDiff < tolerance) break;
  }

  const Sw = matrixVectorMultiply(cov, weights);
  const portfolioVol = Math.sqrt(vectorDot(weights, Sw));
  const riskContributions = weights.map((w, i) => w * Sw[i] / portfolioVol);

  return {
    weights,
    risk: portfolioVol,
    risk_contributions: riskContributions
  };
}

// Black-Litterman model
function blackLitterman(
  marketWeights: number[],
  cov: number[][],
  views: Array<{ assets: number[]; view: number; confidence: number }>,
  tau: number = 0.05,
  riskAversion: number = 2.5
): { weights: number[]; expectedReturns: number[] } {
  const n = cov.length;

  // Implied equilibrium returns: π = δΣw_mkt
  const impliedReturns = vectorScale(matrixVectorMultiply(cov, marketWeights), riskAversion);

  if (views.length === 0) {
    return {
      weights: marketWeights,
      expectedReturns: impliedReturns
    };
  }

  // Build P matrix and Q vector from views
  const P: number[][] = [];
  const Q: number[] = [];
  const Omega: number[][] = [];

  for (const view of views) {
    const pRow = Array(n).fill(0);
    for (const asset of view.assets) {
      pRow[asset] = 1 / view.assets.length;
    }
    P.push(pRow);
    Q.push(view.view);

    // Omega diagonal: uncertainty in view
    const viewVariance = (1 - view.confidence) / view.confidence;
    Omega.push([viewVariance]);
  }

  // Simplified: assuming diagonal Omega
  const k = views.length;
  const OmegaMatrix: number[][] = Array(k).fill(null).map((_, i) =>
    Array(k).fill(0).map((_, j) => i === j ? Omega[i][0] : 0)
  );

  // τΣ
  const tauCov = cov.map(row => row.map(val => val * tau));

  // Master formula: E[R] = [(τΣ)^(-1) + P'Ω^(-1)P]^(-1) [(τΣ)^(-1)π + P'Ω^(-1)Q]

  const tauCovInv = matrixInverse(tauCov);
  const OmegaInv = matrixInverse(OmegaMatrix);

  // P'Ω^(-1)P
  const Pt = transpose(P);
  const PtOmegaInv = matrixMultiply(Pt, OmegaInv);
  const PtOmegaInvP = matrixMultiply(PtOmegaInv, P);

  // (τΣ)^(-1) + P'Ω^(-1)P
  const sumMatrix = tauCovInv.map((row, i) =>
    row.map((val, j) => val + PtOmegaInvP[i][j])
  );
  const sumMatrixInv = matrixInverse(sumMatrix);

  // (τΣ)^(-1)π
  const tauCovInvPi = matrixVectorMultiply(tauCovInv, impliedReturns);

  // P'Ω^(-1)Q
  const PtOmegaInvQ = matrixVectorMultiply(PtOmegaInv, Q);

  // Sum
  const rightSide = vectorAdd(tauCovInvPi, PtOmegaInvQ);

  // Posterior returns
  const posteriorReturns = matrixVectorMultiply(sumMatrixInv, rightSide);

  // Optimal weights
  const covInv = matrixInverse(cov);
  const rawWeights = vectorScale(matrixVectorMultiply(covInv, posteriorReturns), 1 / riskAversion);

  // Normalize
  const sum = rawWeights.reduce((a, b) => a + b, 0);
  const weights = rawWeights.map(w => w / sum);

  return {
    weights,
    expectedReturns: posteriorReturns
  };
}

// Portfolio analysis
function analyzePortfolio(
  weights: number[],
  expectedReturns: number[],
  cov: number[][],
  riskFreeRate: number = 0
): {
  return: number;
  risk: number;
  sharpe: number;
  diversification_ratio: number;
  concentration: number;
  max_drawdown_estimate: number;
} {
  const ret = portfolioReturn(weights, expectedReturns);
  const variance = portfolioVariance(weights, cov);
  const risk = Math.sqrt(variance);
  const sharpe = (ret - riskFreeRate) / risk;

  // Diversification ratio
  const individualVols = cov.map((_, i) => Math.sqrt(cov[i][i]));
  const weightedVol = vectorDot(weights, individualVols);
  const diversificationRatio = weightedVol / risk;

  // Concentration (Herfindahl index)
  const concentration = weights.reduce((sum, w) => sum + w * w, 0);

  // Estimated max drawdown (using Gaussian approximation)
  const annualVol = risk * Math.sqrt(252); // Assuming daily returns
  const maxDrawdownEstimate = annualVol * 2.5; // Rough approximation

  return {
    return: ret,
    risk,
    sharpe,
    diversification_ratio: diversificationRatio,
    concentration,
    max_drawdown_estimate: maxDrawdownEstimate
  };
}

export async function executeportfoliooptimization(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'optimize';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'portfolio_optimization',
          description: 'Portfolio optimization using modern portfolio theory',
          methods: {
            mean_variance: {
              name: 'Markowitz Mean-Variance',
              description: 'Classic optimization minimizing variance for target return',
              inputs: 'expected_returns, covariance_matrix, target_return',
              output: 'optimal weights'
            },
            efficient_frontier: {
              name: 'Efficient Frontier',
              description: 'Set of optimal portfolios for different risk levels',
              inputs: 'expected_returns, covariance_matrix, num_points',
              output: 'frontier points (return, risk, weights)'
            },
            sharpe_ratio: {
              name: 'Maximum Sharpe Ratio',
              description: 'Tangency portfolio maximizing risk-adjusted return',
              inputs: 'expected_returns, covariance_matrix, risk_free_rate',
              output: 'optimal weights, sharpe ratio'
            },
            risk_parity: {
              name: 'Risk Parity',
              description: 'Equal risk contribution from each asset',
              inputs: 'covariance_matrix',
              output: 'weights, risk contributions'
            },
            black_litterman: {
              name: 'Black-Litterman',
              description: 'Bayesian approach combining market equilibrium with investor views',
              inputs: 'market_weights, covariance, views',
              output: 'adjusted expected returns, optimal weights'
            }
          },
          inputs: {
            returns: 'Array of expected returns for each asset',
            covariance: '2D array covariance matrix',
            historical_returns: '2D array of historical returns (auto-computes cov)',
            risk_free_rate: 'Risk-free rate (default 0)',
            target_return: 'Target portfolio return for optimization',
            constraints: '{ min_weight, max_weight } for bounds'
          },
          example_usage: {
            optimize: {
              operation: 'optimize',
              returns: [0.12, 0.10, 0.08],
              covariance: [[0.04, 0.01, 0.005], [0.01, 0.03, 0.008], [0.005, 0.008, 0.02]],
              target_return: 0.10
            }
          }
        }, null, 2)
      };
    }

    // Get or compute covariance and returns
    let cov: number[][] = args.covariance;
    let expectedReturns: number[] = args.returns;

    if (args.historical_returns && args.historical_returns.length > 0) {
      cov = calculateCovariance(args.historical_returns);
      if (!expectedReturns) {
        expectedReturns = calculateExpectedReturns(args.historical_returns);
      }
    }

    // Sample data if not provided
    if (!cov || cov.length === 0) {
      // Default 3-asset example
      cov = [
        [0.04, 0.01, 0.005],
        [0.01, 0.03, 0.008],
        [0.005, 0.008, 0.02]
      ];
      expectedReturns = expectedReturns || [0.12, 0.10, 0.08];
    }

    if (!expectedReturns) {
      expectedReturns = Array(cov.length).fill(0.08);
    }

    const riskFreeRate = args.risk_free_rate ?? 0.02;

    if (operation === 'optimize') {
      const constraints = args.constraints || {};
      const result = markowitzOptimize(expectedReturns, cov, args.target_return, constraints);

      const analysis = analyzePortfolio(result.weights, expectedReturns, cov, riskFreeRate);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'optimize',
          method: 'mean_variance',
          target_return: args.target_return,
          results: {
            weights: result.weights.map(w => Math.round(w * 10000) / 10000),
            expected_return: (result.return * 100).toFixed(2) + '%',
            expected_risk: (result.risk * 100).toFixed(2) + '%',
            sharpe_ratio: analysis.sharpe.toFixed(3),
            diversification_ratio: analysis.diversification_ratio.toFixed(3),
            concentration_hhi: analysis.concentration.toFixed(4)
          },
          allocation_summary: result.weights.map((w, i) =>
            `Asset ${i + 1}: ${(w * 100).toFixed(1)}%`
          )
        }, null, 2)
      };
    }

    if (operation === 'sharpe_ratio') {
      const result = maxSharpeRatio(expectedReturns, cov, riskFreeRate);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'sharpe_ratio',
          method: 'tangency_portfolio',
          risk_free_rate: (riskFreeRate * 100).toFixed(2) + '%',
          results: {
            weights: result.weights.map(w => Math.round(w * 10000) / 10000),
            expected_return: (result.return * 100).toFixed(2) + '%',
            expected_risk: (result.risk * 100).toFixed(2) + '%',
            sharpe_ratio: result.sharpe.toFixed(3)
          },
          note: 'Maximum Sharpe ratio portfolio (tangency portfolio)'
        }, null, 2)
      };
    }

    if (operation === 'efficient_frontier') {
      const numPoints = args.num_points || 20;
      const frontier = efficientFrontier(expectedReturns, cov, numPoints);

      // Find max Sharpe point
      let maxSharpe = -Infinity;
      let maxSharpeIdx = 0;
      frontier.forEach((p, i) => {
        const sharpe = (p.return - riskFreeRate) / p.risk;
        if (sharpe > maxSharpe) {
          maxSharpe = sharpe;
          maxSharpeIdx = i;
        }
      });

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'efficient_frontier',
          num_points: frontier.length,
          frontier: frontier.map((p, i) => ({
            point: i + 1,
            return: (p.return * 100).toFixed(2) + '%',
            risk: (p.risk * 100).toFixed(2) + '%',
            sharpe: ((p.return - riskFreeRate) / p.risk).toFixed(3),
            is_tangency: i === maxSharpeIdx
          })),
          tangency_portfolio: {
            index: maxSharpeIdx + 1,
            weights: frontier[maxSharpeIdx].weights.map(w => Math.round(w * 10000) / 10000),
            sharpe: maxSharpe.toFixed(3)
          }
        }, null, 2)
      };
    }

    if (operation === 'risk_parity') {
      const result = riskParity(cov);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'risk_parity',
          description: 'Equal risk contribution portfolio',
          results: {
            weights: result.weights.map(w => Math.round(w * 10000) / 10000),
            portfolio_risk: (result.risk * 100).toFixed(2) + '%',
            risk_contributions: result.risk_contributions.map(rc =>
              (rc * 100).toFixed(2) + '%'
            )
          },
          verification: {
            target_contribution: (100 / cov.length).toFixed(2) + '%',
            actual_contributions: result.risk_contributions.map(rc =>
              (rc / result.risk * 100).toFixed(2) + '%'
            )
          }
        }, null, 2)
      };
    }

    if (operation === 'black_litterman') {
      const marketWeights = args.market_weights || Array(cov.length).fill(1 / cov.length);
      const views = args.views || [];

      const result = blackLitterman(marketWeights, cov, views);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'black_litterman',
          description: 'Black-Litterman model combining equilibrium with views',
          inputs: {
            market_weights: marketWeights,
            num_views: views.length
          },
          results: {
            posterior_returns: result.expectedReturns.map(r => (r * 100).toFixed(2) + '%'),
            optimal_weights: result.weights.map(w => Math.round(w * 10000) / 10000)
          },
          analysis: analyzePortfolio(result.weights, result.expectedReturns, cov, riskFreeRate)
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      const weights = args.weights || Array(cov.length).fill(1 / cov.length);
      const analysis = analyzePortfolio(weights, expectedReturns, cov, riskFreeRate);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          input_weights: weights,
          analysis: {
            expected_return: (analysis.return * 100).toFixed(2) + '%',
            expected_risk: (analysis.risk * 100).toFixed(2) + '%',
            sharpe_ratio: analysis.sharpe.toFixed(3),
            diversification_ratio: analysis.diversification_ratio.toFixed(3),
            concentration_hhi: analysis.concentration.toFixed(4),
            estimated_max_drawdown: (analysis.max_drawdown_estimate * 100).toFixed(1) + '%'
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: 'Unknown operation',
        available: ['optimize', 'efficient_frontier', 'risk_parity', 'black_litterman', 'sharpe_ratio', 'analyze', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isportfoliooptimizationAvailable(): boolean {
  return true;
}
