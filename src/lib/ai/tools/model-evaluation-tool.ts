/**
 * MODEL EVALUATION TOOL
 * ML model evaluation metrics and analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function calculateClassificationMetrics(actual: number[], predicted: number[]): Record<string, unknown> {
  if (actual.length !== predicted.length) {
    throw new Error('Arrays must have same length');
  }

  // Build confusion matrix
  const classes = [...new Set([...actual, ...predicted])].sort();
  const n = classes.length;
  const matrix = Array(n).fill(null).map(() => Array(n).fill(0));

  const classMap = new Map(classes.map((c, i) => [c, i]));

  for (let i = 0; i < actual.length; i++) {
    const actualIdx = classMap.get(actual[i])!;
    const predictedIdx = classMap.get(predicted[i])!;
    matrix[actualIdx][predictedIdx]++;
  }

  // Calculate metrics for each class
  const metrics: Record<string, Record<string, number>> = {};
  let totalTP = 0, totalFP = 0, totalFN = 0;

  for (let i = 0; i < n; i++) {
    const tp = matrix[i][i];
    const fp = matrix.reduce((sum, row, j) => sum + (j !== i ? row[i] : 0), 0);
    const fn = matrix[i].reduce((sum, val, j) => sum + (j !== i ? val : 0), 0);
    const tn = actual.length - tp - fp - fn;

    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1 = 2 * (precision * recall) / (precision + recall) || 0;
    const specificity = tn / (tn + fp) || 0;

    metrics[`class_${classes[i]}`] = {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      trueNegatives: tn,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1Score: Math.round(f1 * 1000) / 1000,
      specificity: Math.round(specificity * 1000) / 1000
    };

    totalTP += tp;
    totalFP += fp;
    totalFN += fn;
  }

  // Overall metrics
  const accuracy = actual.reduce((acc, a, i) => acc + (a === predicted[i] ? 1 : 0), 0) / actual.length;
  const macroPrecision = Object.values(metrics).reduce((sum, m) => sum + m.precision, 0) / n;
  const macroRecall = Object.values(metrics).reduce((sum, m) => sum + m.recall, 0) / n;
  const macroF1 = Object.values(metrics).reduce((sum, m) => sum + m.f1Score, 0) / n;

  const microPrecision = totalTP / (totalTP + totalFP) || 0;
  const microRecall = totalTP / (totalTP + totalFN) || 0;
  const microF1 = 2 * (microPrecision * microRecall) / (microPrecision + microRecall) || 0;

  return {
    confusionMatrix: { classes, matrix },
    perClass: metrics,
    overall: {
      accuracy: Math.round(accuracy * 1000) / 1000,
      macroPrecision: Math.round(macroPrecision * 1000) / 1000,
      macroRecall: Math.round(macroRecall * 1000) / 1000,
      macroF1: Math.round(macroF1 * 1000) / 1000,
      microPrecision: Math.round(microPrecision * 1000) / 1000,
      microRecall: Math.round(microRecall * 1000) / 1000,
      microF1: Math.round(microF1 * 1000) / 1000
    },
    sampleSize: actual.length
  };
}

function calculateRegressionMetrics(actual: number[], predicted: number[]): Record<string, unknown> {
  if (actual.length !== predicted.length) {
    throw new Error('Arrays must have same length');
  }

  const n = actual.length;
  const errors = actual.map((a, i) => a - predicted[i]);
  const absErrors = errors.map(Math.abs);
  const squaredErrors = errors.map(e => e * e);

  // Mean Absolute Error
  const mae = absErrors.reduce((a, b) => a + b, 0) / n;

  // Mean Squared Error
  const mse = squaredErrors.reduce((a, b) => a + b, 0) / n;

  // Root Mean Squared Error
  const rmse = Math.sqrt(mse);

  // Mean Absolute Percentage Error
  const mape = actual.reduce((sum, a, i) => sum + Math.abs((a - predicted[i]) / (a || 1)), 0) / n * 100;

  // R-squared
  const actualMean = actual.reduce((a, b) => a + b, 0) / n;
  const ssRes = squaredErrors.reduce((a, b) => a + b, 0);
  const ssTot = actual.reduce((sum, a) => sum + Math.pow(a - actualMean, 2), 0);
  const r2 = 1 - (ssRes / ssTot);

  // Adjusted R-squared (assuming 1 predictor)
  const adjR2 = 1 - ((1 - r2) * (n - 1) / (n - 2));

  return {
    mae: Math.round(mae * 1000) / 1000,
    mse: Math.round(mse * 1000) / 1000,
    rmse: Math.round(rmse * 1000) / 1000,
    mape: Math.round(mape * 100) / 100,
    r2: Math.round(r2 * 1000) / 1000,
    adjustedR2: Math.round(adjR2 * 1000) / 1000,
    residualStats: {
      mean: Math.round((errors.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
      std: Math.round(Math.sqrt(errors.reduce((sum, e) => sum + Math.pow(e - (errors.reduce((a, b) => a + b, 0) / n), 2), 0) / n) * 1000) / 1000,
      min: Math.round(Math.min(...errors) * 1000) / 1000,
      max: Math.round(Math.max(...errors) * 1000) / 1000
    },
    sampleSize: n
  };
}

function calculateROCAUC(actual: number[], probabilities: number[]): Record<string, unknown> {
  // Sort by probability descending
  const sorted = actual.map((a, i) => ({ actual: a, prob: probabilities[i] }))
    .sort((a, b) => b.prob - a.prob);

  const positives = actual.filter(a => a === 1).length;
  const negatives = actual.length - positives;

  // Calculate TPR and FPR at each threshold
  const rocPoints: Array<{ threshold: number; tpr: number; fpr: number }> = [];
  let tp = 0, fp = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].actual === 1) tp++;
    else fp++;

    rocPoints.push({
      threshold: sorted[i].prob,
      tpr: tp / positives,
      fpr: fp / negatives
    });
  }

  // Calculate AUC using trapezoidal rule
  let auc = 0;
  for (let i = 1; i < rocPoints.length; i++) {
    const width = rocPoints[i].fpr - rocPoints[i - 1].fpr;
    const height = (rocPoints[i].tpr + rocPoints[i - 1].tpr) / 2;
    auc += width * height;
  }

  // Find optimal threshold (Youden's J statistic)
  let maxJ = 0, optimalThreshold = 0.5;
  for (const point of rocPoints) {
    const j = point.tpr - point.fpr;
    if (j > maxJ) {
      maxJ = j;
      optimalThreshold = point.threshold;
    }
  }

  return {
    auc: Math.round(auc * 1000) / 1000,
    interpretation: auc >= 0.9 ? 'Excellent' : auc >= 0.8 ? 'Good' : auc >= 0.7 ? 'Fair' : auc >= 0.6 ? 'Poor' : 'Fail',
    optimalThreshold: Math.round(optimalThreshold * 1000) / 1000,
    rocCurve: rocPoints.filter((_, i) => i % Math.ceil(rocPoints.length / 20) === 0), // Sample points
    positives,
    negatives
  };
}

function crossValidationSplit(data: number[], k: number = 5): Record<string, unknown> {
  const n = data.length;
  const foldSize = Math.floor(n / k);
  const folds: Array<{ train: number[]; test: number[] }> = [];

  for (let i = 0; i < k; i++) {
    const testStart = i * foldSize;
    const testEnd = i === k - 1 ? n : (i + 1) * foldSize;

    const testIndices = Array.from({ length: testEnd - testStart }, (_, j) => testStart + j);
    const trainIndices = Array.from({ length: n }, (_, j) => j).filter(j => j < testStart || j >= testEnd);

    folds.push({
      train: trainIndices,
      test: testIndices
    });
  }

  return {
    k,
    totalSamples: n,
    foldSize,
    folds: folds.map((f, i) => ({
      fold: i + 1,
      trainSize: f.train.length,
      testSize: f.test.length
    })),
    strategy: 'KFold'
  };
}

function compareModels(models: Array<{
  name: string;
  accuracy: number;
  f1: number;
  auc?: number;
  trainTime?: number;
}>): Record<string, unknown> {
  // Rank by different metrics
  const byAccuracy = [...models].sort((a, b) => b.accuracy - a.accuracy);
  const byF1 = [...models].sort((a, b) => b.f1 - a.f1);
  const byAUC = models.filter(m => m.auc !== undefined).sort((a, b) => (b.auc || 0) - (a.auc || 0));

  // Calculate composite score
  const scored = models.map(m => ({
    ...m,
    compositeScore: m.accuracy * 0.3 + m.f1 * 0.4 + (m.auc || m.f1) * 0.3
  })).sort((a, b) => b.compositeScore - a.compositeScore);

  return {
    ranking: {
      byAccuracy: byAccuracy.map(m => m.name),
      byF1: byF1.map(m => m.name),
      byAUC: byAUC.map(m => m.name),
      overall: scored.map(m => m.name)
    },
    bestModel: scored[0],
    comparison: scored,
    recommendation: `Best overall model: ${scored[0].name} with composite score ${Math.round(scored[0].compositeScore * 1000) / 1000}`
  };
}

function biasAnalysis(predictions: Array<{
  actual: number;
  predicted: number;
  group: string;
}>): Record<string, unknown> {
  const groups = [...new Set(predictions.map(p => p.group))];
  const analysis: Record<string, Record<string, number>> = {};

  for (const group of groups) {
    const groupPreds = predictions.filter(p => p.group === group);
    const accuracy = groupPreds.filter(p => p.actual === p.predicted).length / groupPreds.length;

    // Positive rate
    const positiveRate = groupPreds.filter(p => p.predicted === 1).length / groupPreds.length;

    // True positive rate
    const actualPositives = groupPreds.filter(p => p.actual === 1);
    const tpr = actualPositives.filter(p => p.predicted === 1).length / (actualPositives.length || 1);

    // False positive rate
    const actualNegatives = groupPreds.filter(p => p.actual === 0);
    const fpr = actualNegatives.filter(p => p.predicted === 1).length / (actualNegatives.length || 1);

    analysis[group] = {
      sampleSize: groupPreds.length,
      accuracy: Math.round(accuracy * 1000) / 1000,
      positiveRate: Math.round(positiveRate * 1000) / 1000,
      truePositiveRate: Math.round(tpr * 1000) / 1000,
      falsePositiveRate: Math.round(fpr * 1000) / 1000
    };
  }

  // Calculate disparity metrics
  const accuracies = Object.values(analysis).map(a => a.accuracy);
  const positiveRates = Object.values(analysis).map(a => a.positiveRate);

  return {
    groupAnalysis: analysis,
    disparityMetrics: {
      accuracyDisparity: Math.round((Math.max(...accuracies) - Math.min(...accuracies)) * 1000) / 1000,
      positiveRateDisparity: Math.round((Math.max(...positiveRates) - Math.min(...positiveRates)) * 1000) / 1000,
      demographicParity: Math.max(...positiveRates) / Math.min(...positiveRates)
    },
    fairnessWarnings: Object.values(analysis).some(a => Math.abs(a.accuracy - accuracies[0]) > 0.1)
      ? ['Significant accuracy disparity detected between groups']
      : []
  };
}

export const modelEvaluationTool: UnifiedTool = {
  name: 'model_evaluation',
  description: 'Model Evaluation: classification_metrics, regression_metrics, roc_auc, cross_validation, compare_models, bias_analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['classification_metrics', 'regression_metrics', 'roc_auc', 'cross_validation', 'compare_models', 'bias_analysis'] },
      actual: { type: 'array' },
      predicted: { type: 'array' },
      probabilities: { type: 'array' },
      data: { type: 'array' },
      k: { type: 'number' },
      models: { type: 'array' },
      predictions: { type: 'array' }
    },
    required: ['operation']
  },
};

export async function executeModelEvaluation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'classification_metrics':
        result = calculateClassificationMetrics(
          args.actual || [1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
          args.predicted || [1, 0, 1, 0, 0, 1, 1, 0, 1, 0]
        );
        break;
      case 'regression_metrics':
        result = calculateRegressionMetrics(
          args.actual || [3.0, 2.5, 4.0, 3.5, 2.0],
          args.predicted || [2.8, 2.6, 3.9, 3.4, 2.2]
        );
        break;
      case 'roc_auc':
        result = calculateROCAUC(
          args.actual || [1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
          args.probabilities || [0.9, 0.2, 0.8, 0.7, 0.3, 0.85, 0.4, 0.15, 0.75, 0.25]
        );
        break;
      case 'cross_validation':
        result = crossValidationSplit(args.data || Array.from({ length: 100 }, (_, i) => i), args.k || 5);
        break;
      case 'compare_models':
        result = compareModels(args.models || [
          { name: 'RandomForest', accuracy: 0.92, f1: 0.89, auc: 0.95 },
          { name: 'XGBoost', accuracy: 0.94, f1: 0.91, auc: 0.96 },
          { name: 'LogisticRegression', accuracy: 0.88, f1: 0.85, auc: 0.90 }
        ]);
        break;
      case 'bias_analysis':
        result = biasAnalysis(args.predictions || [
          { actual: 1, predicted: 1, group: 'A' },
          { actual: 0, predicted: 0, group: 'A' },
          { actual: 1, predicted: 0, group: 'B' },
          { actual: 0, predicted: 1, group: 'B' }
        ]);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isModelEvaluationAvailable(): boolean { return true; }
