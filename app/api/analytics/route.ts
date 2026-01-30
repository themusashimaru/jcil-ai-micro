/**
 * DATA ANALYTICS API
 *
 * Analyzes uploaded data files (CSV, Excel) and returns:
 * - Statistical insights (sum, avg, min, max, count)
 * - Trend detection
 * - Outlier identification
 * - Chart configurations for visualization
 *
 * @module api/analytics
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';
import type { AnalyticsResult, ChartConfig, DataInsight, ChartDataPoint } from '@/app/chat/types';

const log = logger('AnalyticsAPI');

export const runtime = 'nodejs';
export const maxDuration = 60; // Analytics can take time

interface AnalyzeRequest {
  fileName: string;
  fileType: string;
  content: string; // Base64 data URL or raw CSV text
  query?: string; // Optional natural language query
}

interface ColumnInfo {
  name: string;
  type: 'number' | 'currency' | 'percent' | 'date' | 'text';
  values: (string | number | Date | null)[];
  numericValues: number[];
  stats?: {
    sum: number;
    avg: number;
    min: number;
    max: number;
    count: number;
  };
}

/**
 * Parse CSV content into rows and columns
 */
function parseCSV(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const rows: string[][] = [];

  for (const line of lines) {
    // Handle quoted fields with commas
    const row: string[] = [];
    let inQuotes = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        // Escaped quote
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }
    row.push(currentField.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Parse Excel content into rows and columns
 */
async function parseExcel(base64Data: string): Promise<string[][]> {
  const base64Content = base64Data.replace(/^data:.*?;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const rows: string[][] = [];
  const worksheet = workbook.worksheets[0]; // Use first sheet

  if (!worksheet) {
    throw new Error('No worksheet found in Excel file');
  }

  worksheet.eachRow((row) => {
    const values = row.values as (string | number | boolean | Date | null | undefined)[];
    const cells = values.slice(1); // ExcelJS is 1-indexed

    rows.push(
      cells.map((cell) => {
        if (cell === null || cell === undefined) return '';
        if (cell instanceof Date) return cell.toISOString().split('T')[0];
        return String(cell);
      })
    );
  });

  return rows;
}

/**
 * Detect column type from values
 */
function detectColumnType(values: string[]): 'number' | 'currency' | 'percent' | 'date' | 'text' {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) return 'text';

  let numberCount = 0;
  let currencyCount = 0;
  let percentCount = 0;
  let dateCount = 0;

  for (const val of nonEmpty.slice(0, 20)) {
    // Sample first 20 rows
    // Check currency
    if (/^\$?-?[\d,]+\.?\d*$/.test(val.replace(/,/g, '')) || /^\$/.test(val)) {
      currencyCount++;
      continue;
    }

    // Check percent
    if (/^-?\d+\.?\d*%$/.test(val)) {
      percentCount++;
      continue;
    }

    // Check date
    if (/^\d{4}-\d{2}-\d{2}/.test(val) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(val)) {
      dateCount++;
      continue;
    }

    // Check number
    if (!isNaN(parseFloat(val.replace(/,/g, ''))) && isFinite(parseFloat(val.replace(/,/g, '')))) {
      numberCount++;
    }
  }

  const threshold = nonEmpty.slice(0, 20).length * 0.7;

  if (currencyCount >= threshold) return 'currency';
  if (percentCount >= threshold) return 'percent';
  if (dateCount >= threshold) return 'date';
  if (numberCount >= threshold) return 'number';
  return 'text';
}

/**
 * Parse value based on detected type
 */
function parseValue(val: string, type: string): number | null {
  if (!val || val.trim() === '') return null;

  switch (type) {
    case 'currency':
      return parseFloat(val.replace(/[$,]/g, '')) || null;
    case 'percent':
      return parseFloat(val.replace('%', '')) || null;
    case 'number':
      return parseFloat(val.replace(/,/g, '')) || null;
    default:
      return null;
  }
}

/**
 * Calculate statistics for numeric values
 */
function calculateStats(values: number[]): ColumnInfo['stats'] {
  if (values.length === 0) {
    return { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    sum,
    avg: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  };
}

/**
 * Format number for display
 */
function formatNumber(num: number, type: string = 'number'): string {
  if (type === 'currency') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(num);
  }
  if (type === 'percent') {
    return `${num.toFixed(1)}%`;
  }
  if (Math.abs(num) >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(num) >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Generate insights from column data
 */
function generateInsights(columns: ColumnInfo[]): DataInsight[] {
  const insights: DataInsight[] = [];

  // Find numeric columns with stats
  const numericCols = columns.filter((col) => col.stats && col.numericValues.length > 0);

  for (const col of numericCols) {
    if (!col.stats) continue;

    // Total/Sum insight
    if (col.type === 'currency' || col.stats.sum > 0) {
      insights.push({
        type: 'stat',
        title: `Total ${col.name}`,
        value: formatNumber(col.stats.sum, col.type),
        icon: col.type === 'currency' ? '💰' : '📊',
      });
    }

    // Average insight
    insights.push({
      type: 'stat',
      title: `Avg ${col.name}`,
      value: formatNumber(col.stats.avg, col.type),
      icon: '📉',
    });
  }

  // Row count insight
  const rowCount = columns[0]?.values.length || 0;
  insights.push({
    type: 'stat',
    title: 'Records',
    value: rowCount.toLocaleString(),
    icon: '#️⃣',
  });

  // Limit to 8 insights
  return insights.slice(0, 8);
}

/**
 * Generate chart configurations based on data
 */
function generateCharts(columns: ColumnInfo[], rows: string[][]): ChartConfig[] {
  const charts: ChartConfig[] = [];

  // Find potential category (text) and value (numeric) columns
  const textCols = columns.filter((col) => col.type === 'text' || col.type === 'date');
  const numericCols = columns.filter(
    (col) => col.type === 'number' || col.type === 'currency' || col.type === 'percent'
  );

  if (textCols.length === 0 || numericCols.length === 0) {
    // If no good category column, try to use first column as category
    if (columns.length >= 2 && numericCols.length > 0) {
      textCols.push(columns[0]);
    } else {
      return charts;
    }
  }

  // Use first text column as X-axis category
  const categoryCol = textCols[0];
  const categoryIndex = columns.indexOf(categoryCol);

  // Aggregate data by category (in case of duplicates)
  const aggregated = new Map<string, Record<string, number>>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const category = row[categoryIndex] || `Row ${i + 1}`;

    if (!aggregated.has(category)) {
      aggregated.set(category, {});
    }

    const record = aggregated.get(category)!;

    for (const numCol of numericCols.slice(0, 3)) {
      // Limit to 3 series
      const colIndex = columns.indexOf(numCol);
      const value = parseValue(row[colIndex], numCol.type);
      if (value !== null) {
        record[numCol.name] = (record[numCol.name] || 0) + value;
      }
    }
  }

  // Convert to chart data (limit to 20 categories for readability)
  const chartData: ChartDataPoint[] = [];
  const entries = Array.from(aggregated.entries()).slice(0, 20);

  for (const [name, values] of entries) {
    chartData.push({
      name: name.length > 15 ? name.slice(0, 15) + '...' : name,
      value: 0,
      ...values,
    });
  }

  if (chartData.length === 0) return charts;

  const yKeys = numericCols.slice(0, 3).map((col) => col.name);

  // Bar chart (default for categorical data)
  charts.push({
    type: 'bar',
    title: `${yKeys[0]} by ${categoryCol.name}`,
    data: chartData,
    xKey: 'name',
    yKeys,
  });

  // If data looks like time series, add line chart
  if (categoryCol.type === 'date' || /year|month|date|time|quarter/i.test(categoryCol.name)) {
    charts.push({
      type: 'line',
      title: `${yKeys[0]} Trend`,
      data: chartData,
      xKey: 'name',
      yKeys,
    });
  }

  // If few categories, add pie chart for first numeric column
  if (chartData.length <= 10 && yKeys.length > 0) {
    const pieData = chartData.map((d) => ({
      name: d.name,
      value: (d[yKeys[0]] as number) || 0,
    }));

    charts.push({
      type: 'pie',
      title: `${yKeys[0]} Distribution`,
      data: pieData,
      xKey: 'name',
      yKeys: ['value'],
    });
  }

  return charts;
}

/**
 * Generate follow-up query suggestions
 */
function generateSuggestions(columns: ColumnInfo[]): string[] {
  const suggestions: string[] = [];

  const numericCols = columns.filter(
    (col) => col.type === 'number' || col.type === 'currency' || col.type === 'percent'
  );
  const textCols = columns.filter((col) => col.type === 'text');

  if (numericCols.length > 0) {
    suggestions.push(`Show me the top 10 by ${numericCols[0].name}`);
    suggestions.push(`What's the trend over time?`);
  }

  if (textCols.length > 0 && numericCols.length > 0) {
    suggestions.push(`Compare ${numericCols[0].name} across different ${textCols[0].name}`);
  }

  suggestions.push('Find any outliers or anomalies');
  suggestions.push('Export this analysis as a report');

  return suggestions.slice(0, 4);
}

/**
 * Main analysis function
 */
async function analyzeData(
  rows: string[][],
  fileName: string,
  _query?: string // Reserved for future query-specific analysis
): Promise<AnalyticsResult> {
  if (rows.length < 2) {
    throw new Error('Data must have at least a header row and one data row');
  }

  // Extract headers and data
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Analyze each column
  const columns: ColumnInfo[] = headers.map((name, index) => {
    const values = dataRows.map((row) => row[index] || '');
    const type = detectColumnType(values);
    const numericValues: number[] = [];

    // Parse numeric values
    for (const val of values) {
      const parsed = parseValue(val, type);
      if (parsed !== null) {
        numericValues.push(parsed);
      }
    }

    return {
      name: name || `Column ${index + 1}`,
      type,
      values,
      numericValues,
      stats: numericValues.length > 0 ? calculateStats(numericValues) : undefined,
    };
  });

  // Generate insights
  const insights = generateInsights(columns);

  // Generate charts
  const charts = generateCharts(columns, dataRows);

  // Generate summary
  const numericColNames = columns
    .filter((c) => c.stats)
    .map((c) => c.name)
    .slice(0, 3)
    .join(', ');

  const summary = `Analyzed ${dataRows.length.toLocaleString()} records with ${columns.length} columns. ${
    numericColNames ? `Key metrics: ${numericColNames}.` : ''
  } ${charts.length > 0 ? `Generated ${charts.length} visualization(s).` : ''}`;

  // Prepare data preview (first 10 rows)
  const rawDataPreview = dataRows.slice(0, 10);

  return {
    id: uuidv4(),
    filename: fileName,
    summary,
    insights,
    charts,
    rawDataPreview,
    totalRows: dataRows.length,
    totalColumns: columns.length,
    columnNames: headers,
    suggestedQueries: generateSuggestions(columns),
  };
}

/**
 * POST /api/analytics
 *
 * Analyzes uploaded data files and returns insights with chart configurations.
 */
export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { fileName, fileType, content, query } = body;

    if (!content) {
      return NextResponse.json({ error: 'No file content provided' }, { status: 400 });
    }

    log.info(`Analyzing ${fileName} (${fileType})`);

    let rows: string[][];

    // Parse based on file type
    if (
      fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileType === 'application/vnd.ms-excel'
    ) {
      rows = await parseExcel(content);
    } else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      // CSV might be base64 encoded or raw text
      let csvText = content;
      if (content.startsWith('data:')) {
        const base64Content = content.replace(/^data:.*?;base64,/, '');
        csvText = Buffer.from(base64Content, 'base64').toString('utf-8');
      }
      rows = parseCSV(csvText);
    } else {
      return NextResponse.json(
        { error: `Unsupported file type for analytics: ${fileType}` },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    // Perform analysis
    const result = await analyzeData(rows, fileName, query);

    log.info(`Analysis complete: ${result.totalRows} rows, ${result.charts.length} charts`);

    return NextResponse.json({
      success: true,
      analytics: result,
    });
  } catch (error) {
    log.error('Analytics failed', error as Error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze data' },
      { status: 500 }
    );
  }
}
