/**
 * BINOMIAL-OPTIONS TOOL
 * Real binomial tree options pricing model
 * Supports American and European options with early exercise analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const binomialoptionsTool: UnifiedTool = {
  name: 'binomial_options',
  description: 'Binomial tree options pricing for American and European options with Greeks and early exercise analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['price', 'build_tree', 'early_exercise', 'greeks', 'convergence', 'compare', 'info'],
        description: 'Operation to perform'
      },
      spot: { type: 'number', description: 'Current stock price (S)' },
      strike: { type: 'number', description: 'Strike price (K)' },
      time: { type: 'number', description: 'Time to expiration in years (T)' },
      rate: { type: 'number', description: 'Risk-free rate (r) as decimal' },
      volatility: { type: 'number', description: 'Volatility (σ) as decimal' },
      dividend: { type: 'number', description: 'Continuous dividend yield (q) as decimal' },
      steps: { type: 'number', description: 'Number of time steps in tree' },
      option_type: { type: 'string', enum: ['call', 'put'], description: 'Call or put' },
      style: { type: 'string', enum: ['american', 'european'], description: 'American or European' }
    },
    required: ['operation']
  }
};

interface BinomialArgs {
  operation: string;
  spot?: number;
  strike?: number;
  time?: number;
  rate?: number;
  volatility?: number;
  dividend?: number;
  steps?: number;
  option_type?: 'call' | 'put';
  style?: 'american' | 'european';
}

/**
 * Cox-Ross-Rubinstein (CRR) Binomial Tree Model
 * u = exp(σ√Δt), d = 1/u = exp(-σ√Δt)
 * p = (exp((r-q)Δt) - d) / (u - d)
 */
class BinomialTree {
  S: number;      // Spot price
  K: number;      // Strike price
  T: number;      // Time to expiration
  r: number;      // Risk-free rate
  sigma: number;  // Volatility
  q: number;      // Dividend yield
  n: number;      // Number of steps
  dt: number;     // Time per step
  u: number;      // Up factor
  d: number;      // Down factor
  p: number;      // Risk-neutral up probability
  df: number;     // Discount factor per step

  stockTree: number[][];
  optionTree: number[][];
  earlyExercise: boolean[][];

  constructor(S: number, K: number, T: number, r: number, sigma: number, q: number, n: number) {
    this.S = S;
    this.K = K;
    this.T = T;
    this.r = r;
    this.sigma = sigma;
    this.q = q;
    this.n = n;

    this.dt = T / n;
    this.u = Math.exp(sigma * Math.sqrt(this.dt));
    this.d = 1 / this.u;
    this.df = Math.exp(-r * this.dt);

    // Risk-neutral probability
    const growth = Math.exp((r - q) * this.dt);
    this.p = (growth - this.d) / (this.u - this.d);

    this.stockTree = [];
    this.optionTree = [];
    this.earlyExercise = [];
  }

  /**
   * Build the stock price tree
   */
  buildStockTree(): number[][] {
    this.stockTree = [];

    for (let i = 0; i <= this.n; i++) {
      const row: number[] = [];
      for (let j = 0; j <= i; j++) {
        // Price at node (i, j): S * u^(i-j) * d^j
        const price = this.S * Math.pow(this.u, i - j) * Math.pow(this.d, j);
        row.push(price);
      }
      this.stockTree.push(row);
    }

    return this.stockTree;
  }

  /**
   * Calculate option payoff
   */
  payoff(stockPrice: number, isCall: boolean): number {
    if (isCall) {
      return Math.max(0, stockPrice - this.K);
    } else {
      return Math.max(0, this.K - stockPrice);
    }
  }

  /**
   * Price European option
   */
  priceEuropean(isCall: boolean): number {
    if (this.stockTree.length === 0) {
      this.buildStockTree();
    }

    // Initialize option values at expiration
    this.optionTree = [];
    const terminalValues: number[] = [];
    for (let j = 0; j <= this.n; j++) {
      terminalValues.push(this.payoff(this.stockTree[this.n][j], isCall));
    }
    this.optionTree[this.n] = terminalValues;

    // Work backwards through the tree
    for (let i = this.n - 1; i >= 0; i--) {
      const row: number[] = [];
      for (let j = 0; j <= i; j++) {
        // Expected value under risk-neutral measure
        const holdValue = this.df * (
          this.p * this.optionTree[i + 1][j] +
          (1 - this.p) * this.optionTree[i + 1][j + 1]
        );
        row.push(holdValue);
      }
      this.optionTree[i] = row;
    }

    return this.optionTree[0][0];
  }

  /**
   * Price American option with early exercise tracking
   */
  priceAmerican(isCall: boolean): { price: number; earlyExerciseNodes: Array<{step: number; node: number; stock: number; intrinsic: number}> } {
    if (this.stockTree.length === 0) {
      this.buildStockTree();
    }

    const earlyExerciseNodes: Array<{step: number; node: number; stock: number; intrinsic: number}> = [];
    this.earlyExercise = [];

    // Initialize option values at expiration
    this.optionTree = [];
    const terminalValues: number[] = [];
    const terminalExercise: boolean[] = [];
    for (let j = 0; j <= this.n; j++) {
      const intrinsic = this.payoff(this.stockTree[this.n][j], isCall);
      terminalValues.push(intrinsic);
      terminalExercise.push(intrinsic > 0);
    }
    this.optionTree[this.n] = terminalValues;
    this.earlyExercise[this.n] = terminalExercise;

    // Work backwards through the tree
    for (let i = this.n - 1; i >= 0; i--) {
      const row: number[] = [];
      const exerciseRow: boolean[] = [];

      for (let j = 0; j <= i; j++) {
        // Expected value of holding
        const holdValue = this.df * (
          this.p * this.optionTree[i + 1][j] +
          (1 - this.p) * this.optionTree[i + 1][j + 1]
        );

        // Value of immediate exercise
        const exerciseValue = this.payoff(this.stockTree[i][j], isCall);

        // American option: take maximum
        const shouldExercise = exerciseValue > holdValue;
        const optionValue = Math.max(holdValue, exerciseValue);

        row.push(optionValue);
        exerciseRow.push(shouldExercise);

        if (shouldExercise && exerciseValue > 0) {
          earlyExerciseNodes.push({
            step: i,
            node: j,
            stock: this.stockTree[i][j],
            intrinsic: exerciseValue
          });
        }
      }

      this.optionTree[i] = row;
      this.earlyExercise[i] = exerciseRow;
    }

    return { price: this.optionTree[0][0], earlyExerciseNodes };
  }

  /**
   * Calculate Greeks using finite differences
   */
  calculateGreeks(isCall: boolean, isAmerican: boolean): Record<string, number> {
    const basePrice = isAmerican ?
      this.priceAmerican(isCall).price :
      this.priceEuropean(isCall);

    // Delta: ∂V/∂S
    const dS = this.S * 0.01;
    const treeUp = new BinomialTree(this.S + dS, this.K, this.T, this.r, this.sigma, this.q, this.n);
    const treeDown = new BinomialTree(this.S - dS, this.K, this.T, this.r, this.sigma, this.q, this.n);
    const priceUp = isAmerican ? treeUp.priceAmerican(isCall).price : treeUp.priceEuropean(isCall);
    const priceDown = isAmerican ? treeDown.priceAmerican(isCall).price : treeDown.priceEuropean(isCall);
    const delta = (priceUp - priceDown) / (2 * dS);

    // Gamma: ∂²V/∂S²
    const gamma = (priceUp - 2 * basePrice + priceDown) / (dS * dS);

    // Theta: -∂V/∂T (per day)
    // Vega: ∂V/∂σ (per 1% change)
    const dSigma = 0.01;
    const treeVegaUp = new BinomialTree(this.S, this.K, this.T, this.r, this.sigma + dSigma, this.q, this.n);
    const treeVegaDown = new BinomialTree(this.S, this.K, this.T, this.r, this.sigma - dSigma, this.q, this.n);
    const priceVegaUp = isAmerican ? treeVegaUp.priceAmerican(isCall).price : treeVegaUp.priceEuropean(isCall);
    const priceVegaDown = isAmerican ? treeVegaDown.priceAmerican(isCall).price : treeVegaDown.priceEuropean(isCall);
    const vega = (priceVegaUp - priceVegaDown) / 2;

    // Rho: ∂V/∂r (per 1% change)
    const dR = 0.01;
    const treeRhoUp = new BinomialTree(this.S, this.K, this.T, this.r + dR, this.sigma, this.q, this.n);
    const treeRhoDown = new BinomialTree(this.S, this.K, this.T, this.r - dR, this.sigma, this.q, this.n);
    const priceRhoUp = isAmerican ? treeRhoUp.priceAmerican(isCall).price : treeRhoUp.priceEuropean(isCall);
    const priceRhoDown = isAmerican ? treeRhoDown.priceAmerican(isCall).price : treeRhoDown.priceEuropean(isCall);
    const rho = (priceRhoUp - priceRhoDown) / 2;

    // Theta calculation
    let theta = 0;
    if (this.T > 1/365) {
      const treeTheta = new BinomialTree(this.S, this.K, this.T - 1/365, this.r, this.sigma, this.q, this.n);
      const priceTheta = isAmerican ? treeTheta.priceAmerican(isCall).price : treeTheta.priceEuropean(isCall);
      theta = priceTheta - basePrice;
    }

    return {
      price: basePrice,
      delta,
      gamma,
      theta,
      vega,
      rho
    };
  }

  /**
   * Get tree as displayable format (first few levels)
   */
  getTreeDisplay(maxLevels: number = 5): {
    stockTree: number[][];
    optionTree: number[][];
    parameters: Record<string, number>;
  } {
    const levels = Math.min(maxLevels, this.stockTree.length);

    return {
      stockTree: this.stockTree.slice(0, levels).map(row =>
        row.map(v => Math.round(v * 100) / 100)
      ),
      optionTree: this.optionTree.slice(0, levels).map(row =>
        row.map(v => Math.round(v * 100) / 100)
      ),
      parameters: {
        u: Math.round(this.u * 10000) / 10000,
        d: Math.round(this.d * 10000) / 10000,
        p: Math.round(this.p * 10000) / 10000,
        dt: Math.round(this.dt * 10000) / 10000,
        df: Math.round(this.df * 10000) / 10000
      }
    };
  }
}

/**
 * Black-Scholes price for comparison (European only)
 */
function blackScholesPrice(S: number, K: number, T: number, r: number, sigma: number, q: number, isCall: boolean): number {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  // Cumulative normal distribution
  const N = (x: number): number => {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return 0.5 * (1.0 + sign * y);
  };

  if (isCall) {
    return S * Math.exp(-q * T) * N(d1) - K * Math.exp(-r * T) * N(d2);
  } else {
    return K * Math.exp(-r * T) * N(-d2) - S * Math.exp(-q * T) * N(-d1);
  }
}

/**
 * Calculate early exercise premium (American - European)
 */
function earlyExercisePremium(
  S: number, K: number, T: number, r: number, sigma: number, q: number, n: number, isCall: boolean
): { european: number; american: number; premium: number; premium_percent: number } {
  const tree = new BinomialTree(S, K, T, r, sigma, q, n);
  tree.buildStockTree();

  const european = tree.priceEuropean(isCall);
  const { price: american } = tree.priceAmerican(isCall);
  const premium = american - european;

  return {
    european,
    american,
    premium,
    premium_percent: (premium / european) * 100
  };
}

/**
 * Analyze convergence as number of steps increases
 */
function analyzeConvergence(
  S: number, K: number, T: number, r: number, sigma: number, q: number,
  isCall: boolean, isAmerican: boolean, stepsArray: number[]
): Array<{ steps: number; price: number; change: number }> {
  const results: Array<{ steps: number; price: number; change: number }> = [];
  let prevPrice = 0;

  for (const n of stepsArray) {
    const tree = new BinomialTree(S, K, T, r, sigma, q, n);
    tree.buildStockTree();
    const price = isAmerican ? tree.priceAmerican(isCall).price : tree.priceEuropean(isCall);

    results.push({
      steps: n,
      price,
      change: prevPrice !== 0 ? Math.abs(price - prevPrice) : 0
    });

    prevPrice = price;
  }

  return results;
}

export async function executebinomialoptions(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args: BinomialArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      spot = 100,
      strike = 100,
      time = 1,
      rate = 0.05,
      volatility = 0.2,
      dividend = 0,
      steps = 100,
      option_type = 'call',
      style = 'american'
    } = args;

    const isCall = option_type === 'call';
    const isAmerican = style === 'american';

    let result: Record<string, unknown>;

    switch (operation) {
      case 'price': {
        const tree = new BinomialTree(spot, strike, time, rate, volatility, dividend, steps);
        tree.buildStockTree();

        let price: number;
        let earlyExerciseInfo: unknown = null;

        if (isAmerican) {
          const americanResult = tree.priceAmerican(isCall);
          price = americanResult.price;
          earlyExerciseInfo = {
            num_early_exercise_nodes: americanResult.earlyExerciseNodes.length,
            sample_nodes: americanResult.earlyExerciseNodes.slice(0, 5)
          };
        } else {
          price = tree.priceEuropean(isCall);
        }

        // Compare with Black-Scholes for European
        const bsPrice = blackScholesPrice(spot, strike, time, rate, volatility, dividend, isCall);

        result = {
          operation: 'price',
          inputs: { spot, strike, time, rate, volatility, dividend, steps, option_type, style },
          binomial_price: price,
          black_scholes_price: bsPrice,
          price_difference: price - bsPrice,
          tree_parameters: {
            up_factor: tree.u,
            down_factor: tree.d,
            risk_neutral_prob: tree.p,
            time_step: tree.dt
          },
          intrinsic_value: isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot),
          time_value: price - (isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot)),
          early_exercise: isAmerican ? earlyExerciseInfo : 'N/A for European options'
        };
        break;
      }

      case 'build_tree': {
        const displaySteps = Math.min(steps, 6);
        const tree = new BinomialTree(spot, strike, time, rate, volatility, dividend, displaySteps);
        tree.buildStockTree();

        if (isAmerican) {
          tree.priceAmerican(isCall);
        } else {
          tree.priceEuropean(isCall);
        }

        const display = tree.getTreeDisplay(displaySteps + 1);

        result = {
          operation: 'build_tree',
          description: 'Binomial tree visualization (showing first levels)',
          inputs: { spot, strike, time, rate, volatility, dividend },
          steps_shown: displaySteps,
          tree_parameters: display.parameters,
          stock_price_tree: display.stockTree,
          option_value_tree: display.optionTree,
          interpretation: {
            stock_tree: 'Each row is a time step; values show possible stock prices',
            option_tree: 'Option values at each node, computed by backward induction',
            top_node: 'Option price at t=0'
          },
          formulas: {
            up_move: 'u = exp(σ√Δt)',
            down_move: 'd = 1/u = exp(-σ√Δt)',
            risk_neutral_prob: 'p = (exp((r-q)Δt) - d) / (u - d)',
            option_value: 'V = df × [p×V_up + (1-p)×V_down]'
          }
        };
        break;
      }

      case 'early_exercise': {
        const premium = earlyExercisePremium(spot, strike, time, rate, volatility, dividend, steps, isCall);

        const tree = new BinomialTree(spot, strike, time, rate, volatility, dividend, steps);
        tree.buildStockTree();
        const { earlyExerciseNodes } = tree.priceAmerican(isCall);

        // Analyze when early exercise is optimal
        const earlyExerciseAnalysis = {
          total_exercise_points: earlyExerciseNodes.length,
          by_time_step: {} as Record<number, number>,
          first_exercise_step: earlyExerciseNodes.length > 0 ?
            Math.min(...earlyExerciseNodes.map(n => n.step)) : null,
          exercise_region: isCall ?
            'Early exercise optimal when S >> K (deep ITM) and dividend yield is high' :
            'Early exercise optimal when K >> S (deep ITM)'
        };

        for (const node of earlyExerciseNodes) {
          earlyExerciseAnalysis.by_time_step[node.step] =
            (earlyExerciseAnalysis.by_time_step[node.step] || 0) + 1;
        }

        result = {
          operation: 'early_exercise',
          inputs: { spot, strike, time, rate, volatility, dividend, steps, option_type },
          european_price: premium.european,
          american_price: premium.american,
          early_exercise_premium: premium.premium,
          premium_percent: premium.premium_percent,
          analysis: earlyExerciseAnalysis,
          sample_exercise_nodes: earlyExerciseNodes.slice(0, 10).map(n => ({
            time_step: n.step,
            stock_price: Math.round(n.stock * 100) / 100,
            intrinsic_value: Math.round(n.intrinsic * 100) / 100
          })),
          theory: {
            call_no_dividend: 'American call = European call when q=0 (no early exercise)',
            call_with_dividend: 'Early exercise may be optimal just before ex-dividend',
            put: 'American put premium always positive; exercise when deep ITM'
          }
        };
        break;
      }

      case 'greeks': {
        const tree = new BinomialTree(spot, strike, time, rate, volatility, dividend, steps);
        tree.buildStockTree();
        const greeks = tree.calculateGreeks(isCall, isAmerican);

        result = {
          operation: 'greeks',
          inputs: { spot, strike, time, rate, volatility, dividend, steps, option_type, style },
          price: greeks.price,
          greeks: {
            delta: greeks.delta,
            gamma: greeks.gamma,
            theta_daily: greeks.theta,
            theta_annual: greeks.theta * 365,
            vega_per_percent: greeks.vega,
            rho_per_percent: greeks.rho
          },
          interpretation: {
            delta: `${isCall ? 'Call' : 'Put'} delta: option moves $${Math.abs(greeks.delta).toFixed(4)} for $1 stock move`,
            gamma: `Delta changes by ${greeks.gamma.toFixed(6)} for $1 stock move`,
            theta: `Option loses $${Math.abs(greeks.theta).toFixed(4)} per day`,
            vega: `Option gains/loses $${greeks.vega.toFixed(4)} for 1% vol change`,
            rho: `Option gains/loses $${greeks.rho.toFixed(4)} for 1% rate change`
          },
          hedge_ratios: {
            delta_hedge_shares: Math.abs(greeks.delta),
            gamma_neutral: `Need ${(-greeks.gamma).toFixed(6)} gamma from other options`
          }
        };
        break;
      }

      case 'convergence': {
        const stepsArray = [10, 25, 50, 100, 200, 500, 1000];
        const convergence = analyzeConvergence(spot, strike, time, rate, volatility, dividend, isCall, isAmerican, stepsArray);

        const bsPrice = blackScholesPrice(spot, strike, time, rate, volatility, dividend, isCall);

        result = {
          operation: 'convergence',
          inputs: { spot, strike, time, rate, volatility, dividend, option_type, style },
          black_scholes_price: isAmerican ? 'N/A for American' : bsPrice,
          convergence_analysis: convergence.map(c => ({
            steps: c.steps,
            price: Math.round(c.price * 10000) / 10000,
            change_from_prev: Math.round(c.change * 10000) / 10000,
            error_vs_bs: isAmerican ? 'N/A' : Math.round(Math.abs(c.price - bsPrice) * 10000) / 10000
          })),
          final_price: convergence[convergence.length - 1].price,
          recommendation: convergence[convergence.length - 2].change < 0.01 ?
            'Converged with current steps' :
            'Consider using more steps for higher accuracy',
          convergence_rate: 'O(1/n) - error decreases linearly with steps'
        };
        break;
      }

      case 'compare': {
        // Compare different pricing methods
        const treeLow = new BinomialTree(spot, strike, time, rate, volatility, dividend, 50);
        const treeMed = new BinomialTree(spot, strike, time, rate, volatility, dividend, 200);
        const treeHigh = new BinomialTree(spot, strike, time, rate, volatility, dividend, 1000);

        treeLow.buildStockTree();
        treeMed.buildStockTree();
        treeHigh.buildStockTree();

        const bsPrice = blackScholesPrice(spot, strike, time, rate, volatility, dividend, isCall);

        result = {
          operation: 'compare',
          inputs: { spot, strike, time, rate, volatility, dividend, option_type },
          european_prices: {
            black_scholes: bsPrice,
            binomial_50_steps: treeLow.priceEuropean(isCall),
            binomial_200_steps: treeMed.priceEuropean(isCall),
            binomial_1000_steps: treeHigh.priceEuropean(isCall)
          },
          american_prices: {
            binomial_50_steps: treeLow.priceAmerican(isCall).price,
            binomial_200_steps: treeMed.priceAmerican(isCall).price,
            binomial_1000_steps: treeHigh.priceAmerican(isCall).price
          },
          early_exercise_premium: {
            '50_steps': treeLow.priceAmerican(isCall).price - treeLow.priceEuropean(isCall),
            '200_steps': treeMed.priceAmerican(isCall).price - treeMed.priceEuropean(isCall),
            '1000_steps': treeHigh.priceAmerican(isCall).price - treeHigh.priceEuropean(isCall)
          },
          model_comparison: {
            black_scholes: 'Closed-form for European only; assumes continuous trading',
            binomial: 'Discrete time model; handles American options; converges to BS'
          }
        };
        break;
      }

      case 'info':
      default:
        result = {
          operation: 'info',
          description: 'Binomial Tree Options Pricing Model (Cox-Ross-Rubinstein)',
          applications: [
            'Pricing American options (no closed-form solution)',
            'Options on dividend-paying stocks',
            'Path-dependent options with modifications',
            'Educational tool for understanding option pricing'
          ],
          operations: {
            price: 'Calculate option price using binomial tree',
            build_tree: 'Visualize stock and option price trees',
            early_exercise: 'Analyze early exercise premium and optimal exercise',
            greeks: 'Calculate option sensitivities (delta, gamma, theta, vega, rho)',
            convergence: 'Study price convergence as steps increase',
            compare: 'Compare European vs American, binomial vs Black-Scholes'
          },
          parameters: {
            spot: 'Current stock price (S)',
            strike: 'Strike price (K)',
            time: 'Time to expiration in years (T)',
            rate: 'Risk-free interest rate (r)',
            volatility: 'Annualized volatility (σ)',
            dividend: 'Continuous dividend yield (q)',
            steps: 'Number of time steps in tree',
            option_type: 'call or put',
            style: 'american (early exercise) or european'
          },
          key_formulas: {
            up_factor: 'u = exp(σ√Δt)',
            down_factor: 'd = 1/u = exp(-σ√Δt)',
            risk_neutral_prob: 'p = (exp((r-q)Δt) - d) / (u - d)',
            backward_induction: 'V(i,j) = e^(-rΔt) × [p×V(i+1,j) + (1-p)×V(i+1,j+1)]',
            american_adjustment: 'V = max(hold_value, exercise_value)'
          },
          convergence: 'Binomial tree converges to Black-Scholes as n → ∞',
          examples: [
            { operation: 'price', spot: 100, strike: 105, time: 0.5, rate: 0.05, volatility: 0.25, style: 'american', option_type: 'put' },
            { operation: 'early_exercise', spot: 100, strike: 90, time: 1, rate: 0.1, volatility: 0.3, option_type: 'put' },
            { operation: 'greeks', spot: 50, strike: 50, time: 0.25, rate: 0.03, volatility: 0.2 }
          ]
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isbinomialoptionsAvailable(): boolean { return true; }
