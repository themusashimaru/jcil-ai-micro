/**
 * DATA VISUALIZATION / CHART TOOL
 *
 * Generates charts and graphs from data using QuickChart.io API.
 * Returns images that can be displayed in chat.
 *
 * Features:
 * - Line charts, bar charts, pie charts, and more
 * - Custom colors and styling
 * - Serverless-compatible (uses external API)
 * - Returns chart as image URL or base64
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('ChartTool');

// ============================================================================
// CONFIGURATION
// ============================================================================

const QUICKCHART_API = 'https://quickchart.io/chart';
const FETCH_TIMEOUT_MS = 15000;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const chartTool: UnifiedTool = {
  name: 'create_chart',
  description: `Create visual charts and graphs from data. Use this when:
- User asks to visualize data
- Creating comparisons between values
- Showing trends over time
- Making pie charts for distributions
- User says "show me a chart of..." or "graph this data"

Chart types available:
- line: Line chart for trends over time
- bar: Bar chart for comparisons
- pie: Pie chart for proportions
- doughnut: Like pie but with hole in center
- radar: Spider/radar chart
- scatter: Scatter plot for correlations

Returns an image URL that can be displayed.`,
  parameters: {
    type: 'object',
    properties: {
      chart_type: {
        type: 'string',
        description: 'Type of chart to create',
        enum: ['line', 'bar', 'pie', 'doughnut', 'radar', 'scatter', 'horizontalBar'],
      },
      title: {
        type: 'string',
        description: 'Chart title',
      },
      labels: {
        type: 'array',
        items: { type: 'string' },
        description: 'Labels for x-axis or pie slices (e.g., ["Jan", "Feb", "Mar"])',
      },
      datasets: {
        type: 'array',
        description:
          'Data series to plot. Each dataset should have: data (array of numbers), optional label (string for legend), optional color (e.g., "blue", "#FF5733"). Example: [{"label": "Sales", "data": [10, 20, 30], "color": "blue"}]',
        items: { type: 'object' },
      },
      width: {
        type: 'number',
        description: 'Chart width in pixels. Default: 600',
        default: 600,
      },
      height: {
        type: 'number',
        description: 'Chart height in pixels. Default: 400',
        default: 400,
      },
    },
    required: ['chart_type', 'labels', 'datasets'],
  },
};

// ============================================================================
// CHART GENERATION
// ============================================================================

interface Dataset {
  label?: string;
  data: number[];
  color?: string;
}

const DEFAULT_COLORS = [
  'rgba(54, 162, 235, 0.8)', // Blue
  'rgba(255, 99, 132, 0.8)', // Red
  'rgba(75, 192, 192, 0.8)', // Teal
  'rgba(255, 206, 86, 0.8)', // Yellow
  'rgba(153, 102, 255, 0.8)', // Purple
  'rgba(255, 159, 64, 0.8)', // Orange
  'rgba(199, 199, 199, 0.8)', // Gray
];

function buildChartConfig(
  chartType: string,
  title: string | undefined,
  labels: string[],
  datasets: Dataset[]
): object {
  // Format datasets for Chart.js
  const formattedDatasets = datasets.map((ds, index) => {
    const color = ds.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
    const borderColor = color.replace('0.8)', '1)');

    return {
      label: ds.label || `Dataset ${index + 1}`,
      data: ds.data,
      backgroundColor:
        chartType === 'line' || chartType === 'radar' || chartType === 'scatter'
          ? color.replace('0.8)', '0.2)')
          : chartType === 'pie' || chartType === 'doughnut'
            ? ds.data.map((_, i) => DEFAULT_COLORS[i % DEFAULT_COLORS.length])
            : color,
      borderColor:
        chartType === 'pie' || chartType === 'doughnut' ? ds.data.map(() => 'white') : borderColor,
      borderWidth: chartType === 'pie' || chartType === 'doughnut' ? 2 : 2,
      fill: chartType === 'line' || chartType === 'radar',
      tension: chartType === 'line' ? 0.3 : undefined,
    };
  });

  const config: Record<string, unknown> = {
    type: chartType,
    data: {
      labels,
      datasets: formattedDatasets,
    },
    options: {
      responsive: false,
      plugins: {
        title: title
          ? {
              display: true,
              text: title,
              font: { size: 16, weight: 'bold' },
            }
          : { display: false },
        legend: {
          display: datasets.length > 1 || chartType === 'pie' || chartType === 'doughnut',
          position: 'bottom',
        },
      },
      scales:
        chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'radar'
          ? {
              y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.1)' },
              },
              x: {
                grid: { display: false },
              },
            }
          : undefined,
    },
  };

  return config;
}

async function generateChart(
  chartType: string,
  title: string | undefined,
  labels: string[],
  datasets: Dataset[],
  width: number,
  height: number
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const config = buildChartConfig(chartType, title, labels, datasets);

    // Build QuickChart URL
    const chartUrl = new URL(QUICKCHART_API);
    chartUrl.searchParams.set('c', JSON.stringify(config));
    chartUrl.searchParams.set('w', width.toString());
    chartUrl.searchParams.set('h', height.toString());
    chartUrl.searchParams.set('bkg', 'white');
    chartUrl.searchParams.set('f', 'png');

    // Verify the chart renders (QuickChart validates on request)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(chartUrl.toString(), {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { success: false, error: `Chart generation failed: ${response.status}` };
    }

    return { success: true, url: chartUrl.toString() };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('aborted')) {
      return { success: false, error: 'Chart generation timed out' };
    }

    log.error('Chart generation failed', { error: errorMessage });
    return { success: false, error: `Chart generation failed: ${errorMessage}` };
  }
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeChart(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, name, arguments: rawArgs } = toolCall;

  if (name !== 'create_chart') {
    return {
      toolCallId: id,
      content: `Unknown tool: ${name}`,
      isError: true,
    };
  }

  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
  const chartType = args.chart_type as string;
  const title = args.title as string | undefined;
  const labels = args.labels as string[];
  const datasets = args.datasets as Dataset[];
  const width = (args.width as number) || 600;
  const height = (args.height as number) || 400;

  // Validation
  if (!chartType) {
    return { toolCallId: id, content: 'Chart type is required', isError: true };
  }
  if (!labels || !Array.isArray(labels) || labels.length === 0) {
    return { toolCallId: id, content: 'Labels array is required', isError: true };
  }
  if (!datasets || !Array.isArray(datasets) || datasets.length === 0) {
    return { toolCallId: id, content: 'At least one dataset is required', isError: true };
  }

  // Validate datasets have data
  for (let i = 0; i < datasets.length; i++) {
    if (!datasets[i].data || !Array.isArray(datasets[i].data)) {
      return {
        toolCallId: id,
        content: `Dataset ${i + 1} must have a data array`,
        isError: true,
      };
    }
  }

  log.info('Creating chart', {
    chartType,
    title,
    labelCount: labels.length,
    datasetCount: datasets.length,
  });

  const result = await generateChart(chartType, title, labels, datasets, width, height);

  if (!result.success) {
    return {
      toolCallId: id,
      content: result.error || 'Chart generation failed',
      isError: true,
    };
  }

  log.info('Chart created successfully', { chartType, url: result.url });

  // Return markdown with the chart image
  const content = `${title ? `**${title}**\n\n` : ''}![Chart](${result.url})\n\n*${chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart with ${datasets.length} dataset(s) and ${labels.length} data points*`;

  return {
    toolCallId: id,
    content,
    isError: false,
  };
}

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isChartAvailable(): boolean {
  return true; // Always available - uses QuickChart.io
}
