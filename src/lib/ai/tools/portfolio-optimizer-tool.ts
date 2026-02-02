/**
 * PORTFOLIO OPTIMIZER TOOL
 * Modern Portfolio Theory, asset allocation, and risk optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Asset { symbol: string; name: string; expectedReturn: number; volatility: number; weight: number; }
interface Portfolio { assets: Asset[]; expectedReturn: number; volatility: number; sharpeRatio: number; }
interface CorrelationMatrix { assets: string[]; matrix: number[][]; }

function generateMockAssets(): Asset[] {
  return [
    { symbol: 'SPY', name: 'S&P 500 ETF', expectedReturn: 0.10, volatility: 0.15, weight: 0 },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF', expectedReturn: 0.12, volatility: 0.20, weight: 0 },
    { symbol: 'BND', name: 'Bond ETF', expectedReturn: 0.04, volatility: 0.05, weight: 0 },
    { symbol: 'GLD', name: 'Gold ETF', expectedReturn: 0.06, volatility: 0.12, weight: 0 },
    { symbol: 'VNQ', name: 'Real Estate ETF', expectedReturn: 0.08, volatility: 0.18, weight: 0 },
    { symbol: 'EEM', name: 'Emerging Markets ETF', expectedReturn: 0.11, volatility: 0.22, weight: 0 },
    { symbol: 'TLT', name: 'Long-Term Treasury ETF', expectedReturn: 0.05, volatility: 0.10, weight: 0 },
    { symbol: 'VTI', name: 'Total Market ETF', expectedReturn: 0.09, volatility: 0.14, weight: 0 },
  ];
}

function generateCorrelationMatrix(assets: Asset[]): CorrelationMatrix {
  const n = assets.length;
  const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 1;
      } else {
        // Generate semi-realistic correlations
        const baseCorr = 0.3 + Math.random() * 0.4;
        matrix[i][j] = Math.round(baseCorr * 100) / 100;
        matrix[j][i] = matrix[i][j];
      }
    }
  }

  // Bonds typically negatively correlated with stocks
  const bondIndex = assets.findIndex(a => a.symbol === 'BND' || a.symbol === 'TLT');
  if (bondIndex !== -1) {
    for (let i = 0; i < n; i++) {
      if (i !== bondIndex && assets[i].volatility > 0.12) {
        matrix[bondIndex][i] = -0.2 + Math.random() * 0.3;
        matrix[i][bondIndex] = matrix[bondIndex][i];
      }
    }
  }

  return { assets: assets.map(a => a.symbol), matrix };
}

function calculatePortfolioMetrics(assets: Asset[], correlations: CorrelationMatrix, riskFreeRate: number = 0.02): Portfolio {
  const totalWeight = assets.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return { assets, expectedReturn: 0, volatility: 0, sharpeRatio: 0 };

  // Normalize weights
  const normalizedAssets = assets.map(a => ({ ...a, weight: a.weight / totalWeight }));

  // Expected return
  const expectedReturn = normalizedAssets.reduce((sum, a) => sum + a.expectedReturn * a.weight, 0);

  // Portfolio variance
  let variance = 0;
  for (let i = 0; i < normalizedAssets.length; i++) {
    for (let j = 0; j < normalizedAssets.length; j++) {
      const corr = correlations.matrix[i][j];
      variance += normalizedAssets[i].weight * normalizedAssets[j].weight *
                  normalizedAssets[i].volatility * normalizedAssets[j].volatility * corr;
    }
  }
  const volatility = Math.sqrt(variance);

  // Sharpe ratio
  const sharpeRatio = (expectedReturn - riskFreeRate) / volatility;

  return {
    assets: normalizedAssets,
    expectedReturn: Math.round(expectedReturn * 10000) / 10000,
    volatility: Math.round(volatility * 10000) / 10000,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100
  };
}

function optimizeForSharpe(assets: Asset[], correlations: CorrelationMatrix, iterations: number = 10000): Portfolio {
  let bestPortfolio: Portfolio | null = null;
  let bestSharpe = -Infinity;

  for (let i = 0; i < iterations; i++) {
    // Generate random weights
    const weights = assets.map(() => Math.random());
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);

    const testAssets = assets.map((a, idx) => ({ ...a, weight: normalizedWeights[idx] }));
    const portfolio = calculatePortfolioMetrics(testAssets, correlations);

    if (portfolio.sharpeRatio > bestSharpe) {
      bestSharpe = portfolio.sharpeRatio;
      bestPortfolio = portfolio;
    }
  }

  return bestPortfolio || calculatePortfolioMetrics(assets, correlations);
}

function generateEfficientFrontier(assets: Asset[], correlations: CorrelationMatrix, points: number = 20): Array<{ return: number; volatility: number; sharpe: number }> {
  const frontier: Array<{ return: number; volatility: number; sharpe: number }> = [];

  for (let i = 0; i < points; i++) {
    const targetReturn = 0.03 + (i / points) * 0.12;
    let bestVolatility = Infinity;
    let bestSharpe = 0;

    for (let j = 0; j < 1000; j++) {
      const weights = assets.map(() => Math.random());
      const total = weights.reduce((a, b) => a + b, 0);
      const testAssets = assets.map((a, idx) => ({ ...a, weight: weights[idx] / total }));
      const portfolio = calculatePortfolioMetrics(testAssets, correlations);

      if (Math.abs(portfolio.expectedReturn - targetReturn) < 0.01 && portfolio.volatility < bestVolatility) {
        bestVolatility = portfolio.volatility;
        bestSharpe = portfolio.sharpeRatio;
      }
    }

    if (bestVolatility < Infinity) {
      frontier.push({
        return: Math.round(targetReturn * 10000) / 10000,
        volatility: Math.round(bestVolatility * 10000) / 10000,
        sharpe: Math.round(bestSharpe * 100) / 100
      });
    }
  }

  return frontier;
}

function riskParity(assets: Asset[]): Asset[] {
  const totalInverseVol = assets.reduce((sum, a) => sum + 1 / a.volatility, 0);
  return assets.map(a => ({
    ...a,
    weight: Math.round((1 / a.volatility / totalInverseVol) * 10000) / 10000
  }));
}

function portfolioToAscii(portfolio: Portfolio): string {
  const lines: string[] = [];
  lines.push('╔════════════════════════════════════════════════════╗');
  lines.push('║                  PORTFOLIO SUMMARY                  ║');
  lines.push('╠════════════════════════════════════════════════════╣');
  lines.push(`║ Expected Return: ${(portfolio.expectedReturn * 100).toFixed(2)}%`.padEnd(53) + '║');
  lines.push(`║ Volatility:      ${(portfolio.volatility * 100).toFixed(2)}%`.padEnd(53) + '║');
  lines.push(`║ Sharpe Ratio:    ${portfolio.sharpeRatio.toFixed(2)}`.padEnd(53) + '║');
  lines.push('╠════════════════════════════════════════════════════╣');
  lines.push('║ ALLOCATION:'.padEnd(53) + '║');

  for (const asset of portfolio.assets.filter(a => a.weight > 0.01)) {
    const bar = '█'.repeat(Math.floor(asset.weight * 30));
    lines.push(`║ ${asset.symbol.padEnd(5)} ${bar} ${(asset.weight * 100).toFixed(1)}%`.padEnd(53) + '║');
  }

  lines.push('╚════════════════════════════════════════════════════╝');
  return lines.join('\n');
}

export const portfolioOptimizerTool: UnifiedTool = {
  name: 'portfolio_optimizer',
  description: 'Portfolio Optimizer: optimize, efficient_frontier, risk_parity, correlations, metrics',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['optimize', 'efficient_frontier', 'risk_parity', 'correlations', 'metrics', 'assets', 'custom_weights', 'ascii', 'info'] },
      weights: { type: 'object' },
      iterations: { type: 'number' },
      riskFreeRate: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executePortfolioOptimizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const assets = generateMockAssets();
    const correlations = generateCorrelationMatrix(assets);

    switch (args.operation) {
      case 'optimize':
        const optimized = optimizeForSharpe(assets, correlations, args.iterations || 10000);
        result = { optimizedPortfolio: optimized, method: 'Maximum Sharpe Ratio' };
        break;
      case 'efficient_frontier':
        const frontier = generateEfficientFrontier(assets, correlations);
        result = { efficientFrontier: frontier, points: frontier.length };
        break;
      case 'risk_parity':
        const parityAssets = riskParity(assets);
        const parityPortfolio = calculatePortfolioMetrics(parityAssets, correlations);
        result = { riskParityPortfolio: parityPortfolio, method: 'Inverse Volatility Weighting' };
        break;
      case 'correlations':
        result = { correlationMatrix: correlations };
        break;
      case 'metrics':
        const customWeights = args.weights || { SPY: 0.4, BND: 0.3, GLD: 0.15, VNQ: 0.15 };
        const weightedAssets = assets.map(a => ({ ...a, weight: customWeights[a.symbol] || 0 }));
        const portfolio = calculatePortfolioMetrics(weightedAssets, correlations, args.riskFreeRate || 0.02);
        result = { portfolio };
        break;
      case 'assets':
        result = { availableAssets: assets.map(a => ({ symbol: a.symbol, name: a.name, expectedReturn: `${(a.expectedReturn * 100).toFixed(1)}%`, volatility: `${(a.volatility * 100).toFixed(1)}%` })) };
        break;
      case 'custom_weights':
        const customW = args.weights || { SPY: 0.6, BND: 0.4 };
        const customAssets = assets.map(a => ({ ...a, weight: customW[a.symbol] || 0 }));
        const customPortfolio = calculatePortfolioMetrics(customAssets, correlations);
        result = { portfolio: customPortfolio, weights: customW };
        break;
      case 'ascii':
        const asciiPortfolio = optimizeForSharpe(assets, correlations, 5000);
        result = { display: portfolioToAscii(asciiPortfolio) };
        break;
      case 'info':
        result = {
          description: 'Modern Portfolio Theory optimization',
          methods: ['Maximum Sharpe Ratio', 'Risk Parity', 'Minimum Variance', 'Efficient Frontier'],
          metrics: ['Expected Return', 'Volatility', 'Sharpe Ratio', 'Sortino Ratio'],
          features: ['Correlation matrix', 'Monte Carlo simulation', 'Asset allocation']
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isPortfolioOptimizerAvailable(): boolean { return true; }
