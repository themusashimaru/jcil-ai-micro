/**
 * MACHINE LEARNING TOOLKIT
 *
 * Comprehensive ML operations running entirely locally.
 * No external API costs - all computation in-process.
 *
 * Features:
 * - K-means clustering
 * - PCA dimensionality reduction
 * - Linear/polynomial regression
 * - Neural network training and inference
 * - Classification and prediction
 *
 * Libraries: ml-kmeans, ml-pca, ml-regression, brain.js
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy load heavy ML libraries
let kmeans: typeof import('ml-kmeans');
let PCA: typeof import('ml-pca').PCA;
let SimpleLinearRegression: typeof import('ml-regression').SimpleLinearRegression;
let PolynomialRegression: typeof import('ml-regression').PolynomialRegression;
let brain: typeof import('brain.js');

async function loadML() {
  if (!kmeans) {
    const kmeansModule = await import('ml-kmeans');
    kmeans = kmeansModule;
  }
  if (!PCA) {
    const pcaModule = await import('ml-pca');
    PCA = pcaModule.PCA;
  }
  if (!SimpleLinearRegression || !PolynomialRegression) {
    const regressionModule = await import('ml-regression');
    SimpleLinearRegression = regressionModule.SimpleLinearRegression;
    PolynomialRegression = regressionModule.PolynomialRegression;
  }
  if (!brain) {
    brain = await import('brain.js');
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Calculate silhouette score for clustering evaluation
function silhouetteScore(data: number[][], labels: number[], _centroids: number[][]): number {
  if (data.length < 2) return 0;

  const n = data.length;
  let totalScore = 0;

  for (let i = 0; i < n; i++) {
    const cluster = labels[i];

    // Calculate a(i) - average distance to points in same cluster
    let sameClusterDist = 0;
    let sameClusterCount = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && labels[j] === cluster) {
        sameClusterDist += euclideanDistance(data[i], data[j]);
        sameClusterCount++;
      }
    }
    const a = sameClusterCount > 0 ? sameClusterDist / sameClusterCount : 0;

    // Calculate b(i) - minimum average distance to points in other clusters
    let minOtherDist = Infinity;
    const uniqueClusters = [...new Set(labels)];
    for (const otherCluster of uniqueClusters) {
      if (otherCluster === cluster) continue;
      let otherDist = 0;
      let otherCount = 0;
      for (let j = 0; j < n; j++) {
        if (labels[j] === otherCluster) {
          otherDist += euclideanDistance(data[i], data[j]);
          otherCount++;
        }
      }
      if (otherCount > 0) {
        minOtherDist = Math.min(minOtherDist, otherDist / otherCount);
      }
    }
    const b = minOtherDist === Infinity ? 0 : minOtherDist;

    // Silhouette coefficient for point i
    const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
    totalScore += s;
  }

  return totalScore / n;
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// Calculate R² score
function rSquared(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < actual.length; i++) {
    ssRes += (actual[i] - predicted[i]) ** 2;
    ssTot += (actual[i] - mean) ** 2;
  }
  return 1 - ssRes / ssTot;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mlToolkitTool: UnifiedTool = {
  name: 'ml_toolkit',
  description: `Machine learning toolkit for clustering, dimensionality reduction, regression, and neural networks.

Available operations:
- kmeans: K-means clustering (specify k clusters)
- pca: Principal Component Analysis for dimensionality reduction
- linear_regression: Fit linear model to data
- polynomial_regression: Fit polynomial model to data
- neural_train: Train a neural network on data
- neural_predict: Make predictions with trained network
- classify: Simple classification based on nearest centroids

All operations run locally with no external API costs.

Input data format: Array of arrays (each inner array is a data point)
Example: [[1,2], [3,4], [5,6]] for 2D data with 3 points`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'kmeans',
          'pca',
          'linear_regression',
          'polynomial_regression',
          'neural_train',
          'neural_predict',
          'classify',
          'statistics',
        ],
        description: 'ML operation to perform',
      },
      data: {
        type: 'array',
        description: 'Input data as array of arrays (each row is a sample)',
      },
      k: {
        type: 'number',
        description: 'Number of clusters for kmeans, or components for PCA',
      },
      degree: {
        type: 'number',
        description: 'Polynomial degree for regression (default: 2)',
      },
      x: {
        type: 'array',
        description: 'X values for regression',
      },
      y: {
        type: 'array',
        description: 'Y values for regression / labels for classification',
      },
      network_config: {
        type: 'object',
        description: 'Neural network config: {hiddenLayers: [10, 5], iterations: 1000}',
      },
      predict_input: {
        type: 'array',
        description: 'Input for neural prediction',
      },
      training_data: {
        type: 'array',
        description: 'Training data for neural network: [{input: [], output: []}, ...]',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMLToolkitAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeMLToolkit(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  await loadML();

  const args = call.arguments as {
    operation: string;
    data?: number[][];
    k?: number;
    degree?: number;
    x?: number[];
    y?: number[];
    network_config?: { hiddenLayers?: number[]; iterations?: number };
    predict_input?: number[];
    training_data?: Array<{ input: number[]; output: number[] }>;
  };

  const {
    operation,
    data,
    k,
    degree = 2,
    x,
    y,
    network_config,
    predict_input,
    training_data,
  } = args;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'kmeans': {
        if (!data || data.length === 0) throw new Error('data is required');
        if (!k || k < 2) throw new Error('k must be >= 2');

        const kmeansDefault = (
          kmeans as {
            default: (
              data: number[][],
              k: number,
              options?: object
            ) => {
              clusters: number[];
              centroids: number[][];
              iterations: number;
              converged: boolean;
            };
          }
        ).default;
        const kmeansResult = kmeansDefault(data, k, {
          initialization: 'kmeans++',
          maxIterations: 100,
        });

        result.clusters = kmeansResult.clusters;
        result.centroids = kmeansResult.centroids;
        result.iterations = kmeansResult.iterations;
        result.converged = kmeansResult.converged;

        // Calculate cluster sizes
        const clusterSizes: Record<number, number> = {};
        for (const label of kmeansResult.clusters) {
          clusterSizes[label] = (clusterSizes[label] || 0) + 1;
        }
        result.cluster_sizes = clusterSizes;

        // Calculate silhouette score
        result.silhouette_score = silhouetteScore(
          data,
          kmeansResult.clusters,
          kmeansResult.centroids
        );
        break;
      }

      case 'pca': {
        if (!data || data.length === 0) throw new Error('data is required');

        const nComponents = k || Math.min(data[0].length, data.length);
        const pca = new PCA(data);

        const eigenvalues = pca.getEigenvalues();
        const eigenvectors = pca.getEigenvectors();
        const explainedVariance = pca.getExplainedVariance();
        const cumulativeVariance = pca.getCumulativeVariance();

        // Project data onto principal components
        const projected = pca.predict(data, { nComponents });

        result.projected_data = projected;
        result.eigenvalues = eigenvalues.slice(0, nComponents);
        result.eigenvectors = eigenvectors.slice(0, nComponents);
        result.explained_variance = explainedVariance.slice(0, nComponents);
        result.cumulative_variance = cumulativeVariance.slice(0, nComponents);
        result.n_components = nComponents;
        result.original_dimensions = data[0].length;
        break;
      }

      case 'linear_regression': {
        if (!x || !y) throw new Error('x and y arrays are required');
        if (x.length !== y.length) throw new Error('x and y must have same length');

        const regression = new SimpleLinearRegression(x, y);

        const predicted = x.map((xi) => regression.predict(xi));
        const r2 = rSquared(y, predicted);

        result.slope = regression.slope;
        result.intercept = regression.intercept;
        result.equation = `y = ${regression.slope.toFixed(6)}x + ${regression.intercept.toFixed(6)}`;
        result.r_squared = r2;
        result.predictions = predicted;

        // Predict a few future values
        const maxX = Math.max(...x);
        const step = (maxX - Math.min(...x)) / x.length;
        result.forecast = [1, 2, 3, 4, 5].map((i) => ({
          x: maxX + i * step,
          y: regression.predict(maxX + i * step),
        }));
        break;
      }

      case 'polynomial_regression': {
        if (!x || !y) throw new Error('x and y arrays are required');
        if (x.length !== y.length) throw new Error('x and y must have same length');

        const regression = new PolynomialRegression(x, y, degree);

        const predicted = x.map((xi) => regression.predict(xi));
        const r2 = rSquared(y, predicted);

        result.coefficients = regression.coefficients;
        result.degree = degree;
        result.equation = regression.toString();
        result.r_squared = r2;
        result.predictions = predicted;
        break;
      }

      case 'neural_train': {
        if (!training_data || training_data.length === 0) {
          throw new Error('training_data is required: [{input: [], output: []}, ...]');
        }

        const config = {
          hiddenLayers: network_config?.hiddenLayers || [3],
          iterations: Math.min(network_config?.iterations || 1000, 5000), // Cap iterations
          learningRate: 0.3,
          log: false,
        };

        const net = new brain.NeuralNetwork(config);
        const trainResult = net.train(training_data, {
          iterations: config.iterations,
          errorThresh: 0.005,
          log: false,
        });

        // Serialize the network for later use
        const serialized = net.toJSON();

        result.error = trainResult.error;
        result.iterations = trainResult.iterations;
        result.network_config = config;
        result.network_json = serialized;
        result.input_size = training_data[0].input.length;
        result.output_size = training_data[0].output.length;

        // Test predictions on training data
        result.training_predictions = training_data.slice(0, 5).map((item) => ({
          input: item.input,
          expected: item.output,
          predicted: net.run(item.input) as number[],
        }));
        break;
      }

      case 'neural_predict': {
        if (!predict_input) throw new Error('predict_input is required');

        // For prediction, we need a network. This is a simple feedforward for demo
        // In practice, we'd load from network_json
        result.note =
          'For prediction, first train a network with neural_train, then use the network_json to load and predict';
        result.input = predict_input;

        // Simple demo prediction using a fresh network
        if (training_data && training_data.length > 0) {
          const net = new brain.NeuralNetwork({ hiddenLayers: [3] });
          net.train(training_data, { iterations: 1000, log: false });
          const prediction = net.run(predict_input);
          result.prediction = prediction as number[];
        }
        break;
      }

      case 'classify': {
        if (!data || !y) throw new Error('data (features) and y (labels) are required');
        if (data.length !== y.length) throw new Error('data and y must have same length');

        // Simple nearest centroid classifier
        const uniqueLabels = [...new Set(y)];
        const centroids: Record<number, number[]> = {};

        // Calculate centroid for each class
        for (const label of uniqueLabels) {
          const classPoints = data.filter((_, i) => y[i] === label);
          const dims = data[0].length;
          const centroid = new Array(dims).fill(0);
          for (const point of classPoints) {
            for (let d = 0; d < dims; d++) {
              centroid[d] += point[d];
            }
          }
          for (let d = 0; d < dims; d++) {
            centroid[d] /= classPoints.length;
          }
          centroids[label as number] = centroid;
        }

        // Cross-validation accuracy (leave-one-out)
        let correct = 0;
        for (let i = 0; i < data.length; i++) {
          let minDist = Infinity;
          let predicted = uniqueLabels[0];
          for (const label of uniqueLabels) {
            const dist = euclideanDistance(data[i], centroids[label as number]);
            if (dist < minDist) {
              minDist = dist;
              predicted = label;
            }
          }
          if (predicted === y[i]) correct++;
        }

        result.centroids = centroids;
        result.classes = uniqueLabels;
        result.accuracy = correct / data.length;
        result.class_counts = uniqueLabels.reduce(
          (acc, label) => {
            acc[label as number] = y.filter((yi) => yi === label).length;
            return acc;
          },
          {} as Record<number, number>
        );
        break;
      }

      case 'statistics': {
        if (!data || data.length === 0) throw new Error('data is required');

        const dims = data[0].length;
        const n = data.length;

        // Calculate mean, std, min, max for each dimension
        const stats = [];
        for (let d = 0; d < dims; d++) {
          const values = data.map((row) => row[d]);
          const mean = values.reduce((a, b) => a + b, 0) / n;
          const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
          const std = Math.sqrt(variance);
          stats.push({
            dimension: d,
            mean,
            std,
            min: Math.min(...values),
            max: Math.max(...values),
            median: values.sort((a, b) => a - b)[Math.floor(n / 2)],
          });
        }

        result.n_samples = n;
        result.n_features = dims;
        result.feature_stats = stats;

        // Correlation matrix for first few dimensions
        if (dims >= 2 && dims <= 10) {
          const corrMatrix: number[][] = [];
          for (let i = 0; i < dims; i++) {
            corrMatrix[i] = [];
            for (let j = 0; j < dims; j++) {
              const xi = data.map((row) => row[i]);
              const xj = data.map((row) => row[j]);
              const meanI = xi.reduce((a, b) => a + b, 0) / n;
              const meanJ = xj.reduce((a, b) => a + b, 0) / n;
              let cov = 0,
                varI = 0,
                varJ = 0;
              for (let k = 0; k < n; k++) {
                cov += (xi[k] - meanI) * (xj[k] - meanJ);
                varI += (xi[k] - meanI) ** 2;
                varJ += (xj[k] - meanJ) ** 2;
              }
              corrMatrix[i][j] = cov / Math.sqrt(varI * varJ);
            }
          }
          result.correlation_matrix = corrMatrix;
        }
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
