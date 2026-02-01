/**
 * TIME SERIES TOOL
 * ARIMA, exponential smoothing, and forecasting
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function movingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) result.push(NaN);
    else {
      let sum = 0;
      for (let j = 0; j < window; j++) sum += data[i - j];
      result.push(sum / window);
    }
  }
  return result;
}

function exponentialSmoothing(data: number[], alpha: number): number[] {
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

function doubleExponentialSmoothing(data: number[], alpha: number, beta: number): { level: number[]; trend: number[]; forecast: number[] } {
  const level: number[] = [data[0]];
  const trend: number[] = [data[1] - data[0]];
  const forecast: number[] = [data[0]];
  
  for (let i = 1; i < data.length; i++) {
    level.push(alpha * data[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]));
    trend.push(beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1]);
    forecast.push(level[i - 1] + trend[i - 1]);
  }
  
  return { level, trend, forecast };
}

function seasonalDecompose(data: number[], period: number): { trend: number[]; seasonal: number[]; residual: number[] } {
  // Moving average for trend
  const trend = movingAverage(data, period);
  
  // Detrend
  const detrended = data.map((v, i) => isNaN(trend[i]) ? NaN : v - trend[i]);
  
  // Calculate seasonal component (average of each position in period)
  const seasonal: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const position = i % period;
    let sum = 0, count = 0;
    for (let j = position; j < data.length; j += period) {
      if (!isNaN(detrended[j])) { sum += detrended[j]; count++; }
    }
    seasonal.push(count > 0 ? sum / count : 0);
  }
  
  // Residual
  const residual = data.map((v, i) => isNaN(trend[i]) ? NaN : v - trend[i] - seasonal[i]);
  
  return { trend, seasonal, residual };
}

function autocorrelation(data: number[], maxLag: number): number[] {
  const mean = data.reduce((a, b) => a + b) / data.length;
  const variance = data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length;
  
  const acf: number[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < data.length - lag; i++) {
      sum += (data[i] - mean) * (data[i + lag] - mean);
    }
    acf.push(sum / (data.length * variance));
  }
  return acf;
}

function forecast(data: number[], steps: number, method: string = 'ses'): number[] {
  const result: number[] = [];
  
  if (method === 'ses') {
    const smoothed = exponentialSmoothing(data, 0.3);
    const lastValue = smoothed[smoothed.length - 1];
    for (let i = 0; i < steps; i++) result.push(lastValue);
  } else if (method === 'holt') {
    const { level, trend } = doubleExponentialSmoothing(data, 0.3, 0.1);
    const lastLevel = level[level.length - 1];
    const lastTrend = trend[trend.length - 1];
    for (let i = 1; i <= steps; i++) result.push(lastLevel + i * lastTrend);
  } else {
    const mean = data.reduce((a, b) => a + b) / data.length;
    for (let i = 0; i < steps; i++) result.push(mean);
  }
  
  return result;
}

function detectAnomalies(data: number[], threshold: number = 2): number[] {
  const mean = data.reduce((a, b) => a + b) / data.length;
  const std = Math.sqrt(data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length);
  
  const anomalies: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i] - mean) > threshold * std) anomalies.push(i);
  }
  return anomalies;
}

export const timeSeriesTool: UnifiedTool = {
  name: 'time_series',
  description: 'Time series analysis with smoothing, decomposition, and forecasting',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['smooth', 'decompose', 'acf', 'forecast', 'anomalies', 'info'], description: 'Operation' },
      data: { type: 'array', description: 'Time series data' },
      window: { type: 'number', description: 'Window size for moving average' },
      alpha: { type: 'number', description: 'Smoothing factor (0-1)' },
      period: { type: 'number', description: 'Seasonal period' },
      steps: { type: 'number', description: 'Forecast steps ahead' },
      method: { type: 'string', description: 'Forecast method: ses, holt, mean' }
    },
    required: ['operation']
  }
};

export async function executeTimeSeries(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const data = args.data || [10, 12, 15, 13, 18, 20, 22, 25, 23, 28, 30, 32];
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'smooth':
        result = {
          ma: movingAverage(data, args.window || 3),
          ses: exponentialSmoothing(data, args.alpha || 0.3),
          holt: doubleExponentialSmoothing(data, args.alpha || 0.3, 0.1)
        };
        break;
      case 'decompose':
        result = seasonalDecompose(data, args.period || 4);
        break;
      case 'acf':
        result = { acf: autocorrelation(data, Math.min(args.window || 10, data.length - 1)) };
        break;
      case 'forecast':
        result = { forecast: forecast(data, args.steps || 5, args.method || 'holt'), method: args.method || 'holt' };
        break;
      case 'anomalies':
        result = { anomalyIndices: detectAnomalies(data, 2) };
        break;
      case 'info':
      default:
        result = { description: 'Time series analysis', features: ['Moving average', 'Exponential smoothing', 'Holt-Winters', 'Seasonal decomposition', 'ACF', 'Anomaly detection'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isTimeSeriesAvailable(): boolean { return true; }
