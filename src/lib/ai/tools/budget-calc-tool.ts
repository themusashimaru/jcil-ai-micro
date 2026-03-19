/**
 * BUDGET CALCULATOR TOOL
 *
 * Financial calculations: loan amortization, compound interest,
 * savings projections, budget breakdown, debt payoff.
 * No external dependencies — pure math.
 *
 * Created: 2026-03-19
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface Expenses {
  housing?: number; food?: number; transportation?: number;
  utilities?: number; insurance?: number; savings?: number;
  debt?: number; entertainment?: number; other?: number;
}

interface ToolArgs {
  calculation_type: string;
  principal?: number; interest_rate?: number; term_months?: number;
  monthly_payment?: number; monthly_contribution?: number;
  target_amount?: number; income?: number; expenses?: Expenses;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const budgetCalcTool: UnifiedTool = {
  name: 'budget_calculator',
  description: `Financial calculator for loans, savings, budgets, and debt payoff. Provides detailed calculations with amortization schedules, growth projections, and budget analysis.

Use this when:
- User asks about loan payments, mortgages, or car loans
- User wants to plan savings or calculate compound interest
- User needs help creating a budget
- User wants to know how long to pay off debt
- User asks any personal finance calculation question

Returns structured financial data with formatted numbers and actionable insights.`,
  parameters: {
    type: 'object',
    properties: {
      calculation_type: {
        type: 'string',
        enum: ['loan_amortization', 'compound_interest', 'savings_goal', 'budget_breakdown', 'debt_payoff'],
        description: 'Type of financial calculation to perform',
      },
      principal: { type: 'number', description: 'Starting amount or loan amount' },
      interest_rate: { type: 'number', description: 'Annual interest rate as percentage (e.g., 5.5 for 5.5%)' },
      term_months: { type: 'number', description: 'Duration in months' },
      monthly_payment: { type: 'number', description: 'Monthly payment amount (for debt payoff)' },
      monthly_contribution: { type: 'number', description: 'Monthly savings contribution' },
      target_amount: { type: 'number', description: 'Target savings goal' },
      income: { type: 'number', description: 'Monthly income (for budget breakdown)' },
      expenses: {
        type: 'object',
        description: 'Budget expenses object with keys: housing, food, transportation, utilities, insurance, savings, debt, entertainment, other (all numbers in dollars)',
      },
    },
    required: ['calculation_type'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isBudgetCalcAvailable(): boolean {
  return true; // Pure math — always available
}

// ============================================================================
// HELPERS
// ============================================================================

const fmt = (n: number): string => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const pct = (n: number): string => `${n.toFixed(1)}%`;

function requireParams(args: ToolArgs, ...names: (keyof ToolArgs)[]): string | null {
  for (const name of names) {
    if (args[name] === undefined || args[name] === null) return `Error: ${name} is required for ${args.calculation_type}`;
  }
  return null;
}

interface ScheduleRow { month: number; payment: string; principal: string; interest: string; balance: string }

// ============================================================================
// CALCULATIONS
// ============================================================================

function calcLoanAmortization(args: ToolArgs) {
  const P = args.principal!, rate = args.interest_rate!, months = args.term_months!;
  const mr = rate / 100 / 12;
  let mp: number;
  if (mr === 0) { mp = P / months; } else {
    const f = Math.pow(1 + mr, months);
    mp = P * (mr * f) / (f - 1);
  }
  const schedule: ScheduleRow[] = [];
  let bal = P, totP12 = 0, totI12 = 0;
  for (let m = 1; m <= months; m++) {
    const intPay = bal * mr, prinPay = mp - intPay;
    bal = Math.max(0, bal - prinPay);
    if (m <= 12) {
      totP12 += prinPay; totI12 += intPay;
      schedule.push({ month: m, payment: fmt(mp), principal: fmt(prinPay), interest: fmt(intPay), balance: fmt(bal) });
    }
  }
  return {
    calculationType: 'loan_amortization',
    summary: { loanAmount: fmt(P), annualRate: pct(rate), termMonths: months, termYears: +(months / 12).toFixed(1),
      monthlyPayment: fmt(mp), totalInterest: fmt(mp * months - P), totalCost: fmt(mp * months) },
    first12Months: schedule,
    first12Summary: { totalPrincipal: fmt(totP12), totalInterest: fmt(totI12) },
    remainingMonths: months > 12 ? months - 12 : 0,
  };
}

function calcCompoundInterest(args: ToolArgs) {
  const P = args.principal ?? 0, rate = args.interest_rate ?? 0;
  const months = args.term_months ?? 120, contrib = args.monthly_contribution ?? 0;
  const mr = rate / 100 / 12, years = Math.ceil(months / 12);
  const yearly: Array<{ year: number; contributions: string; interestEarned: string; balance: string }> = [];
  let bal = P, totC = P, totI = 0;
  for (let y = 1; y <= years; y++) {
    const mThisYr = y === years ? months - (years - 1) * 12 : 12;
    for (let m = 0; m < mThisYr; m++) {
      const interest = bal * mr;
      totI += interest; bal += interest + contrib; totC += contrib;
    }
    yearly.push({ year: y, contributions: fmt(totC), interestEarned: fmt(totI), balance: fmt(bal) });
  }
  return {
    calculationType: 'compound_interest',
    summary: { initialInvestment: fmt(P), monthlyContribution: fmt(contrib), annualRate: pct(rate),
      termMonths: months, termYears: +(months / 12).toFixed(1), futureValue: fmt(bal),
      totalContributions: fmt(totC), totalInterestEarned: fmt(totI),
      effectiveReturn: pct(P > 0 ? ((bal - totC) / P) * 100 : 0) },
    yearByYear: yearly,
  };
}

function calcSavingsGoal(args: ToolArgs) {
  const target = args.target_amount!, rate = args.interest_rate ?? 0, mr = rate / 100 / 12;
  // Mode 1: given contribution, find time
  if (args.monthly_contribution !== undefined) {
    const c = args.monthly_contribution;
    if (c <= 0) return { error: 'monthly_contribution must be greater than 0' };
    let bal = args.principal ?? 0, mo = 0;
    while (bal < target && mo < 1200) { bal += bal * mr + c; mo++; }
    if (mo >= 1200) return { error: 'Goal would take over 100 years' };
    const start = args.principal ?? 0;
    return { calculationType: 'savings_goal', mode: 'time_to_goal',
      summary: { targetAmount: fmt(target), monthlyContribution: fmt(c), startingBalance: fmt(start),
        annualRate: pct(rate), monthsNeeded: mo, yearsNeeded: +(mo / 12).toFixed(1),
        totalContributed: fmt(c * mo + start), interestEarned: fmt(bal - c * mo - start), finalBalance: fmt(bal) } };
  }
  // Mode 2: given term, find contribution
  if (args.term_months !== undefined) {
    const mo = args.term_months, start = args.principal ?? 0;
    let rc: number;
    if (mr === 0) { rc = (target - start) / mo; } else {
      const f = Math.pow(1 + mr, mo);
      rc = ((target - start * f) * mr) / (f - 1);
    }
    return { calculationType: 'savings_goal', mode: 'required_contribution',
      summary: { targetAmount: fmt(target), termMonths: mo, termYears: +(mo / 12).toFixed(1),
        startingBalance: fmt(start), annualRate: pct(rate),
        requiredMonthlyContribution: fmt(Math.max(0, rc)),
        totalContributed: fmt(rc * mo + start), interestEarned: fmt(target - rc * mo - start) } };
  }
  return { error: 'Provide monthly_contribution (to find time) or term_months (to find required contribution)' };
}

function calcBudgetBreakdown(args: ToolArgs) {
  const income = args.income!, exp = args.expenses ?? {};
  const cats: Array<{ name: string; amount: number; pctVal: number }> = [];
  let totalExp = 0;
  const entries: [string, number | undefined][] = [
    ['Housing', exp.housing], ['Food', exp.food], ['Transportation', exp.transportation],
    ['Utilities', exp.utilities], ['Insurance', exp.insurance], ['Savings', exp.savings],
    ['Debt Payments', exp.debt], ['Entertainment', exp.entertainment], ['Other', exp.other],
  ];
  for (const [name, amt] of entries) {
    if (amt !== undefined && amt > 0) { cats.push({ name, amount: amt, pctVal: (amt / income) * 100 }); totalExp += amt; }
  }
  const remaining = income - totalExp;
  const sumCats = (names: string[]) => cats.filter(c => names.includes(c.name)).reduce((s, c) => s + c.amount, 0);
  const needs = sumCats(['Housing', 'Food', 'Transportation', 'Utilities', 'Insurance']);
  const wants = sumCats(['Entertainment', 'Other']);
  const sav = sumCats(['Savings', 'Debt Payments']);
  const nP = (needs / income) * 100, wP = (wants / income) * 100, sP = (sav / income) * 100;
  const warnings: string[] = [];
  if (nP > 50) warnings.push(`Needs at ${pct(nP)} exceeds recommended 50%`);
  if (wP > 30) warnings.push(`Wants at ${pct(wP)} exceeds recommended 30%`);
  if (sP < 20) warnings.push(`Savings/debt at ${pct(sP)} is below recommended 20%`);
  if (totalExp > income) warnings.push('Total expenses exceed income — deficit budget');
  const hP = ((exp.housing ?? 0) / income) * 100;
  if (hP > 30) warnings.push(`Housing at ${pct(hP)} exceeds recommended 30% of income`);
  return {
    calculationType: 'budget_breakdown',
    summary: { monthlyIncome: fmt(income), totalExpenses: fmt(totalExp), remaining: fmt(remaining),
      remainingPercentage: pct((remaining / income) * 100), status: remaining >= 0 ? 'surplus' : 'deficit' },
    categories: cats.map(c => ({ name: c.name, amount: fmt(c.amount), percentage: pct(c.pctVal) })),
    rule503020: {
      needs: { amount: fmt(needs), percentage: pct(nP), recommended: '50%' },
      wants: { amount: fmt(wants), percentage: pct(wP), recommended: '30%' },
      savings: { amount: fmt(sav), percentage: pct(sP), recommended: '20%' },
    },
    warnings: warnings.length > 0 ? warnings : ['Budget looks healthy!'],
  };
}

function calcDebtPayoff(args: ToolArgs) {
  const principal = args.principal!, rate = args.interest_rate!, payment = args.monthly_payment!;
  const mr = rate / 100 / 12, fmi = principal * mr;
  if (payment <= fmi) return { error: `Monthly payment (${fmt(payment)}) must exceed first month interest (${fmt(fmi)})` };
  let bal = principal, totI = 0, mo = 0;
  const schedule: ScheduleRow[] = [];
  while (bal > 0.01 && mo < 1200) {
    mo++;
    const interest = bal * mr, pp = Math.min(bal, payment - interest);
    totI += interest; bal = Math.max(0, bal - pp);
    if (mo <= 12) schedule.push({ month: mo, payment: fmt(Math.min(payment, pp + interest)), principal: fmt(pp), interest: fmt(interest), balance: fmt(bal) });
  }
  if (mo >= 1200) return { error: 'Payoff would take over 100 years — increase payment amount' };
  // Minimum payment comparison
  const minPay = fmi * 1.01 + 1;
  let mBal = principal, mMo = 0, mI = 0;
  while (mBal > 0.01 && mMo < 1200) { mMo++; const i = mBal * mr; mI += i; mBal = Math.max(0, mBal - Math.min(mBal, minPay - i)); }
  return {
    calculationType: 'debt_payoff',
    summary: { originalDebt: fmt(principal), annualRate: pct(rate), monthlyPayment: fmt(payment),
      payoffMonths: mo, payoffYears: +(mo / 12).toFixed(1), totalInterestPaid: fmt(totI), totalCost: fmt(principal + totI) },
    first12Months: schedule, remainingMonths: mo > 12 ? mo - 12 : 0,
    comparison: {
      withCurrentPayment: { monthlyPayment: fmt(payment), payoffMonths: mo, totalInterest: fmt(totI) },
      withMinimumPayment: { monthlyPayment: fmt(minPay),
        payoffMonths: mMo >= 1200 ? 'Over 100 years' : mMo,
        totalInterest: mMo >= 1200 ? 'Enormous' : fmt(mI) },
      savings: { interestSaved: mMo >= 1200 ? 'Significant' : fmt(mI - totI),
        timeSavedMonths: mMo >= 1200 ? 'Decades' : mMo - mo },
    },
  };
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeBudgetCalc(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as unknown as ToolArgs;
  if (!args.calculation_type) {
    return { toolCallId: toolCall.id, content: 'Error: calculation_type is required', isError: true };
  }
  try {
    let result: Record<string, unknown>;
    switch (args.calculation_type) {
      case 'loan_amortization': {
        const err = requireParams(args, 'principal', 'interest_rate', 'term_months');
        if (err) return { toolCallId: toolCall.id, content: err, isError: true };
        result = calcLoanAmortization(args); break;
      }
      case 'compound_interest': {
        if (args.principal === undefined && args.monthly_contribution === undefined)
          return { toolCallId: toolCall.id, content: 'Error: principal or monthly_contribution required', isError: true };
        result = calcCompoundInterest(args); break;
      }
      case 'savings_goal': {
        const err = requireParams(args, 'target_amount');
        if (err) return { toolCallId: toolCall.id, content: err, isError: true };
        result = calcSavingsGoal(args); break;
      }
      case 'budget_breakdown': {
        const err = requireParams(args, 'income');
        if (err) return { toolCallId: toolCall.id, content: err, isError: true };
        result = calcBudgetBreakdown(args); break;
      }
      case 'debt_payoff': {
        const err = requireParams(args, 'principal', 'interest_rate', 'monthly_payment');
        if (err) return { toolCallId: toolCall.id, content: err, isError: true };
        result = calcDebtPayoff(args); break;
      }
      default:
        return { toolCallId: toolCall.id, content: `Error: Unknown calculation_type "${args.calculation_type}"`, isError: true };
    }
    if ('error' in result) return { toolCallId: toolCall.id, content: `Error: ${result.error}`, isError: true };
    return { toolCallId: toolCall.id, content: JSON.stringify({ success: true, ...result }) };
  } catch (error) {
    return { toolCallId: toolCall.id, content: `Error in budget calculation: ${(error as Error).message}`, isError: true };
  }
}
