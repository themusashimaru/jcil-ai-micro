/**
 * BLACK-SCHOLES TOOL
 * Complete Black-Scholes options pricing model with Greeks
 * Real mathematical implementations for financial derivatives
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const blackscholesTool: UnifiedTool = {
  name: 'black_scholes',
  description:
    'Black-Scholes options pricing - call/put prices, Greeks (delta, gamma, theta, vega, rho), implied volatility',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'price_call',
          'price_put',
          'greeks',
          'implied_volatility',
          'price_both',
          'put_call_parity',
          'info',
        ],
        description: 'Calculation type',
      },
      spot: { type: 'number', description: 'Current stock price (S)' },
      strike: { type: 'number', description: 'Strike price (K)' },
      time: { type: 'number', description: 'Time to expiration in years (T)' },
      rate: { type: 'number', description: 'Risk-free interest rate (r) as decimal (0.05 = 5%)' },
      volatility: { type: 'number', description: 'Volatility (σ) as decimal (0.2 = 20%)' },
      dividend: {
        type: 'number',
        description: 'Continuous dividend yield (q) as decimal (default: 0)',
      },
      market_price: {
        type: 'number',
        description: 'Market option price for implied volatility calculation',
      },
      option_type: {
        type: 'string',
        enum: ['call', 'put'],
        description: 'Option type for implied volatility',
      },
    },
    required: ['operation'],
  },
};

interface BlackScholesArgs {
  operation: string;
  spot?: number;
  strike?: number;
  time?: number;
  rate?: number;
  volatility?: number;
  dividend?: number;
  market_price?: number;
  option_type?: 'call' | 'put';
}

/**
 * Standard Normal Cumulative Distribution Function
 * Uses Abramowitz and Stegun approximation (error < 7.5e-8)
 */
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
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Standard Normal Probability Density Function
 */
function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Calculate d1 and d2 parameters
 */
function calculateD1D2(S: number, K: number, T: number, r: number, sigma: number, q: number = 0) {
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return { d1, d2 };
}

/**
 * Black-Scholes Call Option Price
 * C = S*e^(-qT)*N(d1) - K*e^(-rT)*N(d2)
 */
function callPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number = 0
): number {
  if (T <= 0) return Math.max(0, S * Math.exp(-q * T) - K);
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);
  return S * Math.exp(-q * T) * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
}

/**
 * Black-Scholes Put Option Price
 * P = K*e^(-rT)*N(-d2) - S*e^(-qT)*N(-d1)
 */
function putPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number = 0
): number {
  if (T <= 0) return Math.max(0, K - S * Math.exp(-q * T));
  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * Math.exp(-q * T) * normalCDF(-d1);
}

/**
 * Calculate all Greeks for an option
 */
function calculateGreeks(S: number, K: number, T: number, r: number, sigma: number, q: number = 0) {
  if (T <= 0) {
    return {
      call_delta: S > K ? 1 : 0,
      put_delta: S < K ? -1 : 0,
      gamma: 0,
      call_theta: 0,
      put_theta: 0,
      vega: 0,
      call_rho: 0,
      put_rho: 0,
    };
  }

  const { d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);
  const sqrtT = Math.sqrt(T);
  const expQT = Math.exp(-q * T);
  const expRT = Math.exp(-r * T);

  // Delta: ∂V/∂S
  const call_delta = expQT * normalCDF(d1);
  const put_delta = -expQT * normalCDF(-d1);

  // Gamma: ∂²V/∂S² (same for call and put)
  const gamma = (expQT * normalPDF(d1)) / (S * sigma * sqrtT);

  // Theta: -∂V/∂T (expressed as daily decay, divide by 365)
  const commonTheta = (-S * expQT * normalPDF(d1) * sigma) / (2 * sqrtT);
  const call_theta = commonTheta - r * K * expRT * normalCDF(d2) + q * S * expQT * normalCDF(d1);
  const put_theta = commonTheta + r * K * expRT * normalCDF(-d2) - q * S * expQT * normalCDF(-d1);

  // Vega: ∂V/∂σ (same for call and put, per 1% vol change)
  const vega = (S * expQT * normalPDF(d1) * sqrtT) / 100;

  // Rho: ∂V/∂r (per 1% rate change)
  const call_rho = (K * T * expRT * normalCDF(d2)) / 100;
  const put_rho = (-K * T * expRT * normalCDF(-d2)) / 100;

  // Vanna: ∂²V/∂S∂σ
  const vanna = (-expQT * normalPDF(d1) * d2) / sigma;

  // Charm: -∂²V/∂t∂S (delta decay)
  const charm =
    q * expQT * normalCDF(d1) -
    (expQT * normalPDF(d1) * (2 * (r - q) * T - d2 * sigma * sqrtT)) / (2 * T * sigma * sqrtT);

  // Vomma: ∂²V/∂σ² (volga)
  const vomma = (vega * 100 * d1 * d2) / sigma;

  return {
    d1,
    d2,
    call_delta,
    put_delta,
    gamma,
    call_theta_annual: call_theta,
    call_theta_daily: call_theta / 365,
    put_theta_annual: put_theta,
    put_theta_daily: put_theta / 365,
    vega_per_percent: vega,
    vega_per_point: vega * 100,
    call_rho_per_percent: call_rho,
    put_rho_per_percent: put_rho,
    vanna,
    charm,
    vomma,
  };
}

/**
 * Calculate Implied Volatility using Newton-Raphson method
 */
function impliedVolatility(
  S: number,
  K: number,
  T: number,
  r: number,
  marketPrice: number,
  optionType: 'call' | 'put',
  q: number = 0
): { iv: number; iterations: number; error: number } {
  const maxIterations = 100;
  const tolerance = 1e-8;

  // Initial guess using Brenner-Subrahmanyam approximation
  let sigma = (Math.sqrt((2 * Math.PI) / T) * marketPrice) / S;
  if (sigma <= 0 || !isFinite(sigma)) sigma = 0.2;

  for (let i = 0; i < maxIterations; i++) {
    const price =
      optionType === 'call' ? callPrice(S, K, T, r, sigma, q) : putPrice(S, K, T, r, sigma, q);

    const { d1 } = calculateD1D2(S, K, T, r, sigma, q);
    const vega = S * Math.exp(-q * T) * normalPDF(d1) * Math.sqrt(T);

    if (vega < 1e-10) break;

    const diff = price - marketPrice;
    if (Math.abs(diff) < tolerance) {
      return { iv: sigma, iterations: i + 1, error: Math.abs(diff) };
    }

    sigma = sigma - diff / vega;
    if (sigma <= 0) sigma = 0.001;
    if (sigma > 5) sigma = 5;
  }

  return { iv: sigma, iterations: maxIterations, error: NaN };
}

/**
 * Verify put-call parity: C - P = S*e^(-qT) - K*e^(-rT)
 */
function putCallParity(S: number, K: number, T: number, r: number, sigma: number, q: number = 0) {
  const C = callPrice(S, K, T, r, sigma, q);
  const P = putPrice(S, K, T, r, sigma, q);
  const theoretical = S * Math.exp(-q * T) - K * Math.exp(-r * T);
  const actual = C - P;

  return {
    call_price: C,
    put_price: P,
    call_minus_put: actual,
    theoretical_difference: theoretical,
    parity_error: Math.abs(actual - theoretical),
    parity_holds: Math.abs(actual - theoretical) < 1e-10,
    formula: 'C - P = S·e^(-qT) - K·e^(-rT)',
  };
}

/**
 * Calculate moneyness and related metrics
 */
function calculateMoneyness(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  q: number = 0
) {
  const forward = S * Math.exp((r - q) * T);
  const { d1: _d1, d2 } = calculateD1D2(S, K, T, r, sigma, q);

  return {
    spot_moneyness: S / K,
    forward_moneyness: forward / K,
    log_moneyness: Math.log(S / K),
    standardized_moneyness: d2,
    in_the_money_call: S > K,
    in_the_money_put: S < K,
    intrinsic_value_call: Math.max(0, S - K),
    intrinsic_value_put: Math.max(0, K - S),
    time_value_call: callPrice(S, K, T, r, sigma, q) - Math.max(0, S - K),
    time_value_put: putPrice(S, K, T, r, sigma, q) - Math.max(0, K - S),
    forward_price: forward,
  };
}

export async function executeblackscholes(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args: BlackScholesArgs = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      spot = 100,
      strike = 100,
      time = 1,
      rate = 0.05,
      volatility = 0.2,
      dividend = 0,
      market_price,
      option_type = 'call',
    } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'price_call': {
        const price = callPrice(spot, strike, time, rate, volatility, dividend);
        const intrinsic = Math.max(0, spot - strike);
        result = {
          operation: 'price_call',
          inputs: { spot, strike, time, rate, volatility, dividend },
          call_price: price,
          intrinsic_value: intrinsic,
          time_value: price - intrinsic,
          formula: 'C = S·e^(-qT)·N(d1) - K·e^(-rT)·N(d2)',
        };
        break;
      }

      case 'price_put': {
        const price = putPrice(spot, strike, time, rate, volatility, dividend);
        const intrinsic = Math.max(0, strike - spot);
        result = {
          operation: 'price_put',
          inputs: { spot, strike, time, rate, volatility, dividend },
          put_price: price,
          intrinsic_value: intrinsic,
          time_value: price - intrinsic,
          formula: 'P = K·e^(-rT)·N(-d2) - S·e^(-qT)·N(-d1)',
        };
        break;
      }

      case 'price_both': {
        const call = callPrice(spot, strike, time, rate, volatility, dividend);
        const put = putPrice(spot, strike, time, rate, volatility, dividend);
        result = {
          operation: 'price_both',
          inputs: { spot, strike, time, rate, volatility, dividend },
          call_price: call,
          put_price: put,
          call_intrinsic: Math.max(0, spot - strike),
          put_intrinsic: Math.max(0, strike - spot),
          call_time_value: call - Math.max(0, spot - strike),
          put_time_value: put - Math.max(0, strike - spot),
          ...calculateMoneyness(spot, strike, time, rate, volatility, dividend),
        };
        break;
      }

      case 'greeks': {
        const greeks = calculateGreeks(spot, strike, time, rate, volatility, dividend);
        result = {
          operation: 'greeks',
          inputs: { spot, strike, time, rate, volatility, dividend },
          call_price: callPrice(spot, strike, time, rate, volatility, dividend),
          put_price: putPrice(spot, strike, time, rate, volatility, dividend),
          ...greeks,
          greek_definitions: {
            delta: 'Sensitivity to underlying price change (∂V/∂S)',
            gamma: 'Rate of change of delta (∂²V/∂S²)',
            theta: 'Time decay per day (negative for long options)',
            vega: 'Sensitivity to 1% volatility change',
            rho: 'Sensitivity to 1% interest rate change',
            vanna: 'Cross-sensitivity of delta to volatility',
            charm: 'Delta decay over time',
            vomma: 'Sensitivity of vega to volatility',
          },
        };
        break;
      }

      case 'implied_volatility': {
        if (market_price === undefined) {
          throw new Error('market_price is required for implied volatility calculation');
        }
        const { iv, iterations, error } = impliedVolatility(
          spot,
          strike,
          time,
          rate,
          market_price,
          option_type,
          dividend
        );
        const theoreticalPrice =
          option_type === 'call'
            ? callPrice(spot, strike, time, rate, iv, dividend)
            : putPrice(spot, strike, time, rate, iv, dividend);

        result = {
          operation: 'implied_volatility',
          inputs: { spot, strike, time, rate, market_price, option_type, dividend },
          implied_volatility: iv,
          implied_volatility_percent: iv * 100,
          iterations,
          pricing_error: error,
          theoretical_price_at_iv: theoreticalPrice,
          annualized_move_1sd: spot * iv * Math.sqrt(time),
          daily_move_1sd: (spot * iv) / Math.sqrt(252),
        };
        break;
      }

      case 'put_call_parity': {
        result = {
          operation: 'put_call_parity',
          inputs: { spot, strike, time, rate, volatility, dividend },
          ...putCallParity(spot, strike, time, rate, volatility, dividend),
        };
        break;
      }

      case 'info':
      default:
        result = {
          operation: 'info',
          description: 'Black-Scholes Options Pricing Model',
          model_assumptions: [
            'European-style options (exercise only at expiration)',
            'Constant volatility',
            'Constant risk-free rate',
            'No transaction costs or taxes',
            'Log-normal price distribution',
            'Continuous trading possible',
          ],
          operations: {
            price_call: 'Calculate call option price',
            price_put: 'Calculate put option price',
            price_both: 'Calculate both call and put with moneyness',
            greeks: 'Calculate all option Greeks (delta, gamma, theta, vega, rho, etc.)',
            implied_volatility: 'Solve for volatility given market price',
            put_call_parity: 'Verify put-call parity relationship',
          },
          parameters: {
            spot: 'Current stock/underlying price (S)',
            strike: 'Strike/exercise price (K)',
            time: 'Time to expiration in years (T)',
            rate: 'Risk-free interest rate as decimal',
            volatility: 'Annualized volatility as decimal',
            dividend: 'Continuous dividend yield as decimal',
            market_price: 'Market option price (for IV)',
            option_type: 'call or put (for IV)',
          },
          formulas: {
            d1: 'd1 = [ln(S/K) + (r-q+σ²/2)T] / (σ√T)',
            d2: 'd2 = d1 - σ√T',
            call: 'C = S·e^(-qT)·N(d1) - K·e^(-rT)·N(d2)',
            put: 'P = K·e^(-rT)·N(-d2) - S·e^(-qT)·N(-d1)',
            parity: 'C - P = S·e^(-qT) - K·e^(-rT)',
          },
          examples: [
            {
              operation: 'price_both',
              spot: 100,
              strike: 105,
              time: 0.5,
              rate: 0.05,
              volatility: 0.25,
            },
            { operation: 'greeks', spot: 50, strike: 50, time: 0.25, rate: 0.03, volatility: 0.3 },
            {
              operation: 'implied_volatility',
              spot: 100,
              strike: 100,
              time: 1,
              rate: 0.05,
              market_price: 10,
              option_type: 'call',
            },
          ],
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isblackscholesAvailable(): boolean {
  return true;
}
