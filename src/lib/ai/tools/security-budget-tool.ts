/**
 * SECURITY BUDGET TOOL
 * Security program budgeting
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const BUDGET_CATEGORIES = {
  People: { percentage: '40-50%', items: ['Salaries', 'Training', 'Consultants', 'Contractors'] },
  Technology: { percentage: '30-40%', items: ['Tools', 'Licenses', 'Infrastructure', 'Cloud'] },
  Process: { percentage: '10-15%', items: ['Assessments', 'Audits', 'Certifications'] },
  Response: { percentage: '5-10%', items: ['Insurance', 'IR retainer', 'Legal', 'PR'] }
};

const BENCHMARKS = {
  Average: { ITBudgetPercent: '5-10%', perEmployee: '$1000-3000', perEndpoint: '$100-500' },
  HighRisk: { ITBudgetPercent: '10-15%', perEmployee: '$3000-5000', perEndpoint: '$300-800' },
  Regulated: { ITBudgetPercent: '12-18%', perEmployee: '$4000-8000', perEndpoint: '$500-1000' }
};

function calculateBudget(employees: number, industry: string): { recommendedBudget: number; allocation: Record<string, number> } {
  const perEmployee = industry === 'finance' || industry === 'healthcare' ? 5000 : 2000;
  const recommendedBudget = employees * perEmployee;
  return { recommendedBudget, allocation: { people: recommendedBudget * 0.45, technology: recommendedBudget * 0.35, process: recommendedBudget * 0.12, response: recommendedBudget * 0.08 } };
}

export const securityBudgetTool: UnifiedTool = {
  name: 'security_budget',
  description: 'Security budget: categories, benchmarks, calculate',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['categories', 'benchmarks', 'calculate'] }, employees: { type: 'number' }, industry: { type: 'string' } }, required: ['operation'] },
};

export async function executeSecurityBudget(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'categories': result = { budget_categories: BUDGET_CATEGORIES }; break;
      case 'benchmarks': result = { benchmarks: BENCHMARKS }; break;
      case 'calculate': result = calculateBudget(args.employees || 1000, args.industry || 'general'); break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSecurityBudgetAvailable(): boolean { return true; }
