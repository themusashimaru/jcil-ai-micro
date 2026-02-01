/**
 * Type declarations for ML libraries
 */

declare module 'ml-regression' {
  export class SimpleLinearRegression {
    constructor(x: number[], y: number[]);
    slope: number;
    intercept: number;
    coefficients: number[];
    predict(x: number): number;
    score(x: number[], y: number[]): number;
  }

  export class PolynomialRegression {
    constructor(x: number[], y: number[], degree: number);
    degree: number;
    coefficients: number[];
    predict(x: number): number;
    score(x: number[], y: number[]): number;
  }
}

declare module 'ml-kmeans' {
  interface KMeansResult {
    clusters: number[];
    centroids: number[][];
    converged: boolean;
    iterations: number;
  }

  interface KMeansOptions {
    maxIterations?: number;
    tolerance?: number;
    initialization?: 'random' | 'kmeans++';
  }

  export default function kmeans(
    data: number[][],
    k: number,
    options?: KMeansOptions
  ): KMeansResult;
}

declare module 'ml-pca' {
  interface PCAResult {
    U: number[][];
    S: number[];
    means: number[];
    stdevs: number[];
  }

  export class PCA {
    constructor(data: number[][], options?: { center?: boolean; scale?: boolean });
    predict(data: number[][], options?: { nComponents?: number }): number[][];
    getExplainedVariance(): number[];
    getCumulativeVariance(): number[];
    getLoadings(): number[][];
    getEigenvalues(): number[];
    getEigenvectors(): number[][];
  }
}

declare module 'brain.js' {
  interface NeuralNetworkOptions {
    hiddenLayers?: number[];
    activation?: 'sigmoid' | 'relu' | 'leaky-relu' | 'tanh';
    learningRate?: number;
    iterations?: number;
    errorThresh?: number;
    log?: boolean;
    logPeriod?: number;
    momentum?: number;
  }

  interface TrainingData {
    input: number[] | Record<string, number>;
    output: number[] | Record<string, number>;
  }

  interface TrainResult {
    error: number;
    iterations: number;
  }

  export class NeuralNetwork {
    constructor(options?: NeuralNetworkOptions);
    train(data: TrainingData[], options?: NeuralNetworkOptions): TrainResult;
    run(input: number[] | Record<string, number>): number[] | Record<string, number>;
    toJSON(): object;
    fromJSON(json: object): void;
  }
}
