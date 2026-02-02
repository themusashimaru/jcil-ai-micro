/**
 * BLACK-SCHOLES TOOL
 * Black-Scholes options pricing model with complete Greeks calculation
 * Including implied volatility solver using Newton-Raphson
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const blackscholesTool: UnifiedTool = {
  name: 'black_scholes',
  description: 'Black-Scholes options pricing model with Greeks and implied volatility',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'price', 'greeks', 'implied_volatility', 'payoff', 'strategy', 'demonstrate'],
        description: 'Operation to perform'
      },
      option_type: { type: 'string', enum: ['call', 'put'], description: 'Option type' },
      spot: { type: 'number', description: 'Current stock price (S)' },
      strike: { type: 'number', description: 'Strike price (K)' },
      time: { type: 'number', description: 'Time to expiration in years (T)' },
      rate: { type: 'number', description: 'Risk-free interest rate (r)' },
      volatility: { type: 'number', description: 'Volatility (sigma)' },
      dividend: { type: 'number', description: 'Dividend yield (q)' },
      market_price: { type: 'number', description: 'Market price for implied volatility' },
      strategy: { type: 'string', description: 'Options strategy name' }
    },
    required: ['operation']
  }
};

// ===== MATHEMATICAL FUNCTIONS =====

// Standard normal CDF using Abramowitz & Stegun approximation
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

// Standard normal PDF
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// Calculate d1 and d2
function calculateD1D2(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number = 0
): { d1: number; d2: number } {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

// ===== BLACK-SCHOLES PRICING =====

function blackScholesCall(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number = 0
): number {
  if (T <= 0) return Math.max(0, S - K);

  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);
  return S * Math.exp(-q * T) * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

function blackScholesPut(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number = 0
): number {
  if (T <= 0) return Math.max(0, K - S);

  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * Math.exp(-q * T) * normalCDF(-d1);
}

// ===== GREEKS =====

interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

function calculateGreeks(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  optionType: 'call' | 'put',
  q: number = 0
): Greeks {
  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);
  const sqrtT = Math.sqrt(T);
  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);

  // Delta
  let delta: number;
  if (optionType === 'call') {
    delta = expQT * normalCDF(d1);
  } else {
    delta = -expQT * normalCDF(-d1);
  }

  // Gamma (same for call and put)
  const gamma = expQT * normalPDF(d1) / (S * sigma * sqrtT);

  // Theta
  let theta: number;
  const commonTheta = -S * expQT * normalPDF(d1) * sigma / (2 * sqrtT);
  if (optionType === 'call') {
    theta = commonTheta + q * S * expQT * normalCDF(d1) - r * K * expRT * normalCDF(d2);
  } else {
    theta = commonTheta - q * S * expQT * normalCDF(-d1) + r * K * expRT * normalCDF(-d2);
  }
  // Convert to daily theta
  theta = theta / 365;

  // Vega (same for call and put)
  const vega = S * expQT * sqrtT * normalPDF(d1) / 100; // Per 1% vol change

  // Rho
  let rho: number;
  if (optionType === 'call') {
    rho = K * T * expRT * normalCDF(d2) / 100; // Per 1% rate change
  } else {
    rho = -K * T * expRT * normalCDF(-d2) / 100;
  }

  return { delta, gamma, theta, vega, rho };
}

// ===== IMPLIED VOLATILITY =====

function impliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  optionType: 'call' | 'put',
  q: number = 0
): { iv: number; iterations: number; converged: boolean } {
  // Newton-Raphson method
  let sigma = 0.3; // Initial guess
  const maxIterations = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIterations; i++) {
    const price = optionType === 'call'
      ? blackScholesCall(S, K, T, r, sigma, q)
      : blackScholesPut(S, K, T, r, sigma, q);

    const diff = price - marketPrice;

    if (Math.abs(diff) < tolerance) {
      return { iv: sigma, iterations: i + 1, converged: true };
    }

    // Vega for Newton-Raphson step
    const { d1 } = calculateD1D2(S, K, T, r, sigma, q);
    const vega = S * Math.exp(-q * T) * Math.sqrt(T) * normalPDF(d1);

    if (vega < 1e-10) {
      break; // Avoid division by zero
    }

    sigma = sigma - diff / vega;

    // Keep sigma positive and reasonable
    sigma = Math.max(0.001, Math.min(5.0, sigma));
  }

  return { iv: sigma, iterations: maxIterations, converged: false };
}

// ===== OPTIONS STRATEGIES =====

interface StrategyLeg {
  type: 'call' | 'put';
  strike: number;
  position: 'long' | 'short';
  quantity: number;
}

interface Strategy {
  name: string;
  legs: StrategyLeg[];
  description: string;
  maxProfit: string;
  maxLoss: string;
  breakeven: string;
  outlook: string;
}

function getStrategy(name: string, S: number): Strategy | null {
  const strategies: Record<string, Strategy> = {
    long_call: {
      name: 'Long Call',
      legs: [{ type: 'call', strike: S, position: 'long', quantity: 1 }],
      description: 'Buy a call option',
      maxProfit: 'Unlimited',
      maxLoss: 'Premium paid',
      breakeven: 'Strike + Premium',
      outlook: 'Bullish'
    },
    long_put: {
      name: 'Long Put',
      legs: [{ type: 'put', strike: S, position: 'long', quantity: 1 }],
      description: 'Buy a put option',
      maxProfit: 'Strike - Premium (if stock goes to 0)',
      maxLoss: 'Premium paid',
      breakeven: 'Strike - Premium',
      outlook: 'Bearish'
    },
    covered_call: {
      name: 'Covered Call',
      legs: [{ type: 'call', strike: S * 1.05, position: 'short', quantity: 1 }],
      description: 'Own stock + sell OTM call',
      maxProfit: '(Strike - Stock Price) + Premium',
      maxLoss: 'Stock price - Premium (if stock goes to 0)',
      breakeven: 'Stock price - Premium',
      outlook: 'Neutral to slightly bullish'
    },
    protective_put: {
      name: 'Protective Put',
      legs: [{ type: 'put', strike: S * 0.95, position: 'long', quantity: 1 }],
      description: 'Own stock + buy OTM put',
      maxProfit: 'Unlimited',
      maxLoss: 'Stock price - Strike + Premium',
      breakeven: 'Stock price + Premium',
      outlook: 'Bullish with protection'
    },
    bull_call_spread: {
      name: 'Bull Call Spread',
      legs: [
        { type: 'call', strike: S, position: 'long', quantity: 1 },
        { type: 'call', strike: S * 1.1, position: 'short', quantity: 1 }
      ],
      description: 'Buy ATM call, sell OTM call',
      maxProfit: 'Upper strike - Lower strike - Net premium',
      maxLoss: 'Net premium paid',
      breakeven: 'Lower strike + Net premium',
      outlook: 'Moderately bullish'
    },
    bear_put_spread: {
      name: 'Bear Put Spread',
      legs: [
        { type: 'put', strike: S, position: 'long', quantity: 1 },
        { type: 'put', strike: S * 0.9, position: 'short', quantity: 1 }
      ],
      description: 'Buy ATM put, sell OTM put',
      maxProfit: 'Upper strike - Lower strike - Net premium',
      maxLoss: 'Net premium paid',
      breakeven: 'Upper strike - Net premium',
      outlook: 'Moderately bearish'
    },
    straddle: {
      name: 'Long Straddle',
      legs: [
        { type: 'call', strike: S, position: 'long', quantity: 1 },
        { type: 'put', strike: S, position: 'long', quantity: 1 }
      ],
      description: 'Buy ATM call and ATM put',
      maxProfit: 'Unlimited',
      maxLoss: 'Total premium paid',
      breakeven: 'Strike ± Total premium',
      outlook: 'High volatility expected'
    },
    strangle: {
      name: 'Long Strangle',
      legs: [
        { type: 'call', strike: S * 1.05, position: 'long', quantity: 1 },
        { type: 'put', strike: S * 0.95, position: 'long', quantity: 1 }
      ],
      description: 'Buy OTM call and OTM put',
      maxProfit: 'Unlimited',
      maxLoss: 'Total premium paid',
      breakeven: 'Upper strike + Premium or Lower strike - Premium',
      outlook: 'High volatility expected'
    },
    iron_condor: {
      name: 'Iron Condor',
      legs: [
        { type: 'put', strike: S * 0.9, position: 'long', quantity: 1 },
        { type: 'put', strike: S * 0.95, position: 'short', quantity: 1 },
        { type: 'call', strike: S * 1.05, position: 'short', quantity: 1 },
        { type: 'call', strike: S * 1.1, position: 'long', quantity: 1 }
      ],
      description: 'Sell OTM put spread + sell OTM call spread',
      maxProfit: 'Net premium received',
      maxLoss: 'Width of wider spread - Net premium',
      breakeven: 'Short strikes ± Net premium',
      outlook: 'Low volatility expected, neutral'
    },
    butterfly: {
      name: 'Long Call Butterfly',
      legs: [
        { type: 'call', strike: S * 0.95, position: 'long', quantity: 1 },
        { type: 'call', strike: S, position: 'short', quantity: 2 },
        { type: 'call', strike: S * 1.05, position: 'long', quantity: 1 }
      ],
      description: 'Buy lower call, sell 2 middle calls, buy upper call',
      maxProfit: 'Middle strike - Lower strike - Net premium',
      maxLoss: 'Net premium paid',
      breakeven: 'Lower strike + Premium or Upper strike - Premium',
      outlook: 'Low volatility, stock stays near middle strike'
    }
  };

  return strategies[name.toLowerCase().replace(/\s+/g, '_')] || null;
}

// Calculate strategy payoff at expiration
function calculateStrategyPayoff(
  strategy: Strategy,
  S: number,
  T: number,
  r: number,
  sigma: number,
  stockPrices: number[]
): { prices: number[]; payoffs: number[]; totalPremium: number } {
  // Calculate premium for each leg
  let totalPremium = 0;
  const legPrices: number[] = [];

  for (const leg of strategy.legs) {
    const price = leg.type === 'call'
      ? blackScholesCall(S, leg.strike, T, r, sigma)
      : blackScholesPut(S, leg.strike, T, r, sigma);

    legPrices.push(price);
    const multiplier = leg.position === 'long' ? -1 : 1;
    totalPremium += multiplier * price * leg.quantity;
  }

  // Calculate payoff at each stock price
  const payoffs = stockPrices.map(price => {
    let payoff = totalPremium;

    for (const leg of strategy.legs) {
      let intrinsicValue: number;
      if (leg.type === 'call') {
        intrinsicValue = Math.max(0, price - leg.strike);
      } else {
        intrinsicValue = Math.max(0, leg.strike - price);
      }

      const multiplier = leg.position === 'long' ? 1 : -1;
      payoff += multiplier * intrinsicValue * leg.quantity;
    }

    return payoff;
  });

  return { prices: stockPrices, payoffs, totalPremium };
}

// ===== MAIN EXECUTION =====

export async function executeblackscholes(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'black_scholes',
            description: 'Black-Scholes-Merton options pricing model',
            formula: {
              call: 'C = S·e^(-qT)·N(d₁) - K·e^(-rT)·N(d₂)',
              put: 'P = K·e^(-rT)·N(-d₂) - S·e^(-qT)·N(-d₁)',
              d1: 'd₁ = [ln(S/K) + (r - q + σ²/2)T] / (σ√T)',
              d2: 'd₂ = d₁ - σ√T'
            },
            variables: {
              S: 'Current stock price',
              K: 'Strike price',
              T: 'Time to expiration (years)',
              r: 'Risk-free interest rate',
              sigma: 'Volatility (standard deviation of returns)',
              q: 'Dividend yield'
            },
            greeks: {
              delta: 'Rate of change of option price with respect to stock price',
              gamma: 'Rate of change of delta with respect to stock price',
              theta: 'Rate of change of option price with respect to time',
              vega: 'Rate of change of option price with respect to volatility',
              rho: 'Rate of change of option price with respect to interest rate'
            },
            assumptions: [
              'European-style options (exercise only at expiration)',
              'No arbitrage opportunities',
              'Constant volatility and risk-free rate',
              'Log-normal distribution of stock prices',
              'No transaction costs or taxes',
              'Continuous trading possible'
            ],
            operations: ['info', 'price', 'greeks', 'implied_volatility', 'payoff', 'strategy', 'demonstrate']
          }, null, 2)
        };
      }

      case 'price': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const T = args.time || 0.25;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const q = args.dividend || 0;
        const optionType = (args.option_type as 'call' | 'put') || 'call';

        const price = optionType === 'call'
          ? blackScholesCall(S, K, T, r, sigma, q)
          : blackScholesPut(S, K, T, r, sigma, q);

        const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);

        // Intrinsic and time value
        const intrinsicValue = optionType === 'call'
          ? Math.max(0, S - K)
          : Math.max(0, K - S);
        const timeValue = price - intrinsicValue;

        // Moneyness
        let moneyness: string;
        if (optionType === 'call') {
          moneyness = S > K ? 'In-the-money' : S < K ? 'Out-of-the-money' : 'At-the-money';
        } else {
          moneyness = S < K ? 'In-the-money' : S > K ? 'Out-of-the-money' : 'At-the-money';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            option_type: optionType,
            inputs: {
              spot_price: S,
              strike_price: K,
              time_to_expiration: `${T} years (${Math.round(T * 365)} days)`,
              risk_free_rate: `${(r * 100).toFixed(2)}%`,
              volatility: `${(sigma * 100).toFixed(2)}%`,
              dividend_yield: `${(q * 100).toFixed(2)}%`
            },
            pricing: {
              option_price: Math.round(price * 100) / 100,
              intrinsic_value: Math.round(intrinsicValue * 100) / 100,
              time_value: Math.round(timeValue * 100) / 100
            },
            intermediate: {
              d1: Math.round(d1 * 10000) / 10000,
              d2: Math.round(d2 * 10000) / 10000,
              'N(d1)': Math.round(normalCDF(d1) * 10000) / 10000,
              'N(d2)': Math.round(normalCDF(d2) * 10000) / 10000
            },
            moneyness,
            breakeven: optionType === 'call'
              ? Math.round((K + price) * 100) / 100
              : Math.round((K - price) * 100) / 100
          }, null, 2)
        };
      }

      case 'greeks': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const T = args.time || 0.25;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;
        const q = args.dividend || 0;
        const optionType = (args.option_type as 'call' | 'put') || 'call';

        const greeks = calculateGreeks(S, K, T, r, sigma, optionType, q);
        const price = optionType === 'call'
          ? blackScholesCall(S, K, T, r, sigma, q)
          : blackScholesPut(S, K, T, r, sigma, q);

        return {
          toolCallId: id,
          content: JSON.stringify({
            option_type: optionType,
            option_price: Math.round(price * 100) / 100,
            greeks: {
              delta: {
                value: Math.round(greeks.delta * 10000) / 10000,
                interpretation: `Option price changes by $${Math.abs(Math.round(greeks.delta * 100) / 100)} for $1 move in stock`
              },
              gamma: {
                value: Math.round(greeks.gamma * 10000) / 10000,
                interpretation: `Delta changes by ${Math.round(greeks.gamma * 10000) / 10000} for $1 move in stock`
              },
              theta: {
                value: Math.round(greeks.theta * 10000) / 10000,
                interpretation: `Option loses $${Math.abs(Math.round(greeks.theta * 100) / 100)} per day from time decay`
              },
              vega: {
                value: Math.round(greeks.vega * 10000) / 10000,
                interpretation: `Option price changes by $${Math.round(greeks.vega * 100) / 100} for 1% change in volatility`
              },
              rho: {
                value: Math.round(greeks.rho * 10000) / 10000,
                interpretation: `Option price changes by $${Math.round(greeks.rho * 100) / 100} for 1% change in interest rate`
              }
            },
            risk_metrics: {
              dollar_delta: Math.round(greeks.delta * S * 100) / 100,
              delta_hedge_shares: Math.round(greeks.delta * 100),
              gamma_risk: greeks.gamma > 0.01 ? 'High' : greeks.gamma > 0.005 ? 'Medium' : 'Low',
              time_decay_pct: Math.round(greeks.theta / price * 10000) / 100 + '% per day'
            }
          }, null, 2)
        };
      }

      case 'implied_volatility': {
        const marketPrice = args.market_price;
        const S = args.spot || 100;
        const K = args.strike || 100;
        const T = args.time || 0.25;
        const r = args.rate || 0.05;
        const q = args.dividend || 0;
        const optionType = (args.option_type as 'call' | 'put') || 'call';

        if (!marketPrice) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'market_price is required for implied volatility calculation',
              example: {
                operation: 'implied_volatility',
                market_price: 5.50,
                spot: 100,
                strike: 100,
                time: 0.25,
                rate: 0.05,
                option_type: 'call'
              }
            }, null, 2)
          };
        }

        const result = impliedVolatility(marketPrice, S, K, T, r, optionType, q);

        // Calculate theoretical price with found IV
        const theoreticalPrice = optionType === 'call'
          ? blackScholesCall(S, K, T, r, result.iv, q)
          : blackScholesPut(S, K, T, r, result.iv, q);

        return {
          toolCallId: id,
          content: JSON.stringify({
            option_type: optionType,
            inputs: {
              market_price: marketPrice,
              spot: S,
              strike: K,
              time: T,
              risk_free_rate: r
            },
            result: {
              implied_volatility: `${(result.iv * 100).toFixed(2)}%`,
              implied_volatility_decimal: Math.round(result.iv * 10000) / 10000,
              converged: result.converged,
              iterations: result.iterations
            },
            verification: {
              theoretical_price: Math.round(theoreticalPrice * 100) / 100,
              pricing_error: Math.round(Math.abs(theoreticalPrice - marketPrice) * 10000) / 10000
            },
            interpretation: `The market is pricing ${(result.iv * 100).toFixed(1)}% annualized volatility into this option`
          }, null, 2)
        };
      }

      case 'payoff': {
        const S = args.spot || 100;
        const K = args.strike || 100;
        const optionType = (args.option_type as 'call' | 'put') || 'call';
        const T = args.time || 0.25;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;

        const premium = optionType === 'call'
          ? blackScholesCall(S, K, T, r, sigma)
          : blackScholesPut(S, K, T, r, sigma);

        // Generate payoff table
        const priceRange = [];
        for (let p = K * 0.7; p <= K * 1.3; p += K * 0.05) {
          priceRange.push(Math.round(p * 100) / 100);
        }

        const payoffs = priceRange.map(price => {
          const intrinsic = optionType === 'call'
            ? Math.max(0, price - K)
            : Math.max(0, K - price);
          const profit = intrinsic - premium;
          return {
            stock_price: price,
            intrinsic_value: Math.round(intrinsic * 100) / 100,
            profit_loss: Math.round(profit * 100) / 100
          };
        });

        const breakeven = optionType === 'call' ? K + premium : K - premium;

        return {
          toolCallId: id,
          content: JSON.stringify({
            option_type: optionType,
            strike: K,
            premium_paid: Math.round(premium * 100) / 100,
            breakeven_price: Math.round(breakeven * 100) / 100,
            max_profit: optionType === 'call' ? 'Unlimited' : Math.round((K - premium) * 100) / 100,
            max_loss: Math.round(premium * 100) / 100,
            payoff_at_expiration: payoffs
          }, null, 2)
        };
      }

      case 'strategy': {
        const strategyName = args.strategy || 'straddle';
        const S = args.spot || 100;
        const T = args.time || 0.25;
        const r = args.rate || 0.05;
        const sigma = args.volatility || 0.2;

        const strategy = getStrategy(strategyName, S);

        if (!strategy) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Unknown strategy: ${strategyName}`,
              available_strategies: [
                'long_call', 'long_put', 'covered_call', 'protective_put',
                'bull_call_spread', 'bear_put_spread', 'straddle', 'strangle',
                'iron_condor', 'butterfly'
              ]
            }, null, 2)
          };
        }

        // Generate price range for payoff
        const priceRange = [];
        for (let p = S * 0.7; p <= S * 1.3; p += S * 0.05) {
          priceRange.push(Math.round(p * 100) / 100);
        }

        const payoff = calculateStrategyPayoff(strategy, S, T, r, sigma, priceRange);

        // Calculate leg prices
        const legDetails = strategy.legs.map(leg => {
          const price = leg.type === 'call'
            ? blackScholesCall(S, leg.strike, T, r, sigma)
            : blackScholesPut(S, leg.strike, T, r, sigma);
          return {
            type: leg.type,
            strike: Math.round(leg.strike * 100) / 100,
            position: leg.position,
            quantity: leg.quantity,
            premium: Math.round(price * 100) / 100
          };
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            strategy: strategy.name,
            description: strategy.description,
            current_stock_price: S,
            legs: legDetails,
            net_premium: Math.round(payoff.totalPremium * 100) / 100,
            characteristics: {
              max_profit: strategy.maxProfit,
              max_loss: strategy.maxLoss,
              breakeven: strategy.breakeven,
              market_outlook: strategy.outlook
            },
            payoff_at_expiration: payoff.prices.map((price, i) => ({
              stock_price: price,
              profit_loss: Math.round(payoff.payoffs[i] * 100) / 100
            }))
          }, null, 2)
        };
      }

      case 'demonstrate': {
        const S = 100;
        const K = 100;
        const T = 0.25;
        const r = 0.05;
        const sigma = 0.2;

        const callPrice = blackScholesCall(S, K, T, r, sigma);
        const putPrice = blackScholesPut(S, K, T, r, sigma);
        const callGreeks = calculateGreeks(S, K, T, r, sigma, 'call');
        const putGreeks = calculateGreeks(S, K, T, r, sigma, 'put');

        // Put-call parity check
        const pcpLeft = callPrice - putPrice;
        const pcpRight = S - K * Math.exp(-r * T);

        return {
          toolCallId: id,
          content: JSON.stringify({
            demonstration: 'Black-Scholes Options Pricing',
            parameters: {
              spot_price: S,
              strike_price: K,
              time_to_expiration: '3 months (0.25 years)',
              risk_free_rate: '5%',
              volatility: '20%'
            },
            pricing: {
              call_option: Math.round(callPrice * 100) / 100,
              put_option: Math.round(putPrice * 100) / 100
            },
            greeks_comparison: {
              delta: { call: Math.round(callGreeks.delta * 100) / 100, put: Math.round(putGreeks.delta * 100) / 100 },
              gamma: Math.round(callGreeks.gamma * 10000) / 10000,
              theta: { call: Math.round(callGreeks.theta * 100) / 100, put: Math.round(putGreeks.theta * 100) / 100 },
              vega: Math.round(callGreeks.vega * 100) / 100,
              rho: { call: Math.round(callGreeks.rho * 100) / 100, put: Math.round(putGreeks.rho * 100) / 100 }
            },
            put_call_parity: {
              formula: 'C - P = S - K·e^(-rT)',
              left_side: Math.round(pcpLeft * 100) / 100,
              right_side: Math.round(pcpRight * 100) / 100,
              verified: Math.abs(pcpLeft - pcpRight) < 0.01
            },
            key_insights: [
              'ATM options have ~50% delta (calls positive, puts negative)',
              'Gamma is highest for ATM options near expiration',
              'Theta decay accelerates as expiration approaches',
              'Vega is highest for ATM options with longer expiration',
              'Put-Call Parity links European call and put prices'
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            available_operations: ['info', 'price', 'greeks', 'implied_volatility', 'payoff', 'strategy', 'demonstrate']
          }, null, 2)
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isblackscholesAvailable(): boolean { return true; }
