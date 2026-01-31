/**
 * TIME SERIES ANALYSIS TOOL
 *
 * Time series analysis and forecasting.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Trend detection
 * - Seasonality analysis
 * - Moving averages
 * - Anomaly detection
 * - Simple forecasting
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const timeseriesTool: UnifiedTool = {
  name: 'analyze_timeseries',
  description: `Analyze time series data for trends, patterns, and forecasts.

Operations:
- trend: Detect overall trend (linear regression)
- moving_average: Calculate moving averages (SMA, EMA)
- seasonality: Detect seasonal patterns
- anomalies: Detect outliers/anomalies
- forecast: Simple forecast using trend + seasonality
- decompose: Decompose into trend, seasonal, residual
- statistics: Summary statistics over time windows

Use cases:
- Sales forecasting
- Stock price analysis
- Sensor data monitoring
- Website traffic patterns
- Resource usage prediction`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'trend',
          'moving_average',
          'seasonality',
          'anomalies',
          'forecast',
          'decompose',
          'statistics',
        ],
        description: 'Time series operation',
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Time series values (ordered by time)',
      },
      timestamps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional timestamps for each data point',
      },
      window: {
        type: 'number',
        description: 'Window size for moving average or analysis',
      },
      period: {
        type: 'number',
        description: 'Expected seasonality period (e.g., 7 for weekly, 12 for monthly)',
      },
      forecast_periods: {
        type: 'number',
        description: 'Number of periods to forecast ahead',
      },
      threshold: {
        type: 'number',
        description: 'Threshold for anomaly detection (standard deviations)',
      },
    },
    required: ['operation', 'data'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isTimeseriesAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / arr.length);
}

function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const xMean = mean(x);
  const yMean = mean(data);

  let ssXY = 0,
    ssXX = 0,
    ssYY = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (x[i] - xMean) * (data[i] - yMean);
    ssXX += Math.pow(x[i] - xMean, 2);
    ssYY += Math.pow(data[i] - yMean, 2);
  }

  const slope = ssXY / ssXX;
  const intercept = yMean - slope * xMean;
  const r2 = Math.pow(ssXY, 2) / (ssXX * ssYY);

  return { slope, intercept, r2 };
}

function simpleMovingAverage(data: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1);
    result.push(mean(slice));
  }
  return result;
}

function exponentialMovingAverage(data: number[], alpha: number): number[] {
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
  }
  return result;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeTimeseries(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    data: number[];
    timestamps?: string[];
    window?: number;
    period?: number;
    forecast_periods?: number;
    threshold?: number;
  };

  const { operation, data, window = 5, period = 7, forecast_periods = 5, threshold = 2 } = args;

  try {
    if (!data || data.length < 3) {
      throw new Error('At least 3 data points required');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'trend': {
        const reg = linearRegression(data);
        const trendLine = data.map((_, i) => reg.intercept + reg.slope * i);

        result = {
          operation: 'trend',
          data_points: data.length,
          trend: {
            slope: reg.slope,
            intercept: reg.intercept,
            r_squared: reg.r2,
            direction:
              reg.slope > 0.001 ? 'increasing' : reg.slope < -0.001 ? 'decreasing' : 'stable',
            strength: reg.r2 > 0.7 ? 'strong' : reg.r2 > 0.3 ? 'moderate' : 'weak',
          },
          trend_line: trendLine.slice(-10), // Last 10 points
          interpretation: `${reg.slope > 0 ? 'Increasing' : 'Decreasing'} trend with R² = ${reg.r2.toFixed(3)}`,
        };
        break;
      }

      case 'moving_average': {
        const sma = simpleMovingAverage(data, window);
        const ema = exponentialMovingAverage(data, 2 / (window + 1));

        result = {
          operation: 'moving_average',
          window,
          data_points: data.length,
          simple_ma: sma.slice(-20),
          exponential_ma: ema.slice(-20),
          current_sma: sma[sma.length - 1],
          current_ema: ema[ema.length - 1],
          current_vs_sma: data[data.length - 1] > sma[sma.length - 1] ? 'above' : 'below',
        };
        break;
      }

      case 'seasonality': {
        // Simple seasonality detection using autocorrelation
        const detrended = data.map((v, i) => {
          const reg = linearRegression(data);
          return v - (reg.intercept + reg.slope * i);
        });

        // Calculate seasonal averages
        const seasonalMeans: number[] = [];
        for (let p = 0; p < period; p++) {
          const vals = detrended.filter((_, i) => i % period === p);
          seasonalMeans.push(mean(vals));
        }

        // Seasonality strength
        const seasonalVar = std(seasonalMeans);
        const totalVar = std(detrended);
        const seasonalStrength = seasonalVar / (totalVar + 0.001);

        result = {
          operation: 'seasonality',
          period,
          data_points: data.length,
          seasonal_pattern: seasonalMeans,
          seasonality_strength: seasonalStrength,
          is_seasonal: seasonalStrength > 0.3,
          interpretation:
            seasonalStrength > 0.5
              ? 'Strong seasonality detected'
              : seasonalStrength > 0.3
                ? 'Moderate seasonality'
                : 'Weak or no seasonality',
        };
        break;
      }

      case 'anomalies': {
        const m = mean(data);
        const s = std(data);
        const anomalies: Array<{ index: number; value: number; zscore: number }> = [];

        data.forEach((v, i) => {
          const zscore = (v - m) / s;
          if (Math.abs(zscore) > threshold) {
            anomalies.push({ index: i, value: v, zscore });
          }
        });

        result = {
          operation: 'anomalies',
          data_points: data.length,
          threshold_stddev: threshold,
          mean: m,
          std_dev: s,
          anomaly_count: anomalies.length,
          anomaly_rate: ((anomalies.length / data.length) * 100).toFixed(2) + '%',
          anomalies: anomalies.slice(0, 20), // First 20 anomalies
        };
        break;
      }

      case 'forecast': {
        // Simple forecast: trend + seasonal
        const reg = linearRegression(data);

        // Get seasonal component
        const seasonalMeans: number[] = [];
        for (let p = 0; p < period; p++) {
          const vals = data.filter((_, i) => i % period === p);
          const trendVals = vals.map((_v, i) => reg.intercept + reg.slope * (i * period + p));
          seasonalMeans.push(mean(vals.map((v, i) => v - trendVals[i])));
        }

        // Generate forecasts
        const forecasts: number[] = [];
        for (let i = 0; i < forecast_periods; i++) {
          const t = data.length + i;
          const trendComponent = reg.intercept + reg.slope * t;
          const seasonalComponent = seasonalMeans[t % period];
          forecasts.push(trendComponent + seasonalComponent);
        }

        result = {
          operation: 'forecast',
          data_points: data.length,
          forecast_periods,
          method: 'trend + seasonal decomposition',
          last_actual: data[data.length - 1],
          forecasts,
          trend: {
            slope: reg.slope,
            direction: reg.slope > 0 ? 'increasing' : 'decreasing',
          },
          confidence: reg.r2 > 0.7 ? 'high' : reg.r2 > 0.3 ? 'medium' : 'low',
        };
        break;
      }

      case 'decompose': {
        const reg = linearRegression(data);
        const trend = data.map((_, i) => reg.intercept + reg.slope * i);

        // Seasonal
        const detrended = data.map((v, i) => v - trend[i]);
        const seasonalMeans: number[] = [];
        for (let p = 0; p < period; p++) {
          const vals = detrended.filter((_, i) => i % period === p);
          seasonalMeans.push(mean(vals));
        }
        const seasonal = data.map((_, i) => seasonalMeans[i % period]);

        // Residual
        const residual = data.map((v, i) => v - trend[i] - seasonal[i]);

        result = {
          operation: 'decompose',
          data_points: data.length,
          period,
          components: {
            trend: trend.slice(-10),
            seasonal: seasonal.slice(-period),
            residual: residual.slice(-10),
          },
          trend_strength: reg.r2,
          residual_std: std(residual),
        };
        break;
      }

      case 'statistics': {
        const windows = [];
        for (let i = 0; i < data.length; i += window) {
          const slice = data.slice(i, i + window);
          if (slice.length > 0) {
            windows.push({
              start: i,
              end: Math.min(i + window, data.length),
              mean: mean(slice),
              min: Math.min(...slice),
              max: Math.max(...slice),
              std: std(slice),
            });
          }
        }

        result = {
          operation: 'statistics',
          data_points: data.length,
          window_size: window,
          window_count: windows.length,
          overall: {
            mean: mean(data),
            min: Math.min(...data),
            max: Math.max(...data),
            std: std(data),
            range: Math.max(...data) - Math.min(...data),
          },
          windows: windows.slice(-10),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
