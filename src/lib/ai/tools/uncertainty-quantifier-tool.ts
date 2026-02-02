/**
 * UNCERTAINTY-QUANTIFIER TOOL
 * Quantify and reason about uncertainty - THE AI KNOWS WHAT IT DOESN'T KNOW
 *
 * Complete implementation of uncertainty quantification:
 * - Confidence intervals (normal, t-distribution, bootstrap)
 * - Bayesian credence and updating
 * - Epistemic uncertainty (model/knowledge uncertainty)
 * - Aleatoric uncertainty (data/irreducible uncertainty)
 * - Calibration metrics (Brier score, reliability diagrams)
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// STATISTICAL UTILITIES
// ============================================================================

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[], isSample: boolean = true): number {
  const m = mean(arr);
  const squaredDiffs = arr.map(x => (x - m) ** 2);
  const divisor = isSample ? arr.length - 1 : arr.length;
  return squaredDiffs.reduce((a, b) => a + b, 0) / divisor;
}

function stdDev(arr: number[], isSample: boolean = true): number {
  return Math.sqrt(variance(arr, isSample));
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
}

function quantile(arr: number[], q: number): number {
  return percentile(arr, q * 100);
}

// Normal distribution functions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalCDF(x: number, mu: number = 0, sigma: number = 1): number {
  const z = (x - mu) / sigma;
  // Approximation using error function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * absZ);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ);

  return 0.5 * (1.0 + sign * y);
}

function normalPPF(p: number, mu: number = 0, sigma: number = 1): number {
  // Rational approximation for inverse normal CDF
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return mu;

  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number, result: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    result = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    result = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
             (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    result = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  return mu + sigma * result;
}

// T-distribution (approximation)
function tPPF(p: number, df: number): number {
  // Use normal approximation for large df
  if (df > 100) return normalPPF(p);

  // For smaller df, use a simple approximation
  const z = normalPPF(p);
  const g1 = (z ** 3 + z) / 4;
  const g2 = (5 * z ** 5 + 16 * z ** 3 + 3 * z) / 96;
  const g3 = (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / 384;

  return z + g1 / df + g2 / (df ** 2) + g3 / (df ** 3);
}

// Chi-squared distribution (for df calculation)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function chiSquaredPPF(p: number, df: number): number {
  // Simple approximation using Wilson-Hilferty transformation
  const z = normalPPF(p);
  const term = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df));
  return df * (term ** 3);
}

// Beta distribution functions (for Bayesian)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;
  const B = (gamma(alpha) * gamma(beta)) / gamma(alpha + beta);
  return (x ** (alpha - 1) * (1 - x) ** (beta - 1)) / B;
}

function gamma(z: number): number {
  // Lanczos approximation
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
  ];

  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * (t ** (z + 0.5)) * Math.exp(-t) * x;
}

function betaMean(alpha: number, beta: number): number {
  return alpha / (alpha + beta);
}

function betaVariance(alpha: number, beta: number): number {
  return (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
}

function betaMode(alpha: number, beta: number): number {
  if (alpha <= 1 || beta <= 1) return NaN;
  return (alpha - 1) / (alpha + beta - 2);
}

// ============================================================================
// CONFIDENCE INTERVALS
// ============================================================================

interface ConfidenceInterval {
  lower: number;
  upper: number;
  point: number;
  level: number;
  method: string;
}

function normalConfidenceInterval(
  data: number[],
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  const n = data.length;
  const m = mean(data);
  const s = stdDev(data);
  const se = s / Math.sqrt(n);

  const alpha = 1 - confidenceLevel;
  const z = normalPPF(1 - alpha / 2);

  return {
    lower: m - z * se,
    upper: m + z * se,
    point: m,
    level: confidenceLevel,
    method: 'normal'
  };
}

function tConfidenceInterval(
  data: number[],
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  const n = data.length;
  const m = mean(data);
  const s = stdDev(data);
  const se = s / Math.sqrt(n);

  const alpha = 1 - confidenceLevel;
  const df = n - 1;
  const t = tPPF(1 - alpha / 2, df);

  return {
    lower: m - t * se,
    upper: m + t * se,
    point: m,
    level: confidenceLevel,
    method: 't-distribution'
  };
}

function bootstrapConfidenceInterval(
  data: number[],
  confidenceLevel: number = 0.95,
  nBootstrap: number = 1000,
  statistic: (arr: number[]) => number = mean
): ConfidenceInterval {
  const bootstrapStats: number[] = [];

  for (let i = 0; i < nBootstrap; i++) {
    const sample: number[] = [];
    for (let j = 0; j < data.length; j++) {
      const idx = Math.floor(Math.random() * data.length);
      sample.push(data[idx]);
    }
    bootstrapStats.push(statistic(sample));
  }

  const alpha = 1 - confidenceLevel;
  const lower = quantile(bootstrapStats, alpha / 2);
  const upper = quantile(bootstrapStats, 1 - alpha / 2);

  return {
    lower,
    upper,
    point: statistic(data),
    level: confidenceLevel,
    method: 'bootstrap-percentile'
  };
}

function proportionConfidenceInterval(
  successes: number,
  n: number,
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  // Wilson score interval
  const p = successes / n;
  const alpha = 1 - confidenceLevel;
  const z = normalPPF(1 - alpha / 2);
  const z2 = z ** 2;

  const denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const halfWidth = (z / denominator) * Math.sqrt(p * (1 - p) / n + z2 / (4 * n ** 2));

  return {
    lower: Math.max(0, center - halfWidth),
    upper: Math.min(1, center + halfWidth),
    point: p,
    level: confidenceLevel,
    method: 'wilson-score'
  };
}

// ============================================================================
// BAYESIAN UPDATING
// ============================================================================

interface BayesianBelief {
  distribution: string;
  parameters: Record<string, number>;
  mean: number;
  variance: number;
  mode?: number;
  credibleInterval: { lower: number; upper: number; level: number };
}

function betaBayesianUpdate(
  priorAlpha: number,
  priorBeta: number,
  successes: number,
  failures: number,
  credibleLevel: number = 0.95
): { prior: BayesianBelief; posterior: BayesianBelief; bayesFactor: number } {
  const posteriorAlpha = priorAlpha + successes;
  const posteriorBeta = priorBeta + failures;

  // Calculate credible intervals using quantiles (approximation)
  const alpha = 1 - credibleLevel;

  // For Beta distribution, use normal approximation for credible interval
  const priorMean = betaMean(priorAlpha, priorBeta);
  const priorVar = betaVariance(priorAlpha, priorBeta);
  const priorSd = Math.sqrt(priorVar);

  const posteriorMean = betaMean(posteriorAlpha, posteriorBeta);
  const posteriorVar = betaVariance(posteriorAlpha, posteriorBeta);
  const posteriorSd = Math.sqrt(posteriorVar);

  const z = normalPPF(1 - alpha / 2);

  const prior: BayesianBelief = {
    distribution: 'Beta',
    parameters: { alpha: priorAlpha, beta: priorBeta },
    mean: priorMean,
    variance: priorVar,
    mode: priorAlpha > 1 && priorBeta > 1 ? betaMode(priorAlpha, priorBeta) : undefined,
    credibleInterval: {
      lower: Math.max(0, priorMean - z * priorSd),
      upper: Math.min(1, priorMean + z * priorSd),
      level: credibleLevel
    }
  };

  const posterior: BayesianBelief = {
    distribution: 'Beta',
    parameters: { alpha: posteriorAlpha, beta: posteriorBeta },
    mean: posteriorMean,
    variance: posteriorVar,
    mode: posteriorAlpha > 1 && posteriorBeta > 1 ? betaMode(posteriorAlpha, posteriorBeta) : undefined,
    credibleInterval: {
      lower: Math.max(0, posteriorMean - z * posteriorSd),
      upper: Math.min(1, posteriorMean + z * posteriorSd),
      level: credibleLevel
    }
  };

  // Bayes factor (ratio of marginal likelihoods)
  // For conjugate prior, this has a closed form
  const logBF = (
    Math.log(gamma(priorAlpha + priorBeta)) - Math.log(gamma(priorAlpha)) - Math.log(gamma(priorBeta)) +
    Math.log(gamma(posteriorAlpha)) + Math.log(gamma(posteriorBeta)) - Math.log(gamma(posteriorAlpha + posteriorBeta))
  );

  return {
    prior,
    posterior,
    bayesFactor: Math.exp(logBF)
  };
}

function normalBayesianUpdate(
  priorMean: number,
  priorVariance: number,
  dataPoints: number[],
  knownVariance: number,
  credibleLevel: number = 0.95
): { prior: BayesianBelief; posterior: BayesianBelief } {
  const n = dataPoints.length;
  const dataMean = mean(dataPoints);

  // Posterior parameters
  const priorPrecision = 1 / priorVariance;
  const dataPrecision = n / knownVariance;
  const posteriorPrecision = priorPrecision + dataPrecision;
  const posteriorVariance = 1 / posteriorPrecision;
  const posteriorMean = (priorPrecision * priorMean + dataPrecision * dataMean) / posteriorPrecision;

  const alpha = 1 - credibleLevel;
  const z = normalPPF(1 - alpha / 2);

  const priorSd = Math.sqrt(priorVariance);
  const posteriorSd = Math.sqrt(posteriorVariance);

  const prior: BayesianBelief = {
    distribution: 'Normal',
    parameters: { mean: priorMean, variance: priorVariance },
    mean: priorMean,
    variance: priorVariance,
    mode: priorMean,
    credibleInterval: {
      lower: priorMean - z * priorSd,
      upper: priorMean + z * priorSd,
      level: credibleLevel
    }
  };

  const posterior: BayesianBelief = {
    distribution: 'Normal',
    parameters: { mean: posteriorMean, variance: posteriorVariance },
    mean: posteriorMean,
    variance: posteriorVariance,
    mode: posteriorMean,
    credibleInterval: {
      lower: posteriorMean - z * posteriorSd,
      upper: posteriorMean + z * posteriorSd,
      level: credibleLevel
    }
  };

  return { prior, posterior };
}

// ============================================================================
// EPISTEMIC VS ALEATORIC UNCERTAINTY
// ============================================================================

interface UncertaintyDecomposition {
  total: number;
  epistemic: number;
  aleatoric: number;
  ratio: number;
  interpretation: string;
}

function decomposePredictionUncertainty(
  predictions: number[][],  // Multiple model predictions for each input
  variance_estimates?: number[]  // Optional aleatoric variance estimates
): UncertaintyDecomposition {
  const numModels = predictions.length;
  const numSamples = predictions[0].length;

  // Calculate mean prediction across models for each sample
  const meanPredictions: number[] = [];
  for (let i = 0; i < numSamples; i++) {
    let sum = 0;
    for (let m = 0; m < numModels; m++) {
      sum += predictions[m][i];
    }
    meanPredictions.push(sum / numModels);
  }

  // Epistemic uncertainty: variance of means (model disagreement)
  let epistemicSum = 0;
  for (let i = 0; i < numSamples; i++) {
    for (let m = 0; m < numModels; m++) {
      epistemicSum += (predictions[m][i] - meanPredictions[i]) ** 2;
    }
  }
  const epistemic = epistemicSum / (numModels * numSamples);

  // Aleatoric uncertainty: mean of variances (inherent noise)
  let aleatoric: number;
  if (variance_estimates) {
    aleatoric = mean(variance_estimates);
  } else {
    // Estimate from prediction spread within models
    let aleatoricSum = 0;
    for (let m = 0; m < numModels; m++) {
      aleatoricSum += variance(predictions[m], false);
    }
    aleatoric = aleatoricSum / numModels;
  }

  const total = epistemic + aleatoric;
  const ratio = total > 0 ? epistemic / total : 0;

  let interpretation: string;
  if (ratio > 0.7) {
    interpretation = 'High epistemic uncertainty - more data or better model needed';
  } else if (ratio < 0.3) {
    interpretation = 'High aleatoric uncertainty - inherent noise in data, irreducible';
  } else {
    interpretation = 'Balanced uncertainty - both model and data contribute';
  }

  return {
    total,
    epistemic,
    aleatoric,
    ratio,
    interpretation
  };
}

function ensembleUncertainty(
  predictions: number[][]  // predictions[model][sample]
): {
  meanPrediction: number[];
  stdPrediction: number[];
  entropy: number[];
  mutualInformation: number[];
} {
  const numModels = predictions.length;
  const numSamples = predictions[0].length;

  const meanPrediction: number[] = [];
  const stdPrediction: number[] = [];
  const entropy: number[] = [];
  const mutualInformation: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    const samplePreds = predictions.map(p => p[i]);
    meanPrediction.push(mean(samplePreds));
    stdPrediction.push(stdDev(samplePreds, false));

    // For classification-like predictions (values between 0 and 1)
    const avgProb = meanPrediction[i];
    const avgEntropy = avgProb > 0 && avgProb < 1
      ? -(avgProb * Math.log(avgProb + 1e-10) + (1 - avgProb) * Math.log(1 - avgProb + 1e-10))
      : 0;
    entropy.push(avgEntropy);

    // Mutual information approximation
    let modelEntropies = 0;
    for (let m = 0; m < numModels; m++) {
      const p = predictions[m][i];
      if (p > 0 && p < 1) {
        modelEntropies += -(p * Math.log(p + 1e-10) + (1 - p) * Math.log(1 - p + 1e-10));
      }
    }
    modelEntropies /= numModels;
    mutualInformation.push(avgEntropy - modelEntropies);
  }

  return {
    meanPrediction,
    stdPrediction,
    entropy,
    mutualInformation
  };
}

// ============================================================================
// CALIBRATION METRICS
// ============================================================================

interface CalibrationResult {
  brierScore: number;
  logLoss: number;
  calibrationError: number;
  reliabilityDiagram: Array<{
    binMidpoint: number;
    predictedProb: number;
    actualFreq: number;
    count: number;
  }>;
  isCalibrated: boolean;
  recommendation: string;
}

function calculateCalibration(
  predictions: number[],  // Predicted probabilities
  actuals: number[],      // Actual outcomes (0 or 1)
  numBins: number = 10
): CalibrationResult {
  const n = predictions.length;

  // Brier score
  let brierSum = 0;
  let logLossSum = 0;
  for (let i = 0; i < n; i++) {
    brierSum += (predictions[i] - actuals[i]) ** 2;
    const p = Math.max(1e-10, Math.min(1 - 1e-10, predictions[i]));
    logLossSum += -(actuals[i] * Math.log(p) + (1 - actuals[i]) * Math.log(1 - p));
  }
  const brierScore = brierSum / n;
  const logLoss = logLossSum / n;

  // Reliability diagram
  const reliabilityDiagram: CalibrationResult['reliabilityDiagram'] = [];
  const binWidth = 1 / numBins;

  for (let b = 0; b < numBins; b++) {
    const binLower = b * binWidth;
    const binUpper = (b + 1) * binWidth;
    const binMidpoint = (binLower + binUpper) / 2;

    const inBin = predictions.map((p, i) => ({
      pred: p,
      actual: actuals[i]
    })).filter(x => x.pred >= binLower && x.pred < binUpper);

    if (inBin.length > 0) {
      const predictedProb = mean(inBin.map(x => x.pred));
      const actualFreq = mean(inBin.map(x => x.actual));
      reliabilityDiagram.push({
        binMidpoint,
        predictedProb,
        actualFreq,
        count: inBin.length
      });
    }
  }

  // Expected calibration error (ECE)
  let eceSum = 0;
  for (const bin of reliabilityDiagram) {
    eceSum += (bin.count / n) * Math.abs(bin.predictedProb - bin.actualFreq);
  }
  const calibrationError = eceSum;

  // Determine if well-calibrated
  const isCalibrated = calibrationError < 0.05 && brierScore < 0.25;

  let recommendation: string;
  if (calibrationError < 0.02) {
    recommendation = 'Excellent calibration - predictions match reality well';
  } else if (calibrationError < 0.05) {
    recommendation = 'Good calibration - minor adjustments may help';
  } else if (calibrationError < 0.1) {
    recommendation = 'Moderate calibration issues - consider Platt scaling or isotonic regression';
  } else {
    recommendation = 'Poor calibration - significant recalibration needed';
  }

  return {
    brierScore,
    logLoss,
    calibrationError,
    reliabilityDiagram,
    isCalibrated,
    recommendation
  };
}

function plattScaling(
  predictions: number[],
  actuals: number[],
  learningRate: number = 0.01,
  iterations: number = 1000
): { A: number; B: number; calibratedPredictions: number[] } {
  // Platt scaling: P(y=1|x) = sigmoid(A * f(x) + B)
  let A = 1.0;
  let B = 0.0;

  for (let iter = 0; iter < iterations; iter++) {
    let gradA = 0;
    let gradB = 0;

    for (let i = 0; i < predictions.length; i++) {
      const z = A * predictions[i] + B;
      const p = 1 / (1 + Math.exp(-z));
      const error = p - actuals[i];

      gradA += error * predictions[i];
      gradB += error;
    }

    A -= learningRate * gradA / predictions.length;
    B -= learningRate * gradB / predictions.length;
  }

  const calibratedPredictions = predictions.map(p => {
    const z = A * p + B;
    return 1 / (1 + Math.exp(-z));
  });

  return { A, B, calibratedPredictions };
}

// ============================================================================
// TOOL DEFINITION AND EXECUTION
// ============================================================================

export const uncertaintyquantifierTool: UnifiedTool = {
  name: 'uncertainty_quantifier',
  description: 'Quantify uncertainty - confidence intervals, Bayesian credence, epistemic vs aleatoric',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['confidence', 'bayesian_update', 'epistemic', 'aleatoric', 'calibration', 'info'],
        description: 'Operation to perform'
      },
      // Common parameters
      data: { type: 'array', items: { type: 'number' }, description: 'Data points for analysis' },
      confidenceLevel: { type: 'number', description: 'Confidence/credible level (default 0.95)' },
      // Confidence interval parameters
      method: {
        type: 'string',
        enum: ['normal', 't', 'bootstrap', 'proportion'],
        description: 'CI method'
      },
      successes: { type: 'number', description: 'Number of successes (for proportion CI)' },
      n: { type: 'number', description: 'Sample size (for proportion CI)' },
      nBootstrap: { type: 'number', description: 'Bootstrap iterations (default 1000)' },
      // Bayesian parameters
      priorAlpha: { type: 'number', description: 'Beta prior alpha (default 1)' },
      priorBeta: { type: 'number', description: 'Beta prior beta (default 1)' },
      priorMean: { type: 'number', description: 'Normal prior mean' },
      priorVariance: { type: 'number', description: 'Normal prior variance' },
      knownVariance: { type: 'number', description: 'Known data variance for normal model' },
      distributionType: { type: 'string', enum: ['beta', 'normal'], description: 'Prior distribution type' },
      // Uncertainty decomposition
      predictions: {
        type: 'array',
        items: { type: 'array', items: { type: 'number' } },
        description: 'Multiple model predictions (models x samples)'
      },
      varianceEstimates: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional aleatoric variance estimates'
      },
      // Calibration parameters
      predictedProbs: { type: 'array', items: { type: 'number' }, description: 'Predicted probabilities' },
      actuals: { type: 'array', items: { type: 'number' }, description: 'Actual outcomes (0 or 1)' },
      numBins: { type: 'number', description: 'Number of bins for reliability diagram' },
      calibrate: { type: 'boolean', description: 'Apply Platt scaling calibration' }
    },
    required: ['operation']
  }
};

export async function executeuncertaintyquantifier(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'uncertainty_quantifier',
            description: 'Quantify and reason about uncertainty in predictions and estimates',
            operations: {
              confidence: {
                description: 'Calculate confidence intervals',
                methods: ['normal', 't', 'bootstrap', 'proportion'],
                parameters: ['data', 'confidenceLevel', 'method', 'nBootstrap']
              },
              bayesian_update: {
                description: 'Bayesian belief updating from prior to posterior',
                distributionTypes: ['beta', 'normal'],
                parameters: ['priorAlpha/priorBeta or priorMean/priorVariance', 'data', 'credibleLevel']
              },
              epistemic: {
                description: 'Decompose uncertainty into epistemic (model) and aleatoric (data)',
                parameters: ['predictions (models x samples)', 'varianceEstimates (optional)']
              },
              aleatoric: {
                description: 'Analyze aleatoric (irreducible) uncertainty',
                parameters: ['data', 'predictions']
              },
              calibration: {
                description: 'Assess and improve probability calibration',
                metrics: ['Brier score', 'log loss', 'ECE', 'reliability diagram'],
                parameters: ['predictedProbs', 'actuals', 'numBins', 'calibrate']
              }
            },
            concepts: {
              epistemic: 'Uncertainty from lack of knowledge, reducible with more data/better models',
              aleatoric: 'Inherent randomness in the data, irreducible',
              calibration: 'How well predicted probabilities match actual frequencies',
              credibleInterval: 'Bayesian analog of confidence interval, probability parameter is in range'
            }
          }, null, 2)
        };
      }

      case 'confidence': {
        const data = args.data || [];
        const confidenceLevel = args.confidenceLevel || 0.95;
        const method = args.method || 't';
        const nBootstrap = args.nBootstrap || 1000;
        const successes = args.successes;
        const n = args.n;

        if (method === 'proportion' && (successes === undefined || n === undefined)) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Proportion CI requires successes and n parameters'
            }),
            isError: true
          };
        }

        // Generate example data if none provided
        const sampleData = data.length > 0 ? data : Array(30).fill(0).map(() => 100 + Math.random() * 20 - 10);

        let result: ConfidenceInterval;
        switch (method) {
          case 'normal':
            result = normalConfidenceInterval(sampleData, confidenceLevel);
            break;
          case 't':
            result = tConfidenceInterval(sampleData, confidenceLevel);
            break;
          case 'bootstrap':
            result = bootstrapConfidenceInterval(sampleData, confidenceLevel, nBootstrap);
            break;
          case 'proportion':
            result = proportionConfidenceInterval(successes!, n!, confidenceLevel);
            break;
          default:
            result = tConfidenceInterval(sampleData, confidenceLevel);
        }

        // Calculate all methods for comparison
        const comparison = method !== 'proportion' ? {
          normal: normalConfidenceInterval(sampleData, confidenceLevel),
          t: tConfidenceInterval(sampleData, confidenceLevel),
          bootstrap: bootstrapConfidenceInterval(sampleData, confidenceLevel, Math.min(nBootstrap, 500))
        } : undefined;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'confidence',
            result,
            sampleStats: method !== 'proportion' ? {
              n: sampleData.length,
              mean: mean(sampleData),
              stdDev: stdDev(sampleData),
              min: Math.min(...sampleData),
              max: Math.max(...sampleData)
            } : undefined,
            comparison,
            interpretation: {
              meaning: `We are ${confidenceLevel * 100}% confident the true value lies between ${result.lower.toFixed(4)} and ${result.upper.toFixed(4)}`,
              width: result.upper - result.lower,
              marginOfError: (result.upper - result.lower) / 2
            }
          }, null, 2)
        };
      }

      case 'bayesian_update': {
        const distributionType = args.distributionType || 'beta';
        const confidenceLevel = args.confidenceLevel || 0.95;
        const data = args.data || [];

        if (distributionType === 'beta') {
          const priorAlpha = args.priorAlpha || 1;  // Uniform prior
          const priorBeta = args.priorBeta || 1;

          // Count successes and failures from data (interpret as binary)
          let successes = args.successes;
          let failures = args.failures;

          if (successes === undefined && data.length > 0) {
            successes = data.filter(x => x > 0.5).length;
            failures = data.length - successes;
          } else if (successes === undefined) {
            // Demo data
            successes = 7;
            failures = 3;
          }

          failures = failures || (args.n ? args.n - successes : 10 - successes);

          const result = betaBayesianUpdate(priorAlpha, priorBeta, successes, failures, confidenceLevel);

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'bayesian_update',
              distributionType: 'beta',
              data: { successes, failures, total: successes + failures },
              prior: result.prior,
              posterior: result.posterior,
              update: {
                meanShift: result.posterior.mean - result.prior.mean,
                varianceReduction: 1 - result.posterior.variance / result.prior.variance,
                bayesFactor: result.bayesFactor
              },
              interpretation: {
                prior: `Started with belief: P(success) ~ Beta(${priorAlpha}, ${priorBeta})`,
                posterior: `After observing ${successes} successes and ${failures} failures: P(success) ~ Beta(${result.posterior.parameters.alpha}, ${result.posterior.parameters.beta})`,
                conclusion: `Updated belief: ${(result.posterior.mean * 100).toFixed(1)}% probability of success (${confidenceLevel * 100}% CI: ${(result.posterior.credibleInterval.lower * 100).toFixed(1)}% - ${(result.posterior.credibleInterval.upper * 100).toFixed(1)}%)`
              }
            }, null, 2)
          };
        } else {
          // Normal distribution
          const priorMean = args.priorMean || 0;
          const priorVariance = args.priorVariance || 1;
          const knownVariance = args.knownVariance || 1;

          const sampleData = data.length > 0 ? data : Array(10).fill(0).map(() => priorMean + Math.random() * 2 - 1);

          const result = normalBayesianUpdate(priorMean, priorVariance, sampleData, knownVariance, confidenceLevel);

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'bayesian_update',
              distributionType: 'normal',
              data: {
                n: sampleData.length,
                sampleMean: mean(sampleData),
                knownVariance
              },
              prior: result.prior,
              posterior: result.posterior,
              update: {
                meanShift: result.posterior.mean - result.prior.mean,
                varianceReduction: 1 - result.posterior.variance / result.prior.variance,
                precisionGain: (1 / result.posterior.variance) / (1 / result.prior.variance)
              },
              interpretation: {
                prior: `Started with belief: μ ~ N(${priorMean}, ${priorVariance})`,
                posterior: `After observing ${sampleData.length} points: μ ~ N(${result.posterior.mean.toFixed(4)}, ${result.posterior.variance.toFixed(4)})`,
                conclusion: `Updated estimate: μ = ${result.posterior.mean.toFixed(4)} (${confidenceLevel * 100}% CI: ${result.posterior.credibleInterval.lower.toFixed(4)} - ${result.posterior.credibleInterval.upper.toFixed(4)})`
              }
            }, null, 2)
          };
        }
      }

      case 'epistemic':
      case 'aleatoric': {
        let predictions = args.predictions;
        const varianceEstimates = args.varianceEstimates;

        if (!predictions || predictions.length === 0) {
          // Generate example predictions from multiple models
          const numModels = 5;
          const numSamples = 20;
          predictions = [];

          for (let m = 0; m < numModels; m++) {
            const modelPreds: number[] = [];
            const modelBias = (Math.random() - 0.5) * 0.2;
            for (let s = 0; s < numSamples; s++) {
              modelPreds.push(0.5 + modelBias + (Math.random() - 0.5) * 0.3);
            }
            predictions.push(modelPreds);
          }
        }

        const decomposition = decomposePredictionUncertainty(predictions, varianceEstimates);
        const ensemble = ensembleUncertainty(predictions);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'uncertainty_decomposition',
            input: {
              numModels: predictions.length,
              numSamples: predictions[0].length
            },
            decomposition: {
              total: decomposition.total,
              epistemic: decomposition.epistemic,
              aleatoric: decomposition.aleatoric,
              epistemicRatio: decomposition.ratio,
              interpretation: decomposition.interpretation
            },
            ensemble: {
              meanPrediction: mean(ensemble.meanPrediction),
              avgStd: mean(ensemble.stdPrediction),
              avgEntropy: mean(ensemble.entropy),
              avgMutualInformation: mean(ensemble.mutualInformation)
            },
            recommendations: {
              highEpistemic: decomposition.ratio > 0.5
                ? 'Consider collecting more training data or using a more expressive model'
                : null,
              highAleatoric: decomposition.ratio < 0.5
                ? 'Inherent noise is dominant; focus on robust predictions and proper uncertainty quantification'
                : null
            },
            definitions: {
              epistemic: 'Model uncertainty - reducible with more data/better models (variance across models)',
              aleatoric: 'Data uncertainty - irreducible noise inherent in the problem'
            }
          }, null, 2)
        };
      }

      case 'calibration': {
        let predictedProbs = args.predictedProbs;
        let actuals = args.actuals;
        const numBins = args.numBins || 10;
        const calibrate = args.calibrate || false;

        if (!predictedProbs || !actuals) {
          // Generate example predictions with slight miscalibration
          const n = 100;
          predictedProbs = [];
          actuals = [];

          for (let i = 0; i < n; i++) {
            const trueProb = Math.random();
            // Overconfident predictions
            const pred = trueProb < 0.5 ? trueProb * 0.8 : 0.2 + trueProb * 0.8;
            predictedProbs.push(pred);
            actuals.push(Math.random() < trueProb ? 1 : 0);
          }
        }

        const calibrationResult = calculateCalibration(predictedProbs, actuals, numBins);

        let calibrationAdjustment = null;
        if (calibrate) {
          const scaling = plattScaling(predictedProbs, actuals);
          const calibratedResult = calculateCalibration(scaling.calibratedPredictions, actuals, numBins);

          calibrationAdjustment = {
            plattScaling: {
              A: scaling.A,
              B: scaling.B,
              formula: `P_calibrated = sigmoid(${scaling.A.toFixed(4)} * P_original + ${scaling.B.toFixed(4)})`
            },
            improvement: {
              originalECE: calibrationResult.calibrationError,
              calibratedECE: calibratedResult.calibrationError,
              brierImprovement: calibrationResult.brierScore - calibratedResult.brierScore
            },
            calibratedReliability: calibratedResult.reliabilityDiagram
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'calibration',
            input: {
              numPredictions: predictedProbs.length,
              numBins
            },
            metrics: {
              brierScore: calibrationResult.brierScore,
              logLoss: calibrationResult.logLoss,
              expectedCalibrationError: calibrationResult.calibrationError,
              isWellCalibrated: calibrationResult.isCalibrated
            },
            reliabilityDiagram: calibrationResult.reliabilityDiagram,
            recommendation: calibrationResult.recommendation,
            calibrationAdjustment,
            interpretation: {
              brierScore: 'Mean squared error of probabilistic predictions (0 = perfect, 0.25 = random guessing)',
              ece: 'Weighted average difference between predicted probability and actual frequency',
              reliability: 'Each bin shows predicted vs actual frequency - perfect calibration would be on the diagonal'
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['confidence', 'bayesian_update', 'epistemic', 'aleatoric', 'calibration', 'info']
          }),
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error in uncertainty quantifier tool: ${err}`,
      isError: true
    };
  }
}

export function isuncertaintyquantifierAvailable(): boolean {
  return true;
}
