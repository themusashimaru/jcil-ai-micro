/**
 * BINOMIAL-OPTIONS TOOL
 * Cox-Ross-Rubinstein binomial tree options pricing model
 * Implements: American & European options, Greeks, early exercise
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const binomialoptionsTool: UnifiedTool = {
  name: 'binomial_options',
  description: 'Binomial tree options pricing for American and European options',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'price', 'build_tree', 'early_exercise', 'greeks', 'compare', 'demonstrate'],
        description: 'Operation to perform'
      },
      style: { type: 'string', enum: ['american', 'european'], description: 'Option style' },
      option_type: { type: 'string', enum: ['call', 'put'], description: 'Call or put option' },
      spot: { type: 'number', description: 'Current stock price (S)' },
      strike: { type: 'number', description: 'Strike price (K)' },
      rate: { type: 'number', description: 'Risk-free rate (r) as decimal' },
      volatility: { type: 'number', description: 'Volatility (σ) as decimal' },
      time: { type: 'number', description: 'Time to expiration in years (T)' },
      steps: { type: 'number', description: 'Number of tree steps' },
      dividend_yield: { type: 'number', description: 'Continuous dividend yield (q)' }
    },
    required: ['operation']
  }
};

// CRR Binomial Model Parameters
function crrParameters(sigma: number, T: number, n: number, r: number, q: number = 0): {
  dt: number;
  u: number;
  d: number;
  p: number;
  discount: number;
} {
  const dt = T / n;
  const u = Math.exp(sigma * Math.sqrt(dt));
  const d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d);
  const discount = Math.exp(-r * dt);

  return { dt, u, d, p, discount };
}

// Build stock price tree
function buildStockTree(S: number, u: number, d: number, n: number): number[][] {
  const tree: number[][] = [];

  for (let i = 0; i <= n; i++) {
    const level: number[] = [];
    for (let j = 0; j <= i; j++) {
      const price = S * Math.pow(u, i - j) * Math.pow(d, j);
      level.push(price);
    }
    tree.push(level);
  }

  return tree;
}

// Calculate option values at expiration
function expirationValues(stockPrices: number[], K: number, isCall: boolean): number[] {
  return stockPrices.map(S => {
    if (isCall) {
      return Math.max(0, S - K);
    } else {
      return Math.max(0, K - S);
    }
  });
}

// Price European option (backward induction)
function priceEuropean(
  stockTree: number[][],
  K: number,
  isCall: boolean,
  p: number,
  discount: number
): { price: number; optionTree: number[][] } {
  const n = stockTree.length - 1;
  const optionTree: number[][] = [];

  // Terminal values
  optionTree[n] = expirationValues(stockTree[n], K, isCall);

  // Backward induction
  for (let i = n - 1; i >= 0; i--) {
    optionTree[i] = [];
    for (let j = 0; j <= i; j++) {
      const continuation = discount * (p * optionTree[i + 1][j] + (1 - p) * optionTree[i + 1][j + 1]);
      optionTree[i][j] = continuation;
    }
  }

  return { price: optionTree[0][0], optionTree };
}

// Price American option (with early exercise)
function priceAmerican(
  stockTree: number[][],
  K: number,
  isCall: boolean,
  p: number,
  discount: number
): { price: number; optionTree: number[][]; earlyExercise: boolean[][] } {
  const n = stockTree.length - 1;
  const optionTree: number[][] = [];
  const earlyExercise: boolean[][] = [];

  // Terminal values
  optionTree[n] = expirationValues(stockTree[n], K, isCall);
  earlyExercise[n] = optionTree[n].map(() => false);

  // Backward induction with early exercise check
  for (let i = n - 1; i >= 0; i--) {
    optionTree[i] = [];
    earlyExercise[i] = [];

    for (let j = 0; j <= i; j++) {
      const continuation = discount * (p * optionTree[i + 1][j] + (1 - p) * optionTree[i + 1][j + 1]);
      const intrinsic = isCall
        ? Math.max(0, stockTree[i][j] - K)
        : Math.max(0, K - stockTree[i][j]);

      if (intrinsic > continuation) {
        optionTree[i][j] = intrinsic;
        earlyExercise[i][j] = true;
      } else {
        optionTree[i][j] = continuation;
        earlyExercise[i][j] = false;
      }
    }
  }

  return { price: optionTree[0][0], optionTree, earlyExercise };
}

// Calculate Greeks using finite differences
function calculateGreeks(
  S: number, K: number, r: number, sigma: number, T: number, n: number,
  isCall: boolean, isAmerican: boolean, q: number = 0
): {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
} {
  const dS = 0.01 * S;
  const dSigma = 0.01;
  const dT = 1 / 365;
  const dR = 0.0001;

  // Price at different spots for delta and gamma
  const priceBase = binomialPrice(S, K, r, sigma, T, n, isCall, isAmerican, q);
  const priceUp = binomialPrice(S + dS, K, r, sigma, T, n, isCall, isAmerican, q);
  const priceDown = binomialPrice(S - dS, K, r, sigma, T, n, isCall, isAmerican, q);

  const delta = (priceUp - priceDown) / (2 * dS);
  const gamma = (priceUp - 2 * priceBase + priceDown) / (dS * dS);

  // Theta: price change with time decay
  const priceT = T > dT ? binomialPrice(S, K, r, sigma, T - dT, n, isCall, isAmerican, q) : priceBase;
  const theta = (priceT - priceBase) / dT;

  // Vega: sensitivity to volatility
  const priceVegaUp = binomialPrice(S, K, r, sigma + dSigma, T, n, isCall, isAmerican, q);
  const vega = (priceVegaUp - priceBase) / (dSigma * 100); // Per 1% change

  // Rho: sensitivity to interest rate
  const priceRhoUp = binomialPrice(S, K, r + dR, sigma, T, n, isCall, isAmerican, q);
  const rho = (priceRhoUp - priceBase) / (dR * 100); // Per 1% change

  return { delta, gamma, theta, vega, rho };
}

// Helper function for binomial price
function binomialPrice(
  S: number, K: number, r: number, sigma: number, T: number, n: number,
  isCall: boolean, isAmerican: boolean, q: number = 0
): number {
  const { u, d, p, discount } = crrParameters(sigma, T, n, r, q);
  const stockTree = buildStockTree(S, u, d, n);

  if (isAmerican) {
    return priceAmerican(stockTree, K, isCall, p, discount).price;
  } else {
    return priceEuropean(stockTree, K, isCall, p, discount).price;
  }
}

// Black-Scholes for comparison
function blackScholesPrice(S: number, K: number, r: number, sigma: number, T: number, isCall: boolean, q: number = 0): number {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  // Cumulative normal distribution approximation
  function cdf(x: number): number {
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

  if (isCall) {
    return S * Math.exp(-q * T) * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
  } else {
    return K * Math.exp(-r * T) * cdf(-d2) - S * Math.exp(-q * T) * cdf(-d1);
  }
}

// Format tree for display
function formatTree(tree: number[][], maxWidth: number = 10): string {
  const n = tree.length - 1;
  let output = '';

  for (let i = 0; i <= Math.min(n, 5); i++) { // Show first 6 levels
    const indent = ' '.repeat((5 - i) * 4);
    const values = tree[i].slice(0, 6).map(v => v.toFixed(2).padStart(8)).join(' ');
    output += `${indent}Step ${i}: ${values}${tree[i].length > 6 ? '...' : ''}\n`;
  }

  if (n > 5) {
    output += `  ... (${n - 5} more steps)\n`;
  }

  return output;
}

// Find early exercise boundary
function findEarlyExerciseBoundary(
  S: number, K: number, r: number, sigma: number, T: number, n: number,
  isCall: boolean, q: number = 0
): { step: number; stockPrice: number; optionValue: number; intrinsic: number }[] {
  const { u, d, p, discount } = crrParameters(sigma, T, n, r, q);
  const stockTree = buildStockTree(S, u, d, n);
  const { optionTree, earlyExercise } = priceAmerican(stockTree, K, isCall, p, discount);

  const boundary: { step: number; stockPrice: number; optionValue: number; intrinsic: number }[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (earlyExercise[i][j]) {
        const intrinsic = isCall
          ? Math.max(0, stockTree[i][j] - K)
          : Math.max(0, K - stockTree[i][j]);

        boundary.push({
          step: i,
          stockPrice: stockTree[i][j],
          optionValue: optionTree[i][j],
          intrinsic
        });
        break; // Only first exercise point per step
      }
    }
  }

  return boundary;
}

export async function executebinomialoptions(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    let result: any;

    switch (operation) {
      case 'info':
        result = {
          tool: 'binomial-options',
          description: 'Cox-Ross-Rubinstein binomial tree options pricing',
          operations: [
            'info - Tool information',
            'price - Price an option using binomial tree',
            'build_tree - Show stock and option price trees',
            'early_exercise - Analyze American option early exercise',
            'greeks - Calculate option Greeks',
            'compare - Compare binomial with Black-Scholes',
            'demonstrate - Show comprehensive examples'
          ],
          model: 'Cox-Ross-Rubinstein (CRR)',
          parameters: {
            u: 'exp(σ√Δt) - up factor',
            d: '1/u - down factor',
            p: '(exp((r-q)Δt) - d) / (u - d) - risk-neutral probability'
          },
          features: [
            'European and American options',
            'Call and put options',
            'Dividend yield support',
            'Greeks calculation',
            'Early exercise analysis'
          ]
        };
        break;

      case 'price': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const T = args.time || 1;
        const n = args.steps || 100;
        const isCall = args.option_type !== 'put';
        const isAmerican = args.style === 'american';
        const q = args.dividend_yield || 0;

        const { u, d, p, discount, dt } = crrParameters(sigma, T, n, r, q);
        const stockTree = buildStockTree(S, u, d, n);

        let price: number;
        if (isAmerican) {
          price = priceAmerican(stockTree, K, isCall, p, discount).price;
        } else {
          price = priceEuropean(stockTree, K, isCall, p, discount).price;
        }

        // Black-Scholes comparison
        const bsPrice = blackScholesPrice(S, K, r, sigma, T, isCall, q);

        result = {
          optionType: isCall ? 'Call' : 'Put',
          style: isAmerican ? 'American' : 'European',
          inputs: {
            spot: S,
            strike: K,
            riskFreeRate: r,
            volatility: sigma,
            timeToExpiry: T,
            steps: n,
            dividendYield: q
          },
          crrParameters: {
            upFactor: u.toFixed(6),
            downFactor: d.toFixed(6),
            riskNeutralProb: p.toFixed(6),
            discountFactor: discount.toFixed(6),
            timeStep: dt.toFixed(6)
          },
          price: price.toFixed(4),
          blackScholesPrice: bsPrice.toFixed(4),
          difference: (price - bsPrice).toFixed(4),
          moneyness: S > K ? 'ITM' : (S < K ? 'OTM' : 'ATM')
        };
        break;
      }

      case 'build_tree': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const T = args.time || 1;
        const n = Math.min(args.steps || 5, 10); // Limit for display
        const isCall = args.option_type !== 'put';
        const isAmerican = args.style === 'american';
        const q = args.dividend_yield || 0;

        const { u, d, p, discount } = crrParameters(sigma, T, n, r, q);
        const stockTree = buildStockTree(S, u, d, n);

        let optionTree: number[][];
        if (isAmerican) {
          optionTree = priceAmerican(stockTree, K, isCall, p, discount).optionTree;
        } else {
          optionTree = priceEuropean(stockTree, K, isCall, p, discount).optionTree;
        }

        result = {
          optionType: isCall ? 'Call' : 'Put',
          style: isAmerican ? 'American' : 'European',
          steps: n,
          stockTree: formatTree(stockTree),
          optionTree: formatTree(optionTree),
          parameters: {
            upFactor: u.toFixed(4),
            downFactor: d.toFixed(4),
            riskNeutralProb: p.toFixed(4)
          },
          finalPrice: optionTree[0][0].toFixed(4)
        };
        break;
      }

      case 'early_exercise': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const T = args.time || 1;
        const n = args.steps || 50;
        const isCall = args.option_type !== 'put';
        const q = args.dividend_yield || 0;

        const { u, d, p, discount } = crrParameters(sigma, T, n, r, q);
        const stockTree = buildStockTree(S, u, d, n);

        const europeanPrice = priceEuropean(stockTree, K, isCall, p, discount).price;
        const americanResult = priceAmerican(stockTree, K, isCall, p, discount);
        const americanPrice = americanResult.price;

        const boundary = findEarlyExerciseBoundary(S, K, r, sigma, T, n, isCall, q);

        const earlyExercisePremium = americanPrice - europeanPrice;

        result = {
          optionType: isCall ? 'Call' : 'Put',
          europeanPrice: europeanPrice.toFixed(4),
          americanPrice: americanPrice.toFixed(4),
          earlyExercisePremium: earlyExercisePremium.toFixed(4),
          premiumPercent: ((earlyExercisePremium / europeanPrice) * 100).toFixed(2) + '%',
          earlyExerciseBoundary: boundary.slice(0, 10).map(b => ({
            step: b.step,
            stockPrice: b.stockPrice.toFixed(2),
            optionValue: b.optionValue.toFixed(2),
            intrinsicValue: b.intrinsic.toFixed(2)
          })),
          analysis: {
            worthExercisingEarly: earlyExercisePremium > 0.01,
            recommendation: isCall && q === 0
              ? 'Call options on non-dividend stocks are rarely exercised early'
              : earlyExercisePremium > 0.01
                ? 'Early exercise may be optimal in some scenarios'
                : 'Early exercise unlikely to be optimal'
          }
        };
        break;
      }

      case 'greeks': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const T = args.time || 1;
        const n = args.steps || 100;
        const isCall = args.option_type !== 'put';
        const isAmerican = args.style === 'american';
        const q = args.dividend_yield || 0;

        const price = binomialPrice(S, K, r, sigma, T, n, isCall, isAmerican, q);
        const greeks = calculateGreeks(S, K, r, sigma, T, n, isCall, isAmerican, q);

        result = {
          optionType: isCall ? 'Call' : 'Put',
          style: isAmerican ? 'American' : 'European',
          price: price.toFixed(4),
          greeks: {
            delta: {
              value: greeks.delta.toFixed(4),
              interpretation: `Option price changes by $${(greeks.delta).toFixed(4)} for $1 stock move`
            },
            gamma: {
              value: greeks.gamma.toFixed(4),
              interpretation: `Delta changes by ${greeks.gamma.toFixed(4)} for $1 stock move`
            },
            theta: {
              value: greeks.theta.toFixed(4),
              interpretation: `Option loses $${Math.abs(greeks.theta).toFixed(4)} per day`
            },
            vega: {
              value: greeks.vega.toFixed(4),
              interpretation: `Option price changes by $${greeks.vega.toFixed(4)} for 1% vol change`
            },
            rho: {
              value: greeks.rho.toFixed(4),
              interpretation: `Option price changes by $${greeks.rho.toFixed(4)} for 1% rate change`
            }
          }
        };
        break;
      }

      case 'compare': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const T = args.time || 1;
        const isCall = args.option_type !== 'put';
        const q = args.dividend_yield || 0;

        const bsPrice = blackScholesPrice(S, K, r, sigma, T, isCall, q);

        const stepResults: { steps: number; europeanPrice: number; americanPrice: number; bsDiff: number }[] = [];

        for (const n of [10, 25, 50, 100, 200, 500]) {
          const { u, d, p, discount } = crrParameters(sigma, T, n, r, q);
          const stockTree = buildStockTree(S, u, d, n);

          const eurPrice = priceEuropean(stockTree, K, isCall, p, discount).price;
          const amPrice = priceAmerican(stockTree, K, isCall, p, discount).price;

          stepResults.push({
            steps: n,
            europeanPrice: eurPrice,
            americanPrice: amPrice,
            bsDiff: eurPrice - bsPrice
          });
        }

        result = {
          optionType: isCall ? 'Call' : 'Put',
          blackScholesPrice: bsPrice.toFixed(4),
          convergence: stepResults.map(sr => ({
            steps: sr.steps,
            europeanPrice: sr.europeanPrice.toFixed(4),
            americanPrice: sr.americanPrice.toFixed(4),
            differenceFromBS: sr.bsDiff.toFixed(4),
            earlyExercisePremium: (sr.americanPrice - sr.europeanPrice).toFixed(4)
          })),
          analysis: 'Binomial model converges to Black-Scholes as steps increase'
        };
        break;
      }

      case 'demonstrate': {
        const S = 100;
        const K = 100;
        const r = 0.05;
        const sigma = 0.2;
        const T = 1;

        let demo = `
╔═══════════════════════════════════════════════════════════════════════╗
║           BINOMIAL OPTIONS PRICING MODEL DEMONSTRATION                ║
╚═══════════════════════════════════════════════════════════════════════╝

═══════════════════════════════════════════════════════════════════════
                    COX-ROSS-RUBINSTEIN MODEL
═══════════════════════════════════════════════════════════════════════

The binomial model approximates stock price movements as a series of
up and down moves on a discrete tree.

PARAMETERS:
  • Spot Price (S):     $${S}
  • Strike Price (K):   $${K}
  • Risk-Free Rate (r): ${(r * 100).toFixed(1)}%
  • Volatility (σ):     ${(sigma * 100).toFixed(1)}%
  • Time to Expiry (T): ${T} year

CRR FORMULAS:
  • Time Step:    Δt = T/n
  • Up Factor:    u = exp(σ√Δt)
  • Down Factor:  d = 1/u
  • Risk-Neutral: p = (exp(rΔt) - d) / (u - d)

═══════════════════════════════════════════════════════════════════════
                      BINOMIAL TREE (n=3)
═══════════════════════════════════════════════════════════════════════

`;

        const n3 = 3;
        const { u: u3, d: d3, p: p3, discount: disc3 } = crrParameters(sigma, T, n3, r, 0);
        const tree3 = buildStockTree(S, u3, d3, n3);

        demo += `Stock Price Tree (u=${u3.toFixed(4)}, d=${d3.toFixed(4)}):

                            ${tree3[3][0].toFixed(2)}
                      ${tree3[2][0].toFixed(2)}
                ${tree3[1][0].toFixed(2)}          ${tree3[3][1].toFixed(2)}
          ${tree3[0][0].toFixed(2)}
                ${tree3[1][1].toFixed(2)}          ${tree3[3][2].toFixed(2)}
                      ${tree3[2][2].toFixed(2)}
                            ${tree3[3][3].toFixed(2)}

Risk-neutral probability p = ${p3.toFixed(4)}

`;

        // European call
        const eurCall3 = priceEuropean(tree3, K, true, p3, disc3);

        demo += `European Call Option Tree:

  Step 3 (Expiration): [${tree3[3].map(s => Math.max(0, s - K).toFixed(2)).join(', ')}]

  Working backwards with p=${p3.toFixed(4)}, discount=${disc3.toFixed(4)}:
  Step 2: [${eurCall3.optionTree[2].map(v => v.toFixed(2)).join(', ')}]
  Step 1: [${eurCall3.optionTree[1].map(v => v.toFixed(2)).join(', ')}]
  Step 0: [${eurCall3.optionTree[0][0].toFixed(2)}]

  European Call Price: $${eurCall3.price.toFixed(4)}

`;

        // Comparison with more steps
        demo += `═══════════════════════════════════════════════════════════════════════
                    CONVERGENCE TO BLACK-SCHOLES
═══════════════════════════════════════════════════════════════════════

`;
        const bsCall = blackScholesPrice(S, K, r, sigma, T, true, 0);
        const bsPut = blackScholesPrice(S, K, r, sigma, T, false, 0);

        demo += `Black-Scholes Reference:
  • Call Price: $${bsCall.toFixed(4)}
  • Put Price:  $${bsPut.toFixed(4)}

Binomial Convergence (Call):
  ┌─────────┬─────────────┬───────────────┐
  │ Steps   │   Price     │  Difference   │
  ├─────────┼─────────────┼───────────────┤
`;

        for (const steps of [5, 10, 25, 50, 100, 200]) {
          const { u, d, p, discount } = crrParameters(sigma, T, steps, r, 0);
          const tree = buildStockTree(S, u, d, steps);
          const eurPrice = priceEuropean(tree, K, true, p, discount).price;
          demo += `  │ ${steps.toString().padStart(5)}   │ $${eurPrice.toFixed(4).padStart(9)} │ ${(eurPrice - bsCall) >= 0 ? '+' : ''}${(eurPrice - bsCall).toFixed(4).padStart(12)} │\n`;
        }

        demo += `  └─────────┴─────────────┴───────────────┘

`;

        // American vs European
        demo += `═══════════════════════════════════════════════════════════════════════
                     AMERICAN vs EUROPEAN OPTIONS
═══════════════════════════════════════════════════════════════════════

American options can be exercised early. This is valuable for:
• Put options (receive cash sooner)
• Call options on dividend-paying stocks

Example: Put Option with 100 steps
`;

        const { u: u100, d: d100, p: p100, discount: disc100 } = crrParameters(sigma, T, 100, r, 0);
        const tree100 = buildStockTree(S, u100, d100, 100);
        const eurPut = priceEuropean(tree100, K, false, p100, disc100).price;
        const amPut = priceAmerican(tree100, K, false, p100, disc100).price;

        demo += `
  European Put: $${eurPut.toFixed(4)}
  American Put: $${amPut.toFixed(4)}
  Early Exercise Premium: $${(amPut - eurPut).toFixed(4)}

For calls on non-dividend stocks:
`;

        const eurCallFull = priceEuropean(tree100, K, true, p100, disc100).price;
        const amCallFull = priceAmerican(tree100, K, true, p100, disc100).price;

        demo += `
  European Call: $${eurCallFull.toFixed(4)}
  American Call: $${amCallFull.toFixed(4)}
  Early Exercise Premium: $${(amCallFull - eurCallFull).toFixed(4)} (minimal - not optimal to exercise early)

`;

        // Greeks
        const greeks = calculateGreeks(S, K, r, sigma, T, 100, true, false, 0);

        demo += `═══════════════════════════════════════════════════════════════════════
                          OPTION GREEKS
═══════════════════════════════════════════════════════════════════════

ATM European Call Option Greeks (S=${S}, K=${K}):

  ┌────────────┬───────────────┬────────────────────────────────────┐
  │ Greek      │    Value      │ Interpretation                     │
  ├────────────┼───────────────┼────────────────────────────────────┤
  │ Delta (Δ)  │ ${greeks.delta.toFixed(4).padStart(12)} │ $change per $1 stock move          │
  │ Gamma (Γ)  │ ${greeks.gamma.toFixed(4).padStart(12)} │ Δ change per $1 stock move         │
  │ Theta (Θ)  │ ${greeks.theta.toFixed(4).padStart(12)} │ Value lost per day (time decay)    │
  │ Vega (ν)   │ ${greeks.vega.toFixed(4).padStart(12)} │ $change per 1% vol change          │
  │ Rho (ρ)    │ ${greeks.rho.toFixed(4).padStart(12)} │ $change per 1% rate change         │
  └────────────┴───────────────┴────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════
                        KEY INSIGHTS
═══════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│ 1. BINOMIAL MODEL converges to Black-Scholes as steps → ∞         │
│ 2. AMERICAN OPTIONS have early exercise premium (especially puts) │
│ 3. RISK-NEUTRAL PRICING: use p, not real-world probability        │
│ 4. BACKWARD INDUCTION: work from expiration to present            │
│ 5. CONVERGENCE: ~100 steps gives 4 decimal accuracy               │
└─────────────────────────────────────────────────────────────────────┘
`;

        result = {
          demonstration: demo,
          summary: {
            model: 'Cox-Ross-Rubinstein Binomial',
            keyFormulas: ['u = exp(σ√Δt)', 'd = 1/u', 'p = (exp(rΔt) - d)/(u - d)'],
            advantages: ['Handles American options', 'Intuitive discrete model', 'Converges to BS']
          }
        };
        break;
      }

      default:
        result = { error: `Unknown operation: ${operation}`, availableOperations: ['info', 'price', 'build_tree', 'early_exercise', 'greeks', 'compare', 'demonstrate'] };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isbinomialoptionsAvailable(): boolean { return true; }
