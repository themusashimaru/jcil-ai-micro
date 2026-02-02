/**
 * VALUE-AT-RISK TOOL
 * Portfolio risk measurement using VaR methodologies
 * Implements: Parametric, Historical, Monte Carlo VaR, Expected Shortfall
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const valueatriskTool: UnifiedTool = {
  name: 'value_at_risk',
  description: 'Value at Risk (VaR) calculation for portfolio risk management',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'parametric', 'historical', 'monte_carlo', 'expected_shortfall', 'portfolio', 'backtest', 'demonstrate'],
        description: 'Operation to perform'
      },
      confidence: { type: 'number', description: 'Confidence level (e.g., 0.95, 0.99)' },
      horizon: { type: 'number', description: 'Time horizon in days' },
      portfolio_value: { type: 'number', description: 'Total portfolio value' },
      returns: { type: 'array', items: { type: 'number' }, description: 'Historical returns' },
      volatility: { type: 'number', description: 'Annual volatility (σ)' },
      positions: { type: 'array', items: { type: 'object' }, description: 'Portfolio positions' },
      simulations: { type: 'number', description: 'Number of Monte Carlo simulations' }
    },
    required: ['operation']
  }
};

// Standard normal CDF
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

// Inverse normal CDF (approximation)
function normalInvCDF(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Rational approximation for central region
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// Generate normal random variable (Box-Muller)
function normalRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// Calculate statistics
function calculateStats(returns: number[]): { mean: number; std: number; skew: number; kurtosis: number } {
  const n = returns.length;
  const mean = returns.reduce((a, b) => a + b, 0) / n;

  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
  const std = Math.sqrt(variance);

  const skew = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 3), 0) / n;
  const kurtosis = returns.reduce((sum, r) => sum + Math.pow((r - mean) / std, 4), 0) / n - 3;

  return { mean, std, skew, kurtosis };
}

// Parametric VaR (Variance-Covariance method)
function parametricVaR(
  portfolioValue: number,
  volatility: number,
  confidence: number,
  horizon: number = 1
): { var: number; percentVar: number; zScore: number } {
  const zScore = normalInvCDF(1 - confidence);
  const horizonAdj = Math.sqrt(horizon / 252); // Convert to daily (252 trading days)
  const percentVar = -zScore * volatility * horizonAdj;
  const varValue = portfolioValue * percentVar;

  return {
    var: varValue,
    percentVar: percentVar,
    zScore: zScore
  };
}

// Historical VaR
function historicalVaR(
  returns: number[],
  portfolioValue: number,
  confidence: number,
  horizon: number = 1
): { var: number; percentVar: number; worstReturn: number; numObservations: number } {
  // Sort returns
  const sortedReturns = [...returns].sort((a, b) => a - b);

  // Find percentile
  const percentileIndex = Math.floor((1 - confidence) * returns.length);
  const varReturn = sortedReturns[percentileIndex];

  // Scale for horizon
  const horizonAdj = Math.sqrt(horizon);
  const percentVar = -varReturn * horizonAdj;
  const varValue = portfolioValue * percentVar;

  return {
    var: varValue,
    percentVar: percentVar,
    worstReturn: sortedReturns[0],
    numObservations: returns.length
  };
}

// Monte Carlo VaR
function monteCarloVaR(
  portfolioValue: number,
  mean: number,
  volatility: number,
  confidence: number,
  horizon: number = 1,
  simulations: number = 10000
): { var: number; percentVar: number; simulatedReturns: number[]; statistics: any } {
  const dt = horizon / 252;
  const drift = (mean - 0.5 * volatility * volatility) * dt;
  const diffusion = volatility * Math.sqrt(dt);

  const simulatedReturns: number[] = [];

  for (let i = 0; i < simulations; i++) {
    const z = normalRandom();
    const logReturn = drift + diffusion * z;
    simulatedReturns.push(Math.exp(logReturn) - 1);
  }

  // Sort and find VaR
  const sortedReturns = [...simulatedReturns].sort((a, b) => a - b);
  const percentileIndex = Math.floor((1 - confidence) * simulations);
  const varReturn = sortedReturns[percentileIndex];

  const percentVar = -varReturn;
  const varValue = portfolioValue * percentVar;

  const stats = calculateStats(simulatedReturns);

  return {
    var: varValue,
    percentVar: percentVar,
    simulatedReturns: sortedReturns.slice(0, 100), // First 100 worst
    statistics: {
      mean: stats.mean,
      std: stats.std,
      skew: stats.skew,
      kurtosis: stats.kurtosis
    }
  };
}

// Expected Shortfall (CVaR)
function expectedShortfall(
  returns: number[],
  portfolioValue: number,
  confidence: number
): { es: number; percentES: number; numTailObservations: number } {
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const cutoffIndex = Math.floor((1 - confidence) * returns.length);

  // Average of returns in the tail
  const tailReturns = sortedReturns.slice(0, cutoffIndex + 1);
  const avgTailReturn = tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length;

  const percentES = -avgTailReturn;
  const esValue = portfolioValue * percentES;

  return {
    es: esValue,
    percentES: percentES,
    numTailObservations: tailReturns.length
  };
}

// Portfolio VaR with correlation
function portfolioVaR(
  positions: { value: number; volatility: number; weight: number }[],
  correlationMatrix: number[][],
  confidence: number,
  horizon: number = 1
): { var: number; marginalVaR: number[]; componentVaR: number[]; diversificationBenefit: number } {
  const n = positions.length;
  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);

  // Calculate portfolio variance
  let portfolioVariance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portfolioVariance +=
        positions[i].weight * positions[j].weight *
        positions[i].volatility * positions[j].volatility *
        correlationMatrix[i][j];
    }
  }

  const portfolioVol = Math.sqrt(portfolioVariance);
  const horizonAdj = Math.sqrt(horizon / 252);
  const zScore = normalInvCDF(1 - confidence);

  const portfolioVaR = -zScore * portfolioVol * horizonAdj * totalValue;

  // Individual VaRs (undiversified)
  const individualVaRs = positions.map(p =>
    -zScore * p.volatility * horizonAdj * p.value
  );
  const undiversifiedVaR = individualVaRs.reduce((a, b) => a + b, 0);

  // Marginal VaR (sensitivity)
  const marginalVaR = positions.map((p, i) => {
    let marginalContrib = 0;
    for (let j = 0; j < n; j++) {
      marginalContrib +=
        positions[j].weight * positions[j].volatility * correlationMatrix[i][j];
    }
    return (-zScore * horizonAdj * p.volatility * marginalContrib / portfolioVol) * totalValue;
  });

  // Component VaR
  const componentVaR = marginalVaR.map((mv, i) => mv * positions[i].weight);

  const diversificationBenefit = undiversifiedVaR - portfolioVaR;

  return {
    var: portfolioVaR,
    marginalVaR,
    componentVaR,
    diversificationBenefit
  };
}

// VaR Backtesting
function backtestVaR(
  actualReturns: number[],
  varEstimates: number[],
  confidence: number
): {
  exceptions: number;
  exceptionRate: number;
  expectedExceptions: number;
  kupiecTest: { statistic: number; pValue: number; pass: boolean };
} {
  const n = actualReturns.length;
  const exceptions = actualReturns.filter((r, i) => r < -varEstimates[i]).length;
  const exceptionRate = exceptions / n;
  const expectedRate = 1 - confidence;
  const expectedExceptions = expectedRate * n;

  // Kupiec's POF test
  const p = expectedRate;
  const pHat = exceptionRate;

  let kupiecStat: number;
  if (pHat === 0 || pHat === 1) {
    kupiecStat = n * Math.abs(Math.log(p / 0.001));
  } else {
    kupiecStat = -2 * (
      exceptions * Math.log(p / pHat) +
      (n - exceptions) * Math.log((1 - p) / (1 - pHat))
    );
  }

  // Chi-squared p-value with 1 df (simplified)
  const pValue = 1 - normalCDF(Math.sqrt(kupiecStat));

  return {
    exceptions,
    exceptionRate,
    expectedExceptions,
    kupiecTest: {
      statistic: kupiecStat,
      pValue: pValue,
      pass: pValue > 0.05
    }
  };
}

// Generate sample returns
function generateSampleReturns(n: number, mean: number = 0, std: number = 0.02): number[] {
  const returns: number[] = [];
  for (let i = 0; i < n; i++) {
    returns.push(mean + std * normalRandom());
  }
  return returns;
}

export async function executevalueatrisk(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'value-at-risk',
          description: 'Portfolio risk measurement using VaR methodologies',
          operations: [
            'info - Tool information',
            'parametric - Parametric (variance-covariance) VaR',
            'historical - Historical simulation VaR',
            'monte_carlo - Monte Carlo simulation VaR',
            'expected_shortfall - Expected Shortfall (CVaR)',
            'portfolio - Multi-asset portfolio VaR',
            'backtest - VaR model backtesting',
            'demonstrate - Show VaR examples'
          ],
          definition: 'VaR measures the maximum potential loss at a given confidence level over a specified time horizon',
          formula: 'VaR(α) = -μ + σ × Z(α)',
          confidenceLevels: ['95% (1.645σ)', '99% (2.326σ)', '99.5% (2.576σ)'],
          methods: {
            parametric: 'Assumes normal distribution, uses mean/variance',
            historical: 'Uses actual historical returns distribution',
            monteCarlo: 'Simulates many scenarios from assumed distribution'
          }
        };
        break;

      case 'parametric': {
        const portfolioValue = args.portfolio_value || 1000000;
        const volatility = args.volatility || 0.2;
        const confidence = args.confidence || 0.95;
        const horizon = args.horizon || 1;

        const varResult = parametricVaR(portfolioValue, volatility, confidence, horizon);

        result = {
          method: 'Parametric (Variance-Covariance)',
          inputs: {
            portfolioValue: portfolioValue,
            annualVolatility: (volatility * 100).toFixed(2) + '%',
            confidence: (confidence * 100).toFixed(1) + '%',
            horizonDays: horizon
          },
          results: {
            valueAtRisk: '$' + varResult.var.toFixed(2),
            percentageVaR: (varResult.percentVar * 100).toFixed(4) + '%',
            zScore: varResult.zScore.toFixed(4)
          },
          interpretation: `With ${(confidence * 100).toFixed(0)}% confidence, the maximum ${horizon}-day loss will not exceed $${varResult.var.toFixed(2)}`,
          assumptions: [
            'Returns are normally distributed',
            'Volatility is constant',
            'No fat tails or skewness'
          ]
        };
        break;
      }

      case 'historical': {
        const portfolioValue = args.portfolio_value || 1000000;
        const confidence = args.confidence || 0.95;
        const horizon = args.horizon || 1;
        const returns = args.returns || generateSampleReturns(252);

        const stats = calculateStats(returns);
        const varResult = historicalVaR(returns, portfolioValue, confidence, horizon);

        result = {
          method: 'Historical Simulation',
          inputs: {
            portfolioValue: portfolioValue,
            confidence: (confidence * 100).toFixed(1) + '%',
            horizonDays: horizon,
            observations: returns.length
          },
          returnStatistics: {
            mean: (stats.mean * 100).toFixed(4) + '%',
            standardDeviation: (stats.std * 100).toFixed(4) + '%',
            skewness: stats.skew.toFixed(4),
            excessKurtosis: stats.kurtosis.toFixed(4)
          },
          results: {
            valueAtRisk: '$' + varResult.var.toFixed(2),
            percentageVaR: (varResult.percentVar * 100).toFixed(4) + '%',
            worstReturn: (varResult.worstReturn * 100).toFixed(4) + '%'
          },
          advantages: ['No distributional assumptions', 'Captures fat tails', 'Simple to understand'],
          disadvantages: ['Limited by historical data', 'Assumes past = future', 'Sensitive to sample period']
        };
        break;
      }

      case 'monte_carlo': {
        const portfolioValue = args.portfolio_value || 1000000;
        const volatility = args.volatility || 0.2;
        const confidence = args.confidence || 0.95;
        const horizon = args.horizon || 1;
        const simulations = args.simulations || 10000;

        const varResult = monteCarloVaR(portfolioValue, 0.08, volatility, confidence, horizon, simulations);

        result = {
          method: 'Monte Carlo Simulation',
          inputs: {
            portfolioValue: portfolioValue,
            annualVolatility: (volatility * 100).toFixed(2) + '%',
            confidence: (confidence * 100).toFixed(1) + '%',
            horizonDays: horizon,
            simulations: simulations
          },
          simulationStats: {
            mean: (varResult.statistics.mean * 100).toFixed(4) + '%',
            std: (varResult.statistics.std * 100).toFixed(4) + '%',
            skew: varResult.statistics.skew.toFixed(4),
            kurtosis: varResult.statistics.kurtosis.toFixed(4)
          },
          results: {
            valueAtRisk: '$' + varResult.var.toFixed(2),
            percentageVaR: (varResult.percentVar * 100).toFixed(4) + '%',
            worst5Scenarios: varResult.simulatedReturns.slice(0, 5).map(r => (r * 100).toFixed(4) + '%')
          },
          advantages: ['Flexible distribution assumptions', 'Can model complex payoffs', 'Path-dependent options'],
          disadvantages: ['Computationally intensive', 'Model risk', 'Random seed sensitivity']
        };
        break;
      }

      case 'expected_shortfall': {
        const portfolioValue = args.portfolio_value || 1000000;
        const confidence = args.confidence || 0.95;
        const returns = args.returns || generateSampleReturns(252);

        const varResult = historicalVaR(returns, portfolioValue, confidence, 1);
        const esResult = expectedShortfall(returns, portfolioValue, confidence);

        result = {
          method: 'Expected Shortfall (CVaR)',
          inputs: {
            portfolioValue: portfolioValue,
            confidence: (confidence * 100).toFixed(1) + '%',
            observations: returns.length
          },
          results: {
            valueAtRisk: '$' + varResult.var.toFixed(2),
            expectedShortfall: '$' + esResult.es.toFixed(2),
            percentageES: (esResult.percentES * 100).toFixed(4) + '%',
            tailObservations: esResult.numTailObservations
          },
          comparison: {
            esDividedByVaR: (esResult.es / varResult.var).toFixed(4),
            interpretation: `When losses exceed VaR, expected loss is $${esResult.es.toFixed(2)}`
          },
          advantages: [
            'Coherent risk measure',
            'Captures tail risk',
            'Better for optimization',
            'Required by Basel III'
          ]
        };
        break;
      }

      case 'portfolio': {
        const positions = args.positions || [
          { name: 'Stocks', value: 600000, volatility: 0.20, weight: 0.6 },
          { name: 'Bonds', value: 300000, volatility: 0.05, weight: 0.3 },
          { name: 'Gold', value: 100000, volatility: 0.15, weight: 0.1 }
        ];
        const confidence = args.confidence || 0.95;
        const horizon = args.horizon || 1;

        // Correlation matrix
        const correlationMatrix = [
          [1.0, 0.2, -0.1],
          [0.2, 1.0, 0.1],
          [-0.1, 0.1, 1.0]
        ];

        const portfolioResult = portfolioVaR(positions, correlationMatrix, confidence, horizon);

        result = {
          method: 'Portfolio VaR with Correlation',
          inputs: {
            positions: positions.map((p: any) => ({
              name: p.name,
              value: '$' + p.value.toFixed(0),
              weight: (p.weight * 100).toFixed(1) + '%',
              volatility: (p.volatility * 100).toFixed(1) + '%'
            })),
            confidence: (confidence * 100).toFixed(1) + '%',
            horizonDays: horizon
          },
          correlations: {
            'Stocks-Bonds': correlationMatrix[0][1],
            'Stocks-Gold': correlationMatrix[0][2],
            'Bonds-Gold': correlationMatrix[1][2]
          },
          results: {
            portfolioVaR: '$' + portfolioResult.var.toFixed(2),
            componentVaR: positions.map((p: any, i: number) => ({
              name: p.name,
              componentVaR: '$' + portfolioResult.componentVaR[i].toFixed(2)
            })),
            diversificationBenefit: '$' + portfolioResult.diversificationBenefit.toFixed(2)
          },
          analysis: {
            diversificationRatio: (portfolioResult.diversificationBenefit / portfolioResult.var).toFixed(4),
            interpretation: 'Diversification reduces VaR by ' +
              (portfolioResult.diversificationBenefit / (portfolioResult.var + portfolioResult.diversificationBenefit) * 100).toFixed(1) + '%'
          }
        };
        break;
      }

      case 'backtest': {
        const confidence = args.confidence || 0.95;
        const returns = args.returns || generateSampleReturns(252);

        // Generate VaR estimates (using rolling volatility)
        const varEstimates = returns.map(() => {
          const vol = 0.02; // Simplified constant vol
          return -normalInvCDF(1 - confidence) * vol;
        });

        const backtestResult = backtestVaR(returns, varEstimates, confidence);

        result = {
          method: 'VaR Backtesting',
          inputs: {
            confidence: (confidence * 100).toFixed(1) + '%',
            observations: returns.length,
            expectedExceptionRate: ((1 - confidence) * 100).toFixed(1) + '%'
          },
          results: {
            actualExceptions: backtestResult.exceptions,
            expectedExceptions: backtestResult.expectedExceptions.toFixed(1),
            exceptionRate: (backtestResult.exceptionRate * 100).toFixed(2) + '%'
          },
          kupiecTest: {
            testStatistic: backtestResult.kupiecTest.statistic.toFixed(4),
            pValue: backtestResult.kupiecTest.pValue.toFixed(4),
            result: backtestResult.kupiecTest.pass ? 'PASS' : 'FAIL',
            interpretation: backtestResult.kupiecTest.pass
              ? 'VaR model is statistically valid'
              : 'VaR model may be misspecified'
          },
          trafficLight: {
            zone: backtestResult.exceptions <= 4 ? 'Green' :
                  backtestResult.exceptions <= 9 ? 'Yellow' : 'Red',
            explanation: 'Basel traffic light approach for 250-day window at 99%'
          }
        };
        break;
      }

      case 'demonstrate': {
        const portfolioValue = 1000000;
        const volatility = 0.20;
        const returns = generateSampleReturns(252, 0, 0.015);

        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║                VALUE AT RISK (VaR) DEMONSTRATION                      ║
╚═══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
                     WHAT IS VALUE AT RISK?
═══════════════════════════════════════════════════════════════════════

VaR answers: "What is the maximum loss I can expect at a given
confidence level over a specified time horizon?"

Example: 1-day 95% VaR of $50,000 means:
  • 95% of the time, daily loss ≤ $50,000
  • 5% of the time, loss may exceed $50,000

Portfolio: $${portfolioValue.toLocaleString()}
Annual Volatility: ${(volatility * 100).toFixed(0)}%

═══════════════════════════════════════════════════════════════════════
                    1. PARAMETRIC VaR
═══════════════════════════════════════════════════════════════════════

Assumes returns are normally distributed.

Formula: VaR = Portfolio × σ × Z(α) × √(horizon/252)

`;

        for (const conf of [0.95, 0.99]) {
          const varResult = parametricVaR(portfolioValue, volatility, conf, 1);
          demo += `${(conf * 100).toFixed(0)}% Confidence:
  Z-score: ${varResult.zScore.toFixed(4)}
  1-day VaR: $${varResult.var.toFixed(2)} (${(varResult.percentVar * 100).toFixed(2)}%)

`;
        }

        demo += `Scaling by Time Horizon:
  1-day VaR:  $${parametricVaR(portfolioValue, volatility, 0.95, 1).var.toFixed(2)}
  5-day VaR:  $${parametricVaR(portfolioValue, volatility, 0.95, 5).var.toFixed(2)}
  10-day VaR: $${parametricVaR(portfolioValue, volatility, 0.95, 10).var.toFixed(2)}

═══════════════════════════════════════════════════════════════════════
                    2. HISTORICAL VaR
═══════════════════════════════════════════════════════════════════════

Uses actual historical returns - no distribution assumption.

Based on ${returns.length} daily returns:
`;

        const stats = calculateStats(returns);
        demo += `
  Return Statistics:
    Mean:     ${(stats.mean * 100).toFixed(4)}%
    Std Dev:  ${(stats.std * 100).toFixed(4)}%
    Skewness: ${stats.skew.toFixed(4)}
    Kurtosis: ${stats.kurtosis.toFixed(4)} (excess)

`;

        const histVar95 = historicalVaR(returns, portfolioValue, 0.95, 1);
        const histVar99 = historicalVaR(returns, portfolioValue, 0.99, 1);

        demo += `  Historical VaR:
    95% VaR: $${histVar95.var.toFixed(2)}
    99% VaR: $${histVar99.var.toFixed(2)}
    Worst:   ${(histVar95.worstReturn * 100).toFixed(4)}%

═══════════════════════════════════════════════════════════════════════
                    3. MONTE CARLO VaR
═══════════════════════════════════════════════════════════════════════

Simulates thousands of scenarios.
`;

        const mcVar = monteCarloVaR(portfolioValue, 0.08, volatility, 0.95, 1, 10000);

        demo += `
  10,000 Simulations:
    Mean Return: ${(mcVar.statistics.mean * 100).toFixed(4)}%
    Std Dev:     ${(mcVar.statistics.std * 100).toFixed(4)}%
    95% VaR:     $${mcVar.var.toFixed(2)}

  Worst 5 Simulated Scenarios:
    ${mcVar.simulatedReturns.slice(0, 5).map((r, i) => `${i+1}. ${(r * 100).toFixed(2)}%`).join('\n    ')}

═══════════════════════════════════════════════════════════════════════
                    4. EXPECTED SHORTFALL (CVaR)
═══════════════════════════════════════════════════════════════════════

ES = Average loss when VaR is exceeded (tail risk measure)

`;

        const esResult = expectedShortfall(returns, portfolioValue, 0.95);

        demo += `  95% Confidence Level:
    VaR: $${histVar95.var.toFixed(2)}
    ES:  $${esResult.es.toFixed(2)}
    ES/VaR Ratio: ${(esResult.es / histVar95.var).toFixed(2)}

  Interpretation:
    • 95% of the time, loss ≤ VaR
    • When loss > VaR, expected loss = ES

═══════════════════════════════════════════════════════════════════════
                    5. PORTFOLIO DIVERSIFICATION
═══════════════════════════════════════════════════════════════════════

3-Asset Portfolio:
  • Stocks: $600,000 (60%), σ=20%
  • Bonds:  $300,000 (30%), σ=5%
  • Gold:   $100,000 (10%), σ=15%

Correlations:
  Stocks-Bonds: 0.2
  Stocks-Gold: -0.1
  Bonds-Gold:   0.1

`;

        const positions = [
          { name: 'Stocks', value: 600000, volatility: 0.20, weight: 0.6 },
          { name: 'Bonds', value: 300000, volatility: 0.05, weight: 0.3 },
          { name: 'Gold', value: 100000, volatility: 0.15, weight: 0.1 }
        ];
        const corrMatrix = [[1.0, 0.2, -0.1], [0.2, 1.0, 0.1], [-0.1, 0.1, 1.0]];
        const portVar = portfolioVaR(positions, corrMatrix, 0.95, 1);

        demo += `  Undiversified (sum of individual VaRs):
    Stocks VaR: $${parametricVaR(600000, 0.20, 0.95, 1).var.toFixed(2)}
    Bonds VaR:  $${parametricVaR(300000, 0.05, 0.95, 1).var.toFixed(2)}
    Gold VaR:   $${parametricVaR(100000, 0.15, 0.95, 1).var.toFixed(2)}
    Total:      $${(parametricVaR(600000, 0.20, 0.95, 1).var + parametricVaR(300000, 0.05, 0.95, 1).var + parametricVaR(100000, 0.15, 0.95, 1).var).toFixed(2)}

  Diversified Portfolio VaR: $${portVar.var.toFixed(2)}
  Diversification Benefit:   $${portVar.diversificationBenefit.toFixed(2)}

═══════════════════════════════════════════════════════════════════════
                        METHOD COMPARISON
═══════════════════════════════════════════════════════════════════════

┌──────────────┬─────────────┬─────────────────────────────────────────┐
│ Method       │ 95% VaR     │ Characteristics                         │
├──────────────┼─────────────┼─────────────────────────────────────────┤
│ Parametric   │ $${parametricVaR(portfolioValue, volatility, 0.95, 1).var.toFixed(0).padEnd(8)}│ Simple, assumes normality              │
│ Historical   │ $${histVar95.var.toFixed(0).padEnd(8)}│ No assumptions, data-dependent         │
│ Monte Carlo  │ $${mcVar.var.toFixed(0).padEnd(8)}│ Flexible, computationally intensive    │
└──────────────┴─────────────┴─────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ 1. VaR tells you MAXIMUM loss at confidence level                  │
│ 2. ES/CVaR tells you EXPECTED loss when VaR is exceeded            │
│ 3. Parametric VaR underestimates risk with fat tails               │
│ 4. Historical VaR depends heavily on sample period                 │
│ 5. Diversification reduces portfolio VaR significantly             │
│ 6. VaR is NOT the worst-case loss (that's still possible!)         │
└─────────────────────────────────────────────────────────────────────┘
`;

        result = {
          demonstration: demo,
          summary: {
            methods: ['Parametric', 'Historical', 'Monte Carlo'],
            riskMeasures: ['VaR', 'Expected Shortfall', 'Component VaR'],
            applications: ['Risk limits', 'Capital allocation', 'Performance measurement']
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'parametric', 'historical', 'monte_carlo', 'expected_shortfall', 'portfolio', 'backtest', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isvalueatriskAvailable(): boolean { return true; }
