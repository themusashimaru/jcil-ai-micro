import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeChart, isChartAvailable, chartTool } from './chart-tool';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'create_chart', arguments: args };
}

beforeEach(() => {
  mockFetch.mockReset();
  // Default: QuickChart API returns OK
  mockFetch.mockResolvedValue({ ok: true, status: 200 });
});

function basicChartArgs(overrides?: Record<string, unknown>) {
  return {
    chart_type: 'bar',
    labels: ['A', 'B', 'C'],
    datasets: [{ data: [10, 20, 30], label: 'Sales' }],
    ...overrides,
  };
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('chartTool metadata', () => {
  it('should have correct name', () => {
    expect(chartTool.name).toBe('create_chart');
  });

  it('should require chart_type, labels, datasets', () => {
    expect(chartTool.parameters.required).toContain('chart_type');
    expect(chartTool.parameters.required).toContain('labels');
    expect(chartTool.parameters.required).toContain('datasets');
  });
});

describe('isChartAvailable', () => {
  it('should return true', () => {
    expect(isChartAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// Chart creation
// -------------------------------------------------------------------
describe('executeChart - creation', () => {
  it('should create bar chart', async () => {
    const res = await executeChart(makeCall(basicChartArgs()));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Bar chart');
    expect(res.content).toContain('1 dataset');
    expect(res.content).toContain('3 data points');
  });

  it('should create line chart', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ chart_type: 'line' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Line chart');
  });

  it('should create pie chart', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ chart_type: 'pie' })));
    expect(res.isError).toBeFalsy();
    expect(res.content).toContain('Pie chart');
  });

  it('should include title in output', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ title: 'My Chart' })));
    expect(res.content).toContain('**My Chart**');
  });

  it('should support multiple datasets', async () => {
    const res = await executeChart(
      makeCall(
        basicChartArgs({
          datasets: [
            { data: [10, 20, 30], label: 'Sales' },
            { data: [5, 15, 25], label: 'Costs' },
          ],
        })
      )
    );
    expect(res.content).toContain('2 dataset');
  });

  it('should accept custom width and height', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ width: 800, height: 600 })));
    expect(res.isError).toBeFalsy();
  });

  it('should support doughnut chart', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ chart_type: 'doughnut' })));
    expect(res.content).toContain('Doughnut chart');
  });

  it('should support radar chart', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ chart_type: 'radar' })));
    expect(res.content).toContain('Radar chart');
  });

  it('should support scatter chart', async () => {
    const res = await executeChart(makeCall(basicChartArgs({ chart_type: 'scatter' })));
    expect(res.content).toContain('Scatter chart');
  });

  it('should support custom dataset colors', async () => {
    const res = await executeChart(
      makeCall(
        basicChartArgs({
          datasets: [{ data: [10, 20], label: 'X', color: '#FF0000' }],
        })
      )
    );
    expect(res.isError).toBeFalsy();
  });
});

// -------------------------------------------------------------------
// QuickChart API failure
// -------------------------------------------------------------------
describe('executeChart - API failure', () => {
  it('should error when QuickChart returns non-OK', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await executeChart(makeCall(basicChartArgs()));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('failed');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    const res = await executeChart(makeCall(basicChartArgs()));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeChart - validation', () => {
  it('should error without chart_type', async () => {
    const res = await executeChart(makeCall({ labels: ['A'], datasets: [{ data: [1] }] }));
    expect(res.isError).toBe(true);
  });

  it('should error without labels', async () => {
    const res = await executeChart(makeCall({ chart_type: 'bar', datasets: [{ data: [1] }] }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty labels', async () => {
    const res = await executeChart(
      makeCall({ chart_type: 'bar', labels: [], datasets: [{ data: [1] }] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without datasets', async () => {
    const res = await executeChart(makeCall({ chart_type: 'bar', labels: ['A'] }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty datasets', async () => {
    const res = await executeChart(makeCall({ chart_type: 'bar', labels: ['A'], datasets: [] }));
    expect(res.isError).toBe(true);
  });

  it('should error if dataset missing data array', async () => {
    const res = await executeChart(
      makeCall({ chart_type: 'bar', labels: ['A'], datasets: [{ label: 'X' }] })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Dataset 1');
  });

  it('should error for wrong tool name', async () => {
    const res = await executeChart({
      id: 'test',
      name: 'wrong_chart',
      arguments: basicChartArgs(),
    });
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeChart - errors', () => {
  it('should return toolCallId', async () => {
    const res = await executeChart({
      id: 'my-id',
      name: 'create_chart',
      arguments: basicChartArgs(),
    });
    expect(res.toolCallId).toBe('my-id');
  });

  it('should handle string arguments', async () => {
    const res = await executeChart({
      id: 'test',
      name: 'create_chart',
      arguments: JSON.stringify(basicChartArgs()),
    });
    expect(res.isError).toBeFalsy();
  });
});
