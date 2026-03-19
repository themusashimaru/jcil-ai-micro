/**
 * CHURCH BUDGET TOOL — Church/ministry budget report generator.
 * Produces financial reports with income, expenses, missions giving,
 * building fund tracking, and staff compensation.
 * No external dependencies. Created: 2026-03-19
 */
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// --- TYPES ---

interface BudgetLineItem { category: string; budgeted: string; actual: string }
interface MissionGiving { organization: string; amount: string }
interface BuildingFund { goal: string; current: string }
interface StaffCompensation { position: string; budgeted: string; actual: string }

// --- HELPERS ---

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseNum(s: string): number { return parseFloat(s.replace(/[^0-9.\-]/g, '')) || 0; }

function fmtCurrency(n: number): string {
  return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcVariance(budgeted: string, actual: string): { amount: number; pct: number } {
  const b = parseNum(budgeted), a = parseNum(actual), amount = b - a;
  return { amount, pct: b !== 0 ? (amount / b) * 100 : 0 };
}

function sumLines(items: BudgetLineItem[], field: 'budgeted' | 'actual'): number {
  return items.reduce((sum, item) => sum + parseNum(item[field]), 0);
}

// --- MARKDOWN FORMATTER ---

function formatMarkdown(
  churchName: string, fiscalYear: string, preparedBy: string, date: string,
  period: string, notes: string, income: BudgetLineItem[], expenses: BudgetLineItem[],
  missions: MissionGiving[], buildingFund: BuildingFund | undefined,
  staff: StaffCompensation[],
): string {
  const L: string[] = [];
  const tIB = sumLines(income, 'budgeted'), tIA = sumLines(income, 'actual');
  const tEB = sumLines(expenses, 'budgeted'), tEA = sumLines(expenses, 'actual');
  const netB = tIB - tEB;
  const netA = tIA - tEA;

  L.push(`# ${churchName} — Budget Report`, '', '| Field | Value |', '|-------|-------|');
  L.push(`| **Fiscal Year** | ${fiscalYear} |`);
  if (period) L.push(`| **Period** | ${period} |`);
  if (preparedBy) L.push(`| **Prepared By** | ${preparedBy} |`);
  if (date) L.push(`| **Date** | ${date} |`);
  L.push('');

  // Income
  L.push('## Income', '', '| Category | Budgeted | Actual | Variance | Var % |',
    '|----------|----------|--------|----------|-------|');
  for (const item of income) {
    const v = calcVariance(item.budgeted, item.actual);
    L.push(`| ${item.category} | ${item.budgeted} | ${item.actual} | ${fmtCurrency(v.amount)} | ${v.pct.toFixed(1)}% |`);
  }
  L.push(`| **Total Income** | **${fmtCurrency(tIB)}** | **${fmtCurrency(tIA)}** | **${fmtCurrency(tIB - tIA)}** | |`, '');
  // Expenses
  L.push('## Expenses', '', '| Category | Budgeted | Actual | Variance | Var % |', '|----------|----------|--------|----------|-------|');
  for (const item of expenses) {
    const v = calcVariance(item.budgeted, item.actual);
    L.push(`| ${item.category} | ${item.budgeted} | ${item.actual} | ${fmtCurrency(v.amount)} | ${v.pct.toFixed(1)}% |`);
  }
  L.push(`| **Total Expenses** | **${fmtCurrency(tEB)}** | **${fmtCurrency(tEA)}** | **${fmtCurrency(tEB - tEA)}** | |`, '');
  // Net Summary
  const label = netA >= 0 ? 'Net Surplus' : 'Net Deficit';
  L.push('## Net Summary', '', '| | Budgeted | Actual |', '|---|----------|--------|');
  L.push(`| Total Income | ${fmtCurrency(tIB)} | ${fmtCurrency(tIA)} |`);
  L.push(`| Total Expenses | ${fmtCurrency(tEB)} | ${fmtCurrency(tEA)} |`);
  L.push(`| **${label}** | **${fmtCurrency(netB)}** | **${fmtCurrency(netA)}** |`, '');

  // Missions Giving
  if (missions.length > 0) {
    L.push('## Missions Giving', '', '| Organization | Amount |', '|-------------|--------|');
    let missionsTotal = 0;
    for (const m of missions) {
      L.push(`| ${m.organization} | ${m.amount} |`);
      missionsTotal += parseNum(m.amount);
    }
    L.push(`| **Total Missions** | **${fmtCurrency(missionsTotal)}** |`);
    L.push('');
  }

  // Building Fund
  if (buildingFund) {
    const goal = parseNum(buildingFund.goal);
    const current = parseNum(buildingFund.current);
    const pct = goal > 0 ? ((current / goal) * 100).toFixed(1) : '0.0';
    L.push('## Building Fund', '', `**Goal:** ${buildingFund.goal}`, `**Current:** ${buildingFund.current}`,
      `**Progress:** ${pct}%`, '');
  }

  // Staff Compensation
  if (staff.length > 0) {
    L.push('## Staff Compensation', '', '| Position | Budgeted | Actual | Variance |',
      '|----------|----------|--------|----------|');
    for (const s of staff) {
      const v = calcVariance(s.budgeted, s.actual);
      L.push(`| ${s.position} | ${s.budgeted} | ${s.actual} | ${fmtCurrency(v.amount)} |`);
    }
    L.push('');
  }

  if (notes) L.push('## Notes', '', notes, '');

  return L.join('\n');
}

// --- HTML FORMATTER ---

const CSS = [
  'body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:20px;color:#e0e0e0;background:#121225}',
  'h1{color:#c0c8e0;border-bottom:3px solid #1a1a2e;padding-bottom:10px;text-align:center}',
  'h2{color:#a0b0d0;margin-top:28px;border-bottom:1px solid #2a2a4e;padding-bottom:6px}',
  '.meta{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;background:#1a1a2e;padding:16px 20px;border-radius:8px;margin-bottom:24px}',
  '.meta-item{display:flex;gap:8px}.meta-label{font-weight:700;color:#8090b0;min-width:120px}.meta-value{color:#c0c8e0}',
  'table{width:100%;border-collapse:collapse;margin:12px 0}',
  'th,td{border:1px solid #2a2a4e;padding:8px 12px;text-align:left}',
  'th{background:#1a1a2e;color:#c0c8e0}tr:nth-child(even){background:#16162a}',
  '.total-row{font-weight:700;background:#1a1a2e !important}',
  '.positive{color:#40c060}.negative{color:#e04040}',
  '.net-banner{padding:16px 20px;border-radius:8px;margin:20px 0;text-align:center;font-size:1.2em;font-weight:700}',
  '.net-surplus{background:#1a2e1a;border:2px solid #2d8040;color:#60e080}',
  '.net-deficit{background:#2e1a1a;border:2px solid #c04040;color:#e06060}',
  '.missions-item{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #2a2a4e;color:#c0c8e0}',
  '.missions-item:last-child{border-bottom:none;font-weight:700;color:#a0b0d0}',
  '.missions-list{background:#16162a;border:1px solid #2a2a4e;border-radius:8px;overflow:hidden;margin:12px 0}',
  '.fund-progress{background:#2a2a4e;border-radius:8px;overflow:hidden;height:28px;margin:12px 0;position:relative}',
  '.fund-bar{background:linear-gradient(90deg,#2060a0,#40a0e0);height:100%;border-radius:8px;transition:width .3s}',
  '.fund-label{position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.9em}',
  '.fund-info{display:flex;justify-content:space-between;color:#8090b0;font-size:.9em;margin-top:4px}',
  '.notes{background:#1a1a2e;padding:14px 18px;border-radius:8px;margin-top:20px;color:#b0b8d0;border-left:4px solid #4a5a8a}',
  '@media print{body{background:#fff;color:#1a1a1a;padding:0}h1{color:#1a1a2e}h2{color:#2a2a4e}',
  'h1{page-break-before:auto}h2{page-break-after:avoid}',
  '.meta{background:#f5f5fa;border-color:#ccc}th{background:#1a1a2e;color:#fff}',
  '.net-surplus{background:#e8f5e9;color:#1b5e20;border-color:#4caf50}',
  '.net-deficit{background:#fbe9e7;color:#b71c1c;border-color:#ef5350}',
  '.positive{color:#2e7d32}.negative{color:#c62828}',
  'table{break-inside:avoid}thead{display:table-header-group}}',
].join('');

function formatHtml(
  churchName: string, fiscalYear: string, preparedBy: string, date: string,
  period: string, notes: string, income: BudgetLineItem[], expenses: BudgetLineItem[],
  missions: MissionGiving[], buildingFund: BuildingFund | undefined,
  staff: StaffCompensation[],
): string {
  const h: string[] = [];
  const tIB = sumLines(income, 'budgeted'), tIA = sumLines(income, 'actual');
  const tEB = sumLines(expenses, 'budgeted'), tEA = sumLines(expenses, 'actual');
  const netB = tIB - tEB, netA = tIA - tEA;

  h.push(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(churchName)} Budget Report</title>`);
  h.push(`<style>${CSS}</style></head><body>`);
  h.push(`<h1>${esc(churchName)} &mdash; Budget Report</h1>`);
  h.push('<div class="meta">');
  h.push(`<div class="meta-item"><span class="meta-label">Fiscal Year:</span><span class="meta-value">${esc(fiscalYear)}</span></div>`);
  if (period) h.push(`<div class="meta-item"><span class="meta-label">Period:</span><span class="meta-value">${esc(period)}</span></div>`);
  if (preparedBy) h.push(`<div class="meta-item"><span class="meta-label">Prepared By:</span><span class="meta-value">${esc(preparedBy)}</span></div>`);
  if (date) h.push(`<div class="meta-item"><span class="meta-label">Date:</span><span class="meta-value">${esc(date)}</span></div>`);
  h.push('</div>');

  // Render budget table (reused for income & expenses)
  const renderTable = (heading: string, items: BudgetLineItem[], totB: number, totA: number) => {
    h.push(`<h2>${heading}</h2><table><thead><tr><th>Category</th><th>Budgeted</th><th>Actual</th><th>Variance</th><th>Var %</th></tr></thead><tbody>`);
    for (const it of items) {
      const v = calcVariance(it.budgeted, it.actual), cls = v.amount >= 0 ? 'positive' : 'negative';
      h.push(`<tr><td>${esc(it.category)}</td><td>${esc(it.budgeted)}</td><td>${esc(it.actual)}</td><td class="${cls}">${fmtCurrency(v.amount)}</td><td class="${cls}">${v.pct.toFixed(1)}%</td></tr>`);
    }
    h.push(`<tr class="total-row"><td><strong>Total ${heading}</strong></td><td>${fmtCurrency(totB)}</td><td>${fmtCurrency(totA)}</td><td>${fmtCurrency(totB - totA)}</td><td></td></tr></tbody></table>`);
  };
  renderTable('Income', income, tIB, tIA);
  renderTable('Expenses', expenses, tEB, tEA);

  // Net surplus/deficit banner
  const bannerCls = netA >= 0 ? 'net-banner net-surplus' : 'net-banner net-deficit';
  h.push(`<div class="${bannerCls}">${netA >= 0 ? 'Net Surplus' : 'Net Deficit'}: ${fmtCurrency(netA)} (Budgeted: ${fmtCurrency(netB)})</div>`);

  // Missions giving
  if (missions.length > 0) {
    h.push('<h2>Missions Giving</h2><div class="missions-list">');
    let missionsTotal = 0;
    for (const m of missions) {
      h.push(`<div class="missions-item"><span>${esc(m.organization)}</span><span>${esc(m.amount)}</span></div>`);
      missionsTotal += parseNum(m.amount);
    }
    h.push(`<div class="missions-item"><span>Total Missions</span><span>${fmtCurrency(missionsTotal)}</span></div>`);
    h.push('</div>');
  }

  // Building fund progress bar
  if (buildingFund) {
    const goal = parseNum(buildingFund.goal);
    const current = parseNum(buildingFund.current);
    const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
    h.push('<h2>Building Fund</h2>');
    h.push(`<div class="fund-progress"><div class="fund-bar" style="width:${pct.toFixed(1)}%"></div><div class="fund-label">${pct.toFixed(1)}%</div></div>`);
    h.push(`<div class="fund-info"><span>Current: ${esc(buildingFund.current)}</span><span>Goal: ${esc(buildingFund.goal)}</span></div>`);
  }

  // Staff compensation
  if (staff.length > 0) {
    h.push('<h2>Staff Compensation</h2>');
    h.push('<table><thead><tr><th>Position</th><th>Budgeted</th><th>Actual</th><th>Variance</th></tr></thead><tbody>');
    for (const s of staff) {
      const v = calcVariance(s.budgeted, s.actual);
      const cls = v.amount >= 0 ? 'positive' : 'negative';
      h.push(`<tr><td>${esc(s.position)}</td><td>${esc(s.budgeted)}</td><td>${esc(s.actual)}</td><td class="${cls}">${fmtCurrency(v.amount)}</td></tr>`);
    }
    h.push('</tbody></table>');
  }

  if (notes) h.push(`<div class="notes"><strong>Notes:</strong> ${esc(notes)}</div>`);

  h.push('</body></html>');
  return h.join('\n');
}

// --- TOOL DEFINITION ---

export const churchBudgetTool: UnifiedTool = {
  name: 'create_church_budget',
  description: `Generate church budget reports with income, expenses, missions giving, and building fund tracking.

Use this when:
- User needs to create a church or ministry budget report
- User wants to track income and expenses for a religious organization
- User needs financial reporting with missions giving breakdowns
- User wants to visualize building fund progress

Returns a complete budget report with income/expense tables, variance analysis, net surplus/deficit, missions giving, building fund progress, and staff compensation.`,
  parameters: {
    type: 'object',
    properties: {
      church_name: { type: 'string', description: 'Church or ministry name' },
      fiscal_year: { type: 'string', description: 'Fiscal year (e.g., "2026")' },
      income: {
        type: 'array', description: 'Income line items',
        items: {
          type: 'object', required: ['category', 'budgeted', 'actual'],
          properties: {
            category: { type: 'string', description: 'Income category (e.g., "Tithes & Offerings")' },
            budgeted: { type: 'string', description: 'Budgeted amount (e.g., "$50,000")' },
            actual: { type: 'string', description: 'Actual amount received' },
          },
        },
      },
      expenses: {
        type: 'array', description: 'Expense line items',
        items: {
          type: 'object', required: ['category', 'budgeted', 'actual'],
          properties: {
            category: { type: 'string', description: 'Expense category (e.g., "Utilities")' },
            budgeted: { type: 'string', description: 'Budgeted amount' },
            actual: { type: 'string', description: 'Actual amount spent' },
          },
        },
      },
      prepared_by: { type: 'string', description: 'Name of person who prepared the report' },
      date: { type: 'string', description: 'Report date' },
      period: { type: 'string', description: 'Reporting period (e.g., "January - March 2026")' },
      notes: { type: 'string', description: 'Additional notes' },
      missions_giving: {
        type: 'array', description: 'Missions and outreach giving',
        items: {
          type: 'object', properties: { organization: { type: 'string' }, amount: { type: 'string' } },
          required: ['organization', 'amount'],
        },
      },
      building_fund: {
        type: 'object', description: 'Building fund goal and progress',
        properties: { goal: { type: 'string' }, current: { type: 'string' } },
      },
      staff_compensation: {
        type: 'array', description: 'Staff compensation breakdown',
        items: {
          type: 'object', required: ['position', 'budgeted', 'actual'],
          properties: { position: { type: 'string' }, budgeted: { type: 'string' }, actual: { type: 'string' } },
        },
      },
      format: { type: 'string', enum: ['markdown', 'html'], description: 'Output format. Default: "markdown"' },
    },
    required: ['church_name', 'fiscal_year', 'income', 'expenses'],
  },
};

// --- AVAILABILITY CHECK ---

export function isChurchBudgetAvailable(): boolean {
  return true;
}

// --- TOOL EXECUTOR ---

export async function executeChurchBudget(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    church_name: string;
    fiscal_year: string;
    income: BudgetLineItem[];
    expenses: BudgetLineItem[];
    prepared_by?: string;
    date?: string;
    period?: string;
    notes?: string;
    missions_giving?: MissionGiving[];
    building_fund?: BuildingFund;
    staff_compensation?: StaffCompensation[];
    format?: 'markdown' | 'html';
  };

  if (!args.church_name?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: church_name parameter is required', isError: true };
  }
  if (!args.fiscal_year?.trim()) {
    return { toolCallId: toolCall.id, content: 'Error: fiscal_year parameter is required', isError: true };
  }
  if (!Array.isArray(args.income) || args.income.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: income array is required and must not be empty', isError: true };
  }
  if (!Array.isArray(args.expenses) || args.expenses.length === 0) {
    return { toolCallId: toolCall.id, content: 'Error: expenses array is required and must not be empty', isError: true };
  }

  for (let i = 0; i < args.income.length; i++) {
    const it = args.income[i];
    if (!it.category || !it.budgeted || !it.actual) return { toolCallId: toolCall.id, content: `Error: income item at index ${i} is missing required fields (category, budgeted, actual)`, isError: true };
  }
  for (let i = 0; i < args.expenses.length; i++) {
    const it = args.expenses[i];
    if (!it.category || !it.budgeted || !it.actual) return { toolCallId: toolCall.id, content: `Error: expense item at index ${i} is missing required fields (category, budgeted, actual)`, isError: true };
  }
  if (args.missions_giving) {
    for (let i = 0; i < args.missions_giving.length; i++) {
      const m = args.missions_giving[i];
      if (!m.organization || !m.amount) return { toolCallId: toolCall.id, content: `Error: missions_giving entry at index ${i} is missing required fields (organization, amount)`, isError: true };
    }
  }
  if (args.staff_compensation) {
    for (let i = 0; i < args.staff_compensation.length; i++) {
      const s = args.staff_compensation[i];
      if (!s.position || !s.budgeted || !s.actual) return { toolCallId: toolCall.id, content: `Error: staff_compensation entry at index ${i} is missing required fields (position, budgeted, actual)`, isError: true };
    }
  }

  const fmt = args.format ?? 'markdown';
  const preparedBy = args.prepared_by ?? '';
  const date = args.date ?? '';
  const period = args.period ?? '';
  const notes = args.notes ?? '';
  const missions = args.missions_giving ?? [];
  const staff = args.staff_compensation ?? [];
  const totalIncomeActual = sumLines(args.income, 'actual');
  const totalExpActual = sumLines(args.expenses, 'actual');
  const netActual = totalIncomeActual - totalExpActual;

  try {
    const formatted = fmt === 'html'
      ? formatHtml(args.church_name, args.fiscal_year, preparedBy, date, period, notes, args.income, args.expenses, missions, args.building_fund, staff)
      : formatMarkdown(args.church_name, args.fiscal_year, preparedBy, date, period, notes, args.income, args.expenses, missions, args.building_fund, staff);

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Church budget report created: ${args.church_name} (${args.fiscal_year})`,
        format: fmt,
        formatted_output: formatted,
        summary: {
          church_name: args.church_name,
          fiscal_year: args.fiscal_year,
          period: period || null,
          income_categories: args.income.length,
          expense_categories: args.expenses.length,
          total_income: fmtCurrency(totalIncomeActual),
          total_expenses: fmtCurrency(totalExpActual),
          net_result: fmtCurrency(netActual),
          net_status: netActual >= 0 ? 'surplus' : 'deficit',
          missions_partners: missions.length,
          has_building_fund: !!args.building_fund,
          staff_positions: staff.length,
        },
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating church budget report: ${(error as Error).message}`,
      isError: true,
    };
  }
}
