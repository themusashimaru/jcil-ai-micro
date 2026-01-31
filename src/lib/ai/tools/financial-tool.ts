/**
 * FINANCIAL MATH TOOL
 *
 * Financial calculations using the financial library.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Time value of money (PV, FV, PMT)
 * - Net Present Value (NPV)
 * - Internal Rate of Return (IRR)
 * - Loan amortization
 * - Bond pricing
 * - Options pricing (Black-Scholes)
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let financial: any = null;

async function initFinancial(): Promise<boolean> {
  if (financial) return true;
  try {
    const mod = await import('financial');
    financial = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const financialTool: UnifiedTool = {
  name: 'financial_calc',
  description: `Perform financial calculations and analysis.

Operations:
- pv: Present Value of future cash flows
- fv: Future Value of investment
- pmt: Payment amount for loan/annuity
- npv: Net Present Value of cash flows
- irr: Internal Rate of Return
- amortization: Loan amortization schedule
- compound: Compound interest calculations
- bond_price: Bond pricing
- black_scholes: Options pricing (Black-Scholes model)

Use cases:
- Loan and mortgage calculations
- Investment analysis
- Project valuation
- Options and derivatives pricing
- Retirement planning`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'pv',
          'fv',
          'pmt',
          'npv',
          'irr',
          'amortization',
          'compound',
          'bond_price',
          'black_scholes',
        ],
        description: 'Financial calculation to perform',
      },
      rate: {
        type: 'number',
        description: 'Interest/discount rate per period (as decimal, e.g., 0.05 for 5%)',
      },
      nper: {
        type: 'number',
        description: 'Number of periods',
      },
      pmt: {
        type: 'number',
        description: 'Payment per period',
      },
      pv: {
        type: 'number',
        description: 'Present value / principal',
      },
      fv: {
        type: 'number',
        description: 'Future value',
      },
      cash_flows: {
        type: 'array',
        items: { type: 'number' },
        description:
          'Array of cash flows for NPV/IRR (first element is initial investment, usually negative)',
      },
      // Bond parameters
      face_value: {
        type: 'number',
        description: 'Bond face/par value',
      },
      coupon_rate: {
        type: 'number',
        description: 'Annual coupon rate (as decimal)',
      },
      years_to_maturity: {
        type: 'number',
        description: 'Years until bond maturity',
      },
      // Black-Scholes parameters
      stock_price: {
        type: 'number',
        description: 'Current stock price (S)',
      },
      strike_price: {
        type: 'number',
        description: 'Option strike price (K)',
      },
      time_to_expiry: {
        type: 'number',
        description: 'Time to expiration in years',
      },
      volatility: {
        type: 'number',
        description: 'Annual volatility (sigma, as decimal)',
      },
      risk_free_rate: {
        type: 'number',
        description: 'Risk-free interest rate (as decimal)',
      },
      option_type: {
        type: 'string',
        enum: ['call', 'put'],
        description: 'Option type',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isFinancialAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Standard normal CDF approximation for Black-Scholes
function normCDF(x: number): number {
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

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeFinancial(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    rate?: number;
    nper?: number;
    pmt?: number;
    pv?: number;
    fv?: number;
    cash_flows?: number[];
    face_value?: number;
    coupon_rate?: number;
    years_to_maturity?: number;
    stock_price?: number;
    strike_price?: number;
    time_to_expiry?: number;
    volatility?: number;
    risk_free_rate?: number;
    option_type?: string;
  };

  const { operation } = args;

  try {
    const initialized = await initFinancial();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize financial library' }),
        isError: true,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'pv': {
        const { rate, nper, pmt = 0, fv = 0 } = args;
        if (rate === undefined || nper === undefined) {
          throw new Error('rate and nper required for PV calculation');
        }
        const pvValue = financial.PV(rate, nper, pmt, fv);
        result = {
          operation: 'present_value',
          inputs: { rate, nper, pmt, fv },
          present_value: pvValue,
          formula: 'PV = PMT * [(1 - (1+r)^-n) / r] + FV * (1+r)^-n',
        };
        break;
      }

      case 'fv': {
        const { rate, nper, pmt = 0, pv = 0 } = args;
        if (rate === undefined || nper === undefined) {
          throw new Error('rate and nper required for FV calculation');
        }
        const fvValue = financial.FV(rate, nper, pmt, pv);
        result = {
          operation: 'future_value',
          inputs: { rate, nper, pmt, pv },
          future_value: fvValue,
          formula: 'FV = PV * (1+r)^n + PMT * [((1+r)^n - 1) / r]',
        };
        break;
      }

      case 'pmt': {
        const { rate, nper, pv, fv = 0 } = args;
        if (rate === undefined || nper === undefined || pv === undefined) {
          throw new Error('rate, nper, and pv required for PMT calculation');
        }
        const pmtValue = financial.PMT(rate, nper, pv, fv);
        result = {
          operation: 'payment',
          inputs: { rate, nper, pv, fv },
          payment: pmtValue,
          total_payments: pmtValue * nper,
          total_interest: pmtValue * nper - pv,
        };
        break;
      }

      case 'npv': {
        const { rate, cash_flows } = args;
        if (rate === undefined || !cash_flows) {
          throw new Error('rate and cash_flows required for NPV');
        }
        const npvValue = financial.NPV(rate, ...cash_flows);
        result = {
          operation: 'net_present_value',
          inputs: { rate, cash_flows },
          npv: npvValue,
          interpretation:
            npvValue > 0 ? 'Project adds value (accept)' : 'Project destroys value (reject)',
        };
        break;
      }

      case 'irr': {
        const { cash_flows } = args;
        if (!cash_flows) {
          throw new Error('cash_flows required for IRR');
        }
        const irrValue = financial.IRR(cash_flows);
        result = {
          operation: 'internal_rate_of_return',
          inputs: { cash_flows },
          irr: irrValue,
          irr_percent: (irrValue * 100).toFixed(2) + '%',
          interpretation: 'Rate at which NPV equals zero',
        };
        break;
      }

      case 'amortization': {
        const { rate, nper, pv } = args;
        if (rate === undefined || nper === undefined || pv === undefined) {
          throw new Error('rate, nper, and pv required for amortization');
        }
        const pmtValue = -financial.PMT(rate, nper, pv, 0);
        const schedule: Array<{
          period: number;
          payment: number;
          principal: number;
          interest: number;
          balance: number;
        }> = [];

        let balance = pv;

        for (let i = 1; i <= Math.min(nper, 60); i++) {
          // Cap at 60 periods for display
          const interest = balance * rate;
          const principal = pmtValue - interest;
          balance -= principal;

          schedule.push({
            period: i,
            payment: pmtValue,
            principal,
            interest,
            balance: Math.max(0, balance),
          });
        }

        result = {
          operation: 'amortization',
          inputs: { rate, nper, pv },
          monthly_payment: pmtValue,
          total_payments: pmtValue * nper,
          total_interest: pmtValue * nper - pv,
          schedule: schedule.slice(0, 12), // First 12 periods
          summary: {
            loan_amount: pv,
            total_paid: pmtValue * nper,
            total_interest: pmtValue * nper - pv,
          },
        };
        break;
      }

      case 'compound': {
        const { pv, rate, nper } = args;
        if (pv === undefined || rate === undefined || nper === undefined) {
          throw new Error('pv, rate, and nper required for compound interest');
        }
        const fvValue = pv * Math.pow(1 + rate, nper);
        const interestEarned = fvValue - pv;
        result = {
          operation: 'compound_interest',
          inputs: { principal: pv, rate, periods: nper },
          future_value: fvValue,
          interest_earned: interestEarned,
          effective_rate: Math.pow(1 + rate, nper) - 1,
          formula: 'FV = PV × (1 + r)^n',
        };
        break;
      }

      case 'bond_price': {
        const { face_value = 1000, coupon_rate, years_to_maturity, rate } = args;
        if (coupon_rate === undefined || years_to_maturity === undefined || rate === undefined) {
          throw new Error('coupon_rate, years_to_maturity, and rate (yield) required');
        }
        const coupon = face_value * coupon_rate;
        let price = 0;
        for (let t = 1; t <= years_to_maturity; t++) {
          price += coupon / Math.pow(1 + rate, t);
        }
        price += face_value / Math.pow(1 + rate, years_to_maturity);

        result = {
          operation: 'bond_pricing',
          inputs: { face_value, coupon_rate, years_to_maturity, yield: rate },
          bond_price: price,
          annual_coupon: coupon,
          current_yield: coupon / price,
          premium_discount:
            price > face_value ? 'Premium' : price < face_value ? 'Discount' : 'Par',
        };
        break;
      }

      case 'black_scholes': {
        const {
          stock_price,
          strike_price,
          time_to_expiry,
          volatility,
          risk_free_rate,
          option_type = 'call',
        } = args;
        if (
          !stock_price ||
          !strike_price ||
          !time_to_expiry ||
          !volatility ||
          risk_free_rate === undefined
        ) {
          throw new Error(
            'stock_price, strike_price, time_to_expiry, volatility, and risk_free_rate required'
          );
        }

        const S = stock_price;
        const K = strike_price;
        const T = time_to_expiry;
        const sigma = volatility;
        const r = risk_free_rate;

        const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);

        let price: number;
        let delta: number;

        if (option_type === 'call') {
          price = S * normCDF(d1) - K * Math.exp(-r * T) * normCDF(d2);
          delta = normCDF(d1);
        } else {
          price = K * Math.exp(-r * T) * normCDF(-d2) - S * normCDF(-d1);
          delta = normCDF(d1) - 1;
        }

        // Greeks
        const gamma = Math.exp((-d1 * d1) / 2) / (S * sigma * Math.sqrt(2 * Math.PI * T));
        const vega = (S * Math.sqrt(T) * Math.exp((-d1 * d1) / 2)) / Math.sqrt(2 * Math.PI);
        const theta =
          option_type === 'call'
            ? -(S * sigma * Math.exp((-d1 * d1) / 2)) / (2 * Math.sqrt(2 * Math.PI * T)) -
              r * K * Math.exp(-r * T) * normCDF(d2)
            : -(S * sigma * Math.exp((-d1 * d1) / 2)) / (2 * Math.sqrt(2 * Math.PI * T)) +
              r * K * Math.exp(-r * T) * normCDF(-d2);

        result = {
          operation: 'black_scholes',
          inputs: {
            stock_price,
            strike_price,
            time_to_expiry,
            volatility,
            risk_free_rate,
            option_type,
          },
          option_price: price,
          greeks: {
            delta,
            gamma,
            vega: vega / 100, // Per 1% change in volatility
            theta: theta / 365, // Per day
          },
          intermediate: { d1, d2 },
          intrinsic_value: option_type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S),
          time_value: price - (option_type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)),
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
