/**
 * REAL-ESTATE TOOL
 * Comprehensive real estate valuation and investment analysis
 *
 * Provides:
 * - Property valuation (comparable sales, income approach)
 * - Cap rate calculation and analysis
 * - Cash flow analysis (rental income, expenses, NOI)
 * - Investment metrics (IRR, NPV, cash-on-cash return)
 * - Market analysis and comparables
 * - Mortgage calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// MARKET DATA
// ============================================================================

interface MarketData {
  city: string;
  state: string;
  median_price: number;
  price_per_sqft: number;
  avg_cap_rate: number;
  avg_rent_per_sqft: number;
  vacancy_rate: number;
  appreciation_rate: number;
  property_tax_rate: number;
}

const MARKET_DATA: Record<string, MarketData> = {
  'new_york': { city: 'New York', state: 'NY', median_price: 750000, price_per_sqft: 850, avg_cap_rate: 0.04, avg_rent_per_sqft: 4.5, vacancy_rate: 0.05, appreciation_rate: 0.03, property_tax_rate: 0.012 },
  'los_angeles': { city: 'Los Angeles', state: 'CA', median_price: 850000, price_per_sqft: 650, avg_cap_rate: 0.045, avg_rent_per_sqft: 3.5, vacancy_rate: 0.06, appreciation_rate: 0.04, property_tax_rate: 0.0075 },
  'chicago': { city: 'Chicago', state: 'IL', median_price: 325000, price_per_sqft: 250, avg_cap_rate: 0.065, avg_rent_per_sqft: 2.0, vacancy_rate: 0.07, appreciation_rate: 0.02, property_tax_rate: 0.022 },
  'houston': { city: 'Houston', state: 'TX', median_price: 325000, price_per_sqft: 180, avg_cap_rate: 0.07, avg_rent_per_sqft: 1.4, vacancy_rate: 0.08, appreciation_rate: 0.035, property_tax_rate: 0.022 },
  'phoenix': { city: 'Phoenix', state: 'AZ', median_price: 425000, price_per_sqft: 275, avg_cap_rate: 0.055, avg_rent_per_sqft: 1.6, vacancy_rate: 0.06, appreciation_rate: 0.045, property_tax_rate: 0.006 },
  'miami': { city: 'Miami', state: 'FL', median_price: 550000, price_per_sqft: 450, avg_cap_rate: 0.05, avg_rent_per_sqft: 2.8, vacancy_rate: 0.07, appreciation_rate: 0.05, property_tax_rate: 0.02 },
  'dallas': { city: 'Dallas', state: 'TX', median_price: 400000, price_per_sqft: 220, avg_cap_rate: 0.06, avg_rent_per_sqft: 1.5, vacancy_rate: 0.07, appreciation_rate: 0.04, property_tax_rate: 0.022 },
  'seattle': { city: 'Seattle', state: 'WA', median_price: 750000, price_per_sqft: 550, avg_cap_rate: 0.045, avg_rent_per_sqft: 2.8, vacancy_rate: 0.05, appreciation_rate: 0.04, property_tax_rate: 0.01 },
  'denver': { city: 'Denver', state: 'CO', median_price: 550000, price_per_sqft: 350, avg_cap_rate: 0.05, avg_rent_per_sqft: 2.0, vacancy_rate: 0.05, appreciation_rate: 0.04, property_tax_rate: 0.006 },
  'austin': { city: 'Austin', state: 'TX', median_price: 550000, price_per_sqft: 325, avg_cap_rate: 0.05, avg_rent_per_sqft: 2.0, vacancy_rate: 0.06, appreciation_rate: 0.05, property_tax_rate: 0.02 }
};

// ============================================================================
// PROPERTY TYPES
// ============================================================================

interface PropertyTypeData {
  name: string;
  typical_cap_rate_range: [number, number];
  typical_expense_ratio: number;
  typical_vacancy: number;
  depreciation_years: number;
}

const PROPERTY_TYPES: Record<string, PropertyTypeData> = {
  'single_family': { name: 'Single Family Home', typical_cap_rate_range: [0.04, 0.08], typical_expense_ratio: 0.35, typical_vacancy: 0.05, depreciation_years: 27.5 },
  'multifamily': { name: 'Multifamily (2-4 units)', typical_cap_rate_range: [0.05, 0.09], typical_expense_ratio: 0.40, typical_vacancy: 0.07, depreciation_years: 27.5 },
  'apartment': { name: 'Apartment Complex (5+ units)', typical_cap_rate_range: [0.04, 0.07], typical_expense_ratio: 0.45, typical_vacancy: 0.08, depreciation_years: 27.5 },
  'office': { name: 'Office Building', typical_cap_rate_range: [0.05, 0.09], typical_expense_ratio: 0.40, typical_vacancy: 0.12, depreciation_years: 39 },
  'retail': { name: 'Retail Property', typical_cap_rate_range: [0.05, 0.10], typical_expense_ratio: 0.35, typical_vacancy: 0.08, depreciation_years: 39 },
  'industrial': { name: 'Industrial/Warehouse', typical_cap_rate_range: [0.05, 0.08], typical_expense_ratio: 0.25, typical_vacancy: 0.06, depreciation_years: 39 },
  'mixed_use': { name: 'Mixed Use', typical_cap_rate_range: [0.05, 0.08], typical_expense_ratio: 0.40, typical_vacancy: 0.08, depreciation_years: 27.5 }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const realestateTool: UnifiedTool = {
  name: 'real_estate',
  description: 'Comprehensive real estate valuation and investment analysis tool. Supports property valuation, cap rate analysis, cash flow projections, investment metrics (IRR, NPV), and market comparisons.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['valuation', 'cap_rate', 'cash_flow', 'investment', 'mortgage', 'market_analysis', 'compare', 'info', 'examples'],
        description: 'Operation to perform'
      },
      // Property details
      purchase_price: { type: 'number', description: 'Purchase price in USD' },
      property_type: { type: 'string', enum: ['single_family', 'multifamily', 'apartment', 'office', 'retail', 'industrial', 'mixed_use'], description: 'Type of property' },
      square_feet: { type: 'number', description: 'Total square footage' },
      units: { type: 'number', description: 'Number of units (for multifamily)' },
      year_built: { type: 'number', description: 'Year property was built' },
      // Income details
      gross_rent: { type: 'number', description: 'Annual gross rental income' },
      other_income: { type: 'number', description: 'Other annual income (parking, laundry, etc.)' },
      vacancy_rate: { type: 'number', description: 'Expected vacancy rate (0-1)' },
      // Expense details
      property_taxes: { type: 'number', description: 'Annual property taxes' },
      insurance: { type: 'number', description: 'Annual insurance cost' },
      maintenance: { type: 'number', description: 'Annual maintenance/repairs' },
      management_fee: { type: 'number', description: 'Property management fee (0-1 or annual amount)' },
      utilities: { type: 'number', description: 'Annual utilities (if owner paid)' },
      hoa_fees: { type: 'number', description: 'Annual HOA fees' },
      other_expenses: { type: 'number', description: 'Other annual expenses' },
      // Financing
      down_payment_percent: { type: 'number', description: 'Down payment percentage (0-1)' },
      interest_rate: { type: 'number', description: 'Annual interest rate (0-1)' },
      loan_term_years: { type: 'number', description: 'Loan term in years' },
      // Analysis parameters
      holding_period: { type: 'number', description: 'Investment holding period in years' },
      exit_cap_rate: { type: 'number', description: 'Expected cap rate at sale' },
      appreciation_rate: { type: 'number', description: 'Annual appreciation rate' },
      rent_growth_rate: { type: 'number', description: 'Annual rent growth rate' },
      discount_rate: { type: 'number', description: 'Discount rate for NPV calculation' },
      // Market analysis
      market: { type: 'string', description: 'Market name (e.g., new_york, chicago)' },
      // Comparable properties
      comparables: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            price: { type: 'number' },
            sqft: { type: 'number' },
            bedrooms: { type: 'number' },
            distance_miles: { type: 'number' }
          }
        },
        description: 'Comparable properties for valuation'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// VALUATION FUNCTIONS
// ============================================================================

function calculateValuation(
  comparables: Array<{ price: number; sqft: number; bedrooms?: number; distance_miles?: number }>,
  subjectSqft: number,
  subjectBedrooms?: number
): {
  approach: string;
  comparable_analysis: Array<{
    price: number;
    sqft: number;
    price_per_sqft: number;
    adjustment: number;
    adjusted_price: number;
  }>;
  estimated_value: {
    low: number;
    mid: number;
    high: number;
    price_per_sqft: number;
  };
  confidence: string;
} {
  const analyzed = comparables.map(comp => {
    const ppsf = comp.price / comp.sqft;

    // Size adjustment (-$10k per 100 sqft difference)
    let adjustment = ((subjectSqft - comp.sqft) / 100) * 5000;

    // Bedroom adjustment (if provided)
    if (subjectBedrooms !== undefined && comp.bedrooms !== undefined) {
      adjustment += (subjectBedrooms - comp.bedrooms) * 15000;
    }

    // Distance adjustment (farther = less reliable)
    if (comp.distance_miles !== undefined && comp.distance_miles > 0.5) {
      adjustment *= (1 - Math.min(0.2, comp.distance_miles * 0.05));
    }

    const adjustedPrice = comp.price + adjustment;

    return {
      price: comp.price,
      sqft: comp.sqft,
      price_per_sqft: Math.round(ppsf * 100) / 100,
      adjustment: Math.round(adjustment),
      adjusted_price: Math.round(adjustedPrice)
    };
  });

  const adjustedPrices = analyzed.map(a => a.adjusted_price);
  const avgPrice = adjustedPrices.reduce((a, b) => a + b, 0) / adjustedPrices.length;
  const minPrice = Math.min(...adjustedPrices);
  const maxPrice = Math.max(...adjustedPrices);

  // Confidence based on spread
  const spread = (maxPrice - minPrice) / avgPrice;
  let confidence: string;
  if (spread < 0.1) confidence = 'High - comparables are consistent';
  else if (spread < 0.2) confidence = 'Medium - moderate variation in comparables';
  else confidence = 'Low - wide variation, consider more comparables';

  return {
    approach: 'Sales Comparison (Comparable Sales)',
    comparable_analysis: analyzed,
    estimated_value: {
      low: Math.round(minPrice),
      mid: Math.round(avgPrice),
      high: Math.round(maxPrice),
      price_per_sqft: Math.round(avgPrice / subjectSqft * 100) / 100
    },
    confidence
  };
}

// ============================================================================
// CAP RATE ANALYSIS
// ============================================================================

function calculateCapRate(
  purchasePrice: number,
  grossRent: number,
  otherIncome: number = 0,
  vacancyRate: number = 0.05,
  operatingExpenses: number,
  propertyType: string = 'multifamily'
): {
  income: {
    gross_potential_income: number;
    vacancy_loss: number;
    effective_gross_income: number;
    other_income: number;
    total_income: number;
  };
  expenses: {
    operating_expenses: number;
    expense_ratio: number;
  };
  noi: number;
  cap_rate: number;
  cap_rate_percent: string;
  valuation_at_cap_rates: Array<{ cap_rate: number; implied_value: number }>;
  market_comparison: {
    property_type: string;
    typical_range: [number, number];
    assessment: string;
  };
} {
  const gpi = grossRent;
  const vacancyLoss = gpi * vacancyRate;
  const egi = gpi - vacancyLoss;
  const totalIncome = egi + otherIncome;
  const noi = totalIncome - operatingExpenses;
  const capRate = noi / purchasePrice;
  const expenseRatio = operatingExpenses / totalIncome;

  const propTypeData = PROPERTY_TYPES[propertyType] || PROPERTY_TYPES.multifamily;

  // Assessment
  let assessment: string;
  if (capRate < propTypeData.typical_cap_rate_range[0]) {
    assessment = 'Below market - property may be overpriced or in premium location';
  } else if (capRate > propTypeData.typical_cap_rate_range[1]) {
    assessment = 'Above market - potential value-add opportunity or higher risk';
  } else {
    assessment = 'Within market range - fairly priced for property type';
  }

  // Implied values at different cap rates
  const valuationAtCaps = [0.04, 0.05, 0.06, 0.07, 0.08].map(cr => ({
    cap_rate: cr,
    implied_value: Math.round(noi / cr)
  }));

  return {
    income: {
      gross_potential_income: gpi,
      vacancy_loss: Math.round(vacancyLoss),
      effective_gross_income: Math.round(egi),
      other_income: otherIncome,
      total_income: Math.round(totalIncome)
    },
    expenses: {
      operating_expenses: operatingExpenses,
      expense_ratio: Math.round(expenseRatio * 1000) / 10
    },
    noi: Math.round(noi),
    cap_rate: Math.round(capRate * 10000) / 10000,
    cap_rate_percent: (capRate * 100).toFixed(2) + '%',
    valuation_at_cap_rates: valuationAtCaps,
    market_comparison: {
      property_type: propTypeData.name,
      typical_range: propTypeData.typical_cap_rate_range,
      assessment
    }
  };
}

// ============================================================================
// CASH FLOW ANALYSIS
// ============================================================================

function calculateCashFlow(
  purchasePrice: number,
  grossRent: number,
  otherIncome: number,
  vacancyRate: number,
  operatingExpenses: number,
  downPaymentPercent: number,
  interestRate: number,
  loanTermYears: number
): {
  purchase: {
    price: number;
    down_payment: number;
    loan_amount: number;
    closing_costs_estimate: number;
    total_cash_needed: number;
  };
  annual_income: {
    gross_rent: number;
    other_income: number;
    vacancy_loss: number;
    effective_income: number;
  };
  annual_expenses: {
    operating_expenses: number;
    mortgage_payment: number;
    total_expenses: number;
  };
  cash_flow: {
    noi: number;
    annual_debt_service: number;
    cash_flow_before_tax: number;
    monthly_cash_flow: number;
  };
  returns: {
    cap_rate: number;
    cash_on_cash_return: number;
    debt_service_coverage_ratio: number;
    gross_rent_multiplier: number;
  };
} {
  // Purchase details
  const downPayment = purchasePrice * downPaymentPercent;
  const loanAmount = purchasePrice - downPayment;
  const closingCosts = purchasePrice * 0.03;
  const totalCashNeeded = downPayment + closingCosts;

  // Income
  const vacancyLoss = grossRent * vacancyRate;
  const effectiveIncome = grossRent - vacancyLoss + otherIncome;

  // Mortgage calculation
  const monthlyRate = interestRate / 12;
  const numPayments = loanTermYears * 12;
  const monthlyMortgage = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const annualDebtService = monthlyMortgage * 12;

  // Cash flow
  const noi = effectiveIncome - operatingExpenses;
  const cfbt = noi - annualDebtService;

  // Returns
  const capRate = noi / purchasePrice;
  const coc = cfbt / totalCashNeeded;
  const dscr = noi / annualDebtService;
  const grm = purchasePrice / grossRent;

  return {
    purchase: {
      price: purchasePrice,
      down_payment: Math.round(downPayment),
      loan_amount: Math.round(loanAmount),
      closing_costs_estimate: Math.round(closingCosts),
      total_cash_needed: Math.round(totalCashNeeded)
    },
    annual_income: {
      gross_rent: grossRent,
      other_income: otherIncome,
      vacancy_loss: Math.round(vacancyLoss),
      effective_income: Math.round(effectiveIncome)
    },
    annual_expenses: {
      operating_expenses: operatingExpenses,
      mortgage_payment: Math.round(annualDebtService),
      total_expenses: Math.round(operatingExpenses + annualDebtService)
    },
    cash_flow: {
      noi: Math.round(noi),
      annual_debt_service: Math.round(annualDebtService),
      cash_flow_before_tax: Math.round(cfbt),
      monthly_cash_flow: Math.round(cfbt / 12)
    },
    returns: {
      cap_rate: Math.round(capRate * 10000) / 100,
      cash_on_cash_return: Math.round(coc * 10000) / 100,
      debt_service_coverage_ratio: Math.round(dscr * 100) / 100,
      gross_rent_multiplier: Math.round(grm * 100) / 100
    }
  };
}

// ============================================================================
// INVESTMENT ANALYSIS (IRR, NPV)
// ============================================================================

function calculateInvestment(
  purchasePrice: number,
  downPaymentPercent: number,
  noi: number,
  holdingPeriod: number,
  exitCapRate: number,
  appreciationRate: number,
  rentGrowthRate: number,
  discountRate: number,
  annualDebtService: number
): {
  initial_investment: number;
  projected_cash_flows: Array<{
    year: number;
    noi: number;
    cash_flow: number;
    cumulative_cash_flow: number;
  }>;
  exit_analysis: {
    projected_noi_at_exit: number;
    exit_value: number;
    loan_balance_estimate: number;
    net_proceeds: number;
  };
  returns: {
    total_profit: number;
    multiple_on_equity: number;
    irr: number;
    npv: number;
    payback_period_years: number;
  };
  sensitivity: {
    exit_cap_rates: Array<{ cap_rate: number; exit_value: number; irr_estimate: number }>;
  };
} {
  const downPayment = purchasePrice * downPaymentPercent;
  const closingCosts = purchasePrice * 0.03;
  const initialInvestment = downPayment + closingCosts;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _loanAmount = purchasePrice - downPayment;

  // Project cash flows
  const cashFlows: number[] = [-initialInvestment];
  const projectedCFs: Array<{ year: number; noi: number; cash_flow: number; cumulative_cash_flow: number }> = [];

  let currentNOI = noi;
  let cumulativeCF = -initialInvestment;

  for (let year = 1; year <= holdingPeriod; year++) {
    currentNOI = year === 1 ? noi : currentNOI * (1 + rentGrowthRate);
    const cf = currentNOI - annualDebtService;
    cumulativeCF += cf;
    cashFlows.push(cf);
    projectedCFs.push({
      year,
      noi: Math.round(currentNOI),
      cash_flow: Math.round(cf),
      cumulative_cash_flow: Math.round(cumulativeCF)
    });
  }

  // Exit analysis
  const exitNOI = currentNOI * (1 + rentGrowthRate);
  const exitValue = exitNOI / exitCapRate;

  // Estimate remaining loan balance (simplified)
  const yearsRemaining = 30 - holdingPeriod; // Assume 30-year loan
  const monthlyRate = 0.065 / 12; // Estimate
  const remainingPayments = yearsRemaining * 12;
  const monthlyPayment = annualDebtService / 12;
  const loanBalance = monthlyPayment * (1 - Math.pow(1 + monthlyRate, -remainingPayments)) / monthlyRate;

  const sellingCosts = exitValue * 0.06; // 6% selling costs
  const netProceeds = exitValue - loanBalance - sellingCosts;

  // Add exit proceeds to final year
  cashFlows[cashFlows.length - 1] += netProceeds;

  // Calculate IRR
  const irr = calculateIRR(cashFlows);

  // Calculate NPV
  const npv = cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + discountRate, i), 0);

  // Multiple on equity
  const totalProfit = netProceeds + cumulativeCF + initialInvestment;
  const multiple = (netProceeds + cumulativeCF + initialInvestment) / initialInvestment;

  // Payback period
  let paybackYears = holdingPeriod;
  let cumCF = -initialInvestment;
  for (let i = 0; i < projectedCFs.length; i++) {
    cumCF += projectedCFs[i].cash_flow;
    if (cumCF >= 0) {
      paybackYears = i + 1;
      break;
    }
  }

  // Sensitivity analysis
  const sensitivity = [0.05, 0.055, 0.06, 0.065, 0.07, 0.075, 0.08].map(capRate => {
    const ev = exitNOI / capRate;
    const np = ev - loanBalance - (ev * 0.06);
    const tempCFs = [...cashFlows];
    tempCFs[tempCFs.length - 1] = projectedCFs[projectedCFs.length - 1].cash_flow + np;
    return {
      cap_rate: capRate,
      exit_value: Math.round(ev),
      irr_estimate: Math.round(calculateIRR(tempCFs) * 10000) / 100
    };
  });

  return {
    initial_investment: Math.round(initialInvestment),
    projected_cash_flows: projectedCFs,
    exit_analysis: {
      projected_noi_at_exit: Math.round(exitNOI),
      exit_value: Math.round(exitValue),
      loan_balance_estimate: Math.round(loanBalance),
      net_proceeds: Math.round(netProceeds)
    },
    returns: {
      total_profit: Math.round(totalProfit),
      multiple_on_equity: Math.round(multiple * 100) / 100,
      irr: Math.round(irr * 10000) / 100,
      npv: Math.round(npv),
      payback_period_years: paybackYears
    },
    sensitivity: {
      exit_cap_rates: sensitivity
    }
  };
}

// IRR calculation using Newton-Raphson
function calculateIRR(cashFlows: number[]): number {
  let irr = 0.1;
  const maxIter = 100;
  const tolerance = 0.0001;

  for (let i = 0; i < maxIter; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let t = 0; t < cashFlows.length; t++) {
      const factor = Math.pow(1 + irr, t);
      npv += cashFlows[t] / factor;
      if (t > 0) {
        dnpv -= (t * cashFlows[t]) / (factor * (1 + irr));
      }
    }

    if (Math.abs(npv) < tolerance) break;
    if (dnpv === 0) break;

    irr = irr - npv / dnpv;
  }

  return irr;
}

// ============================================================================
// MORTGAGE CALCULATOR
// ============================================================================

function calculateMortgage(
  loanAmount: number,
  interestRate: number,
  loanTermYears: number
): {
  loan_details: {
    principal: number;
    annual_interest_rate: number;
    term_years: number;
    total_payments: number;
  };
  payment: {
    monthly_payment: number;
    annual_payment: number;
    total_interest: number;
    total_cost: number;
  };
  amortization_summary: Array<{
    year: number;
    beginning_balance: number;
    principal_paid: number;
    interest_paid: number;
    ending_balance: number;
  }>;
  comparison: Array<{
    rate: number;
    monthly_payment: number;
    total_interest: number;
  }>;
} {
  const monthlyRate = interestRate / 12;
  const numPayments = loanTermYears * 12;

  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
  const totalCost = monthlyPayment * numPayments;
  const totalInterest = totalCost - loanAmount;

  // Amortization summary by year
  const amortization: Array<{
    year: number;
    beginning_balance: number;
    principal_paid: number;
    interest_paid: number;
    ending_balance: number;
  }> = [];

  let balance = loanAmount;
  for (let year = 1; year <= Math.min(loanTermYears, 10); year++) {
    const beginningBalance = balance;
    let yearPrincipal = 0;
    let yearInterest = 0;

    for (let month = 0; month < 12; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      yearPrincipal += principalPayment;
      yearInterest += interestPayment;
      balance -= principalPayment;
    }

    amortization.push({
      year,
      beginning_balance: Math.round(beginningBalance),
      principal_paid: Math.round(yearPrincipal),
      interest_paid: Math.round(yearInterest),
      ending_balance: Math.round(Math.max(0, balance))
    });
  }

  // Rate comparison
  const rateComparison = [interestRate - 0.01, interestRate - 0.005, interestRate, interestRate + 0.005, interestRate + 0.01]
    .filter(r => r > 0)
    .map(rate => {
      const mr = rate / 12;
      const mp = loanAmount * (mr * Math.pow(1 + mr, numPayments)) / (Math.pow(1 + mr, numPayments) - 1);
      return {
        rate: Math.round(rate * 10000) / 100,
        monthly_payment: Math.round(mp),
        total_interest: Math.round(mp * numPayments - loanAmount)
      };
    });

  return {
    loan_details: {
      principal: loanAmount,
      annual_interest_rate: interestRate,
      term_years: loanTermYears,
      total_payments: numPayments
    },
    payment: {
      monthly_payment: Math.round(monthlyPayment),
      annual_payment: Math.round(monthlyPayment * 12),
      total_interest: Math.round(totalInterest),
      total_cost: Math.round(totalCost)
    },
    amortization_summary: amortization,
    comparison: rateComparison
  };
}

// ============================================================================
// MARKET ANALYSIS
// ============================================================================

function getMarketAnalysis(marketName: string): object {
  const market = MARKET_DATA[marketName];
  if (!market) {
    return {
      error: `Market '${marketName}' not found`,
      available_markets: Object.keys(MARKET_DATA)
    };
  }

  return {
    market: market.city + ', ' + market.state,
    metrics: {
      median_price: market.median_price,
      price_per_sqft: market.price_per_sqft,
      avg_cap_rate: (market.avg_cap_rate * 100).toFixed(1) + '%',
      avg_rent_per_sqft: '$' + market.avg_rent_per_sqft.toFixed(2),
      vacancy_rate: (market.vacancy_rate * 100).toFixed(1) + '%',
      appreciation_rate: (market.appreciation_rate * 100).toFixed(1) + '%',
      property_tax_rate: (market.property_tax_rate * 100).toFixed(2) + '%'
    },
    rental_analysis: {
      sample_1br_rent: Math.round(market.avg_rent_per_sqft * 650),
      sample_2br_rent: Math.round(market.avg_rent_per_sqft * 900),
      sample_3br_rent: Math.round(market.avg_rent_per_sqft * 1200),
      grm_estimate: Math.round(1 / (market.avg_rent_per_sqft * 12 / market.price_per_sqft) * 100) / 100
    },
    investment_outlook: market.avg_cap_rate > 0.06 ?
      'Higher yield market - focus on cash flow' :
      market.appreciation_rate > 0.04 ?
        'Growth market - appreciation potential' :
        'Balanced market - moderate cash flow and appreciation'
  };
}

function compareMarkets(): object {
  return {
    markets: Object.entries(MARKET_DATA).map(([key, m]) => ({
      market: key,
      city: m.city,
      median_price: m.median_price,
      cap_rate: (m.avg_cap_rate * 100).toFixed(1) + '%',
      appreciation: (m.appreciation_rate * 100).toFixed(1) + '%',
      price_per_sqft: m.price_per_sqft
    })),
    rankings: {
      highest_cap_rate: Object.entries(MARKET_DATA).sort(([, a], [, b]) => b.avg_cap_rate - a.avg_cap_rate).slice(0, 3).map(([k]) => k),
      highest_appreciation: Object.entries(MARKET_DATA).sort(([, a], [, b]) => b.appreciation_rate - a.appreciation_rate).slice(0, 3).map(([k]) => k),
      most_affordable: Object.entries(MARKET_DATA).sort(([, a], [, b]) => a.median_price - b.median_price).slice(0, 3).map(([k]) => k)
    }
  };
}

function getInfo(): object {
  return {
    tool: 'real_estate',
    description: 'Comprehensive real estate valuation and investment analysis',
    capabilities: [
      'Property valuation (comparable sales approach)',
      'Cap rate calculation and market comparison',
      'Cash flow analysis (income, expenses, NOI)',
      'Investment metrics (IRR, NPV, cash-on-cash)',
      'Mortgage calculations with amortization',
      'Market analysis and comparisons'
    ],
    property_types: Object.keys(PROPERTY_TYPES),
    markets_available: Object.keys(MARKET_DATA),
    key_metrics: {
      cap_rate: 'NOI / Purchase Price',
      cash_on_cash: 'Annual Cash Flow / Total Cash Invested',
      dscr: 'NOI / Annual Debt Service (should be > 1.25)',
      grm: 'Purchase Price / Annual Gross Rent'
    }
  };
}

function getExamples(): object {
  return {
    cap_rate_analysis: {
      operation: 'cap_rate',
      purchase_price: 500000,
      gross_rent: 60000,
      vacancy_rate: 0.05,
      property_taxes: 6000,
      insurance: 2400,
      maintenance: 4800,
      management_fee: 4800,
      property_type: 'multifamily'
    },
    cash_flow_analysis: {
      operation: 'cash_flow',
      purchase_price: 400000,
      gross_rent: 48000,
      other_income: 1200,
      vacancy_rate: 0.07,
      property_taxes: 4800,
      insurance: 1800,
      maintenance: 3600,
      management_fee: 3840,
      down_payment_percent: 0.25,
      interest_rate: 0.07,
      loan_term_years: 30
    },
    investment_analysis: {
      operation: 'investment',
      purchase_price: 500000,
      down_payment_percent: 0.25,
      gross_rent: 60000,
      vacancy_rate: 0.05,
      holding_period: 5,
      exit_cap_rate: 0.06,
      appreciation_rate: 0.03,
      rent_growth_rate: 0.02,
      discount_rate: 0.10
    },
    mortgage: {
      operation: 'mortgage',
      purchase_price: 400000,
      down_payment_percent: 0.20,
      interest_rate: 0.07,
      loan_term_years: 30
    }
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executerealestate(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: object;

    switch (operation) {
      case 'valuation': {
        if (!args.comparables || !Array.isArray(args.comparables)) {
          throw new Error('comparables array required for valuation');
        }
        result = {
          operation: 'valuation',
          ...calculateValuation(args.comparables, args.square_feet || 1500, args.bedrooms)
        };
        break;
      }

      case 'cap_rate': {
        const opex = (args.property_taxes || 0) + (args.insurance || 0) + (args.maintenance || 0) +
          (args.management_fee || 0) + (args.utilities || 0) + (args.hoa_fees || 0) + (args.other_expenses || 0);
        result = {
          operation: 'cap_rate',
          ...calculateCapRate(
            args.purchase_price || 500000,
            args.gross_rent || 60000,
            args.other_income || 0,
            args.vacancy_rate || 0.05,
            opex,
            args.property_type || 'multifamily'
          )
        };
        break;
      }

      case 'cash_flow': {
        const opex = (args.property_taxes || 0) + (args.insurance || 0) + (args.maintenance || 0) +
          (args.management_fee || 0) + (args.utilities || 0) + (args.hoa_fees || 0) + (args.other_expenses || 0);
        result = {
          operation: 'cash_flow',
          ...calculateCashFlow(
            args.purchase_price || 500000,
            args.gross_rent || 60000,
            args.other_income || 0,
            args.vacancy_rate || 0.05,
            opex,
            args.down_payment_percent || 0.25,
            args.interest_rate || 0.07,
            args.loan_term_years || 30
          )
        };
        break;
      }

      case 'investment': {
        const opex = (args.property_taxes || 0) + (args.insurance || 0) + (args.maintenance || 0) +
          (args.management_fee || 0) + (args.utilities || 0) + (args.hoa_fees || 0) + (args.other_expenses || 0);
        const grossRent = args.gross_rent || 60000;
        const vacancyRate = args.vacancy_rate || 0.05;
        const noi = grossRent * (1 - vacancyRate) - opex;

        const downPayment = (args.purchase_price || 500000) * (args.down_payment_percent || 0.25);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const loanAmount = (args.purchase_price || 500000) - downPayment;
        const monthlyRate = (args.interest_rate || 0.07) / 12;
        const numPayments = (args.loan_term_years || 30) * 12;
        const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
        const annualDebtService = monthlyPayment * 12;

        result = {
          operation: 'investment',
          ...calculateInvestment(
            args.purchase_price || 500000,
            args.down_payment_percent || 0.25,
            noi,
            args.holding_period || 5,
            args.exit_cap_rate || 0.06,
            args.appreciation_rate || 0.03,
            args.rent_growth_rate || 0.02,
            args.discount_rate || 0.10,
            annualDebtService
          )
        };
        break;
      }

      case 'mortgage': {
        const loanAmount = (args.purchase_price || 400000) * (1 - (args.down_payment_percent || 0.20));
        result = {
          operation: 'mortgage',
          ...calculateMortgage(
            loanAmount,
            args.interest_rate || 0.07,
            args.loan_term_years || 30
          )
        };
        break;
      }

      case 'market_analysis':
        result = {
          operation: 'market_analysis',
          ...getMarketAnalysis(args.market || 'new_york')
        };
        break;

      case 'compare':
        result = {
          operation: 'compare',
          ...compareMarkets()
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

export function isrealestateAvailable(): boolean {
  return true;
}
