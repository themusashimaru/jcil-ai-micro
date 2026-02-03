/**
 * ECONOMICS-SIMULATOR TOOL
 * Comprehensive macroeconomic and microeconomic simulation
 *
 * Provides:
 * - Supply and demand analysis
 * - Market equilibrium calculations
 * - Monetary policy modeling (interest rates, money supply)
 * - Fiscal policy simulation (government spending, taxation)
 * - Economic growth models (Solow, endogenous growth)
 * - Business cycle analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// ECONOMIC CONSTANTS AND PARAMETERS
// ============================================================================

const ECONOMIC_PARAMS = {
  // Typical elasticities
  price_elasticity_demand: {
    necessities: -0.3,
    normal_goods: -1.0,
    luxury_goods: -2.5,
    inferior_goods: 0.5
  },
  price_elasticity_supply: {
    short_run: 0.5,
    long_run: 2.0
  },

  // Money multiplier components
  reserve_ratio: 0.10,
  currency_ratio: 0.15,
  excess_reserves_ratio: 0.05,

  // Phillips curve parameters
  natural_unemployment: 0.05,  // 5%
  okun_coefficient: 2.0,       // 2% GDP loss per 1% unemployment above natural

  // Growth model parameters
  depreciation_rate: 0.05,     // 5% annual
  capital_share: 0.33,         // Cobb-Douglas
  labor_share: 0.67,
  tfp_growth: 0.015,          // 1.5% annual
  population_growth: 0.01,    // 1% annual

  // Central bank typical parameters
  inflation_target: 0.02,     // 2%
  taylor_inflation_coef: 1.5,
  taylor_output_coef: 0.5,
  neutral_rate: 0.025
};

// ============================================================================
// ECONOMIC INDICATOR DATABASE
// ============================================================================

interface EconomicIndicators {
  gdp_growth: number;
  inflation: number;
  unemployment: number;
  interest_rate: number;
  budget_deficit_gdp: number;
  debt_gdp: number;
  current_account_gdp: number;
  money_supply_growth: number;
}

const COUNTRY_DATA: Record<string, EconomicIndicators> = {
  usa: {
    gdp_growth: 0.025,
    inflation: 0.035,
    unemployment: 0.038,
    interest_rate: 0.0525,
    budget_deficit_gdp: -0.06,
    debt_gdp: 1.23,
    current_account_gdp: -0.03,
    money_supply_growth: 0.08
  },
  eurozone: {
    gdp_growth: 0.008,
    inflation: 0.027,
    unemployment: 0.065,
    interest_rate: 0.045,
    budget_deficit_gdp: -0.035,
    debt_gdp: 0.90,
    current_account_gdp: 0.025,
    money_supply_growth: 0.05
  },
  japan: {
    gdp_growth: 0.015,
    inflation: 0.032,
    unemployment: 0.026,
    interest_rate: -0.001,
    budget_deficit_gdp: -0.045,
    debt_gdp: 2.60,
    current_account_gdp: 0.035,
    money_supply_growth: 0.03
  },
  china: {
    gdp_growth: 0.052,
    inflation: 0.022,
    unemployment: 0.052,
    interest_rate: 0.035,
    budget_deficit_gdp: -0.075,
    debt_gdp: 0.77,
    current_account_gdp: 0.02,
    money_supply_growth: 0.11
  },
  uk: {
    gdp_growth: 0.004,
    inflation: 0.04,
    unemployment: 0.042,
    interest_rate: 0.0525,
    budget_deficit_gdp: -0.055,
    debt_gdp: 1.01,
    current_account_gdp: -0.035,
    money_supply_growth: 0.06
  }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const economicssimulatorTool: UnifiedTool = {
  name: 'economics_simulator',
  description: 'Comprehensive economic simulation tool for macro and microeconomics. Supports supply/demand analysis, market equilibrium, monetary/fiscal policy modeling, growth models, and business cycle analysis.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['supply_demand', 'equilibrium', 'monetary', 'fiscal', 'growth', 'business_cycle', 'multiplier', 'compare', 'info', 'examples'],
        description: 'Operation to perform'
      },
      // For supply_demand
      demand_intercept: { type: 'number', description: 'Demand curve intercept (max price)' },
      demand_slope: { type: 'number', description: 'Demand curve slope (negative)' },
      supply_intercept: { type: 'number', description: 'Supply curve intercept (min price)' },
      supply_slope: { type: 'number', description: 'Supply curve slope (positive)' },
      price: { type: 'number', description: 'Price to analyze' },
      quantity: { type: 'number', description: 'Quantity to analyze' },
      // For equilibrium
      demand_elasticity: { type: 'number', description: 'Price elasticity of demand' },
      supply_elasticity: { type: 'number', description: 'Price elasticity of supply' },
      shift_type: { type: 'string', enum: ['demand_increase', 'demand_decrease', 'supply_increase', 'supply_decrease', 'none'], description: 'Market shift' },
      shift_percent: { type: 'number', description: 'Percentage shift' },
      // For monetary
      current_rate: { type: 'number', description: 'Current interest rate' },
      inflation_rate: { type: 'number', description: 'Current inflation rate' },
      output_gap: { type: 'number', description: 'Output gap (actual - potential GDP) / potential' },
      money_supply_change: { type: 'number', description: 'Percent change in money supply' },
      // For fiscal
      government_spending: { type: 'number', description: 'Government spending amount' },
      tax_rate: { type: 'number', description: 'Tax rate (0-1)' },
      gdp: { type: 'number', description: 'Current GDP' },
      marginal_propensity_consume: { type: 'number', description: 'MPC (0-1)' },
      spending_change: { type: 'number', description: 'Change in government spending' },
      // For growth
      capital: { type: 'number', description: 'Capital stock' },
      labor: { type: 'number', description: 'Labor force' },
      savings_rate: { type: 'number', description: 'Savings rate (0-1)' },
      years: { type: 'number', description: 'Simulation years' },
      // For compare
      country: { type: 'string', description: 'Country code (usa, eurozone, japan, china, uk)' }
    },
    required: ['operation']
  }
};

// ============================================================================
// SUPPLY AND DEMAND ANALYSIS
// ============================================================================

function analyzeSupplyDemand(
  demandIntercept: number,
  demandSlope: number,
  supplyIntercept: number,
  supplySlope: number,
  price?: number,
  _quantity?: number
): {
  demand_curve: { intercept: number; slope: number; equation: string };
  supply_curve: { intercept: number; slope: number; equation: string };
  equilibrium: { price: number; quantity: number };
  at_price?: { quantity_demanded: number; quantity_supplied: number; surplus_shortage: number; market_status: string };
  consumer_surplus: number;
  producer_surplus: number;
  total_surplus: number;
  elasticity_at_equilibrium: { demand: number; supply: number };
} {
  // Linear curves: Qd = a - bP, Qs = c + dP
  // At equilibrium: a - bP = c + dP => P* = (a-c)/(b+d)

  const eqPrice = (demandIntercept - supplyIntercept) / (supplySlope - demandSlope);
  const eqQuantity = demandIntercept + demandSlope * eqPrice;

  // Consumer surplus = 0.5 * (max_price - eq_price) * eq_quantity
  // Max price when Q=0: P = a/(-slope)
  const maxDemandPrice = demandIntercept / (-demandSlope);
  const consumerSurplus = 0.5 * (maxDemandPrice - eqPrice) * eqQuantity;

  // Producer surplus = 0.5 * (eq_price - min_price) * eq_quantity
  const producerSurplus = 0.5 * (eqPrice - supplyIntercept) * eqQuantity;

  // Elasticity at equilibrium
  const demandElasticity = (demandSlope * eqPrice) / eqQuantity;
  const supplyElasticity = (supplySlope * eqPrice) / eqQuantity;

  const result: ReturnType<typeof analyzeSupplyDemand> = {
    demand_curve: {
      intercept: demandIntercept,
      slope: demandSlope,
      equation: `Qd = ${demandIntercept} + ${demandSlope}P`
    },
    supply_curve: {
      intercept: supplyIntercept,
      slope: supplySlope,
      equation: `Qs = ${supplyIntercept} + ${supplySlope}P`
    },
    equilibrium: {
      price: Math.round(eqPrice * 100) / 100,
      quantity: Math.round(eqQuantity * 100) / 100
    },
    consumer_surplus: Math.round(consumerSurplus * 100) / 100,
    producer_surplus: Math.round(producerSurplus * 100) / 100,
    total_surplus: Math.round((consumerSurplus + producerSurplus) * 100) / 100,
    elasticity_at_equilibrium: {
      demand: Math.round(demandElasticity * 100) / 100,
      supply: Math.round(supplyElasticity * 100) / 100
    }
  };

  // Analyze at specific price
  if (price !== undefined) {
    const qd = demandIntercept + demandSlope * price;
    const qs = supplyIntercept + supplySlope * price;
    const diff = qs - qd;

    result.at_price = {
      quantity_demanded: Math.round(qd * 100) / 100,
      quantity_supplied: Math.round(qs * 100) / 100,
      surplus_shortage: Math.round(diff * 100) / 100,
      market_status: diff > 0 ? 'Surplus (excess supply)' : diff < 0 ? 'Shortage (excess demand)' : 'Equilibrium'
    };
  }

  return result;
}

// ============================================================================
// MARKET EQUILIBRIUM SHIFTS
// ============================================================================

function analyzeEquilibriumShift(
  initialPrice: number,
  initialQuantity: number,
  demandElasticity: number,
  supplyElasticity: number,
  shiftType: string,
  shiftPercent: number
): {
  initial: { price: number; quantity: number };
  shift: { type: string; percent: number };
  new_equilibrium: { price: number; quantity: number; price_change_pct: number; quantity_change_pct: number };
  analysis: string;
  elasticity_effects: string;
} {
  // Use elasticity-based analysis for shifts
  // For demand shift: ΔP/P = shift / (Es - Ed)
  // For supply shift: ΔP/P = -shift / (Es - Ed)

  let priceChangePct = 0;
  let quantityChangePct = 0;
  let analysis = '';

  const elasticityDiff = supplyElasticity - demandElasticity;

  switch (shiftType) {
    case 'demand_increase':
      priceChangePct = shiftPercent / elasticityDiff;
      quantityChangePct = supplyElasticity * priceChangePct;
      analysis = 'Demand increase shifts D curve right, raising both price and quantity';
      break;
    case 'demand_decrease':
      priceChangePct = -shiftPercent / elasticityDiff;
      quantityChangePct = supplyElasticity * priceChangePct;
      analysis = 'Demand decrease shifts D curve left, lowering both price and quantity';
      break;
    case 'supply_increase':
      priceChangePct = -shiftPercent / elasticityDiff;
      quantityChangePct = -demandElasticity * priceChangePct;
      analysis = 'Supply increase shifts S curve right, lowering price and raising quantity';
      break;
    case 'supply_decrease':
      priceChangePct = shiftPercent / elasticityDiff;
      quantityChangePct = -demandElasticity * priceChangePct;
      analysis = 'Supply decrease shifts S curve left, raising price and lowering quantity';
      break;
    default:
      analysis = 'No shift applied';
  }

  const newPrice = initialPrice * (1 + priceChangePct / 100);
  const newQuantity = initialQuantity * (1 + quantityChangePct / 100);

  // Elasticity effects
  const elasticDemand = Math.abs(demandElasticity) > 1;
  const elasticSupply = supplyElasticity > 1;
  const elasticityEffects = `With ${elasticDemand ? 'elastic' : 'inelastic'} demand (|Ed|=${Math.abs(demandElasticity).toFixed(2)}) and ${elasticSupply ? 'elastic' : 'inelastic'} supply (Es=${supplyElasticity.toFixed(2)}), price changes are ${elasticDemand ? 'smaller' : 'larger'} and quantity changes are ${elasticDemand ? 'larger' : 'smaller'}.`;

  return {
    initial: { price: initialPrice, quantity: initialQuantity },
    shift: { type: shiftType, percent: shiftPercent },
    new_equilibrium: {
      price: Math.round(newPrice * 100) / 100,
      quantity: Math.round(newQuantity * 100) / 100,
      price_change_pct: Math.round(priceChangePct * 100) / 100,
      quantity_change_pct: Math.round(quantityChangePct * 100) / 100
    },
    analysis,
    elasticity_effects: elasticityEffects
  };
}

// ============================================================================
// MONETARY POLICY ANALYSIS
// ============================================================================

function analyzeMonetaryPolicy(
  currentRate: number,
  inflationRate: number,
  outputGap: number,
  moneySupplyChange?: number
): {
  current_conditions: {
    interest_rate: number;
    inflation: number;
    output_gap: number;
    real_rate: number;
  };
  taylor_rule: {
    recommended_rate: number;
    rate_gap: number;
    stance: string;
  };
  money_multiplier: {
    multiplier: number;
    components: { reserve_ratio: number; currency_ratio: number };
  };
  quantity_theory: {
    velocity_implied: number;
    money_supply_effect?: { gdp_growth_impact: number; inflation_impact: number };
  };
  policy_recommendation: string;
} {
  // Taylor Rule: r = r* + π + 0.5(π - π*) + 0.5(y - y*)
  const neutralRate = ECONOMIC_PARAMS.neutral_rate;
  const inflationTarget = ECONOMIC_PARAMS.inflation_target;

  const taylorRate = neutralRate +
    inflationRate +
    ECONOMIC_PARAMS.taylor_inflation_coef * (inflationRate - inflationTarget) +
    ECONOMIC_PARAMS.taylor_output_coef * outputGap;

  const rateGap = taylorRate - currentRate;
  let stance: string;
  if (rateGap > 0.01) stance = 'Too loose - consider tightening';
  else if (rateGap < -0.01) stance = 'Too tight - consider easing';
  else stance = 'Appropriate';

  // Money multiplier
  const rr = ECONOMIC_PARAMS.reserve_ratio;
  const cr = ECONOMIC_PARAMS.currency_ratio;
  const moneyMultiplier = (1 + cr) / (rr + cr);

  // Quantity theory: MV = PY, so ΔM + ΔV = Δπ + Δy
  // Assume V constant, so ΔM = Δπ + Δy
  let moneySupplyEffect;
  if (moneySupplyChange !== undefined) {
    // Simplified: split between inflation and growth
    const inflationImpact = moneySupplyChange * 0.6;
    const growthImpact = moneySupplyChange * 0.4;
    moneySupplyEffect = {
      gdp_growth_impact: growthImpact,
      inflation_impact: inflationImpact
    };
  }

  // Real interest rate
  const realRate = currentRate - inflationRate;

  // Policy recommendation
  let recommendation: string;
  if (inflationRate > inflationTarget * 1.5 && outputGap > 0) {
    recommendation = 'Strong tightening: Raise rates significantly to combat overheating economy';
  } else if (inflationRate > inflationTarget) {
    recommendation = 'Modest tightening: Gradually raise rates to return inflation to target';
  } else if (inflationRate < inflationTarget && outputGap < -0.02) {
    recommendation = 'Easing: Lower rates or expand QE to support growth and raise inflation';
  } else {
    recommendation = 'Hold steady: Current policy stance appears appropriate';
  }

  return {
    current_conditions: {
      interest_rate: currentRate,
      inflation: inflationRate,
      output_gap: outputGap,
      real_rate: Math.round(realRate * 10000) / 10000
    },
    taylor_rule: {
      recommended_rate: Math.round(taylorRate * 10000) / 10000,
      rate_gap: Math.round(rateGap * 10000) / 10000,
      stance
    },
    money_multiplier: {
      multiplier: Math.round(moneyMultiplier * 100) / 100,
      components: { reserve_ratio: rr, currency_ratio: cr }
    },
    quantity_theory: {
      velocity_implied: 5.5, // Typical US velocity
      money_supply_effect: moneySupplyEffect
    },
    policy_recommendation: recommendation
  };
}

// ============================================================================
// FISCAL POLICY ANALYSIS
// ============================================================================

function analyzeFiscalPolicy(
  gdp: number,
  governmentSpending: number,
  taxRate: number,
  mpc: number,
  spendingChange?: number
): {
  current_fiscal: {
    gdp: number;
    government_spending: number;
    tax_rate: number;
    tax_revenue: number;
    budget_balance: number;
    budget_as_pct_gdp: number;
  };
  multipliers: {
    spending_multiplier: number;
    tax_multiplier: number;
    balanced_budget_multiplier: number;
    explanation: string;
  };
  spending_impact?: {
    spending_change: number;
    gdp_change: number;
    new_gdp: number;
    crowding_out_estimate: number;
  };
  automatic_stabilizers: {
    tax_revenue_sensitivity: number;
    spending_sensitivity: number;
    overall_stabilization: string;
  };
  sustainability: {
    primary_balance: number;
    interest_payment_estimate: number;
    debt_dynamics: string;
  };
} {
  // Tax revenue
  const taxRevenue = gdp * taxRate;
  const budgetBalance = taxRevenue - governmentSpending;
  const budgetPctGdp = (budgetBalance / gdp) * 100;

  // Multipliers (simple Keynesian)
  // Spending multiplier = 1 / (1 - MPC(1-t))
  const spendingMultiplier = 1 / (1 - mpc * (1 - taxRate));
  // Tax multiplier = -MPC / (1 - MPC(1-t))
  const taxMultiplier = -mpc / (1 - mpc * (1 - taxRate));
  // Balanced budget multiplier = 1 (Haavelmo theorem)
  const balancedBudgetMultiplier = 1;

  // Spending impact
  let spendingImpact;
  if (spendingChange !== undefined) {
    const gdpChange = spendingChange * spendingMultiplier;
    // Crowding out estimate (simplified)
    const crowdingOut = spendingChange * 0.3; // 30% crowding out
    spendingImpact = {
      spending_change: spendingChange,
      gdp_change: Math.round(gdpChange * 100) / 100,
      new_gdp: Math.round((gdp + gdpChange) * 100) / 100,
      crowding_out_estimate: Math.round(crowdingOut * 100) / 100
    };
  }

  // Automatic stabilizers
  const taxSensitivity = taxRate * 1.2; // Tax revenue falls faster than GDP
  const spendingSensitivity = 0.3; // Unemployment benefits, etc.

  // Debt sustainability (simplified)
  const interestPayment = governmentSpending * 0.15; // Assume 15% of spending is interest
  const primaryBalance = budgetBalance + interestPayment;
  const debtDynamics = primaryBalance < 0 ?
    'Primary deficit - debt likely increasing relative to GDP' :
    'Primary surplus - debt may be stabilizing';

  return {
    current_fiscal: {
      gdp,
      government_spending: governmentSpending,
      tax_rate: taxRate,
      tax_revenue: Math.round(taxRevenue * 100) / 100,
      budget_balance: Math.round(budgetBalance * 100) / 100,
      budget_as_pct_gdp: Math.round(budgetPctGdp * 100) / 100
    },
    multipliers: {
      spending_multiplier: Math.round(spendingMultiplier * 100) / 100,
      tax_multiplier: Math.round(taxMultiplier * 100) / 100,
      balanced_budget_multiplier: balancedBudgetMultiplier,
      explanation: `With MPC=${mpc} and tax rate=${taxRate}, each $1 of government spending increases GDP by $${spendingMultiplier.toFixed(2)}`
    },
    spending_impact: spendingImpact,
    automatic_stabilizers: {
      tax_revenue_sensitivity: taxSensitivity,
      spending_sensitivity: spendingSensitivity,
      overall_stabilization: 'Automatic stabilizers provide partial counter-cyclical offset'
    },
    sustainability: {
      primary_balance: Math.round(primaryBalance * 100) / 100,
      interest_payment_estimate: Math.round(interestPayment * 100) / 100,
      debt_dynamics: debtDynamics
    }
  };
}

// ============================================================================
// ECONOMIC GROWTH MODEL (SOLOW)
// ============================================================================

function simulateGrowth(
  capital: number,
  labor: number,
  savingsRate: number,
  years: number
): {
  initial_state: {
    capital: number;
    labor: number;
    gdp: number;
    capital_per_worker: number;
    output_per_worker: number;
  };
  parameters: {
    savings_rate: number;
    depreciation_rate: number;
    population_growth: number;
    tfp_growth: number;
    capital_share: number;
  };
  steady_state: {
    capital_per_worker: number;
    output_per_worker: number;
    consumption_per_worker: number;
    golden_rule_savings: number;
  };
  time_series: Array<{
    year: number;
    gdp: number;
    capital: number;
    labor: number;
    gdp_growth: number;
  }>;
  final_state: {
    gdp: number;
    gdp_growth: number;
    total_growth: number;
    average_growth_rate: number;
  };
} {
  const alpha = ECONOMIC_PARAMS.capital_share;
  const delta = ECONOMIC_PARAMS.depreciation_rate;
  const n = ECONOMIC_PARAMS.population_growth;
  const g = ECONOMIC_PARAMS.tfp_growth;

  // Cobb-Douglas: Y = A * K^α * L^(1-α)
  const A0 = 1; // Initial TFP normalized to 1
  const initialGDP = A0 * Math.pow(capital, alpha) * Math.pow(labor, 1 - alpha);

  // Steady state (Solow model)
  // k* = (s / (n + g + δ))^(1/(1-α))
  const kStar = Math.pow(savingsRate / (n + g + delta), 1 / (1 - alpha));
  const yStar = Math.pow(kStar, alpha);
  const cStar = (1 - savingsRate) * yStar;

  // Golden rule: s* = α
  const goldenRuleSavings = alpha;

  // Simulate growth path
  const timeSeries: Array<{
    year: number;
    gdp: number;
    capital: number;
    labor: number;
    gdp_growth: number;
  }> = [];

  let K = capital;
  let L = labor;
  let A = A0;
  let prevGDP = initialGDP;

  for (let year = 0; year <= years; year++) {
    const GDP = A * Math.pow(K, alpha) * Math.pow(L, 1 - alpha);
    const gdpGrowth = year > 0 ? (GDP - prevGDP) / prevGDP : 0;

    timeSeries.push({
      year,
      gdp: Math.round(GDP * 100) / 100,
      capital: Math.round(K * 100) / 100,
      labor: Math.round(L * 100) / 100,
      gdp_growth: Math.round(gdpGrowth * 10000) / 100
    });

    // Update for next period
    const investment = savingsRate * GDP;
    const depreciation = delta * K;
    K = K + investment - depreciation;
    L = L * (1 + n);
    A = A * (1 + g);
    prevGDP = GDP;
  }

  const finalGDP = timeSeries[timeSeries.length - 1].gdp;
  const totalGrowth = (finalGDP - initialGDP) / initialGDP;
  const avgGrowthRate = Math.pow(1 + totalGrowth, 1 / years) - 1;

  return {
    initial_state: {
      capital,
      labor,
      gdp: Math.round(initialGDP * 100) / 100,
      capital_per_worker: Math.round((capital / labor) * 100) / 100,
      output_per_worker: Math.round((initialGDP / labor) * 100) / 100
    },
    parameters: {
      savings_rate: savingsRate,
      depreciation_rate: delta,
      population_growth: n,
      tfp_growth: g,
      capital_share: alpha
    },
    steady_state: {
      capital_per_worker: Math.round(kStar * 100) / 100,
      output_per_worker: Math.round(yStar * 100) / 100,
      consumption_per_worker: Math.round(cStar * 100) / 100,
      golden_rule_savings: goldenRuleSavings
    },
    time_series: timeSeries.filter((_, i) => i % Math.max(1, Math.floor(years / 10)) === 0 || i === years),
    final_state: {
      gdp: finalGDP,
      gdp_growth: Math.round(timeSeries[timeSeries.length - 1].gdp_growth * 100) / 100,
      total_growth: Math.round(totalGrowth * 10000) / 100,
      average_growth_rate: Math.round(avgGrowthRate * 10000) / 100
    }
  };
}

// ============================================================================
// BUSINESS CYCLE ANALYSIS
// ============================================================================

function analyzeBusinessCycle(
  gdpGrowth: number,
  unemployment: number,
  inflation: number,
  interestRate: number
): {
  current_indicators: {
    gdp_growth: number;
    unemployment: number;
    inflation: number;
    interest_rate: number;
  };
  cycle_phase: {
    phase: string;
    description: string;
    typical_duration: string;
  };
  phillips_curve: {
    natural_unemployment: number;
    unemployment_gap: number;
    expected_inflation_change: number;
  };
  okun_law: {
    output_gap_estimate: number;
    unemployment_above_natural: number;
  };
  leading_indicators: string[];
  policy_recommendations: {
    monetary: string;
    fiscal: string;
  };
} {
  // Determine cycle phase
  let phase: string;
  let description: string;
  let duration: string;

  if (gdpGrowth > 0.03 && unemployment < 0.05) {
    phase = 'Expansion (Peak)';
    description = 'Economy at or near full capacity, potential overheating';
    duration = '2-4 years typical';
  } else if (gdpGrowth > 0.01 && gdpGrowth <= 0.03) {
    phase = 'Expansion (Mid-cycle)';
    description = 'Sustained growth, unemployment falling';
    duration = '3-5 years typical';
  } else if (gdpGrowth > 0 && gdpGrowth <= 0.01) {
    phase = 'Late Expansion / Early Slowdown';
    description = 'Growth decelerating, watch for turning point';
    duration = '1-2 years typical';
  } else if (gdpGrowth <= 0 && gdpGrowth > -0.02) {
    phase = 'Contraction (Recession)';
    description = 'Economic decline, rising unemployment';
    duration = '6-18 months typical';
  } else {
    phase = 'Deep Recession';
    description = 'Severe economic decline, high unemployment';
    duration = 'Variable, depends on policy response';
  }

  // Phillips curve analysis
  const naturalU = ECONOMIC_PARAMS.natural_unemployment;
  const uGap = unemployment - naturalU;
  const expectedInflationChange = -0.5 * uGap; // Simplified Phillips curve

  // Okun's law
  const okunCoef = ECONOMIC_PARAMS.okun_coefficient;
  const outputGap = -okunCoef * uGap;

  // Leading indicators to watch
  const leadingIndicators = [
    'Yield curve slope (inverted = recession warning)',
    'Initial jobless claims',
    'ISM Manufacturing PMI',
    'Consumer confidence',
    'Building permits',
    'Stock market performance'
  ];

  // Policy recommendations
  let monetaryRec: string;
  let fiscalRec: string;

  if (phase.includes('Recession')) {
    monetaryRec = 'Lower interest rates, consider QE';
    fiscalRec = 'Counter-cyclical stimulus spending';
  } else if (phase.includes('Peak') || inflation > 0.04) {
    monetaryRec = 'Raise rates to prevent overheating';
    fiscalRec = 'Reduce deficits, build fiscal buffers';
  } else {
    monetaryRec = 'Data-dependent, gradual adjustments';
    fiscalRec = 'Maintain steady course, targeted investments';
  }

  return {
    current_indicators: {
      gdp_growth: gdpGrowth,
      unemployment,
      inflation,
      interest_rate: interestRate
    },
    cycle_phase: {
      phase,
      description,
      typical_duration: duration
    },
    phillips_curve: {
      natural_unemployment: naturalU,
      unemployment_gap: Math.round(uGap * 10000) / 10000,
      expected_inflation_change: Math.round(expectedInflationChange * 10000) / 10000
    },
    okun_law: {
      output_gap_estimate: Math.round(outputGap * 10000) / 10000,
      unemployment_above_natural: Math.round(uGap * 10000) / 10000
    },
    leading_indicators: leadingIndicators,
    policy_recommendations: {
      monetary: monetaryRec,
      fiscal: fiscalRec
    }
  };
}

// ============================================================================
// MULTIPLIER CALCULATIONS
// ============================================================================

function calculateMultipliers(
  mpc: number,
  taxRate: number,
  importPropensity: number = 0.15
): {
  marginal_propensity_consume: number;
  marginal_propensity_save: number;
  tax_rate: number;
  import_propensity: number;
  simple_multiplier: number;
  tax_adjusted_multiplier: number;
  open_economy_multiplier: number;
  tax_multiplier: number;
  balanced_budget_multiplier: number;
  explanations: Record<string, string>;
} {
  const mps = 1 - mpc;

  // Simple Keynesian: 1 / (1 - MPC)
  const simpleMultiplier = 1 / mps;

  // With taxes: 1 / (1 - MPC(1-t))
  const taxAdjusted = 1 / (1 - mpc * (1 - taxRate));

  // Open economy: 1 / (1 - MPC(1-t) + MPM)
  const openEconomy = 1 / (1 - mpc * (1 - taxRate) + importPropensity);

  // Tax multiplier: -MPC / (1 - MPC(1-t))
  const taxMultiplier = -mpc / (1 - mpc * (1 - taxRate));

  return {
    marginal_propensity_consume: mpc,
    marginal_propensity_save: mps,
    tax_rate: taxRate,
    import_propensity: importPropensity,
    simple_multiplier: Math.round(simpleMultiplier * 100) / 100,
    tax_adjusted_multiplier: Math.round(taxAdjusted * 100) / 100,
    open_economy_multiplier: Math.round(openEconomy * 100) / 100,
    tax_multiplier: Math.round(taxMultiplier * 100) / 100,
    balanced_budget_multiplier: 1,
    explanations: {
      simple: `In closed economy with no taxes, multiplier = 1/(1-${mpc}) = ${simpleMultiplier.toFixed(2)}`,
      tax_adjusted: `With ${(taxRate * 100).toFixed(0)}% tax rate, multiplier reduced to ${taxAdjusted.toFixed(2)}`,
      open_economy: `Adding imports further reduces to ${openEconomy.toFixed(2)}`,
      tax_multiplier: `Tax cut multiplier is ${Math.abs(taxMultiplier).toFixed(2)} (negative because tax cuts, not increases)`,
      balanced_budget: 'Balanced budget multiplier = 1 (Haavelmo theorem)'
    }
  };
}

function compareCountries(): object {
  return {
    countries: Object.entries(COUNTRY_DATA).map(([code, data]) => ({
      code,
      ...data,
      gdp_growth_pct: (data.gdp_growth * 100).toFixed(1) + '%',
      inflation_pct: (data.inflation * 100).toFixed(1) + '%',
      unemployment_pct: (data.unemployment * 100).toFixed(1) + '%'
    })),
    rankings: {
      gdp_growth: Object.entries(COUNTRY_DATA).sort(([, a], [, b]) => b.gdp_growth - a.gdp_growth).map(([c]) => c),
      lowest_unemployment: Object.entries(COUNTRY_DATA).sort(([, a], [, b]) => a.unemployment - b.unemployment).map(([c]) => c),
      lowest_inflation: Object.entries(COUNTRY_DATA).sort(([, a], [, b]) => a.inflation - b.inflation).map(([c]) => c)
    }
  };
}

function getInfo(): object {
  return {
    tool: 'economics_simulator',
    description: 'Comprehensive economic simulation for macro and microeconomics',
    capabilities: [
      'Supply and demand analysis with surplus calculations',
      'Market equilibrium shifts with elasticity effects',
      'Monetary policy (Taylor rule, money multiplier)',
      'Fiscal policy (multipliers, automatic stabilizers)',
      'Solow growth model simulation',
      'Business cycle phase identification',
      'Country comparison'
    ],
    models: {
      supply_demand: 'Linear demand and supply curves',
      monetary: 'Taylor Rule, Quantity Theory of Money',
      fiscal: 'Keynesian multipliers, IS-LM framework',
      growth: 'Solow-Swan neoclassical growth model',
      business_cycle: 'Phillips Curve, Okun\'s Law'
    },
    parameters: ECONOMIC_PARAMS,
    available_countries: Object.keys(COUNTRY_DATA)
  };
}

function getExamples(): object {
  return {
    supply_demand: {
      operation: 'supply_demand',
      demand_intercept: 1000,
      demand_slope: -10,
      supply_intercept: 0,
      supply_slope: 5,
      price: 50
    },
    equilibrium_shift: {
      operation: 'equilibrium',
      demand_elasticity: -1.2,
      supply_elasticity: 0.8,
      shift_type: 'demand_increase',
      shift_percent: 10
    },
    monetary_policy: {
      operation: 'monetary',
      current_rate: 0.05,
      inflation_rate: 0.035,
      output_gap: 0.01,
      money_supply_change: 5
    },
    fiscal_policy: {
      operation: 'fiscal',
      gdp: 25000000000000,
      government_spending: 6000000000000,
      tax_rate: 0.25,
      marginal_propensity_consume: 0.8,
      spending_change: 100000000000
    },
    growth_model: {
      operation: 'growth',
      capital: 100,
      labor: 50,
      savings_rate: 0.25,
      years: 50
    },
    business_cycle: {
      operation: 'business_cycle',
      country: 'usa'
    }
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executeeconomicssimulator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: object;

    switch (operation) {
      case 'supply_demand':
        if (!args.demand_intercept || !args.demand_slope || !args.supply_intercept || !args.supply_slope) {
          throw new Error('demand_intercept, demand_slope, supply_intercept, supply_slope required');
        }
        result = {
          operation: 'supply_demand',
          ...analyzeSupplyDemand(
            args.demand_intercept,
            args.demand_slope,
            args.supply_intercept,
            args.supply_slope,
            args.price,
            args.quantity
          )
        };
        break;

      case 'equilibrium':
        result = {
          operation: 'equilibrium',
          ...analyzeEquilibriumShift(
            args.price || 100,
            args.quantity || 100,
            args.demand_elasticity || -1,
            args.supply_elasticity || 0.5,
            args.shift_type || 'none',
            args.shift_percent || 10
          )
        };
        break;

      case 'monetary':
        result = {
          operation: 'monetary',
          ...analyzeMonetaryPolicy(
            args.current_rate || 0.05,
            args.inflation_rate || 0.03,
            args.output_gap || 0,
            args.money_supply_change
          )
        };
        break;

      case 'fiscal':
        result = {
          operation: 'fiscal',
          ...analyzeFiscalPolicy(
            args.gdp || 1000,
            args.government_spending || 200,
            args.tax_rate || 0.25,
            args.marginal_propensity_consume || 0.8,
            args.spending_change
          )
        };
        break;

      case 'growth':
        result = {
          operation: 'growth',
          ...simulateGrowth(
            args.capital || 100,
            args.labor || 50,
            args.savings_rate || 0.2,
            args.years || 50
          )
        };
        break;

      case 'business_cycle': {
        const country = args.country || 'usa';
        const data = COUNTRY_DATA[country] || COUNTRY_DATA.usa;
        result = {
          operation: 'business_cycle',
          country,
          ...analyzeBusinessCycle(
            data.gdp_growth,
            data.unemployment,
            data.inflation,
            data.interest_rate
          )
        };
        break;
      }

      case 'multiplier':
        result = {
          operation: 'multiplier',
          ...calculateMultipliers(
            args.marginal_propensity_consume || 0.8,
            args.tax_rate || 0.25,
            args.import_propensity || 0.15
          )
        };
        break;

      case 'compare':
        result = {
          operation: 'compare',
          ...compareCountries()
        };
        break;

      case 'examples':
        result = {
          operation: 'examples',
          examples: getExamples()
        };
        break;

      case 'info':
      default:
        result = {
          operation: 'info',
          ...getInfo()
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iseconomicssimulatorAvailable(): boolean {
  return true;
}
