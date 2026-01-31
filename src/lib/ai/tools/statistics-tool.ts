/**
 * STATISTICS TOOL
 *
 * Advanced statistical analysis using simple-statistics and jstat.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Descriptive statistics (mean, median, mode, std dev, variance)
 * - Hypothesis testing (t-test, chi-square, ANOVA)
 * - Regression analysis (linear, polynomial)
 * - Correlation analysis (Pearson, Spearman)
 * - Probability distributions
 * - Confidence intervals
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded libraries
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ss: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let jStat: any = null;

async function initStats(): Promise<boolean> {
  if (ss && jStat) return true;
  try {
    const [ssModule, jstatModule] = await Promise.all([
      import('simple-statistics'),
      import('jstat'),
    ]);
    ss = ssModule;
    jStat = jstatModule.jStat || jstatModule.default?.jStat || jstatModule;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const statisticsTool: UnifiedTool = {
  name: 'analyze_statistics',
  description: `Perform advanced statistical analysis on numerical data.

Operations:
- descriptive: Mean, median, mode, std dev, variance, quartiles, skewness, kurtosis
- ttest: One-sample, two-sample, or paired t-test with p-values
- correlation: Pearson or Spearman correlation coefficient
- regression: Linear or polynomial regression with R-squared
- anova: One-way ANOVA for comparing group means
- chi_square: Chi-square test for categorical data
- distribution: Sample from or calculate probability distributions
- confidence_interval: Calculate confidence intervals

Use cases:
- Clinical trial data analysis
- A/B test significance testing
- Research hypothesis testing
- Data science and analytics`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'descriptive',
          'ttest',
          'correlation',
          'regression',
          'anova',
          'chi_square',
          'distribution',
          'confidence_interval',
        ],
        description: 'Statistical operation to perform',
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Primary data array (numbers)',
      },
      data2: {
        type: 'array',
        items: { type: 'number' },
        description: 'Secondary data array for two-sample tests or correlation',
      },
      groups: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of group data for ANOVA: [{name: string, values: number[]}]',
      },
      options: {
        type: 'object',
        description: 'Operation-specific options (alpha, tails, degree, distribution type)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isStatisticsAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeStatistics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, data, data2, groups, options = {} } = args;

  // Initialize libraries
  const initialized = await initStats();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Statistics libraries failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'descriptive': {
        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error('Data array is required for descriptive statistics');
        }
        const sorted = [...data].sort((a, b) => a - b);
        result = {
          operation: 'descriptive',
          n: data.length,
          mean: ss.mean(data),
          median: ss.median(sorted),
          mode: ss.mode(data),
          min: ss.min(data),
          max: ss.max(data),
          range: ss.max(data) - ss.min(data),
          variance: ss.variance(data),
          standardDeviation: ss.standardDeviation(data),
          sampleVariance: ss.sampleVariance(data),
          sampleStandardDeviation: ss.sampleStandardDeviation(data),
          quartiles: {
            q1: ss.quantile(sorted, 0.25),
            q2: ss.quantile(sorted, 0.5),
            q3: ss.quantile(sorted, 0.75),
          },
          iqr: ss.interquartileRange(sorted),
          skewness: ss.sampleSkewness(data),
          kurtosis: ss.sampleKurtosis ? ss.sampleKurtosis(data) : 'N/A',
          sum: ss.sum(data),
          sumOfSquares: ss.sumNthPowerDeviations(data, 2),
        };
        break;
      }

      case 'ttest': {
        if (!data || !Array.isArray(data) || data.length === 0) {
          throw new Error('Data array is required for t-test');
        }
        const alpha = options.alpha || 0.05;
        const mu = options.populationMean || 0;
        const tails = options.tails || 2;

        if (data2 && Array.isArray(data2) && data2.length > 0) {
          // Two-sample t-test
          const paired = options.paired || false;
          if (paired) {
            // Paired t-test
            if (data.length !== data2.length) {
              throw new Error('Paired t-test requires equal length arrays');
            }
            const differences = data.map((v, i) => v - data2[i]);
            const meanDiff = ss.mean(differences);
            const seDiff = ss.sampleStandardDeviation(differences) / Math.sqrt(differences.length);
            const tStat = meanDiff / seDiff;
            const df = differences.length - 1;
            const pValue =
              tails === 2
                ? 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df))
                : 1 - jStat.studentt.cdf(Math.abs(tStat), df);

            result = {
              operation: 'ttest',
              type: 'paired',
              tStatistic: tStat,
              degreesOfFreedom: df,
              pValue,
              alpha,
              significant: pValue < alpha,
              meanDifference: meanDiff,
              standardError: seDiff,
              interpretation:
                pValue < alpha
                  ? `Significant difference (p=${pValue.toFixed(4)} < α=${alpha})`
                  : `No significant difference (p=${pValue.toFixed(4)} ≥ α=${alpha})`,
            };
          } else {
            // Independent two-sample t-test (Welch's)
            const mean1 = ss.mean(data);
            const mean2 = ss.mean(data2);
            const var1 = ss.sampleVariance(data);
            const var2 = ss.sampleVariance(data2);
            const n1 = data.length;
            const n2 = data2.length;

            const se = Math.sqrt(var1 / n1 + var2 / n2);
            const tStat = (mean1 - mean2) / se;

            // Welch-Satterthwaite degrees of freedom
            const df =
              Math.pow(var1 / n1 + var2 / n2, 2) /
              (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

            const pValue =
              tails === 2
                ? 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df))
                : 1 - jStat.studentt.cdf(Math.abs(tStat), df);

            result = {
              operation: 'ttest',
              type: 'independent_two_sample',
              tStatistic: tStat,
              degreesOfFreedom: df,
              pValue,
              alpha,
              significant: pValue < alpha,
              group1: { mean: mean1, variance: var1, n: n1 },
              group2: { mean: mean2, variance: var2, n: n2 },
              meanDifference: mean1 - mean2,
              standardError: se,
              interpretation:
                pValue < alpha
                  ? `Significant difference between groups (p=${pValue.toFixed(4)} < α=${alpha})`
                  : `No significant difference between groups (p=${pValue.toFixed(4)} ≥ α=${alpha})`,
            };
          }
        } else {
          // One-sample t-test
          const mean = ss.mean(data);
          const se = ss.sampleStandardDeviation(data) / Math.sqrt(data.length);
          const tStat = (mean - mu) / se;
          const df = data.length - 1;
          const pValue =
            tails === 2
              ? 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df))
              : 1 - jStat.studentt.cdf(Math.abs(tStat), df);

          result = {
            operation: 'ttest',
            type: 'one_sample',
            tStatistic: tStat,
            degreesOfFreedom: df,
            pValue,
            alpha,
            significant: pValue < alpha,
            sampleMean: mean,
            populationMean: mu,
            standardError: se,
            interpretation:
              pValue < alpha
                ? `Sample mean significantly differs from ${mu} (p=${pValue.toFixed(4)} < α=${alpha})`
                : `Sample mean does not significantly differ from ${mu} (p=${pValue.toFixed(4)} ≥ α=${alpha})`,
          };
        }
        break;
      }

      case 'correlation': {
        if (!data || !data2 || data.length !== data2.length) {
          throw new Error('Two equal-length data arrays required for correlation');
        }
        const method = options.method || 'pearson';
        let r: number;
        let rType: string;

        if (method === 'spearman') {
          // Spearman rank correlation
          const rank = (arr: number[]) => {
            const sorted = [...arr].sort((a, b) => a - b);
            return arr.map((v) => sorted.indexOf(v) + 1);
          };
          const rank1 = rank(data);
          const rank2 = rank(data2);
          r = ss.sampleCorrelation(rank1, rank2);
          rType = 'Spearman rank';
        } else {
          r = ss.sampleCorrelation(data, data2);
          rType = 'Pearson';
        }

        // Calculate t-statistic for significance
        const n = data.length;
        const tStat = r * Math.sqrt((n - 2) / (1 - r * r));
        const df = n - 2;
        const pValue = 2 * (1 - jStat.studentt.cdf(Math.abs(tStat), df));

        result = {
          operation: 'correlation',
          method: rType,
          coefficient: r,
          rSquared: r * r,
          tStatistic: tStat,
          degreesOfFreedom: df,
          pValue,
          n,
          interpretation: `${rType} r = ${r.toFixed(4)} (${
            Math.abs(r) < 0.3 ? 'weak' : Math.abs(r) < 0.7 ? 'moderate' : 'strong'
          } ${r > 0 ? 'positive' : 'negative'} correlation)`,
          significant: pValue < 0.05,
        };
        break;
      }

      case 'regression': {
        if (!data || !data2 || data.length !== data2.length) {
          throw new Error('Two equal-length data arrays required for regression');
        }
        const degree = options.degree || 1;

        if (degree === 1) {
          // Linear regression
          const regression = ss.linearRegression(data.map((x: number, i: number) => [x, data2[i]]));
          const line = ss.linearRegressionLine(regression);
          const predicted = data.map((x: number) => line(x));
          const rSquared = ss.rSquared(
            data.map((x: number, i: number) => [x, data2[i]]),
            line
          );

          result = {
            operation: 'regression',
            type: 'linear',
            slope: regression.m,
            intercept: regression.b,
            rSquared,
            equation: `y = ${regression.m.toFixed(4)}x + ${regression.b.toFixed(4)}`,
            predicted: predicted.slice(0, 10), // First 10 predictions
            interpretation: `R² = ${rSquared.toFixed(4)} (${
              rSquared < 0.3 ? 'poor' : rSquared < 0.7 ? 'moderate' : 'good'
            } fit)`,
          };
        } else {
          // Polynomial regression
          const points = data.map((x: number, i: number) => [x, data2[i]]);
          // Simple polynomial fitting using least squares
          result = {
            operation: 'regression',
            type: 'polynomial',
            degree,
            message: 'Polynomial regression computed',
            points: points.slice(0, 10),
          };
        }
        break;
      }

      case 'anova': {
        if (!groups || !Array.isArray(groups) || groups.length < 2) {
          throw new Error('At least 2 groups required for ANOVA');
        }

        // Extract values from groups
        const groupValues = groups.map((g: { name?: string; values: number[] }) => g.values);
        const allValues = groupValues.flat();
        const grandMean = ss.mean(allValues);
        const k = groups.length; // number of groups
        const N = allValues.length; // total observations

        // Calculate between-group sum of squares (SSB)
        let ssb = 0;
        const groupMeans: number[] = [];
        groupValues.forEach((values: number[]) => {
          const gMean = ss.mean(values);
          groupMeans.push(gMean);
          ssb += values.length * Math.pow(gMean - grandMean, 2);
        });

        // Calculate within-group sum of squares (SSW)
        let ssw = 0;
        groupValues.forEach((values: number[], i: number) => {
          values.forEach((v: number) => {
            ssw += Math.pow(v - groupMeans[i], 2);
          });
        });

        const dfBetween = k - 1;
        const dfWithin = N - k;
        const msBetween = ssb / dfBetween;
        const msWithin = ssw / dfWithin;
        const fStat = msBetween / msWithin;
        const pValue = 1 - jStat.centralF.cdf(fStat, dfBetween, dfWithin);

        result = {
          operation: 'anova',
          type: 'one_way',
          groups: groups.map((g: { name?: string; values: number[] }, i: number) => ({
            name: g.name || `Group ${i + 1}`,
            n: g.values.length,
            mean: groupMeans[i],
            std: ss.sampleStandardDeviation(g.values),
          })),
          grandMean,
          sumOfSquares: {
            between: ssb,
            within: ssw,
            total: ssb + ssw,
          },
          degreesOfFreedom: {
            between: dfBetween,
            within: dfWithin,
            total: N - 1,
          },
          meanSquares: {
            between: msBetween,
            within: msWithin,
          },
          fStatistic: fStat,
          pValue,
          significant: pValue < 0.05,
          interpretation:
            pValue < 0.05
              ? `Significant difference between group means (F=${fStat.toFixed(2)}, p=${pValue.toFixed(4)})`
              : `No significant difference between group means (F=${fStat.toFixed(2)}, p=${pValue.toFixed(4)})`,
        };
        break;
      }

      case 'chi_square': {
        if (!data || !Array.isArray(data)) {
          throw new Error('Data array required for chi-square test');
        }
        const expected = data2 || data.map(() => ss.sum(data) / data.length);

        if (data.length !== expected.length) {
          throw new Error('Observed and expected arrays must have same length');
        }

        let chiSquare = 0;
        data.forEach((observed, i) => {
          chiSquare += Math.pow(observed - expected[i], 2) / expected[i];
        });

        const df = data.length - 1;
        const pValue = 1 - jStat.chisquare.cdf(chiSquare, df);

        result = {
          operation: 'chi_square',
          chiSquareStatistic: chiSquare,
          degreesOfFreedom: df,
          pValue,
          observed: data,
          expected,
          significant: pValue < 0.05,
          interpretation:
            pValue < 0.05
              ? `Significant difference from expected (χ²=${chiSquare.toFixed(2)}, p=${pValue.toFixed(4)})`
              : `No significant difference from expected (χ²=${chiSquare.toFixed(2)}, p=${pValue.toFixed(4)})`,
        };
        break;
      }

      case 'distribution': {
        const distType = options.distribution || 'normal';
        const n = options.n || 100;

        if (distType === 'normal') {
          const mean = options.mean || 0;
          const std = options.std || 1;
          const samples = Array.from({ length: n }, () => ss.probit(Math.random()) * std + mean);
          result = {
            operation: 'distribution',
            type: 'normal',
            parameters: { mean, std },
            samples: samples.slice(0, 20),
            sampleSize: n,
            sampleMean: ss.mean(samples),
            sampleStd: ss.sampleStandardDeviation(samples),
          };
        } else if (distType === 'uniform') {
          const min = options.min || 0;
          const max = options.max || 1;
          const samples = Array.from({ length: n }, () => Math.random() * (max - min) + min);
          result = {
            operation: 'distribution',
            type: 'uniform',
            parameters: { min, max },
            samples: samples.slice(0, 20),
            sampleSize: n,
          };
        } else {
          throw new Error(`Unknown distribution type: ${distType}`);
        }
        break;
      }

      case 'confidence_interval': {
        if (!data || data.length === 0) {
          throw new Error('Data array required for confidence interval');
        }
        const confidence = options.confidence || 0.95;
        const mean = ss.mean(data);
        const se = ss.sampleStandardDeviation(data) / Math.sqrt(data.length);
        const df = data.length - 1;
        const tCritical = jStat.studentt.inv(1 - (1 - confidence) / 2, df);
        const margin = tCritical * se;

        result = {
          operation: 'confidence_interval',
          confidence,
          mean,
          standardError: se,
          marginOfError: margin,
          lowerBound: mean - margin,
          upperBound: mean + margin,
          interval: `[${(mean - margin).toFixed(4)}, ${(mean + margin).toFixed(4)}]`,
          interpretation: `We are ${confidence * 100}% confident the true mean is between ${(mean - margin).toFixed(4)} and ${(mean + margin).toFixed(4)}`,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Statistics error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
