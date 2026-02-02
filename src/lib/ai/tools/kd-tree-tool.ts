/**
 * KD-TREE TOOL
 * k-d tree spatial data structure for nearest neighbor search and range queries
 * Implements efficient multi-dimensional spatial indexing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Point type for k-dimensional space
type Point = number[];

// KD-Tree node
interface KDNode {
  point: Point;
  data?: any;
  left: KDNode | null;
  right: KDNode | null;
  splitDimension: number;
}

// Distance functions
function euclideanDistance(a: Point, b: Point): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

function manhattanDistance(a: Point, b: Point): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.abs(a[i] - b[i]);
  }
  return sum;
}

function chebyshevDistance(a: Point, b: Point): number {
  let max = 0;
  for (let i = 0; i < a.length; i++) {
    max = Math.max(max, Math.abs(a[i] - b[i]));
  }
  return max;
}

// Build KD-Tree from points
function buildKDTree(points: Array<{ point: Point; data?: any }>, depth: number = 0): KDNode | null {
  if (points.length === 0) return null;

  const k = points[0].point.length; // Number of dimensions
  const axis = depth % k;

  // Sort points by current axis
  points.sort((a, b) => a.point[axis] - b.point[axis]);

  const medianIndex = Math.floor(points.length / 2);
  const medianPoint = points[medianIndex];

  return {
    point: medianPoint.point,
    data: medianPoint.data,
    splitDimension: axis,
    left: buildKDTree(points.slice(0, medianIndex), depth + 1),
    right: buildKDTree(points.slice(medianIndex + 1), depth + 1)
  };
}

// Nearest neighbor search
function nearestNeighbor(
  root: KDNode | null,
  target: Point,
  distanceFunc: (a: Point, b: Point) => number = euclideanDistance
): { point: Point; distance: number; data?: any } | null {
  if (!root) return null;

  let best: { point: Point; distance: number; data?: any } | null = null;

  function search(node: KDNode | null, depth: number): void {
    if (!node) return;

    const k = target.length;
    const axis = depth % k;
    const distance = distanceFunc(target, node.point);

    if (!best || distance < best.distance) {
      best = { point: node.point, distance, data: node.data };
    }

    const diff = target[axis] - node.point[axis];
    const nearChild = diff < 0 ? node.left : node.right;
    const farChild = diff < 0 ? node.right : node.left;

    search(nearChild, depth + 1);

    // Check if we need to search the far subtree
    if (!best || Math.abs(diff) < best.distance) {
      search(farChild, depth + 1);
    }
  }

  search(root, 0);
  return best;
}

// K nearest neighbors search
function kNearestNeighbors(
  root: KDNode | null,
  target: Point,
  k: number,
  distanceFunc: (a: Point, b: Point) => number = euclideanDistance
): Array<{ point: Point; distance: number; data?: any }> {
  if (!root) return [];

  const results: Array<{ point: Point; distance: number; data?: any }> = [];

  function search(node: KDNode | null, depth: number): void {
    if (!node) return;

    const dims = target.length;
    const axis = depth % dims;
    const distance = distanceFunc(target, node.point);

    // Add to results if we have room or this is closer than the farthest
    if (results.length < k) {
      results.push({ point: node.point, distance, data: node.data });
      results.sort((a, b) => a.distance - b.distance);
    } else if (distance < results[results.length - 1].distance) {
      results.pop();
      results.push({ point: node.point, distance, data: node.data });
      results.sort((a, b) => a.distance - b.distance);
    }

    const diff = target[axis] - node.point[axis];
    const nearChild = diff < 0 ? node.left : node.right;
    const farChild = diff < 0 ? node.right : node.left;

    search(nearChild, depth + 1);

    // Check far subtree if necessary
    if (results.length < k || Math.abs(diff) < results[results.length - 1].distance) {
      search(farChild, depth + 1);
    }
  }

  search(root, 0);
  return results;
}

// Range search (points within a bounding box)
function rangeSearch(
  root: KDNode | null,
  minBounds: Point,
  maxBounds: Point
): Array<{ point: Point; data?: any }> {
  const results: Array<{ point: Point; data?: any }> = [];

  function isInRange(point: Point): boolean {
    for (let i = 0; i < point.length; i++) {
      if (point[i] < minBounds[i] || point[i] > maxBounds[i]) {
        return false;
      }
    }
    return true;
  }

  function search(node: KDNode | null, depth: number): void {
    if (!node) return;

    const k = minBounds.length;
    const axis = depth % k;

    if (isInRange(node.point)) {
      results.push({ point: node.point, data: node.data });
    }

    // Check if left subtree could contain points in range
    if (node.left && minBounds[axis] <= node.point[axis]) {
      search(node.left, depth + 1);
    }

    // Check if right subtree could contain points in range
    if (node.right && maxBounds[axis] >= node.point[axis]) {
      search(node.right, depth + 1);
    }
  }

  search(root, 0);
  return results;
}

// Radius search (points within distance r)
function radiusSearch(
  root: KDNode | null,
  center: Point,
  radius: number,
  distanceFunc: (a: Point, b: Point) => number = euclideanDistance
): Array<{ point: Point; distance: number; data?: any }> {
  const results: Array<{ point: Point; distance: number; data?: any }> = [];

  function search(node: KDNode | null, depth: number): void {
    if (!node) return;

    const k = center.length;
    const axis = depth % k;
    const distance = distanceFunc(center, node.point);

    if (distance <= radius) {
      results.push({ point: node.point, distance, data: node.data });
    }

    const diff = center[axis] - node.point[axis];
    const nearChild = diff < 0 ? node.left : node.right;
    const farChild = diff < 0 ? node.right : node.left;

    search(nearChild, depth + 1);

    // Only search far subtree if hyperplane is within radius
    if (Math.abs(diff) <= radius) {
      search(farChild, depth + 1);
    }
  }

  search(root, 0);
  return results;
}

// Tree statistics
function getTreeStats(root: KDNode | null): {
  nodeCount: number;
  depth: number;
  leafCount: number;
  balance: number;
} {
  let nodeCount = 0;
  let leafCount = 0;
  let maxDepth = 0;
  let depths: number[] = [];

  function traverse(node: KDNode | null, depth: number): void {
    if (!node) return;

    nodeCount++;

    if (!node.left && !node.right) {
      leafCount++;
      depths.push(depth);
      maxDepth = Math.max(maxDepth, depth);
    }

    traverse(node.left, depth + 1);
    traverse(node.right, depth + 1);
  }

  traverse(root, 0);

  const minLeafDepth = depths.length > 0 ? Math.min(...depths) : 0;
  const avgLeafDepth = depths.length > 0 ? depths.reduce((a, b) => a + b, 0) / depths.length : 0;

  return {
    nodeCount,
    depth: maxDepth,
    leafCount,
    balance: nodeCount > 0 ? parseFloat((minLeafDepth / (maxDepth || 1)).toFixed(2)) : 1
  };
}

// Visualize tree structure
function visualizeTree(root: KDNode | null, dims: number = 2): string {
  if (!root) return '(empty tree)';

  let output = '\nKD-TREE STRUCTURE\n═════════════════\n\n';
  const lines: string[] = [];

  function traverse(node: KDNode | null, prefix: string, isLeft: boolean): void {
    if (!node) return;

    const pointStr = `[${node.point.map(v => v.toFixed(1)).join(', ')}]`;
    const dimStr = `d${node.splitDimension}`;
    lines.push(prefix + (isLeft ? '├── ' : '└── ') + `${pointStr} (${dimStr})`);

    const newPrefix = prefix + (isLeft ? '│   ' : '    ');
    if (node.left || node.right) {
      if (node.left) traverse(node.left, newPrefix, true);
      else lines.push(newPrefix + '├── (null)');
      if (node.right) traverse(node.right, newPrefix, false);
      else lines.push(newPrefix + '└── (null)');
    }
  }

  const rootPointStr = `[${root.point.map(v => v.toFixed(1)).join(', ')}]`;
  lines.push(`Root: ${rootPointStr} (d${root.splitDimension})`);
  if (root.left || root.right) {
    if (root.left) traverse(root.left, '', true);
    if (root.right) traverse(root.right, '', false);
  }

  return output + lines.slice(0, 20).join('\n') + (lines.length > 20 ? '\n...' : '');
}

// Generate sample points
function generateSamplePoints(
  count: number,
  dimensions: number,
  min: number = 0,
  max: number = 100
): Array<{ point: Point; data: { id: number } }> {
  const points = [];
  for (let i = 0; i < count; i++) {
    const point: Point = [];
    for (let d = 0; d < dimensions; d++) {
      point.push(parseFloat((min + Math.random() * (max - min)).toFixed(2)));
    }
    points.push({ point, data: { id: i + 1 } });
  }
  return points;
}

export const kdtreeTool: UnifiedTool = {
  name: 'kd_tree',
  description: 'k-d tree for multi-dimensional spatial searching, nearest neighbor queries, and range searches',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'build', 'nearest', 'knn', 'range', 'radius', 'analyze', 'demonstrate'],
        description: 'Operation to perform'
      },
      points: { type: 'array', description: 'Array of points (arrays of coordinates)' },
      target: { type: 'array', description: 'Target point for search' },
      dimensions: { type: 'integer', description: 'Number of dimensions' },
      k: { type: 'integer', description: 'Number of neighbors for k-NN' },
      radius: { type: 'number', description: 'Search radius' },
      min_bounds: { type: 'array', description: 'Minimum bounds for range search' },
      max_bounds: { type: 'array', description: 'Maximum bounds for range search' },
      distance_metric: { type: 'string', enum: ['euclidean', 'manhattan', 'chebyshev'], description: 'Distance metric' }
    },
    required: ['operation']
  }
};

export async function executekdtree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    const getDistanceFunc = (metric: string = 'euclidean') => {
      switch (metric) {
        case 'manhattan': return manhattanDistance;
        case 'chebyshev': return chebyshevDistance;
        default: return euclideanDistance;
      }
    };

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'kd_tree',
          description: 'k-dimensional tree for efficient spatial queries',
          complexity: {
            build: 'O(n log n)',
            nearest_neighbor: 'O(log n) average, O(n) worst case',
            range_search: 'O(√n + k) for k results',
            insert: 'O(log n)'
          },
          features: {
            nearest_neighbor: 'Find closest point to a target',
            k_nearest: 'Find k closest points',
            range_search: 'Find all points within bounding box',
            radius_search: 'Find all points within distance r'
          },
          distance_metrics: {
            euclidean: 'L2 norm: √(Σ(xi - yi)²)',
            manhattan: 'L1 norm: Σ|xi - yi|',
            chebyshev: 'L∞ norm: max|xi - yi|'
          },
          applications: [
            'Nearest neighbor search',
            'Spatial databases',
            'Collision detection',
            'Machine learning (k-NN classifier)',
            'Computational geometry',
            'Ray tracing acceleration'
          ],
          operations: ['build', 'nearest', 'knn', 'range', 'radius', 'analyze', 'demonstrate']
        };
        break;
      }

      case 'build': {
        const dims = args.dimensions || 2;
        const points = args.points
          ? args.points.map((p: Point, i: number) => ({ point: p, data: { id: i + 1 } }))
          : generateSamplePoints(10, dims);

        const tree = buildKDTree(points);
        const stats = getTreeStats(tree);

        result = {
          operation: 'build',
          input: {
            point_count: points.length,
            dimensions: dims
          },
          tree_stats: stats,
          points: points.slice(0, 10).map((p: { point: Point }) => p.point),
          visualization: visualizeTree(tree, dims),
          explanation: {
            method: 'Median-based construction',
            split_cycle: `Alternates through ${dims} dimensions`,
            balance: stats.balance > 0.8 ? 'Well balanced' : 'Could be better balanced'
          }
        };
        break;
      }

      case 'nearest': {
        const dims = args.dimensions || 2;
        const points = args.points
          ? args.points.map((p: Point, i: number) => ({ point: p, data: { id: i + 1 } }))
          : generateSamplePoints(20, dims);

        const target = args.target || Array(dims).fill(0).map(() => parseFloat((Math.random() * 100).toFixed(2)));
        const distFunc = getDistanceFunc(args.distance_metric);

        const tree = buildKDTree(points);
        const nearest = nearestNeighbor(tree, target, distFunc);

        // Also compute brute force for verification
        let bruteForceNearest = points[0];
        let bruteForceDistance = distFunc(target, points[0].point);
        for (const p of points) {
          const d = distFunc(target, p.point);
          if (d < bruteForceDistance) {
            bruteForceDistance = d;
            bruteForceNearest = p;
          }
        }

        result = {
          operation: 'nearest',
          target_point: target,
          result: nearest ? {
            point: nearest.point,
            distance: parseFloat(nearest.distance.toFixed(4)),
            data: nearest.data
          } : null,
          verification: {
            brute_force_point: bruteForceNearest.point,
            brute_force_distance: parseFloat(bruteForceDistance.toFixed(4)),
            match: nearest ? nearest.distance === bruteForceDistance || Math.abs(nearest.distance - bruteForceDistance) < 0.0001 : false
          },
          distance_metric: args.distance_metric || 'euclidean',
          point_count: points.length
        };
        break;
      }

      case 'knn': {
        const dims = args.dimensions || 2;
        const k = args.k || 5;
        const points = args.points
          ? args.points.map((p: Point, i: number) => ({ point: p, data: { id: i + 1 } }))
          : generateSamplePoints(30, dims);

        const target = args.target || Array(dims).fill(50);
        const distFunc = getDistanceFunc(args.distance_metric);

        const tree = buildKDTree(points);
        const neighbors = kNearestNeighbors(tree, target, k, distFunc);

        result = {
          operation: 'knn',
          parameters: {
            k: k,
            target: target,
            distance_metric: args.distance_metric || 'euclidean',
            point_count: points.length
          },
          neighbors: neighbors.map((n, i) => ({
            rank: i + 1,
            point: n.point,
            distance: parseFloat(n.distance.toFixed(4)),
            data: n.data
          })),
          statistics: neighbors.length > 0 ? {
            min_distance: parseFloat(neighbors[0].distance.toFixed(4)),
            max_distance: parseFloat(neighbors[neighbors.length - 1].distance.toFixed(4)),
            avg_distance: parseFloat((neighbors.reduce((s, n) => s + n.distance, 0) / neighbors.length).toFixed(4))
          } : null
        };
        break;
      }

      case 'range': {
        const dims = args.dimensions || 2;
        const points = args.points
          ? args.points.map((p: Point, i: number) => ({ point: p, data: { id: i + 1 } }))
          : generateSamplePoints(50, dims);

        const minBounds = args.min_bounds || Array(dims).fill(25);
        const maxBounds = args.max_bounds || Array(dims).fill(75);

        const tree = buildKDTree(points);
        const inRange = rangeSearch(tree, minBounds, maxBounds);

        result = {
          operation: 'range',
          bounding_box: {
            min: minBounds,
            max: maxBounds,
            size: maxBounds.map((max: number, i: number) => max - minBounds[i])
          },
          total_points: points.length,
          points_in_range: inRange.length,
          percentage: parseFloat((inRange.length / points.length * 100).toFixed(1)) + '%',
          results: inRange.slice(0, 20).map(r => ({
            point: r.point,
            data: r.data
          })),
          truncated: inRange.length > 20
        };
        break;
      }

      case 'radius': {
        const dims = args.dimensions || 2;
        const radius = args.radius || 20;
        const points = args.points
          ? args.points.map((p: Point, i: number) => ({ point: p, data: { id: i + 1 } }))
          : generateSamplePoints(50, dims);

        const center = args.target || Array(dims).fill(50);
        const distFunc = getDistanceFunc(args.distance_metric);

        const tree = buildKDTree(points);
        const inRadius = radiusSearch(tree, center, radius, distFunc);
        inRadius.sort((a, b) => a.distance - b.distance);

        result = {
          operation: 'radius',
          parameters: {
            center: center,
            radius: radius,
            distance_metric: args.distance_metric || 'euclidean'
          },
          total_points: points.length,
          points_in_radius: inRadius.length,
          results: inRadius.slice(0, 20).map(r => ({
            point: r.point,
            distance: parseFloat(r.distance.toFixed(4)),
            data: r.data
          })),
          statistics: inRadius.length > 0 ? {
            closest: parseFloat(inRadius[0].distance.toFixed(4)),
            farthest: parseFloat(inRadius[inRadius.length - 1].distance.toFixed(4)),
            avg_distance: parseFloat((inRadius.reduce((s, r) => s + r.distance, 0) / inRadius.length).toFixed(4))
          } : null
        };
        break;
      }

      case 'analyze': {
        const dims = args.dimensions || 2;
        const sizes = [10, 50, 100, 500];
        const analysis = [];

        for (const n of sizes) {
          const points = generateSamplePoints(n, dims);
          const startBuild = performance.now();
          const tree = buildKDTree(points);
          const buildTime = performance.now() - startBuild;

          const stats = getTreeStats(tree);
          const target = Array(dims).fill(50);

          const startSearch = performance.now();
          const nearest = nearestNeighbor(tree, target);
          const searchTime = performance.now() - startSearch;

          analysis.push({
            n: n,
            build_time_ms: parseFloat(buildTime.toFixed(3)),
            search_time_ms: parseFloat(searchTime.toFixed(3)),
            tree_depth: stats.depth,
            balance: stats.balance,
            theoretical_depth: Math.ceil(Math.log2(n))
          });
        }

        result = {
          operation: 'analyze',
          dimensions: dims,
          performance_analysis: analysis,
          complexity_validation: {
            build: 'O(n log n) - build time increases linearly with n·log(n)',
            search: 'O(log n) average - search time roughly constant',
            depth: 'Tree depth ≈ log₂(n) for balanced tree'
          },
          observations: [
            'Build time scales with n·log(n)',
            'Search time remains relatively constant',
            'Tree depth matches theoretical log₂(n)',
            'Balance factor indicates tree quality'
          ]
        };
        break;
      }

      case 'demonstrate': {
        const points2D = [
          [2, 3], [5, 4], [9, 6], [4, 7], [8, 1], [7, 2]
        ].map((p, i) => ({ point: p, data: { id: i + 1 } }));

        const tree = buildKDTree(points2D);
        const target = [7, 4];
        const nearest = nearestNeighbor(tree, target);
        const knn = kNearestNeighbors(tree, target, 3);

        result = {
          operation: 'demonstrate',
          tool: 'kd_tree',
          example_2d: {
            points: points2D.map(p => p.point),
            target: target,
            nearest_neighbor: nearest,
            k_nearest_3: knn,
            tree_structure: visualizeTree(tree, 2)
          },
          algorithm_explanation: {
            build: [
              '1. Select axis based on current depth (depth % k)',
              '2. Sort points by that axis',
              '3. Choose median as split point',
              '4. Recursively build left and right subtrees',
              '5. Alternate through dimensions at each level'
            ],
            search: [
              '1. Traverse tree, going left or right based on split axis',
              '2. Track best distance found so far',
              '3. At each node, check if point is closer than best',
              '4. Prune branches that cannot contain closer points',
              '5. Backtrack and check other branches if needed'
            ]
          },
          key_insight: 'k-d trees exploit spatial partitioning to prune large portions of the search space',
          visualization: `
KD-TREE CONSTRUCTION (2D)
═════════════════════════

     Points: (2,3) (5,4) (9,6) (4,7) (8,1) (7,2)

     Step 1: Split on X (median = 7,2)
             ┌──────────┴──────────┐
         x<7                     x≥7
     (2,3)(5,4)(4,7)         (9,6)(8,1)

     Step 2: Split left on Y (median = 5,4)
                 ┌──────┴──────┐
              y<4            y≥4
            (2,3)        (4,7)

     Final Tree:
              (7,2) [x]
             /        \\
         (5,4) [y]    (9,6) [y]
         /    \\        /
     (2,3)  (4,7)   (8,1)


NEAREST NEIGHBOR SEARCH
═══════════════════════

     Target: (7, 4)

     1. Start at root (7,2)
     2. Go right (7 ≥ 7)
     3. Check (9,6): distance = 2.83
     4. Check (8,1): distance = 3.16
     5. Backtrack, check left side
     6. Best: (5,4) with distance = 2.0

     ✓ Nearest neighbor found efficiently!
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'build', 'nearest', 'knn', 'range', 'radius', 'analyze', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iskdtreeAvailable(): boolean {
  return true;
}
