/**
 * CHART RENDERER
 * Renders bar, line, and pie charts as PNG images using @napi-rs/canvas.
 * Used by the spreadsheet generator to embed charts in Excel files.
 */

import { createCanvas } from '@napi-rs/canvas';

// ── Types ──────────────────────────────────────────────────────────

export interface ChartDataSeries {
  label: string;
  values: number[];
  color?: string; // Hex color
}

export interface ChartConfig {
  type: 'bar' | 'line' | 'pie';
  title?: string;
  categories: string[]; // X-axis labels (or pie slice labels)
  series: ChartDataSeries[];
  width?: number; // Default 600
  height?: number; // Default 400
  showLegend?: boolean;
  showValues?: boolean;
  colors?: string[]; // Custom color palette
}

// ── Constants ──────────────────────────────────────────────────────

const DEFAULT_COLORS = [
  '#4472C4',
  '#ED7D31',
  '#A5A5A5',
  '#FFC000',
  '#5B9BD5',
  '#70AD47',
  '#264478',
  '#9B57A0',
  '#636363',
  '#EB7E30',
];

const CHART_PADDING = { top: 50, right: 30, bottom: 60, left: 70 };
const TITLE_FONT = 'bold 14px sans-serif';
const LABEL_FONT = '10px sans-serif';

// ── Main Entry ─────────────────────────────────────────────────────

/**
 * Render a chart to a PNG buffer.
 */
export function renderChart(config: ChartConfig): Buffer {
  const width = config.width || 600;
  const height = config.height || 400;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Title
  if (config.title) {
    ctx.font = TITLE_FONT;
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, width / 2, 30);
  }

  const colors = config.colors || DEFAULT_COLORS;

  switch (config.type) {
    case 'bar':
      renderBarChart(ctx, config, width, height, colors);
      break;
    case 'line':
      renderLineChart(ctx, config, width, height, colors);
      break;
    case 'pie':
      renderPieChart(ctx, config, width, height, colors);
      break;
  }

  // Legend
  if (config.showLegend !== false && config.series.length > 1) {
    renderLegend(ctx, config.series, width, colors);
  }

  return Buffer.from(canvas.toBuffer('image/png'));
}

// ── Bar Chart ──────────────────────────────────────────────────────

function renderBarChart(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  config: ChartConfig,
  width: number,
  height: number,
  colors: string[]
): void {
  const { categories, series, showValues } = config;
  const chartLeft = CHART_PADDING.left;
  const chartRight = width - CHART_PADDING.right;
  const chartTop = CHART_PADDING.top;
  const chartBottom = height - CHART_PADDING.bottom;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // Find max value for scale
  const allValues = series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 1);
  const niceMax = niceRound(maxVal);

  // Draw axes
  drawAxes(ctx, chartLeft, chartTop, chartRight, chartBottom, niceMax);

  // Draw gridlines
  drawGridlines(ctx, chartLeft, chartTop, chartRight, chartBottom, niceMax);

  // Draw bars
  const groupCount = categories.length;
  const seriesCount = series.length;
  const groupWidth = chartWidth / groupCount;
  const barPadding = groupWidth * 0.15;
  const barGroupWidth = groupWidth - barPadding * 2;
  const barWidth = barGroupWidth / seriesCount;

  for (let si = 0; si < seriesCount; si++) {
    const s = series[si];
    ctx.fillStyle = s.color || colors[si % colors.length];

    for (let ci = 0; ci < categories.length; ci++) {
      const val = s.values[ci] || 0;
      const barHeight = (val / niceMax) * chartHeight;
      const x = chartLeft + ci * groupWidth + barPadding + si * barWidth;
      const y = chartBottom - barHeight;

      ctx.fillRect(x, y, barWidth - 1, barHeight);

      // Value labels
      if (showValues) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(val), x + barWidth / 2, y - 4);
        ctx.fillStyle = s.color || colors[si % colors.length];
      }
    }
  }

  // X-axis labels
  drawCategoryLabels(ctx, categories, chartLeft, chartBottom, groupWidth);
}

// ── Line Chart ─────────────────────────────────────────────────────

function renderLineChart(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  config: ChartConfig,
  width: number,
  height: number,
  colors: string[]
): void {
  const { categories, series, showValues } = config;
  const chartLeft = CHART_PADDING.left;
  const chartRight = width - CHART_PADDING.right;
  const chartTop = CHART_PADDING.top;
  const chartBottom = height - CHART_PADDING.bottom;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const allValues = series.flatMap((s) => s.values);
  const maxVal = Math.max(...allValues, 1);
  const niceMax = niceRound(maxVal);

  drawAxes(ctx, chartLeft, chartTop, chartRight, chartBottom, niceMax);
  drawGridlines(ctx, chartLeft, chartTop, chartRight, chartBottom, niceMax);

  const pointCount = categories.length;
  const xStep = pointCount > 1 ? chartWidth / (pointCount - 1) : chartWidth;

  for (let si = 0; si < series.length; si++) {
    const s = series[si];
    const color = s.color || colors[si % colors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let ci = 0; ci < pointCount; ci++) {
      const val = s.values[ci] || 0;
      const x = pointCount > 1 ? chartLeft + ci * xStep : chartLeft + chartWidth / 2;
      const y = chartBottom - (val / niceMax) * chartHeight;
      if (ci === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw dots
    ctx.fillStyle = color;
    for (let ci = 0; ci < pointCount; ci++) {
      const val = s.values[ci] || 0;
      const x = pointCount > 1 ? chartLeft + ci * xStep : chartLeft + chartWidth / 2;
      const y = chartBottom - (val / niceMax) * chartHeight;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (showValues) {
        ctx.font = LABEL_FONT;
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(val), x, y - 10);
        ctx.fillStyle = color;
      }
    }
  }

  drawCategoryLabels(ctx, categories, chartLeft, chartBottom, pointCount > 1 ? xStep : chartWidth);
}

// ── Pie Chart ──────────────────────────────────────────────────────

function renderPieChart(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  config: ChartConfig,
  width: number,
  height: number,
  colors: string[]
): void {
  const { categories, series, showValues } = config;
  const values = series[0]?.values || [];
  const total = values.reduce((a, b) => a + b, 0) || 1;

  const centerX = width / 2;
  const centerY = height / 2 + 10;
  const radius = Math.min(width, height) * 0.33;

  let startAngle = -Math.PI / 2;

  for (let i = 0; i < values.length; i++) {
    const sliceAngle = (values[i] / total) * Math.PI * 2;
    const color = colors[i % colors.length];

    // Slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    const midAngle = startAngle + sliceAngle / 2;
    const labelRadius = radius * 1.25;
    const labelX = centerX + Math.cos(midAngle) * labelRadius;
    const labelY = centerY + Math.sin(midAngle) * labelRadius;
    const percent = Math.round((values[i] / total) * 100);

    ctx.font = LABEL_FONT;
    ctx.fillStyle = '#333333';
    ctx.textAlign = midAngle > Math.PI / 2 && midAngle < (3 * Math.PI) / 2 ? 'right' : 'left';
    const label = categories[i] || `Slice ${i + 1}`;
    const displayText = showValues ? `${label} (${percent}%)` : label;
    ctx.fillText(displayText, labelX, labelY);

    startAngle += sliceAngle;
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function drawAxes(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  left: number,
  top: number,
  right: number,
  bottom: number,
  _maxVal: number
): void {
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.stroke();
}

function drawGridlines(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  left: number,
  top: number,
  right: number,
  bottom: number,
  maxVal: number
): void {
  const steps = 5;
  const chartHeight = bottom - top;

  ctx.strokeStyle = '#E8E8E8';
  ctx.lineWidth = 0.5;
  ctx.font = LABEL_FONT;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'right';

  for (let i = 0; i <= steps; i++) {
    const y = bottom - (i / steps) * chartHeight;
    const val = (i / steps) * maxVal;

    // Gridline
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    // Y-axis label
    ctx.fillText(formatNumber(val), left - 6, y + 4);
  }
}

function drawCategoryLabels(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  categories: string[],
  chartLeft: number,
  chartBottom: number,
  step: number
): void {
  ctx.font = LABEL_FONT;
  ctx.fillStyle = '#666666';
  ctx.textAlign = 'center';

  for (let i = 0; i < categories.length; i++) {
    const x = chartLeft + i * step + step / 2;
    const label = categories[i].length > 12 ? categories[i].substring(0, 11) + '…' : categories[i];
    ctx.fillText(label, x, chartBottom + 16);
  }
}

function renderLegend(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  series: ChartDataSeries[],
  width: number,
  colors: string[]
): void {
  ctx.font = LABEL_FONT;
  const totalWidth = series.reduce((w, s) => w + ctx.measureText(s.label).width + 30, 0);
  let x = (width - totalWidth) / 2;
  const y = 42;

  for (let i = 0; i < series.length; i++) {
    const color = series[i].color || colors[i % colors.length];
    ctx.fillStyle = color;
    ctx.fillRect(x, y - 6, 12, 12);
    ctx.fillStyle = '#333333';
    ctx.fillText(series[i].label, x + 16, y + 4);
    x += ctx.measureText(series[i].label).width + 30;
  }
}

function niceRound(val: number): number {
  if (val <= 0) return 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
  const normalized = val / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function formatNumber(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}
