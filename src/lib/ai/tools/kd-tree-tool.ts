/**
 * KD-TREE TOOL
 * k-dimensional tree spatial data structure for efficient spatial searching
 *
 * Features:
 * - Tree construction with median splitting
 * - Nearest neighbor search
 * - k-nearest neighbors search
 * - Range/box queries
 * - Ball queries (radius search)
 * - Tree balancing and optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const kdtreeTool: UnifiedTool = {
  name: 'kd_tree',
  description: 'k-d tree for spatial searching, nearest neighbor queries, and range searches in multi-dimensional spaces',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['build', 'nearest', 'knn', 'range_search', 'ball_query', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      points: {
        type: 'array',
        items: {
          type: 'array',
          items: { type: 'number' }
        },
        description: 'Array of points (each point is array of coordinates)'
      },
      query_point: {
        type: 'array',
        items: { type: 'number' },
        description: 'Query point for nearest neighbor searches'
      },
      k: {
        type: 'number',
        description: 'Number of nearest neighbors for knn search'
      },
      min_bounds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Minimum bounds for range query'
      },
      max_bounds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Maximum bounds for range query'
      },
      radius: {
        type: 'number',
        description: 'Radius for ball query'
      },
      dimensions: {
        type: 'number',
        description: 'Number of dimensions (inferred from points if not specified)'
      }
    },
    required: ['operation']
  }
};

// K-d tree node
interface KDNode {
  point: number[];
  index: number;
  splitDimension: number;
  left: KDNode | null;
  right: KDNode | null;
}

// Priority queue element for knn
interface PQElement {
  point: number[];
  index: number;
  distance: number;
}

// Build k-d tree recursively with median splitting
function buildKDTree(
  points: number[][],
  indices: number[],
  depth: number,
  dimensions: number
): KDNode | null {
  if (indices.length === 0) return null;

  const axis = depth % dimensions;

  // Sort by current axis
  indices.sort((a, b) => points[a][axis] - points[b][axis]);

  // Find median
  const medianIdx = Math.floor(indices.length / 2);
  const medianPointIdx = indices[medianIdx];

  return {
    point: points[medianPointIdx],
    index: medianPointIdx,
    splitDimension: axis,
    left: buildKDTree(points, indices.slice(0, medianIdx), depth + 1, dimensions),
    right: buildKDTree(points, indices.slice(medianIdx + 1), depth + 1, dimensions)
  };
}

// Euclidean distance squared
function distanceSquared(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

// Manhattan distance
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function manhattanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

// Nearest neighbor search
function nearestNeighbor(
  node: KDNode | null,
  query: number[],
  best: { node: KDNode | null; distSq: number }
): void {
  if (node === null) return;

  const distSq = distanceSquared(node.point, query);

  if (distSq < best.distSq) {
    best.distSq = distSq;
    best.node = node;
  }

  const axis = node.splitDimension;
  const diff = query[axis] - node.point[axis];

  // Search closer side first
  const first = diff < 0 ? node.left : node.right;
  const second = diff < 0 ? node.right : node.left;

  nearestNeighbor(first, query, best);

  // Check if we need to search the other side
  if (diff * diff < best.distSq) {
    nearestNeighbor(second, query, best);
  }
}

// K-nearest neighbors with max heap
function kNearestNeighbors(
  node: KDNode | null,
  query: number[],
  k: number,
  heap: PQElement[]
): void {
  if (node === null) return;

  const distSq = distanceSquared(node.point, query);

  if (heap.length < k) {
    // Add to heap
    heap.push({ point: node.point, index: node.index, distance: distSq });
    // Heapify up
    let i = heap.length - 1;
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (heap[parent].distance < heap[i].distance) {
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      } else break;
    }
  } else if (distSq < heap[0].distance) {
    // Replace root
    heap[0] = { point: node.point, index: node.index, distance: distSq };
    // Heapify down
    let i = 0;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let largest = i;
      if (left < heap.length && heap[left].distance > heap[largest].distance) {
        largest = left;
      }
      if (right < heap.length && heap[right].distance > heap[largest].distance) {
        largest = right;
      }
      if (largest !== i) {
        [heap[i], heap[largest]] = [heap[largest], heap[i]];
        i = largest;
      } else break;
    }
  }

  const axis = node.splitDimension;
  const diff = query[axis] - node.point[axis];

  const first = diff < 0 ? node.left : node.right;
  const second = diff < 0 ? node.right : node.left;

  kNearestNeighbors(first, query, k, heap);

  // Check if we need to search other side
  if (heap.length < k || diff * diff < heap[0].distance) {
    kNearestNeighbors(second, query, k, heap);
  }
}

// Range search (axis-aligned bounding box)
function rangeSearch(
  node: KDNode | null,
  minBounds: number[],
  maxBounds: number[],
  results: { point: number[]; index: number }[]
): void {
  if (node === null) return;

  // Check if point is in range
  let inRange = true;
  for (let i = 0; i < node.point.length; i++) {
    if (node.point[i] < minBounds[i] || node.point[i] > maxBounds[i]) {
      inRange = false;
      break;
    }
  }

  if (inRange) {
    results.push({ point: node.point, index: node.index });
  }

  const axis = node.splitDimension;

  // Check if we need to search left subtree
  if (minBounds[axis] <= node.point[axis]) {
    rangeSearch(node.left, minBounds, maxBounds, results);
  }

  // Check if we need to search right subtree
  if (maxBounds[axis] >= node.point[axis]) {
    rangeSearch(node.right, minBounds, maxBounds, results);
  }
}

// Ball query (radius search)
function ballQuery(
  node: KDNode | null,
  center: number[],
  radiusSq: number,
  results: { point: number[]; index: number; distance: number }[]
): void {
  if (node === null) return;

  const distSq = distanceSquared(node.point, center);

  if (distSq <= radiusSq) {
    results.push({ point: node.point, index: node.index, distance: Math.sqrt(distSq) });
  }

  const axis = node.splitDimension;
  const diff = center[axis] - node.point[axis];

  const first = diff < 0 ? node.left : node.right;
  const second = diff < 0 ? node.right : node.left;

  ballQuery(first, center, radiusSq, results);

  // Check if ball intersects splitting plane
  if (diff * diff <= radiusSq) {
    ballQuery(second, center, radiusSq, results);
  }
}

// Calculate tree depth
function treeDepth(node: KDNode | null): number {
  if (node === null) return 0;
  return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}

// Count nodes
function countNodes(node: KDNode | null): number {
  if (node === null) return 0;
  return 1 + countNodes(node.left) + countNodes(node.right);
}

// Calculate tree balance factor
function balanceFactor(node: KDNode | null): number {
  if (node === null) return 0;
  const leftDepth = treeDepth(node.left);
  const rightDepth = treeDepth(node.right);
  return leftDepth - rightDepth;
}

// Get all points from tree (in-order traversal)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getAllPoints(node: KDNode | null, points: { point: number[]; index: number }[]): void {
  if (node === null) return;
  getAllPoints(node.left, points);
  points.push({ point: node.point, index: node.index });
  getAllPoints(node.right, points);
}

// Compute bounding box of points
function computeBoundingBox(points: number[][]): { min: number[]; max: number[] } {
  if (points.length === 0) {
    return { min: [], max: [] };
  }

  const dims = points[0].length;
  const min = [...points[0]];
  const max = [...points[0]];

  for (const p of points) {
    for (let i = 0; i < dims; i++) {
      if (p[i] < min[i]) min[i] = p[i];
      if (p[i] > max[i]) max[i] = p[i];
    }
  }

  return { min, max };
}

// Generate visualization of tree structure
function visualizeTree(node: KDNode | null, prefix: string = '', isLast: boolean = true): string[] {
  if (node === null) return [];

  const lines: string[] = [];
  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';

  lines.push(`${prefix}${connector}[d${node.splitDimension}] (${node.point.map(v => v.toFixed(2)).join(', ')})`);

  const children: (KDNode | null)[] = [node.left, node.right];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const childLabels = ['L', 'R'];

  for (let i = 0; i < children.length; i++) {
    if (children[i] !== null) {
      const childLines = visualizeTree(children[i], prefix + extension, i === children.length - 1 || children[i + 1] === null);
      lines.push(...childLines);
    }
  }

  return lines;
}

// Analyze point distribution
function analyzeDistribution(points: number[][]): {
  mean: number[];
  variance: number[];
  correlations: number[][];
} {
  if (points.length === 0) {
    return { mean: [], variance: [], correlations: [] };
  }

  const n = points.length;
  const dims = points[0].length;

  // Calculate mean
  const mean = new Array(dims).fill(0);
  for (const p of points) {
    for (let i = 0; i < dims; i++) {
      mean[i] += p[i];
    }
  }
  for (let i = 0; i < dims; i++) {
    mean[i] /= n;
  }

  // Calculate variance
  const variance = new Array(dims).fill(0);
  for (const p of points) {
    for (let i = 0; i < dims; i++) {
      const diff = p[i] - mean[i];
      variance[i] += diff * diff;
    }
  }
  for (let i = 0; i < dims; i++) {
    variance[i] /= n;
  }

  // Calculate correlation matrix
  const correlations: number[][] = [];
  for (let i = 0; i < dims; i++) {
    correlations[i] = [];
    for (let j = 0; j < dims; j++) {
      let cov = 0;
      for (const p of points) {
        cov += (p[i] - mean[i]) * (p[j] - mean[j]);
      }
      cov /= n;

      const stdI = Math.sqrt(variance[i]);
      const stdJ = Math.sqrt(variance[j]);

      correlations[i][j] = stdI > 0 && stdJ > 0 ? cov / (stdI * stdJ) : (i === j ? 1 : 0);
    }
  }

  return { mean, variance, correlations };
}

// Generate sample points for demo
function generateSamplePoints(type: string, n: number, dims: number): number[][] {
  const points: number[][] = [];

  switch (type) {
    case 'uniform':
      for (let i = 0; i < n; i++) {
        const p: number[] = [];
        for (let d = 0; d < dims; d++) {
          p.push(Math.random() * 100);
        }
        points.push(p);
      }
      break;

    case 'gaussian':
      for (let i = 0; i < n; i++) {
        const p: number[] = [];
        for (let d = 0; d < dims; d++) {
          // Box-Muller transform
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          p.push(50 + z * 15);
        }
        points.push(p);
      }
      break;

    case 'clustered':
      const numClusters = Math.min(5, Math.ceil(n / 10));
      const centers: number[][] = [];
      for (let c = 0; c < numClusters; c++) {
        const center: number[] = [];
        for (let d = 0; d < dims; d++) {
          center.push(Math.random() * 80 + 10);
        }
        centers.push(center);
      }

      for (let i = 0; i < n; i++) {
        const center = centers[i % numClusters];
        const p: number[] = [];
        for (let d = 0; d < dims; d++) {
          p.push(center[d] + (Math.random() - 0.5) * 20);
        }
        points.push(p);
      }
      break;

    case 'grid':
      const gridSize = Math.ceil(Math.pow(n, 1 / dims));
      let count = 0;
      const indices = new Array(dims).fill(0);
      while (count < n) {
        const p: number[] = [];
        for (let d = 0; d < dims; d++) {
          p.push(indices[d] * (100 / (gridSize - 1 || 1)));
        }
        points.push(p);
        count++;

        // Increment indices
        let carry = true;
        for (let d = 0; d < dims && carry; d++) {
          indices[d]++;
          if (indices[d] >= gridSize) {
            indices[d] = 0;
          } else {
            carry = false;
          }
        }
        if (carry) break;
      }
      break;

    default:
      // Random points
      for (let i = 0; i < n; i++) {
        const p: number[] = [];
        for (let d = 0; d < dims; d++) {
          p.push(Math.random() * 100);
        }
        points.push(p);
      }
  }

  return points;
}

export async function executekdtree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'kd_tree',
          description: 'K-dimensional tree for efficient spatial searching',
          operations: {
            build: 'Construct k-d tree from points with median splitting',
            nearest: 'Find single nearest neighbor to query point',
            knn: 'Find k nearest neighbors to query point',
            range_search: 'Find all points within axis-aligned bounding box',
            ball_query: 'Find all points within radius of center point',
            analyze: 'Analyze tree structure and point distribution'
          },
          features: [
            'Median-based balanced tree construction',
            'O(log n) average nearest neighbor search',
            'K-nearest neighbors with max-heap pruning',
            'Range queries for axis-aligned boxes',
            'Ball queries (radius search)',
            'Support for arbitrary dimensions',
            'Tree structure analysis and visualization'
          ],
          complexity: {
            build: 'O(n log n)',
            nearest: 'O(log n) average, O(n) worst case',
            knn: 'O(k log n) average',
            range: 'O(√n + m) where m is result size',
            ball: 'O(√n + m) where m is result size'
          },
          applications: [
            'Spatial databases and GIS',
            'Computer graphics (ray tracing)',
            'Machine learning (k-NN classification)',
            'Collision detection',
            'Point cloud processing',
            'Nearest neighbor interpolation'
          ],
          example: {
            operation: 'knn',
            points: [[1,2], [3,4], [5,6], [7,8], [2,3]],
            query_point: [4, 5],
            k: 3
          }
        }, null, 2)
      };
    }

    if (operation === 'build') {
      let points = args.points;

      // Generate sample points if not provided
      if (!points || points.length === 0) {
        const dims = args.dimensions || 2;
        const n = args.num_points || 20;
        const distribution = args.distribution || 'uniform';
        points = generateSamplePoints(distribution, n, dims);
      }

      const dims = points[0].length;
      const indices = points.map((_: number[], i: number) => i);

      // Build tree
      const root = buildKDTree(points, indices, 0, dims);

      // Compute statistics
      const depth = treeDepth(root);
      const nodeCount = countNodes(root);
      const balance = balanceFactor(root);
      const bbox = computeBoundingBox(points);

      // Visualize small trees
      let visualization: string[] = [];
      if (nodeCount <= 31) {
        visualization = visualizeTree(root);
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'build',
          num_points: points.length,
          dimensions: dims,
          tree_statistics: {
            depth,
            node_count: nodeCount,
            balance_factor: balance,
            optimal_depth: Math.ceil(Math.log2(points.length + 1)),
            is_balanced: Math.abs(balance) <= 1
          },
          bounding_box: {
            min: bbox.min,
            max: bbox.max,
            size: bbox.max.map((v, i) => v - bbox.min[i])
          },
          points_sample: points.slice(0, 10).map((p: number[], i: number) => ({ index: i, coords: p })),
          visualization: visualization.length > 0 ? visualization.slice(0, 20) : 'Tree too large to visualize'
        }, null, 2)
      };
    }

    if (operation === 'nearest') {
      const points = args.points;
      const queryPoint = args.query_point;

      if (!points || points.length === 0) {
        return { toolCallId: id, content: 'Error: points array required', isError: true };
      }
      if (!queryPoint) {
        return { toolCallId: id, content: 'Error: query_point required', isError: true };
      }

      const dims = points[0].length;
      const indices = points.map((_: number[], i: number) => i);
      const root = buildKDTree(points, indices, 0, dims);

      const best = { node: null as KDNode | null, distSq: Infinity };
      nearestNeighbor(root, queryPoint, best);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'nearest',
          query_point: queryPoint,
          nearest_neighbor: best.node ? {
            point: best.node.point,
            index: best.node.index,
            distance: Math.sqrt(best.distSq),
            distance_squared: best.distSq
          } : null,
          num_points_searched: points.length
        }, null, 2)
      };
    }

    if (operation === 'knn') {
      const points = args.points;
      const queryPoint = args.query_point;
      const k = args.k || 5;

      if (!points || points.length === 0) {
        return { toolCallId: id, content: 'Error: points array required', isError: true };
      }
      if (!queryPoint) {
        return { toolCallId: id, content: 'Error: query_point required', isError: true };
      }

      const dims = points[0].length;
      const indices = points.map((_: number[], i: number) => i);
      const root = buildKDTree(points, indices, 0, dims);

      const heap: PQElement[] = [];
      kNearestNeighbors(root, queryPoint, Math.min(k, points.length), heap);

      // Sort by distance
      const neighbors = heap
        .map(e => ({
          point: e.point,
          index: e.index,
          distance: Math.sqrt(e.distance)
        }))
        .sort((a, b) => a.distance - b.distance);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'knn',
          query_point: queryPoint,
          k,
          neighbors,
          num_found: neighbors.length,
          farthest_distance: neighbors.length > 0 ? neighbors[neighbors.length - 1].distance : null
        }, null, 2)
      };
    }

    if (operation === 'range_search') {
      const points = args.points;
      const minBounds = args.min_bounds;
      const maxBounds = args.max_bounds;

      if (!points || points.length === 0) {
        return { toolCallId: id, content: 'Error: points array required', isError: true };
      }
      if (!minBounds || !maxBounds) {
        return { toolCallId: id, content: 'Error: min_bounds and max_bounds required', isError: true };
      }

      const dims = points[0].length;
      const indices = points.map((_: number[], i: number) => i);
      const root = buildKDTree(points, indices, 0, dims);

      const results: { point: number[]; index: number }[] = [];
      rangeSearch(root, minBounds, maxBounds, results);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'range_search',
          query_bounds: {
            min: minBounds,
            max: maxBounds,
            volume: minBounds.reduce((v, min, i) => v * (maxBounds[i] - min), 1)
          },
          points_found: results.length,
          results: results.slice(0, 50).map(r => ({
            index: r.index,
            point: r.point
          })),
          truncated: results.length > 50
        }, null, 2)
      };
    }

    if (operation === 'ball_query') {
      const points = args.points;
      const center = args.query_point || args.center;
      const radius = args.radius;

      if (!points || points.length === 0) {
        return { toolCallId: id, content: 'Error: points array required', isError: true };
      }
      if (!center) {
        return { toolCallId: id, content: 'Error: query_point/center required', isError: true };
      }
      if (radius === undefined || radius < 0) {
        return { toolCallId: id, content: 'Error: valid radius required', isError: true };
      }

      const dims = points[0].length;
      const indices = points.map((_: number[], i: number) => i);
      const root = buildKDTree(points, indices, 0, dims);

      const results: { point: number[]; index: number; distance: number }[] = [];
      ballQuery(root, center, radius * radius, results);

      // Sort by distance
      results.sort((a, b) => a.distance - b.distance);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'ball_query',
          center,
          radius,
          points_found: results.length,
          results: results.slice(0, 50).map(r => ({
            index: r.index,
            point: r.point,
            distance: r.distance
          })),
          truncated: results.length > 50,
          density: results.length / (Math.PI * Math.pow(radius, dims))
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      let points = args.points;

      if (!points || points.length === 0) {
        const dims = args.dimensions || 2;
        points = generateSamplePoints('gaussian', 100, dims);
      }

      const dims = points[0].length;
      const indices = points.map((_: number[], i: number) => i);
      const root = buildKDTree(points, indices, 0, dims);

      const distribution = analyzeDistribution(points);
      const bbox = computeBoundingBox(points);
      const depth = treeDepth(root);

      // Calculate average distances
      let totalNearestDist = 0;
      for (let i = 0; i < Math.min(points.length, 100); i++) {
        const query = points[i];
        let minDist = Infinity;
        for (let j = 0; j < points.length; j++) {
          if (i !== j) {
            const d = Math.sqrt(distanceSquared(query, points[j]));
            if (d < minDist) minDist = d;
          }
        }
        if (minDist !== Infinity) {
          totalNearestDist += minDist;
        }
      }
      const avgNearestDist = totalNearestDist / Math.min(points.length, 100);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          point_statistics: {
            count: points.length,
            dimensions: dims,
            mean: distribution.mean.map(v => parseFloat(v.toFixed(4))),
            variance: distribution.variance.map(v => parseFloat(v.toFixed(4))),
            std_dev: distribution.variance.map(v => parseFloat(Math.sqrt(v).toFixed(4)))
          },
          spatial_extent: {
            bounding_box: bbox,
            diagonal: Math.sqrt(bbox.max.reduce((s, v, i) => s + Math.pow(v - bbox.min[i], 2), 0))
          },
          tree_analysis: {
            depth,
            optimal_depth: Math.ceil(Math.log2(points.length + 1)),
            efficiency: Math.ceil(Math.log2(points.length + 1)) / depth,
            balance_factor: balanceFactor(root)
          },
          distribution_analysis: {
            avg_nearest_neighbor_distance: avgNearestDist,
            correlation_matrix: distribution.correlations.map(row =>
              row.map(v => parseFloat(v.toFixed(4)))
            )
          },
          recommendations: [
            depth > 2 * Math.ceil(Math.log2(points.length + 1))
              ? 'Consider rebalancing tree'
              : 'Tree is well-balanced',
            avgNearestDist < 1
              ? 'Points are densely clustered'
              : 'Points have good spatial distribution'
          ]
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: `Unknown operation: ${operation}`,
        available_operations: ['build', 'nearest', 'knn', 'range_search', 'ball_query', 'analyze', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function iskdtreeAvailable(): boolean {
  return true;
}
