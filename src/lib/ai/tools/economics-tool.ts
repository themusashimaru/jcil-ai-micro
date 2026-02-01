/**
 * ECONOMICS TOOL
 *
 * Economic calculations: supply/demand, elasticity, GDP,
 * inflation, interest rates, and market analysis.
 *
 * Part of TIER ECONOMICS - Ultimate Tool Arsenal
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// SUPPLY AND DEMAND
// ============================================================================

function equilibrium(demandSlope: number, demandIntercept: number, supplySlope: number, supplyIntercept: number): { price: number; quantity: number } {
  // Qd = a - bP (demand)
  // Qs = c + dP (supply)
  // At equilibrium: Qd = Qs
  const price = (demandIntercept - supplyIntercept) / (supplySlope + demandSlope);
  const quantity = demandIntercept - demandSlope * price;
  return { price, quantity };
}

function priceElasticity(percentChangeQuantity: number, percentChangePrice: number): { elasticity: number; type: string } {
  const e = Math.abs(percentChangeQuantity / percentChangePrice);
  let type = 'Unit elastic';
  if (e > 1) type = 'Elastic';
  else if (e < 1) type = 'Inelastic';

  return { elasticity: Math.round(e * 100) / 100, type };
}

function _crossElasticity(percentChangeQa: number, percentChangePb: number): { elasticity: number; relationship: string } {
  const e = percentChangeQa / percentChangePb;
  let relationship = 'Independent';
  if (e > 0) relationship = 'Substitutes';
  else if (e < 0) relationship = 'Complements';

  return { elasticity: Math.round(e * 100) / 100, relationship };
}

// ============================================================================
// GDP AND GROWTH
// ============================================================================

function nominalToRealGDP(nominalGDP: number, deflator: number): number {
  return (nominalGDP / deflator) * 100;
}

function _gdpGrowthRate(gdpCurrent: number, gdpPrevious: number): number {
  return ((gdpCurrent - gdpPrevious) / gdpPrevious) * 100;
}

function gdpPerCapita(gdp: number, population: number): number {
  return gdp / population;
}

function ruleOf70(growthRate: number): number {
  return 70 / growthRate;
}

// ============================================================================
// INFLATION
// ============================================================================

function inflationRate(cpiCurrent: number, cpiPrevious: number): number {
  return ((cpiCurrent - cpiPrevious) / cpiPrevious) * 100;
}

function realInterestRate(nominalRate: number, inflationRate: number): number {
  // Fisher equation approximation
  return nominalRate - inflationRate;
}

function purchasingPower(amount: number, inflationRate: number, years: number): number {
  return amount / Math.pow(1 + inflationRate / 100, years);
}

// ============================================================================
// MONEY AND BANKING
// ============================================================================

function moneyMultiplier(reserveRatio: number): number {
  return 1 / reserveRatio;
}

function moneySupplyChange(deposit: number, reserveRatio: number): number {
  return deposit * moneyMultiplier(reserveRatio);
}

function presentValue(futureValue: number, rate: number, periods: number): number {
  return futureValue / Math.pow(1 + rate, periods);
}

function futureValue(presentValue: number, rate: number, periods: number): number {
  return presentValue * Math.pow(1 + rate, periods);
}

// ============================================================================
// UNEMPLOYMENT
// ============================================================================

function unemploymentRate(unemployed: number, laborForce: number): number {
  return (unemployed / laborForce) * 100;
}

function _laborForceParticipation(laborForce: number, workingAgePopulation: number): number {
  return (laborForce / workingAgePopulation) * 100;
}

function okunLaw(actualGDP: number, potentialGDP: number): number {
  // Unemployment gap ≈ -0.5 × output gap
  const outputGap = ((actualGDP - potentialGDP) / potentialGDP) * 100;
  return -0.5 * outputGap;
}

// ============================================================================
// INTERNATIONAL TRADE
// ============================================================================

function termsOfTrade(exportPriceIndex: number, importPriceIndex: number): number {
  return (exportPriceIndex / importPriceIndex) * 100;
}

function realExchangeRate(nominalRate: number, domesticPrice: number, foreignPrice: number): number {
  return nominalRate * (foreignPrice / domesticPrice);
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const economicsTool: UnifiedTool = {
  name: 'economics',
  description: `Economic analysis and calculations.

Operations:
- supply_demand: Supply/demand equilibrium and elasticity
- gdp: GDP calculations and growth rates
- inflation: Inflation and purchasing power
- money: Money supply and time value of money
- unemployment: Unemployment metrics
- trade: International trade metrics`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['supply_demand', 'gdp', 'inflation', 'money', 'unemployment', 'trade'],
        description: 'Economics operation',
      },
      demand_slope: { type: 'number', description: 'Demand curve slope' },
      demand_intercept: { type: 'number', description: 'Demand curve intercept' },
      supply_slope: { type: 'number', description: 'Supply curve slope' },
      supply_intercept: { type: 'number', description: 'Supply curve intercept' },
      percent_change_quantity: { type: 'number', description: 'Percent change in quantity' },
      percent_change_price: { type: 'number', description: 'Percent change in price' },
      nominal_gdp: { type: 'number', description: 'Nominal GDP' },
      real_gdp: { type: 'number', description: 'Real GDP' },
      deflator: { type: 'number', description: 'GDP deflator' },
      population: { type: 'number', description: 'Population' },
      growth_rate: { type: 'number', description: 'Growth rate (%)' },
      cpi_current: { type: 'number', description: 'Current CPI' },
      cpi_previous: { type: 'number', description: 'Previous CPI' },
      nominal_rate: { type: 'number', description: 'Nominal interest rate (%)' },
      inflation_rate: { type: 'number', description: 'Inflation rate (%)' },
      amount: { type: 'number', description: 'Money amount' },
      years: { type: 'number', description: 'Number of years' },
      reserve_ratio: { type: 'number', description: 'Reserve ratio (decimal)' },
      deposit: { type: 'number', description: 'Initial deposit' },
      unemployed: { type: 'number', description: 'Number unemployed' },
      labor_force: { type: 'number', description: 'Labor force size' },
      actual_gdp: { type: 'number', description: 'Actual GDP' },
      potential_gdp: { type: 'number', description: 'Potential GDP' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeEconomics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'supply_demand': {
        const { demand_slope = 2, demand_intercept = 100, supply_slope = 1, supply_intercept = 10,
                percent_change_quantity, percent_change_price } = args;

        if (percent_change_quantity !== undefined && percent_change_price !== undefined) {
          const elasticity = priceElasticity(percent_change_quantity, percent_change_price);

          result = {
            operation: 'elasticity',
            percent_change_quantity: percent_change_quantity,
            percent_change_price: percent_change_price,
            price_elasticity: elasticity.elasticity,
            elasticity_type: elasticity.type,
            interpretation: elasticity.type === 'Elastic' ?
              'Quantity responds more than proportionally to price changes' :
              elasticity.type === 'Inelastic' ?
              'Quantity responds less than proportionally to price changes' :
              'Quantity responds proportionally to price changes',
          };
        } else {
          const eq = equilibrium(demand_slope, demand_intercept, supply_slope, supply_intercept);

          result = {
            operation: 'supply_demand',
            demand_equation: `Qd = ${demand_intercept} - ${demand_slope}P`,
            supply_equation: `Qs = ${supply_intercept} + ${supply_slope}P`,
            equilibrium: {
              price: Math.round(eq.price * 100) / 100,
              quantity: Math.round(eq.quantity * 100) / 100,
            },
            consumer_surplus_formula: '0.5 × (max_price - eq_price) × eq_quantity',
            producer_surplus_formula: '0.5 × (eq_price - min_price) × eq_quantity',
          };
        }
        break;
      }

      case 'gdp': {
        const { nominal_gdp = 21000, deflator = 110, population = 330000000, growth_rate } = args;
        const realGDP = nominalToRealGDP(nominal_gdp, deflator);
        const perCapita = gdpPerCapita(realGDP * 1e9, population);

        const gdpResult: Record<string, unknown> = {
          operation: 'gdp',
          nominal_gdp_billion: nominal_gdp,
          gdp_deflator: deflator,
          real_gdp_billion: Math.round(realGDP * 100) / 100,
          population: population,
          gdp_per_capita: Math.round(perCapita),
        };

        if (growth_rate !== undefined) {
          const doublingTime = ruleOf70(growth_rate);
          gdpResult.growth_rate_percent = growth_rate;
          gdpResult.doubling_time_years = Math.round(doublingTime * 10) / 10;
          gdpResult.rule_of_70 = 'Years to double ≈ 70 / growth rate';
        }

        result = gdpResult;
        break;
      }

      case 'inflation': {
        const { cpi_current = 280, cpi_previous = 270, nominal_rate = 5, amount = 1000, years = 10 } = args;
        const inflation = inflationRate(cpi_current, cpi_previous);
        const realRate = realInterestRate(nominal_rate, inflation);
        const futurePurchasing = purchasingPower(amount, inflation, years);

        result = {
          operation: 'inflation',
          cpi: { current: cpi_current, previous: cpi_previous },
          inflation_rate_percent: Math.round(inflation * 100) / 100,
          nominal_interest_rate_percent: nominal_rate,
          real_interest_rate_percent: Math.round(realRate * 100) / 100,
          purchasing_power: {
            amount_today: amount,
            years: years,
            value_in_future_dollars: Math.round(futurePurchasing * 100) / 100,
            purchasing_power_lost_percent: Math.round((1 - futurePurchasing / amount) * 10000) / 100,
          },
          fisher_equation: 'Real rate ≈ Nominal rate - Inflation rate',
        };
        break;
      }

      case 'money': {
        const { reserve_ratio = 0.1, deposit = 1000, amount = 1000, nominal_rate = 5, years = 10 } = args;
        const multiplier = moneyMultiplier(reserve_ratio);
        const maxMoneyCreation = moneySupplyChange(deposit, reserve_ratio);
        const rate = nominal_rate / 100;
        const fv = futureValue(amount, rate, years);
        const pv = presentValue(amount, rate, years);

        result = {
          operation: 'money',
          fractional_reserve: {
            reserve_ratio: reserve_ratio,
            money_multiplier: Math.round(multiplier * 100) / 100,
            initial_deposit: deposit,
            maximum_money_creation: Math.round(maxMoneyCreation * 100) / 100,
          },
          time_value: {
            present_value: amount,
            interest_rate_percent: nominal_rate,
            years: years,
            future_value: Math.round(fv * 100) / 100,
            present_value_of_future_amount: Math.round(pv * 100) / 100,
          },
        };
        break;
      }

      case 'unemployment': {
        const { unemployed = 6000000, labor_force = 160000000, actual_gdp, potential_gdp } = args;
        const uRate = unemploymentRate(unemployed, labor_force);

        const unempResult: Record<string, unknown> = {
          operation: 'unemployment',
          unemployed: unemployed,
          labor_force: labor_force,
          unemployment_rate_percent: Math.round(uRate * 100) / 100,
          employed: labor_force - unemployed,
          classification: uRate < 4 ? 'Low (full employment)' : uRate < 6 ? 'Natural rate' : uRate < 10 ? 'Elevated' : 'High',
        };

        if (actual_gdp !== undefined && potential_gdp !== undefined) {
          const cyclicalUnemp = okunLaw(actual_gdp, potential_gdp);
          const outputGap = ((actual_gdp - potential_gdp) / potential_gdp) * 100;
          unempResult.okuns_law = {
            actual_gdp: actual_gdp,
            potential_gdp: potential_gdp,
            output_gap_percent: Math.round(outputGap * 100) / 100,
            implied_cyclical_unemployment: Math.round(cyclicalUnemp * 100) / 100,
          };
        }

        result = unempResult;
        break;
      }

      case 'trade': {
        const { export_price_index: _export_price_index = 105, import_price_index: _import_price_index = 100, nominal_exchange = 1.2, domestic_price = 100, foreign_price = 95 } = args;
        const tot = termsOfTrade(args.export_price_index ?? 105, args.import_price_index ?? 100);
        const rer = realExchangeRate(nominal_exchange, domestic_price, foreign_price);

        result = {
          operation: 'trade',
          terms_of_trade: {
            export_price_index: args.export_price_index ?? 105,
            import_price_index: args.import_price_index ?? 100,
            terms_of_trade_index: Math.round(tot * 100) / 100,
            interpretation: tot > 100 ? 'Favorable (exports buy more imports)' : tot < 100 ? 'Unfavorable' : 'Neutral',
          },
          exchange_rate: {
            nominal_rate: nominal_exchange,
            domestic_price_level: domestic_price,
            foreign_price_level: foreign_price,
            real_exchange_rate: Math.round(rer * 1000) / 1000,
            competitiveness: rer > 1 ? 'Domestic goods relatively expensive' : 'Domestic goods relatively cheap',
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Economics Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isEconomicsAvailable(): boolean { return true; }
void _crossElasticity; void _gdpGrowthRate; void _laborForceParticipation;
