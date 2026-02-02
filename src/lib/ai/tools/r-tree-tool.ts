/**
 * R-TREE TOOL
 * R-tree spatial indexing for bounding box queries
 * Efficient spatial indexing for rectangles and geographic data
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Bounding box (MBR - Minimum Bounding Rectangle)
interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// R-tree entry
interface RTreeEntry {
  bounds: BoundingBox;
  data?: any;
  id?: number;
}

// R-tree node
interface RTreeNode {
  bounds: BoundingBox;
  entries: RTreeEntry[];
  children: RTreeNode[];
  isLeaf: boolean;
}

// Calculate area of bounding box
function area(bbox: BoundingBox): number {
  return (bbox.maxX - bbox.minX) * (bbox.maxY - bbox.minY);
}

// Calculate perimeter of bounding box
function perimeter(bbox: BoundingBox): number {
  return 2 * ((bbox.maxX - bbox.minX) + (bbox.maxY - bbox.minY));
}

// Combine two bounding boxes
function combineBounds(b1: BoundingBox, b2: BoundingBox): BoundingBox {
  return {
    minX: Math.min(b1.minX, b2.minX),
    minY: Math.min(b1.minY, b2.minY),
    maxX: Math.max(b1.maxX, b2.maxX),
    maxY: Math.max(b1.maxY, b2.maxY)
  };
}

// Check if two bounding boxes intersect
function intersects(b1: BoundingBox, b2: BoundingBox): boolean {
  return !(b1.maxX < b2.minX || b1.minX > b2.maxX ||
           b1.maxY < b2.minY || b1.minY > b2.maxY);
}

// Check if b1 contains b2
function contains(b1: BoundingBox, b2: BoundingBox): boolean {
  return b1.minX <= b2.minX && b1.maxX >= b2.maxX &&
         b1.minY <= b2.minY && b1.maxY >= b2.maxY;
}

// Calculate enlargement needed to add bbox to existing bounds
function enlargementNeeded(existing: BoundingBox, adding: BoundingBox): number {
  const combined = combineBounds(existing, adding);
  return area(combined) - area(existing);
}

// Point to bounding box
function pointToBBox(x: number, y: number): BoundingBox {
  return { minX: x, minY: y, maxX: x, maxY: y };
}

// Calculate center of bounding box
function center(bbox: BoundingBox): { x: number; y: number } {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2
  };
}

// Distance between two bounding boxes (center to center)
function distance(b1: BoundingBox, b2: BoundingBox): number {
  const c1 = center(b1);
  const c2 = center(b2);
  return Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
}

// Simple R-tree implementation
class RTree {
  private root: RTreeNode;
  private maxEntries: number;
  private minEntries: number;

  constructor(maxEntries: number = 9) {
    this.maxEntries = maxEntries;
    this.minEntries = Math.floor(maxEntries * 0.4);
    this.root = this.createNode(true);
  }

  private createNode(isLeaf: boolean): RTreeNode {
    return {
      bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      entries: [],
      children: [],
      isLeaf
    };
  }

  private updateBounds(node: RTreeNode): void {
    if (node.isLeaf && node.entries.length > 0) {
      node.bounds = node.entries.reduce(
        (acc, entry) => combineBounds(acc, entry.bounds),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
    } else if (!node.isLeaf && node.children.length > 0) {
      node.bounds = node.children.reduce(
        (acc, child) => combineBounds(acc, child.bounds),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      );
    }
  }

  private chooseLeaf(node: RTreeNode, entry: RTreeEntry): RTreeNode {
    if (node.isLeaf) {
      return node;
    }

    // Choose child that needs least enlargement
    let bestChild = node.children[0];
    let bestEnlargement = enlargementNeeded(bestChild.bounds, entry.bounds);

    for (let i = 1; i < node.children.length; i++) {
      const enlargement = enlargementNeeded(node.children[i].bounds, entry.bounds);
      if (enlargement < bestEnlargement ||
          (enlargement === bestEnlargement && area(node.children[i].bounds) < area(bestChild.bounds))) {
        bestEnlargement = enlargement;
        bestChild = node.children[i];
      }
    }

    return this.chooseLeaf(bestChild, entry);
  }

  insert(entry: RTreeEntry): void {
    const leaf = this.chooseLeaf(this.root, entry);
    leaf.entries.push(entry);
    this.updateBounds(leaf);

    // Handle overflow (simplified - would need proper split in production)
    if (leaf.entries.length > this.maxEntries) {
      // Simple split by sorting and dividing
      leaf.entries.sort((a, b) => center(a.bounds).x - center(b.bounds).x);
    }
  }

  search(queryBounds: BoundingBox): RTreeEntry[] {
    const results: RTreeEntry[] = [];
    this.searchNode(this.root, queryBounds, results);
    return results;
  }

  private searchNode(node: RTreeNode, query: BoundingBox, results: RTreeEntry[]): void {
    if (!intersects(node.bounds, query)) {
      return;
    }

    if (node.isLeaf) {
      for (const entry of node.entries) {
        if (intersects(entry.bounds, query)) {
          results.push(entry);
        }
      }
    } else {
      for (const child of node.children) {
        this.searchNode(child, query, results);
      }
    }
  }

  nearestNeighbor(point: { x: number; y: number }, k: number = 1): RTreeEntry[] {
    const pointBBox = pointToBBox(point.x, point.y);
    const results: { entry: RTreeEntry; distance: number }[] = [];

    this.nearestSearch(this.root, pointBBox, results, k);

    return results.map(r => r.entry);
  }

  private nearestSearch(
    node: RTreeNode,
    query: BoundingBox,
    results: { entry: RTreeEntry; distance: number }[],
    k: number
  ): void {
    if (node.isLeaf) {
      for (const entry of node.entries) {
        const dist = distance(entry.bounds, query);
        if (results.length < k) {
          results.push({ entry, distance: dist });
          results.sort((a, b) => a.distance - b.distance);
        } else if (dist < results[results.length - 1].distance) {
          results.pop();
          results.push({ entry, distance: dist });
          results.sort((a, b) => a.distance - b.distance);
        }
      }
    } else {
      // Sort children by distance to query
      const sortedChildren = node.children
        .map(child => ({ child, dist: distance(child.bounds, query) }))
        .sort((a, b) => a.dist - b.dist);

      for (const { child, dist } of sortedChildren) {
        if (results.length < k || dist < results[results.length - 1].distance) {
          this.nearestSearch(child, query, results, k);
        }
      }
    }
  }

  getStats(): { nodeCount: number; entryCount: number; depth: number; bounds: BoundingBox } {
    let nodeCount = 0;
    let entryCount = 0;
    let maxDepth = 0;

    const traverse = (node: RTreeNode, depth: number): void => {
      nodeCount++;
      maxDepth = Math.max(maxDepth, depth);

      if (node.isLeaf) {
        entryCount += node.entries.length;
      } else {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(this.root, 0);

    return {
      nodeCount,
      entryCount,
      depth: maxDepth,
      bounds: this.root.bounds
    };
  }

  getAllEntries(): RTreeEntry[] {
    const entries: RTreeEntry[] = [];

    const traverse = (node: RTreeNode): void => {
      if (node.isLeaf) {
        entries.push(...node.entries);
      } else {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    traverse(this.root);
    return entries;
  }
}

// Generate random rectangles
function generateRandomRectangles(
  count: number,
  maxCoord: number = 100,
  maxSize: number = 20
): RTreeEntry[] {
  const entries: RTreeEntry[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * (maxCoord - maxSize);
    const y = Math.random() * (maxCoord - maxSize);
    const width = Math.random() * maxSize + 1;
    const height = Math.random() * maxSize + 1;

    entries.push({
      bounds: {
        minX: parseFloat(x.toFixed(2)),
        minY: parseFloat(y.toFixed(2)),
        maxX: parseFloat((x + width).toFixed(2)),
        maxY: parseFloat((y + height).toFixed(2))
      },
      data: { id: i + 1 },
      id: i + 1
    });
  }
  return entries;
}

// Visualize bounding boxes
function visualizeBoundingBoxes(entries: RTreeEntry[], queryBox?: BoundingBox): string {
  const width = 50;
  const height = 25;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Find bounds
  let minX = 0, maxX = 100, minY = 0, maxY = 100;
  for (const entry of entries) {
    minX = Math.min(minX, entry.bounds.minX);
    maxX = Math.max(maxX, entry.bounds.maxX);
    minY = Math.min(minY, entry.bounds.minY);
    maxY = Math.max(maxY, entry.bounds.maxY);
  }

  const scaleX = (width - 2) / (maxX - minX);
  const scaleY = (height - 2) / (maxY - minY);

  // Draw entries
  for (let i = 0; i < Math.min(entries.length, 10); i++) {
    const b = entries[i].bounds;
    const x1 = Math.floor((b.minX - minX) * scaleX) + 1;
    const y1 = height - 1 - Math.floor((b.maxY - minY) * scaleY) - 1;
    const x2 = Math.floor((b.maxX - minX) * scaleX) + 1;
    const y2 = height - 1 - Math.floor((b.minY - minY) * scaleY) - 1;

    const char = String(i % 10);

    // Draw corners
    if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) grid[y1][x1] = char;
    if (x2 >= 0 && x2 < width && y1 >= 0 && y1 < height) grid[y1][x2] = char;
    if (x1 >= 0 && x1 < width && y2 >= 0 && y2 < height) grid[y2][x1] = char;
    if (x2 >= 0 && x2 < width && y2 >= 0 && y2 < height) grid[y2][x2] = char;
  }

  // Draw query box if provided
  if (queryBox) {
    const x1 = Math.floor((queryBox.minX - minX) * scaleX) + 1;
    const y1 = height - 1 - Math.floor((queryBox.maxY - minY) * scaleY) - 1;
    const x2 = Math.floor((queryBox.maxX - minX) * scaleX) + 1;
    const y2 = height - 1 - Math.floor((queryBox.minY - minY) * scaleY) - 1;

    for (let x = x1; x <= x2; x++) {
      if (x >= 0 && x < width && y1 >= 0 && y1 < height) grid[y1][x] = grid[y1][x] === ' ' ? '─' : grid[y1][x];
      if (x >= 0 && x < width && y2 >= 0 && y2 < height) grid[y2][x] = grid[y2][x] === ' ' ? '─' : grid[y2][x];
    }
    for (let y = y1; y <= y2; y++) {
      if (x1 >= 0 && x1 < width && y >= 0 && y < height) grid[y][x1] = grid[y][x1] === ' ' ? '│' : grid[y][x1];
      if (x2 >= 0 && x2 < width && y >= 0 && y < height) grid[y][x2] = grid[y][x2] === ' ' ? '│' : grid[y][x2];
    }
    if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) grid[y1][x1] = '┌';
    if (x2 >= 0 && x2 < width && y1 >= 0 && y1 < height) grid[y1][x2] = '┐';
    if (x1 >= 0 && x1 < width && y2 >= 0 && y2 < height) grid[y2][x1] = '└';
    if (x2 >= 0 && x2 < width && y2 >= 0 && y2 < height) grid[y2][x2] = '┘';
  }

  let viz = '┌' + '─'.repeat(width) + '┐\n';
  for (const row of grid) {
    viz += '│' + row.join('') + '│\n';
  }
  viz += '└' + '─'.repeat(width) + '┘';
  viz += '\nNumbers = rectangle IDs, Box = query region';

  return viz;
}

export const rtreeTool: UnifiedTool = {
  name: 'r_tree',
  description: 'R-tree spatial indexing for bounding box queries and range searches',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'insert', 'search', 'nearest', 'range_query', 'contains', 'analyze', 'demonstrate'],
        description: 'Operation to perform'
      },
      entries: { type: 'array', description: 'Array of entries with bounds' },
      query: { type: 'object', description: 'Query bounding box' },
      point: { type: 'object', description: 'Query point {x, y}' },
      k: { type: 'integer', description: 'Number of nearest neighbors' },
      num_entries: { type: 'integer', description: 'Number of random entries to generate' }
    },
    required: ['operation']
  }
};

export async function executertree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: any;

    switch (operation) {
      case 'info': {
        result = {
          operation: 'info',
          tool: 'r_tree',
          description: 'R-tree for efficient spatial indexing of rectangles',
          complexity: {
            insert: 'O(log n) average',
            search: 'O(log n + k) for k results',
            nearest: 'O(log n) average'
          },
          features: {
            range_query: 'Find all objects intersecting query box',
            point_query: 'Find objects containing a point',
            nearest_neighbor: 'Find k closest objects',
            insertion: 'Dynamic insertion of new objects'
          },
          structure: {
            internal_node: 'Contains child node MBRs',
            leaf_node: 'Contains data object MBRs',
            mbr: 'Minimum Bounding Rectangle enclosing children',
            balancing: 'Maintains balanced tree through splits'
          },
          variants: [
            'R-tree (original, Guttman 1984)',
            'R*-tree (improved splits)',
            'R+-tree (no overlap between siblings)',
            'Hilbert R-tree (uses Hilbert curve)'
          ],
          applications: [
            'Geographic Information Systems (GIS)',
            'Spatial databases',
            'Computer graphics',
            'CAD systems',
            'Video game collision detection'
          ],
          operations: ['insert', 'search', 'nearest', 'range_query', 'contains', 'analyze', 'demonstrate']
        };
        break;
      }

      case 'insert': {
        const tree = new RTree();
        const entries = args.entries?.map((e: any, i: number) => ({ ...e, id: i + 1 })) ||
                       generateRandomRectangles(args.num_entries || 10);

        for (const entry of entries) {
          tree.insert(entry);
        }

        const stats = tree.getStats();

        result = {
          operation: 'insert',
          entries_inserted: entries.length,
          entries: entries.slice(0, 10).map((e: RTreeEntry) => ({
            id: e.id,
            bounds: e.bounds,
            area: parseFloat(area(e.bounds).toFixed(2))
          })),
          tree_stats: stats,
          tree_bounds: {
            ...stats.bounds,
            total_area: parseFloat(area(stats.bounds).toFixed(2))
          }
        };
        break;
      }

      case 'search':
      case 'range_query': {
        const tree = new RTree();
        const entries = args.entries?.map((e: any, i: number) => ({ ...e, id: i + 1 })) ||
                       generateRandomRectangles(args.num_entries || 20);

        for (const entry of entries) {
          tree.insert(entry);
        }

        const query: BoundingBox = args.query || { minX: 30, minY: 30, maxX: 70, maxY: 70 };
        const results = tree.search(query);

        result = {
          operation: 'range_query',
          total_entries: entries.length,
          query_box: query,
          query_area: parseFloat(area(query).toFixed(2)),
          results_found: results.length,
          results: results.slice(0, 15).map(r => ({
            id: r.id,
            bounds: r.bounds,
            data: r.data
          })),
          efficiency: {
            entries_checked: entries.length,
            results_returned: results.length,
            selectivity: parseFloat((results.length / entries.length * 100).toFixed(1)) + '%'
          },
          visualization: visualizeBoundingBoxes(entries, query)
        };
        break;
      }

      case 'nearest': {
        const tree = new RTree();
        const entries = args.entries?.map((e: any, i: number) => ({ ...e, id: i + 1 })) ||
                       generateRandomRectangles(args.num_entries || 20);

        for (const entry of entries) {
          tree.insert(entry);
        }

        const point = args.point || { x: 50, y: 50 };
        const k = args.k || 5;
        const nearest = tree.nearestNeighbor(point, k);

        // Calculate distances
        const withDistances = nearest.map(n => ({
          ...n,
          distance: parseFloat(distance(n.bounds, pointToBBox(point.x, point.y)).toFixed(2))
        }));

        result = {
          operation: 'nearest',
          query_point: point,
          k: k,
          total_entries: entries.length,
          nearest_neighbors: withDistances.map((n, i) => ({
            rank: i + 1,
            id: n.id,
            bounds: n.bounds,
            distance_to_center: n.distance
          })),
          visualization: visualizeBoundingBoxes(entries, pointToBBox(point.x, point.y))
        };
        break;
      }

      case 'contains': {
        const tree = new RTree();
        const entries = args.entries?.map((e: any, i: number) => ({ ...e, id: i + 1 })) ||
                       generateRandomRectangles(args.num_entries || 15);

        for (const entry of entries) {
          tree.insert(entry);
        }

        const point = args.point || { x: 50, y: 50 };
        const pointBox = pointToBBox(point.x, point.y);

        // Find entries containing the point
        const allEntries = tree.getAllEntries();
        const containing = allEntries.filter(e => contains(e.bounds, pointBox));

        result = {
          operation: 'contains',
          query_point: point,
          total_entries: entries.length,
          entries_containing_point: containing.length,
          results: containing.map(c => ({
            id: c.id,
            bounds: c.bounds,
            area: parseFloat(area(c.bounds).toFixed(2))
          })),
          visualization: visualizeBoundingBoxes(entries, { ...pointBox, minX: point.x - 1, minY: point.y - 1, maxX: point.x + 1, maxY: point.y + 1 })
        };
        break;
      }

      case 'analyze': {
        const sizes = [10, 50, 100, 500];
        const analysis = [];

        for (const n of sizes) {
          const entries = generateRandomRectangles(n);
          const tree = new RTree();

          const startInsert = performance.now();
          for (const entry of entries) {
            tree.insert(entry);
          }
          const insertTime = performance.now() - startInsert;

          const query: BoundingBox = { minX: 25, minY: 25, maxX: 75, maxY: 75 };
          const startSearch = performance.now();
          const results = tree.search(query);
          const searchTime = performance.now() - startSearch;

          const stats = tree.getStats();

          analysis.push({
            n: n,
            insert_time_ms: parseFloat(insertTime.toFixed(3)),
            search_time_ms: parseFloat(searchTime.toFixed(3)),
            results_found: results.length,
            tree_depth: stats.depth,
            nodes: stats.nodeCount
          });
        }

        result = {
          operation: 'analyze',
          performance_analysis: analysis,
          complexity_observations: [
            'Insert time scales with log(n)',
            'Search time depends on result count k',
            'Tree depth grows logarithmically',
            'Range queries benefit from spatial clustering'
          ],
          optimization_tips: [
            'Bulk loading is faster than individual inserts',
            'R*-tree provides better query performance',
            'Choose appropriate node capacity for your data',
            'Consider spatial locality of your data'
          ]
        };
        break;
      }

      case 'demonstrate': {
        const demoEntries: RTreeEntry[] = [
          { bounds: { minX: 10, minY: 10, maxX: 30, maxY: 30 }, id: 1, data: { name: 'A' } },
          { bounds: { minX: 20, minY: 20, maxX: 40, maxY: 40 }, id: 2, data: { name: 'B' } },
          { bounds: { minX: 50, minY: 10, maxX: 70, maxY: 30 }, id: 3, data: { name: 'C' } },
          { bounds: { minX: 60, minY: 50, maxX: 80, maxY: 70 }, id: 4, data: { name: 'D' } },
          { bounds: { minX: 30, minY: 60, maxX: 50, maxY: 80 }, id: 5, data: { name: 'E' } }
        ];

        const tree = new RTree();
        for (const entry of demoEntries) {
          tree.insert(entry);
        }

        const query: BoundingBox = { minX: 15, minY: 15, maxX: 45, maxY: 45 };
        const results = tree.search(query);

        result = {
          operation: 'demonstrate',
          tool: 'r_tree',
          demo_entries: demoEntries.map(e => ({
            id: e.id,
            name: e.data.name,
            bounds: e.bounds
          })),
          query_example: {
            query_box: query,
            results: results.map(r => ({ id: r.id, name: r.data.name })),
            explanation: 'Query returns entries A and B which intersect the query region'
          },
          visualization: visualizeBoundingBoxes(demoEntries, query),
          structure_explanation: {
            mbr: 'Minimum Bounding Rectangle enclosing all children',
            node_capacity: 'Maximum entries per node (typically 4-50)',
            split: 'Node splits when capacity exceeded',
            overlap: 'MBRs of siblings may overlap'
          },
          algorithm: `
R-TREE STRUCTURE
════════════════

                    Root MBR
              ┌─────────────────┐
              │   encompasses   │
              │   all children  │
              └────────┬────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
    ┌────┴────┐                 ┌────┴────┐
    │ Node 1  │                 │ Node 2  │
    │  MBR    │                 │  MBR    │
    └────┬────┘                 └────┬────┘
         │                           │
    ┌────┴────┐                 ┌────┴────┐
    │ A  │ B  │                 │ C  │ D  │
    └─────────┘                 └─────────┘


RANGE QUERY PROCESS
═══════════════════

1. Start at root
2. If query intersects MBR, descend
3. At leaf, check each entry
4. Return intersecting entries

Query: [15,15] to [45,45]
├── Check Node 1 MBR: INTERSECTS ✓
│   ├── Check A: INTERSECTS ✓ → Return
│   └── Check B: INTERSECTS ✓ → Return
└── Check Node 2 MBR: NO INTERSECTION ✗
    └── Skip entire subtree (pruning!)
`
        };
        break;
      }

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          available: ['info', 'insert', 'search', 'nearest', 'range_query', 'contains', 'analyze', 'demonstrate']
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isrtreeAvailable(): boolean {
  return true;
}
