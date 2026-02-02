/**
 * K-MEANS CLUSTERING TOOL
 * Cluster analysis and visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Point { x: number; y: number; cluster?: number; }
interface Centroid { x: number; y: number; }
interface ClusterResult { centroids: Centroid[]; assignments: number[]; iterations: number; wcss: number; }

function euclideanDistance(p1: Point, p2: Point | Centroid): number {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function initializeCentroids(points: Point[], k: number): Centroid[] {
  // K-means++ initialization
  const centroids: Centroid[] = [];
  const indices: number[] = [];

  // First centroid is random
  const firstIdx = Math.floor(Math.random() * points.length);
  centroids.push({ x: points[firstIdx].x, y: points[firstIdx].y });
  indices.push(firstIdx);

  // Remaining centroids chosen with probability proportional to distance squared
  while (centroids.length < k) {
    const distances: number[] = points.map(p => {
      const minDist = Math.min(...centroids.map(c => euclideanDistance(p, c)));
      return minDist * minDist;
    });
    const totalDist = distances.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalDist;

    for (let i = 0; i < points.length; i++) {
      random -= distances[i];
      if (random <= 0 && !indices.includes(i)) {
        centroids.push({ x: points[i].x, y: points[i].y });
        indices.push(i);
        break;
      }
    }
  }

  return centroids;
}

function assignClusters(points: Point[], centroids: Centroid[]): number[] {
  return points.map(p => {
    let minDist = Infinity;
    let cluster = 0;
    for (let c = 0; c < centroids.length; c++) {
      const dist = euclideanDistance(p, centroids[c]);
      if (dist < minDist) {
        minDist = dist;
        cluster = c;
      }
    }
    return cluster;
  });
}

function updateCentroids(points: Point[], assignments: number[], k: number): Centroid[] {
  const newCentroids: Centroid[] = [];

  for (let c = 0; c < k; c++) {
    const clusterPoints = points.filter((_, i) => assignments[i] === c);
    if (clusterPoints.length > 0) {
      newCentroids.push({
        x: clusterPoints.reduce((sum, p) => sum + p.x, 0) / clusterPoints.length,
        y: clusterPoints.reduce((sum, p) => sum + p.y, 0) / clusterPoints.length
      });
    } else {
      // Keep old centroid if no points assigned
      newCentroids.push(initializeCentroids(points, 1)[0]);
    }
  }

  return newCentroids;
}

function calculateWCSS(points: Point[], centroids: Centroid[], assignments: number[]): number {
  let wcss = 0;
  for (let i = 0; i < points.length; i++) {
    wcss += Math.pow(euclideanDistance(points[i], centroids[assignments[i]]), 2);
  }
  return Math.round(wcss * 100) / 100;
}

function kmeans(points: Point[], k: number, maxIterations: number = 100): ClusterResult {
  let centroids = initializeCentroids(points, k);
  let assignments = assignClusters(points, centroids);
  let iterations = 0;

  for (let iter = 0; iter < maxIterations; iter++) {
    const newCentroids = updateCentroids(points, assignments, k);
    const newAssignments = assignClusters(points, newCentroids);

    iterations++;

    // Check convergence
    const changed = newAssignments.some((a, i) => a !== assignments[i]);
    if (!changed) break;

    centroids = newCentroids;
    assignments = newAssignments;
  }

  return {
    centroids: centroids.map(c => ({ x: Math.round(c.x * 100) / 100, y: Math.round(c.y * 100) / 100 })),
    assignments,
    iterations,
    wcss: calculateWCSS(points, centroids, assignments)
  };
}

function elbowMethod(points: Point[], maxK: number = 10): Array<{ k: number; wcss: number }> {
  const results: Array<{ k: number; wcss: number }> = [];
  for (let k = 1; k <= maxK; k++) {
    const result = kmeans(points, k);
    results.push({ k, wcss: result.wcss });
  }
  return results;
}

function silhouetteScore(points: Point[], assignments: number[], k: number): number {
  if (points.length < 2 || k < 2) return 0;

  let totalSilhouette = 0;

  for (let i = 0; i < points.length; i++) {
    const cluster = assignments[i];
    const sameCluster = points.filter((_, j) => assignments[j] === cluster && j !== i);

    if (sameCluster.length === 0) continue;

    // a(i) - average distance to same cluster
    const a = sameCluster.reduce((sum, p) => sum + euclideanDistance(points[i], p), 0) / sameCluster.length;

    // b(i) - minimum average distance to other clusters
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === cluster) continue;
      const otherCluster = points.filter((_, j) => assignments[j] === c);
      if (otherCluster.length === 0) continue;
      const avgDist = otherCluster.reduce((sum, p) => sum + euclideanDistance(points[i], p), 0) / otherCluster.length;
      b = Math.min(b, avgDist);
    }

    if (b === Infinity) continue;
    const s = (b - a) / Math.max(a, b);
    totalSilhouette += s;
  }

  return Math.round((totalSilhouette / points.length) * 1000) / 1000;
}

function generateClusteredData(numClusters: number = 3, pointsPerCluster: number = 30): Point[] {
  const points: Point[] = [];
  const centers = [
    { x: 2, y: 2 }, { x: 8, y: 2 }, { x: 5, y: 8 },
    { x: 2, y: 8 }, { x: 8, y: 8 }
  ].slice(0, numClusters);

  for (const center of centers) {
    for (let i = 0; i < pointsPerCluster; i++) {
      points.push({
        x: center.x + (Math.random() - 0.5) * 3,
        y: center.y + (Math.random() - 0.5) * 3
      });
    }
  }

  return points;
}

function clusterToAscii(points: Point[], assignments: number[], centroids: Centroid[], width: number = 40, height: number = 20): string {
  const symbols = ['●', '■', '▲', '◆', '★'];
  const centroidSymbol = '✚';

  const allX = [...points.map(p => p.x), ...centroids.map(c => c.x)];
  const allY = [...points.map(p => p.y), ...centroids.map(c => c.y)];
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1;

  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Plot points
  for (let i = 0; i < points.length; i++) {
    const x = Math.floor(((points[i].x - minX) / rangeX) * (width - 1));
    const y = height - 1 - Math.floor(((points[i].y - minY) / rangeY) * (height - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = symbols[assignments[i] % symbols.length];
    }
  }

  // Plot centroids
  for (const c of centroids) {
    const x = Math.floor(((c.x - minX) / rangeX) * (width - 1));
    const y = height - 1 - Math.floor(((c.y - minY) / rangeY) * (height - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = centroidSymbol;
    }
  }

  const lines = grid.map(row => row.join(''));
  lines.push(`Legend: ${symbols.slice(0, centroids.length).map((s, i) => `${s}=Cluster${i}`).join(' ')} ${centroidSymbol}=Centroid`);

  return lines.join('\n');
}

export const kmeansClusteringTool: UnifiedTool = {
  name: 'kmeans_clustering',
  description: 'K-Means: cluster, elbow, silhouette, visualize, generate_data, demo',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['cluster', 'elbow', 'silhouette', 'visualize', 'generate_data', 'demo', 'info'] },
      k: { type: 'number' },
      points: { type: 'array' },
      numClusters: { type: 'number' },
      pointsPerCluster: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeKmeansClustering(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'cluster':
        const clusterPoints = args.points || generateClusteredData(3, 20);
        const k = args.k || 3;
        const clusterResult = kmeans(clusterPoints, k);
        result = {
          k,
          numPoints: clusterPoints.length,
          ...clusterResult,
          clusterSizes: Array.from({ length: k }, (_, i) => clusterResult.assignments.filter(a => a === i).length)
        };
        break;
      case 'elbow':
        const elbowPoints = generateClusteredData(3, 30);
        const elbowResults = elbowMethod(elbowPoints, args.maxK || 8);
        result = {
          method: 'Elbow Method',
          results: elbowResults,
          recommendation: 'Look for the "elbow" where WCSS decrease slows'
        };
        break;
      case 'silhouette':
        const silPoints = generateClusteredData(args.numClusters || 3, 25);
        const silResult = kmeans(silPoints, args.k || 3);
        const score = silhouetteScore(silPoints, silResult.assignments, args.k || 3);
        result = {
          k: args.k || 3,
          silhouetteScore: score,
          interpretation: score > 0.5 ? 'Good clustering' : score > 0.25 ? 'Fair clustering' : 'Poor clustering'
        };
        break;
      case 'visualize':
        const vizPoints = generateClusteredData(args.numClusters || 3, 20);
        const vizResult = kmeans(vizPoints, args.k || 3);
        result = { ascii: clusterToAscii(vizPoints, vizResult.assignments, vizResult.centroids) };
        break;
      case 'generate_data':
        const genPoints = generateClusteredData(args.numClusters || 3, args.pointsPerCluster || 20);
        result = {
          points: genPoints.slice(0, 10),
          totalPoints: genPoints.length,
          trueClusters: args.numClusters || 3
        };
        break;
      case 'demo':
        const demoPoints = generateClusteredData(3, 25);
        const demoResult = kmeans(demoPoints, 3);
        const demoSilhouette = silhouetteScore(demoPoints, demoResult.assignments, 3);
        result = {
          problem: '3-cluster demonstration',
          points: demoPoints.length,
          ...demoResult,
          silhouetteScore: demoSilhouette,
          visualization: clusterToAscii(demoPoints, demoResult.assignments, demoResult.centroids)
        };
        break;
      case 'info':
        result = {
          description: 'K-Means clustering algorithm',
          initialization: 'K-means++ for better convergence',
          metrics: ['WCSS (Within-Cluster Sum of Squares)', 'Silhouette Score'],
          methods: ['Elbow method for k selection', 'Silhouette analysis'],
          features: ['ASCII visualization', 'Cluster statistics']
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isKmeansClusteringAvailable(): boolean { return true; }
