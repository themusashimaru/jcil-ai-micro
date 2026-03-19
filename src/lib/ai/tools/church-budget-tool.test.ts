import { describe, it, expect } from 'vitest';
import {
  executeChurchBudget,
  isChurchBudgetAvailable,
  churchBudgetTool,
} from './church-budget-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_church_budget', arguments: args };
}

function basicArgs(overrides?: Record<string, unknown>) {
  return {
    church_name: 'Grace Community Church',
    fiscal_year: '2026',
    income: [
      { category: 'Tithes & Offerings', budgeted: '$250,000', actual: '$245,000' },
      { category: 'Building Fund Donations', budgeted: '$50,000', actual: '$48,000' },
    ],
    expenses: [
      { category: 'Staff Salaries', budgeted: '$120,000', actual: '$118,500' },
      { category: 'Facility Maintenance', budgeted: '$30,000', actual: '$32,000' },
    ],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('churchBudgetTool metadata', () => {
  it('should have correct name', () => {
    expect(churchBudgetTool.name).toBe('create_church_budget');
  });

  it('should have a description', () => {
    expect(churchBudgetTool.description).toBeTruthy();
  });

  it('should require church_name, fiscal_year, income, expenses', () => {
    expect(churchBudgetTool.parameters.required).toContain('church_name');
    expect(churchBudgetTool.parameters.required).toContain('fiscal_year');
    expect(churchBudgetTool.parameters.required).toContain('income');
    expect(churchBudgetTool.parameters.required).toContain('expenses');
  });
});

describe('isChurchBudgetAvailable', () => {
  it('should return true', () => {
    expect(isChurchBudgetAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Execution — valid input
// -------------------------------------------------------------------
describe('executeChurchBudget - creation', () => {
  it('should create church budget with valid input', async () => {
    const res = await executeChurchBudget(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Grace Community Church');
    expect(res.content).toContain('2026');
  });

  it('should include income categories', async () => {
    const res = await executeChurchBudget(makeCall(basicArgs()));
    expect(res.content).toContain('Tithes');
  });

  it('should include expense categories', async () => {
    const res = await executeChurchBudget(makeCall(basicArgs()));
    expect(res.content).toContain('Staff Salaries');
  });

  it('should support html format', async () => {
    const res = await executeChurchBudget(makeCall(basicArgs({ format: 'html' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('<');
  });

  it('should default to markdown format', async () => {
    const res = await executeChurchBudget(makeCall(basicArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('#');
  });

  it('should return toolCallId', async () => {
    const res = await executeChurchBudget({
      id: 'my-id',
      name: 'create_church_budget',
      arguments: basicArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });
});

// -------------------------------------------------------------------
// Validation — missing fields
// -------------------------------------------------------------------
describe('executeChurchBudget - validation', () => {
  it('should error without church_name', async () => {
    const res = await executeChurchBudget(
      makeCall({ fiscal_year: '2026', income: [], expenses: [] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without fiscal_year', async () => {
    const res = await executeChurchBudget(
      makeCall({ church_name: 'Test Church', income: [], expenses: [] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error with empty arguments', async () => {
    const res = await executeChurchBudget({
      id: 'test',
      name: 'create_church_budget',
      arguments: {},
    });
    expect(res.isError).toBe(true);
  });
});
