/**
 * DATA VISUALIZATION TOOL
 * Create ASCII charts and data visualizations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DataPoint { label: string; value: number; }
interface Series { name: string; data: number[]; }

function barChart(data: DataPoint[], width: number = 40): string {
  const maxVal = Math.max(...data.map(d => d.value));
  const maxLabelLen = Math.max(...data.map(d => d.label.length));
  const lines: string[] = [];
  for (const d of data) {
    const barLen = Math.floor((d.value / maxVal) * width);
    const bar = '█'.repeat(barLen) + '░'.repeat(width - barLen);
    lines.push(`${d.label.padEnd(maxLabelLen)} │${bar}│ ${d.value}`);
  }
  return lines.join('\n');
}

function horizontalBarChart(data: DataPoint[], width: number = 50): string {
  const maxVal = Math.max(...data.map(d => d.value));
  const lines: string[] = [];
  lines.push('┌' + '─'.repeat(width + 2) + '┐');
  for (const d of data) {
    const barLen = Math.floor((d.value / maxVal) * width);
    lines.push(`│ ${d.label.padEnd(10).slice(0, 10)} ${'█'.repeat(barLen)}${' '.repeat(width - barLen - 10)} │`);
  }
  lines.push('└' + '─'.repeat(width + 2) + '┘');
  return lines.join('\n');
}
void horizontalBarChart; // Available for boxed charts

function lineChart(series: Series[], width: number = 60, height: number = 15): string {
  const allData = series.flatMap(s => s.data);
  const minVal = Math.min(...allData);
  const maxVal = Math.max(...allData);
  const range = maxVal - minVal || 1;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));
  const symbols = ['*', '+', 'o', 'x', '#'];
  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const symbol = symbols[si % symbols.length];
    for (let i = 0; i < s.data.length; i++) {
      const x = Math.floor((i / (s.data.length - 1)) * (width - 1));
      const y = height - 1 - Math.floor(((s.data[i] - minVal) / range) * (height - 1));
      if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = symbol;
    }
  }
  const lines: string[] = [];
  lines.push(`${maxVal.toFixed(1).padStart(8)} ┤${grid[0].join('')}`);
  for (let i = 1; i < height - 1; i++) lines.push(`${''.padStart(8)} │${grid[i].join('')}`);
  lines.push(`${minVal.toFixed(1).padStart(8)} ┤${grid[height - 1].join('')}`);
  lines.push(`${''.padStart(9)}└${'─'.repeat(width)}`);
  if (series.length > 1) lines.push(`Legend: ${series.map((s, i) => `${symbols[i]}=${s.name}`).join(' ')}`);
  return lines.join('\n');
}

function pieChart(data: DataPoint[], radius: number = 8): string {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const symbols = ['█', '▓', '▒', '░', '▪', '◆', '○', '●'];
  const size = radius * 2 + 1;
  const grid: string[][] = Array(size).fill(null).map(() => Array(size * 2).fill(' '));
  let currentAngle = 0;
  const slices: Array<{ start: number; end: number; symbol: string; label: string }> = [];
  data.forEach((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    slices.push({ start: currentAngle, end: currentAngle + angle, symbol: symbols[i % symbols.length], label: d.label });
    currentAngle += angle;
  });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size * 2; x++) {
      const dx = (x / 2) - radius;
      const dy = y - radius;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        let angle = Math.atan2(dy, dx);
        if (angle < 0) angle += 2 * Math.PI;
        for (const slice of slices) {
          if (angle >= slice.start && angle < slice.end) {
            grid[y][x] = slice.symbol;
            break;
          }
        }
      }
    }
  }
  const chart = grid.map(row => row.join('')).join('\n');
  const legend = slices.map(s => `${s.symbol} ${s.label}`).join('  ');
  return chart + '\n\n' + legend;
}

function sparkline(data: number[], width: number = 20): string {
  const chars = '▁▂▃▄▅▆▇█';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = Math.ceil(data.length / width);
  const sampled = [];
  for (let i = 0; i < data.length; i += step) sampled.push(data[i]);
  return sampled.map(v => chars[Math.floor(((v - min) / range) * (chars.length - 1))]).join('');
}

function histogram(data: number[], bins: number = 10, width: number = 30): string {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / bins;
  const counts: number[] = new Array(bins).fill(0);
  for (const v of data) {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    counts[binIndex]++;
  }
  const maxCount = Math.max(...counts);
  const lines: string[] = [];
  for (let i = 0; i < bins; i++) {
    const barLen = Math.floor((counts[i] / maxCount) * width);
    const rangeStart = (min + i * binWidth).toFixed(1);
    const rangeEnd = (min + (i + 1) * binWidth).toFixed(1);
    lines.push(`${rangeStart.padStart(6)}-${rangeEnd.padEnd(6)} │${'█'.repeat(barLen)}${' '.repeat(width - barLen)}│ ${counts[i]}`);
  }
  return lines.join('\n');
}

function scatterPlot(xData: number[], yData: number[], width: number = 40, height: number = 20): string {
  const minX = Math.min(...xData), maxX = Math.max(...xData);
  const minY = Math.min(...yData), maxY = Math.max(...yData);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));
  for (let i = 0; i < xData.length; i++) {
    const x = Math.floor(((xData[i] - minX) / rangeX) * (width - 1));
    const y = height - 1 - Math.floor(((yData[i] - minY) / rangeY) * (height - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) grid[y][x] = '●';
  }
  const lines: string[] = [];
  lines.push(`${maxY.toFixed(1).padStart(8)} ┤${grid[0].join('')}`);
  for (let i = 1; i < height - 1; i++) lines.push(`${''.padStart(8)} │${grid[i].join('')}`);
  lines.push(`${minY.toFixed(1).padStart(8)} ┤${grid[height - 1].join('')}`);
  lines.push(`${''.padStart(9)}└${'─'.repeat(width)}`);
  lines.push(`${''.padStart(9)}${minX.toFixed(1)}${' '.repeat(width - 10)}${maxX.toFixed(1)}`);
  return lines.join('\n');
}

function table(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] || '').length)));
  const sep = '┼' + colWidths.map(w => '─'.repeat(w + 2)).join('┼') + '┼';
  const lines: string[] = [];
  lines.push('┌' + colWidths.map(w => '─'.repeat(w + 2)).join('┬') + '┐');
  lines.push('│ ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' │ ') + ' │');
  lines.push(sep);
  for (const row of rows) {
    lines.push('│ ' + row.map((c, i) => (c || '').padEnd(colWidths[i])).join(' │ ') + ' │');
  }
  lines.push('└' + colWidths.map(w => '─'.repeat(w + 2)).join('┴') + '┘');
  return lines.join('\n');
}

export const dataVisualizationTool: UnifiedTool = {
  name: 'data_visualization',
  description: 'Data Visualization: bar, line, pie, sparkline, histogram, scatter, table',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['bar', 'line', 'pie', 'sparkline', 'histogram', 'scatter', 'table'] },
      data: { type: 'array' },
      labels: { type: 'array' },
      values: { type: 'array' },
      width: { type: 'number' },
      height: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeDataVisualization(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'bar':
        const barData = args.data || [{ label: 'A', value: 30 }, { label: 'B', value: 50 }, { label: 'C', value: 20 }, { label: 'D', value: 40 }];
        result = { chart: barChart(barData, args.width || 40) };
        break;
      case 'line':
        const lineData = args.data || [{ name: 'Series A', data: [10, 20, 15, 30, 25, 40, 35] }];
        result = { chart: lineChart(lineData, args.width || 60, args.height || 15) };
        break;
      case 'pie':
        const pieData = args.data || [{ label: 'Red', value: 30 }, { label: 'Blue', value: 25 }, { label: 'Green', value: 20 }, { label: 'Yellow', value: 25 }];
        result = { chart: pieChart(pieData) };
        break;
      case 'sparkline':
        const sparkData = args.values || [1, 5, 3, 8, 2, 9, 4, 7, 6, 3, 8, 5];
        result = { sparkline: sparkline(sparkData, args.width || 20) };
        break;
      case 'histogram':
        const histData = args.values || Array.from({ length: 100 }, () => Math.random() * 100);
        result = { chart: histogram(histData, 10, args.width || 30) };
        break;
      case 'scatter':
        const xData = args.xValues || Array.from({ length: 20 }, () => Math.random() * 100);
        const yData = args.yValues || xData.map((x: number) => x * 0.5 + Math.random() * 20);
        result = { chart: scatterPlot(xData, yData, args.width || 40, args.height || 20) };
        break;
      case 'table':
        const headers = args.headers || ['Name', 'Value', 'Status'];
        const rows = args.rows || [['Item A', '100', 'Active'], ['Item B', '200', 'Pending'], ['Item C', '150', 'Active']];
        result = { table: table(headers, rows) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDataVisualizationAvailable(): boolean { return true; }
