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

import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { requireUser } from '@/lib/auth/user-guard';
import { v4 as uuidv4 } from 'uuid';
import type { AnalyticsResult } from '@/app/chat/types';
import { successResponse, errors } from '@/lib/api/utils';
import {
  parseCSV,
  parseExcel,
  detectColumnType,
  parseValue,
  calculateStats,
  generateInsights,
  generateCharts,
  generateSuggestions,
  ColumnInfo,
} from './analytics-utils';

const log = logger('AnalyticsAPI');

export const runtime = 'nodejs';
export const maxDuration = 60; // Analytics can take time

interface AnalyzeRequest {
  fileName: string;
  fileType: string;
  content: string; // Base64 data URL or raw CSV text
  query?: string; // Optional natural language query
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
    // Authentication check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const body: AnalyzeRequest = await request.json();
    const { fileName, fileType, content, query } = body;

    if (!content) {
      return errors.badRequest('No file content provided');
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
      return errors.badRequest(`Unsupported file type for analytics: ${fileType}`);
    }

    if (rows.length === 0) {
      return errors.badRequest('No data found in file');
    }

    // Perform analysis
    const result = await analyzeData(rows, fileName, query);

    log.info(`Analysis complete: ${result.totalRows} rows, ${result.charts.length} charts`);

    return successResponse({
      analytics: result,
    });
  } catch (error) {
    log.error('Analytics failed', error as Error);
    return errors.serverError('Failed to analyze data');
  }
}
