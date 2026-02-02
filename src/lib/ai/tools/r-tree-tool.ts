/**
 * R-TREE TOOL
 * R-tree spatial indexing data structure
 *
 * Implements:
 * - R-tree insertion with node splitting
 * - Range queries (bounding box search)
 * - Nearest neighbor queries
 * - Bulk loading
 * - Tree visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Bounding box type
interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Point type
interface Point {
  x: number;
  y: number;
  data?: unknown;
}

// R-tree node
interface RTreeNode {
  bbox: BBox;
  children: RTreeNode[];
  entries: Point[];  // Only leaf nodes have entries
  isLeaf: boolean;
  level: number;
}

// Calculate bounding box for a point
function pointToBBox(p: Point): BBox {
  return { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
}

// Expand bbox to include another bbox
function expandBBox(a: BBox, b: BBox): BBox {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  };
}

// Calculate area of bbox
function bboxArea(b: BBox): number {
  return (b.maxX - b.minX) * (b.maxY - b.minY);
}

// Calculate area enlargement if we add bbox b to bbox a
function enlargementArea(a: BBox, b: BBox): number {
  const expanded = expandBBox(a, b);
  return bboxArea(expanded) - bboxArea(a);
}

// Check if two bboxes intersect
function bboxIntersects(a: BBox, b: BBox): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX &&
         a.minY <= b.maxY && a.maxY >= b.minY;
}

// Check if bbox a contains bbox b
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function bboxContains(a: BBox, b: BBox): boolean {
  return a.minX <= b.minX && a.maxX >= b.maxX &&
         a.minY <= b.minY && a.maxY >= b.maxY;
}

// Distance from point to bbox (0 if inside)
function distanceToBBox(p: Point, b: BBox): number {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dy = Math.max(b.minY - p.y, 0, p.y - b.maxY);
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance between two points
function pointDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// R-tree class
class RTree {
  private root: RTreeNode;
  private minEntries: number;
  private maxEntries: number;
  private nodeCount: number = 1;
  private entryCount: number = 0;

  constructor(maxEntries: number = 9, minEntries?: number) {
    this.maxEntries = maxEntries;
    this.minEntries = minEntries || Math.floor(maxEntries * 0.4);

    this.root = {
      bbox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      children: [],
      entries: [],
      isLeaf: true,
      level: 0
    };
  }

  // Insert a point
  insert(point: Point): void {
    const pointBBox = pointToBBox(point);

    // Find best leaf
    const path: RTreeNode[] = [];
    let node = this.root;

    while (!node.isLeaf) {
      path.push(node);

      // Choose child that needs least enlargement
      let bestChild = node.children[0];
      let bestEnlargement = enlargementArea(bestChild.bbox, pointBBox);
      let bestArea = bboxArea(bestChild.bbox);

      for (let i = 1; i < node.children.length; i++) {
        const child = node.children[i];
        const enlargement = enlargementArea(child.bbox, pointBBox);
        const area = bboxArea(child.bbox);

        if (enlargement < bestEnlargement ||
            (enlargement === bestEnlargement && area < bestArea)) {
          bestChild = child;
          bestEnlargement = enlargement;
          bestArea = area;
        }
      }
      node = bestChild;
    }

    // Insert into leaf
    node.entries.push(point);
    node.bbox = expandBBox(node.bbox, pointBBox);
    this.entryCount++;

    // Split if necessary
    if (node.entries.length > this.maxEntries) {
      this.splitLeaf(node, path);
    } else {
      // Update bboxes up the tree
      for (const n of path) {
        n.bbox = expandBBox(n.bbox, pointBBox);
      }
    }
  }

  // Split a leaf node using quadratic split
  private splitLeaf(node: RTreeNode, path: RTreeNode[]): void {
    const entries = node.entries;

    // Pick seeds: find pair with largest area waste
    let seed1 = 0, seed2 = 1;
    let maxWaste = -Infinity;

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const combined = expandBBox(pointToBBox(entries[i]), pointToBBox(entries[j]));
        const waste = bboxArea(combined) - 0; // Individual points have 0 area
        if (waste > maxWaste) {
          maxWaste = waste;
          seed1 = i;
          seed2 = j;
        }
      }
    }

    // Create two groups
    const group1: Point[] = [entries[seed1]];
    const group2: Point[] = [entries[seed2]];
    let bbox1 = pointToBBox(entries[seed1]);
    let bbox2 = pointToBBox(entries[seed2]);

    // Distribute remaining entries
    const remaining = entries.filter((_, i) => i !== seed1 && i !== seed2);

    for (const entry of remaining) {
      const pBBox = pointToBBox(entry);

      // Check if one group needs all remaining
      if (group1.length + remaining.length - group2.length <= this.minEntries) {
        group1.push(entry);
        bbox1 = expandBBox(bbox1, pBBox);
      } else if (group2.length + remaining.length - group1.length <= this.minEntries) {
        group2.push(entry);
        bbox2 = expandBBox(bbox2, pBBox);
      } else {
        // Add to group with less enlargement
        const e1 = enlargementArea(bbox1, pBBox);
        const e2 = enlargementArea(bbox2, pBBox);

        if (e1 < e2 || (e1 === e2 && group1.length <= group2.length)) {
          group1.push(entry);
          bbox1 = expandBBox(bbox1, pBBox);
        } else {
          group2.push(entry);
          bbox2 = expandBBox(bbox2, pBBox);
        }
      }
    }

    // Update original node
    node.entries = group1;
    node.bbox = bbox1;

    // Create new sibling node
    const sibling: RTreeNode = {
      bbox: bbox2,
      children: [],
      entries: group2,
      isLeaf: true,
      level: node.level
    };
    this.nodeCount++;

    // Insert sibling into parent
    if (path.length === 0) {
      // Split root
      const newRoot: RTreeNode = {
        bbox: expandBBox(bbox1, bbox2),
        children: [node, sibling],
        entries: [],
        isLeaf: false,
        level: node.level + 1
      };
      this.root = newRoot;
      this.nodeCount++;
    } else {
      const parent = path[path.length - 1];
      parent.children.push(sibling);
      parent.bbox = expandBBox(parent.bbox, bbox2);

      if (parent.children.length > this.maxEntries) {
        this.splitInternal(parent, path.slice(0, -1));
      }
    }
  }

  // Split internal node
  private splitInternal(node: RTreeNode, path: RTreeNode[]): void {
    const children = node.children;

    // Pick seeds
    let seed1 = 0, seed2 = 1;
    let maxWaste = -Infinity;

    for (let i = 0; i < children.length; i++) {
      for (let j = i + 1; j < children.length; j++) {
        const combined = expandBBox(children[i].bbox, children[j].bbox);
        const waste = bboxArea(combined) - bboxArea(children[i].bbox) - bboxArea(children[j].bbox);
        if (waste > maxWaste) {
          maxWaste = waste;
          seed1 = i;
          seed2 = j;
        }
      }
    }

    const group1: RTreeNode[] = [children[seed1]];
    const group2: RTreeNode[] = [children[seed2]];
    let bbox1 = children[seed1].bbox;
    let bbox2 = children[seed2].bbox;

    const remaining = children.filter((_, i) => i !== seed1 && i !== seed2);

    for (const child of remaining) {
      if (group1.length + remaining.length - group2.length <= this.minEntries) {
        group1.push(child);
        bbox1 = expandBBox(bbox1, child.bbox);
      } else if (group2.length + remaining.length - group1.length <= this.minEntries) {
        group2.push(child);
        bbox2 = expandBBox(bbox2, child.bbox);
      } else {
        const e1 = enlargementArea(bbox1, child.bbox);
        const e2 = enlargementArea(bbox2, child.bbox);

        if (e1 < e2 || (e1 === e2 && group1.length <= group2.length)) {
          group1.push(child);
          bbox1 = expandBBox(bbox1, child.bbox);
        } else {
          group2.push(child);
          bbox2 = expandBBox(bbox2, child.bbox);
        }
      }
    }

    node.children = group1;
    node.bbox = bbox1;

    const sibling: RTreeNode = {
      bbox: bbox2,
      children: group2,
      entries: [],
      isLeaf: false,
      level: node.level
    };
    this.nodeCount++;

    if (path.length === 0) {
      const newRoot: RTreeNode = {
        bbox: expandBBox(bbox1, bbox2),
        children: [node, sibling],
        entries: [],
        isLeaf: false,
        level: node.level + 1
      };
      this.root = newRoot;
      this.nodeCount++;
    } else {
      const parent = path[path.length - 1];
      parent.children.push(sibling);
      parent.bbox = expandBBox(parent.bbox, bbox2);

      if (parent.children.length > this.maxEntries) {
        this.splitInternal(parent, path.slice(0, -1));
      }
    }
  }

  // Range query: find all points within bbox
  rangeQuery(queryBBox: BBox): Point[] {
    const results: Point[] = [];
    this.rangeQueryNode(this.root, queryBBox, results);
    return results;
  }

  private rangeQueryNode(node: RTreeNode, queryBBox: BBox, results: Point[]): void {
    if (!bboxIntersects(node.bbox, queryBBox)) return;

    if (node.isLeaf) {
      for (const entry of node.entries) {
        if (entry.x >= queryBBox.minX && entry.x <= queryBBox.maxX &&
            entry.y >= queryBBox.minY && entry.y <= queryBBox.maxY) {
          results.push(entry);
        }
      }
    } else {
      for (const child of node.children) {
        this.rangeQueryNode(child, queryBBox, results);
      }
    }
  }

  // K-nearest neighbors query
  knn(query: Point, k: number): { point: Point; distance: number }[] {
    const results: { point: Point; distance: number }[] = [];

    // Priority queue for nodes (min-heap by distance to query)
    const nodeQueue: { node: RTreeNode; dist: number }[] = [
      { node: this.root, dist: distanceToBBox(query, this.root.bbox) }
    ];

    while (nodeQueue.length > 0 && results.length < k) {
      // Pop minimum
      nodeQueue.sort((a, b) => a.dist - b.dist);
      const current = nodeQueue.shift()!;

      // Prune if current distance is greater than k-th best
      if (results.length === k && current.dist > results[results.length - 1].distance) {
        break;
      }

      if (current.node.isLeaf) {
        for (const entry of current.node.entries) {
          const dist = pointDistance(query, entry);

          if (results.length < k) {
            results.push({ point: entry, distance: dist });
            results.sort((a, b) => a.distance - b.distance);
          } else if (dist < results[results.length - 1].distance) {
            results[results.length - 1] = { point: entry, distance: dist };
            results.sort((a, b) => a.distance - b.distance);
          }
        }
      } else {
        for (const child of current.node.children) {
          const childDist = distanceToBBox(query, child.bbox);

          if (results.length < k || childDist < results[results.length - 1].distance) {
            nodeQueue.push({ node: child, dist: childDist });
          }
        }
      }
    }

    return results;
  }

  // Get all points
  getAllPoints(): Point[] {
    const points: Point[] = [];
    this.collectPoints(this.root, points);
    return points;
  }

  private collectPoints(node: RTreeNode, points: Point[]): void {
    if (node.isLeaf) {
      points.push(...node.entries);
    } else {
      for (const child of node.children) {
        this.collectPoints(child, points);
      }
    }
  }

  // Get tree statistics
  getStats(): {
    height: number;
    nodeCount: number;
    entryCount: number;
    avgEntriesPerLeaf: number;
    rootBBox: BBox;
  } {
    const leafNodes: RTreeNode[] = [];
    this.collectLeaves(this.root, leafNodes);

    const avgEntriesPerLeaf = leafNodes.length > 0
      ? leafNodes.reduce((sum, n) => sum + n.entries.length, 0) / leafNodes.length
      : 0;

    return {
      height: this.root.level + 1,
      nodeCount: this.nodeCount,
      entryCount: this.entryCount,
      avgEntriesPerLeaf,
      rootBBox: this.root.bbox
    };
  }

  private collectLeaves(node: RTreeNode, leaves: RTreeNode[]): void {
    if (node.isLeaf) {
      leaves.push(node);
    } else {
      for (const child of node.children) {
        this.collectLeaves(child, leaves);
      }
    }
  }

  // Visualize tree structure
  visualize(maxDepth: number = 3): string {
    const lines: string[] = [];
    this.visualizeNode(this.root, '', true, lines, 0, maxDepth);
    return lines.join('\n');
  }

  private visualizeNode(
    node: RTreeNode,
    prefix: string,
    isLast: boolean,
    lines: string[],
    depth: number,
    maxDepth: number
  ): void {
    if (depth > maxDepth) return;

    const connector = isLast ? '└── ' : '├── ';
    const bboxStr = `[${node.bbox.minX.toFixed(1)},${node.bbox.minY.toFixed(1)}]-[${node.bbox.maxX.toFixed(1)},${node.bbox.maxY.toFixed(1)}]`;

    if (node.isLeaf) {
      lines.push(`${prefix}${connector}Leaf(${node.entries.length}) ${bboxStr}`);
    } else {
      lines.push(`${prefix}${connector}Node(${node.children.length}) ${bboxStr}`);

      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      node.children.forEach((child, i) => {
        this.visualizeNode(child, childPrefix, i === node.children.length - 1, lines, depth + 1, maxDepth);
      });
    }
  }
}

// Demo data generators
function generateRandomPoints(n: number, minX: number, maxX: number, minY: number, maxY: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    points.push({
      x: minX + Math.random() * (maxX - minX),
      y: minY + Math.random() * (maxY - minY),
      data: { id: i }
    });
  }
  return points;
}

function generateClusteredPoints(n: number, clusters: number): Point[] {
  const points: Point[] = [];
  const centersX = Array(clusters).fill(0).map(() => Math.random() * 100);
  const centersY = Array(clusters).fill(0).map(() => Math.random() * 100);

  for (let i = 0; i < n; i++) {
    const cluster = i % clusters;
    points.push({
      x: centersX[cluster] + (Math.random() - 0.5) * 20,
      y: centersY[cluster] + (Math.random() - 0.5) * 20,
      data: { id: i, cluster }
    });
  }
  return points;
}

// Global tree storage for demo
let demoTree: RTree | null = null;

export const rtreeTool: UnifiedTool = {
  name: 'r_tree',
  description: 'R-tree spatial indexing - insert, range query, nearest neighbor, bulk loading',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'insert', 'bulk_insert', 'range_query', 'knn', 'stats', 'visualize', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      maxEntries: { type: 'number', description: 'Max entries per node (default 9)' },
      point: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, description: 'Point to insert' },
      points: { type: 'array', description: 'Array of points for bulk insert' },
      bbox: { type: 'object', description: 'Bounding box for range query: {minX, minY, maxX, maxY}' },
      query: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, description: 'Query point for KNN' },
      k: { type: 'number', description: 'Number of neighbors for KNN' },
      n: { type: 'number', description: 'Number of random points for demo' },
      clustered: { type: 'boolean', description: 'Use clustered distribution for demo' }
    },
    required: ['operation']
  }
};

export async function executertree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'r-tree',
          description: 'R-tree spatial indexing data structure',
          concepts: {
            rtree: 'Balanced tree for indexing multi-dimensional data',
            mbr: 'Minimum Bounding Rectangle - each node has a bounding box',
            splitting: 'Quadratic split algorithm when node overflows',
            rangeQuery: 'Find all points within a given bounding box',
            knn: 'K-nearest neighbors using branch-and-bound'
          },
          complexity: {
            insert: 'O(log n)',
            rangeQuery: 'O(log n + k) where k is result size',
            knn: 'O(log n * k)'
          },
          parameters: {
            maxEntries: 'Maximum entries per node (M), typically 9-50',
            minEntries: 'Minimum entries per node (m), typically 40% of M'
          },
          operations: ['create', 'insert', 'bulk_insert', 'range_query', 'knn', 'stats', 'visualize', 'demo', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Create a new R-tree',
              call: { operation: 'create', maxEntries: 9 }
            },
            {
              description: 'Insert a point',
              call: { operation: 'insert', point: { x: 10, y: 20 } }
            },
            {
              description: 'Bulk insert points',
              call: { operation: 'bulk_insert', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }] }
            },
            {
              description: 'Range query',
              call: { operation: 'range_query', bbox: { minX: 0, minY: 0, maxX: 50, maxY: 50 } }
            },
            {
              description: 'Find 5 nearest neighbors',
              call: { operation: 'knn', query: { x: 25, y: 25 }, k: 5 }
            },
            {
              description: 'Demo with 100 random points',
              call: { operation: 'demo', n: 100 }
            }
          ]
        }, null, 2)
      };
    }

    if (operation === 'create') {
      const maxEntries = args.maxEntries || 9;
      demoTree = new RTree(maxEntries);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'create',
          maxEntries,
          message: 'R-tree created successfully',
          stats: demoTree.getStats()
        }, null, 2)
      };
    }

    if (operation === 'insert') {
      if (!demoTree) {
        demoTree = new RTree();
      }

      const point = args.point;
      if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Invalid point: must have x and y coordinates' }),
          isError: true
        };
      }

      demoTree.insert(point);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'insert',
          point,
          stats: demoTree.getStats()
        }, null, 2)
      };
    }

    if (operation === 'bulk_insert') {
      if (!demoTree) {
        demoTree = new RTree();
      }

      const points = args.points || [];
      if (!Array.isArray(points)) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Points must be an array' }),
          isError: true
        };
      }

      for (const p of points) {
        if (typeof p.x === 'number' && typeof p.y === 'number') {
          demoTree.insert(p);
        }
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'bulk_insert',
          inserted: points.length,
          stats: demoTree.getStats()
        }, null, 2)
      };
    }

    if (operation === 'range_query') {
      if (!demoTree) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No tree exists. Use create or demo first.' }),
          isError: true
        };
      }

      const bbox = args.bbox;
      if (!bbox || typeof bbox.minX !== 'number') {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Invalid bbox: must have minX, minY, maxX, maxY' }),
          isError: true
        };
      }

      const results = demoTree.rangeQuery(bbox);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'range_query',
          bbox,
          resultCount: results.length,
          results: results.slice(0, 20).map(p => ({ x: p.x.toFixed(2), y: p.y.toFixed(2) })),
          truncated: results.length > 20
        }, null, 2)
      };
    }

    if (operation === 'knn') {
      if (!demoTree) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No tree exists. Use create or demo first.' }),
          isError: true
        };
      }

      const query = args.query;
      const k = args.k || 5;

      if (!query || typeof query.x !== 'number') {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Invalid query point' }),
          isError: true
        };
      }

      const results = demoTree.knn(query, k);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'knn',
          query,
          k,
          results: results.map(r => ({
            x: r.point.x.toFixed(4),
            y: r.point.y.toFixed(4),
            distance: r.distance.toFixed(4)
          }))
        }, null, 2)
      };
    }

    if (operation === 'stats') {
      if (!demoTree) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No tree exists. Use create or demo first.' }),
          isError: true
        };
      }

      const stats = demoTree.getStats();

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'stats',
          ...stats,
          rootBBox: {
            minX: stats.rootBBox.minX.toFixed(2),
            minY: stats.rootBBox.minY.toFixed(2),
            maxX: stats.rootBBox.maxX.toFixed(2),
            maxY: stats.rootBBox.maxY.toFixed(2)
          }
        }, null, 2)
      };
    }

    if (operation === 'visualize') {
      if (!demoTree) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No tree exists. Use create or demo first.' }),
          isError: true
        };
      }

      const visualization = demoTree.visualize(args.maxDepth || 4);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'visualize',
          tree: visualization
        }, null, 2)
      };
    }

    if (operation === 'demo') {
      const n = Math.min(1000, args.n || 50);
      const clustered = args.clustered || false;

      demoTree = new RTree(9);

      const points = clustered
        ? generateClusteredPoints(n, 5)
        : generateRandomPoints(n, 0, 100, 0, 100);

      for (const p of points) {
        demoTree.insert(p);
      }

      // Perform sample queries
      const rangeResults = demoTree.rangeQuery({ minX: 25, minY: 25, maxX: 75, maxY: 75 });
      const knnResults = demoTree.knn({ x: 50, y: 50 }, 5);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'demo',
          pointsGenerated: n,
          distribution: clustered ? 'clustered (5 clusters)' : 'uniform random',
          stats: demoTree.getStats(),
          sampleRangeQuery: {
            bbox: { minX: 25, minY: 25, maxX: 75, maxY: 75 },
            resultCount: rangeResults.length
          },
          sampleKNN: {
            query: { x: 50, y: 50 },
            k: 5,
            results: knnResults.map(r => ({
              x: r.point.x.toFixed(2),
              y: r.point.y.toFixed(2),
              distance: r.distance.toFixed(2)
            }))
          },
          treeVisualization: demoTree.visualize(2)
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isrtreeAvailable(): boolean { return true; }
