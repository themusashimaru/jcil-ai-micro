/**
 * BTREE-INDEX TOOL
 * B-tree index implementation for database indexing operations
 * Supports insert, delete, search, range queries, and visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface BTreeNode<K, V> {
  keys: K[];
  values: V[];
  children: BTreeNode<K, V>[];
  isLeaf: boolean;
}

interface BTreeVisualization {
  level: number;
  nodes: {
    keys: unknown[];
    isLeaf: boolean;
    childCount: number;
  }[];
}

interface BTreeStats {
  height: number;
  totalNodes: number;
  totalKeys: number;
  leafNodes: number;
  internalNodes: number;
  minDegree: number;
  maxKeys: number;
  fillFactor: number;
}

interface SearchResult<K, V> {
  found: boolean;
  key?: K;
  value?: V;
  comparisons: number;
  path: K[][];
}

interface RangeQueryResult<K, V> {
  results: { key: K; value: V }[];
  count: number;
  scannedNodes: number;
}

// ============================================================================
// B-TREE IMPLEMENTATION
// ============================================================================

class BTree<K, V> {
  private root: BTreeNode<K, V>;
  private t: number; // Minimum degree
  private compare: (a: K, b: K) => number;
  private nodeCount = 0;

  constructor(minDegree: number = 3, compareFn?: (a: K, b: K) => number) {
    this.t = minDegree;
    this.compare = compareFn || ((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    this.root = this.createNode(true);
  }

  private createNode(isLeaf: boolean): BTreeNode<K, V> {
    this.nodeCount++;
    return {
      keys: [],
      values: [],
      children: [],
      isLeaf
    };
  }

  /**
   * Search for a key in the B-tree
   */
  search(key: K): SearchResult<K, V> {
    let comparisons = 0;
    const path: K[][] = [];

    const searchNode = (node: BTreeNode<K, V>): { found: boolean; value?: V } => {
      path.push([...node.keys]);

      // Find the first key >= search key
      let i = 0;
      while (i < node.keys.length) {
        comparisons++;
        const cmp = this.compare(key, node.keys[i]);
        if (cmp === 0) {
          return { found: true, value: node.values[i] };
        }
        if (cmp < 0) break;
        i++;
      }

      if (node.isLeaf) {
        return { found: false };
      }

      return searchNode(node.children[i]);
    };

    const result = searchNode(this.root);

    return {
      found: result.found,
      key: result.found ? key : undefined,
      value: result.value,
      comparisons,
      path
    };
  }

  /**
   * Insert a key-value pair
   */
  insert(key: K, value: V): { success: boolean; splits: number } {
    let splits = 0;

    // If root is full, split it first
    if (this.root.keys.length === 2 * this.t - 1) {
      const newRoot = this.createNode(false);
      newRoot.children.push(this.root);
      this.splitChild(newRoot, 0);
      splits++;
      this.root = newRoot;
    }

    // Insert into non-full tree
    const insertResult = this.insertNonFull(this.root, key, value);
    splits += insertResult.splits;

    return { success: true, splits };
  }

  private insertNonFull(node: BTreeNode<K, V>, key: K, value: V): { splits: number } {
    let i = node.keys.length - 1;
    let splits = 0;

    if (node.isLeaf) {
      // Find position and insert
      while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
        i--;
      }

      // Check for duplicate
      if (i >= 0 && this.compare(key, node.keys[i]) === 0) {
        node.values[i] = value; // Update existing
        return { splits: 0 };
      }

      // Insert at position i+1
      node.keys.splice(i + 1, 0, key);
      node.values.splice(i + 1, 0, value);
    } else {
      // Find child to descend
      while (i >= 0 && this.compare(key, node.keys[i]) < 0) {
        i--;
      }
      i++;

      // Check if child is full
      if (node.children[i].keys.length === 2 * this.t - 1) {
        this.splitChild(node, i);
        splits++;
        if (this.compare(key, node.keys[i]) > 0) {
          i++;
        }
      }

      const childResult = this.insertNonFull(node.children[i], key, value);
      splits += childResult.splits;
    }

    return { splits };
  }

  private splitChild(parent: BTreeNode<K, V>, index: number): void {
    const child = parent.children[index];
    const newNode = this.createNode(child.isLeaf);
    const mid = this.t - 1;

    // Move keys and values to new node
    newNode.keys = child.keys.splice(mid + 1);
    newNode.values = child.values.splice(mid + 1);

    // Move children if not leaf
    if (!child.isLeaf) {
      newNode.children = child.children.splice(mid + 1);
    }

    // Get middle key
    const midKey = child.keys.pop()!;
    const midValue = child.values.pop()!;

    // Insert middle key into parent
    parent.keys.splice(index, 0, midKey);
    parent.values.splice(index, 0, midValue);
    parent.children.splice(index + 1, 0, newNode);
  }

  /**
   * Delete a key from the B-tree
   */
  delete(key: K): { success: boolean; found: boolean } {
    const result = this.deleteKey(this.root, key);

    // Shrink tree if root is empty but has children
    if (this.root.keys.length === 0 && !this.root.isLeaf) {
      this.root = this.root.children[0];
      this.nodeCount--;
    }

    return result;
  }

  private deleteKey(node: BTreeNode<K, V>, key: K): { success: boolean; found: boolean } {
    let i = 0;
    while (i < node.keys.length && this.compare(key, node.keys[i]) > 0) {
      i++;
    }

    // Key found in this node
    if (i < node.keys.length && this.compare(key, node.keys[i]) === 0) {
      if (node.isLeaf) {
        // Case 1: Key is in leaf node
        node.keys.splice(i, 1);
        node.values.splice(i, 1);
        return { success: true, found: true };
      } else {
        // Case 2: Key is in internal node
        return this.deleteInternalKey(node, i);
      }
    } else {
      // Key not in this node
      if (node.isLeaf) {
        return { success: false, found: false };
      }

      // Ensure child has enough keys
      const isLastChild = i === node.keys.length;
      if (node.children[i].keys.length < this.t) {
        this.fillChild(node, i);
      }

      // After fill, index may have changed
      if (isLastChild && i > node.keys.length) {
        return this.deleteKey(node.children[i - 1], key);
      }
      return this.deleteKey(node.children[i], key);
    }
  }

  private deleteInternalKey(node: BTreeNode<K, V>, index: number): { success: boolean; found: boolean } {
    const key = node.keys[index];

    if (node.children[index].keys.length >= this.t) {
      // Case 2a: Left child has enough keys
      const { predKey, predValue } = this.getPredecessor(node.children[index]);
      node.keys[index] = predKey;
      node.values[index] = predValue;
      return this.deleteKey(node.children[index], predKey);
    } else if (node.children[index + 1].keys.length >= this.t) {
      // Case 2b: Right child has enough keys
      const { succKey, succValue } = this.getSuccessor(node.children[index + 1]);
      node.keys[index] = succKey;
      node.values[index] = succValue;
      return this.deleteKey(node.children[index + 1], succKey);
    } else {
      // Case 2c: Both children have t-1 keys, merge
      this.merge(node, index);
      return this.deleteKey(node.children[index], key);
    }
  }

  private getPredecessor(node: BTreeNode<K, V>): { predKey: K; predValue: V } {
    while (!node.isLeaf) {
      node = node.children[node.children.length - 1];
    }
    const last = node.keys.length - 1;
    return { predKey: node.keys[last], predValue: node.values[last] };
  }

  private getSuccessor(node: BTreeNode<K, V>): { succKey: K; succValue: V } {
    while (!node.isLeaf) {
      node = node.children[0];
    }
    return { succKey: node.keys[0], succValue: node.values[0] };
  }

  private fillChild(parent: BTreeNode<K, V>, index: number): void {
    if (index > 0 && parent.children[index - 1].keys.length >= this.t) {
      this.borrowFromPrev(parent, index);
    } else if (index < parent.keys.length && parent.children[index + 1].keys.length >= this.t) {
      this.borrowFromNext(parent, index);
    } else {
      if (index < parent.keys.length) {
        this.merge(parent, index);
      } else {
        this.merge(parent, index - 1);
      }
    }
  }

  private borrowFromPrev(parent: BTreeNode<K, V>, index: number): void {
    const child = parent.children[index];
    const sibling = parent.children[index - 1];

    // Move key from parent to child
    child.keys.unshift(parent.keys[index - 1]);
    child.values.unshift(parent.values[index - 1]);

    // Move key from sibling to parent
    parent.keys[index - 1] = sibling.keys.pop()!;
    parent.values[index - 1] = sibling.values.pop()!;

    // Move child pointer if not leaf
    if (!child.isLeaf) {
      child.children.unshift(sibling.children.pop()!);
    }
  }

  private borrowFromNext(parent: BTreeNode<K, V>, index: number): void {
    const child = parent.children[index];
    const sibling = parent.children[index + 1];

    // Move key from parent to child
    child.keys.push(parent.keys[index]);
    child.values.push(parent.values[index]);

    // Move key from sibling to parent
    parent.keys[index] = sibling.keys.shift()!;
    parent.values[index] = sibling.values.shift()!;

    // Move child pointer if not leaf
    if (!child.isLeaf) {
      child.children.push(sibling.children.shift()!);
    }
  }

  private merge(parent: BTreeNode<K, V>, index: number): void {
    const left = parent.children[index];
    const right = parent.children[index + 1];

    // Pull key from parent
    left.keys.push(parent.keys[index]);
    left.values.push(parent.values[index]);

    // Copy keys from right to left
    left.keys.push(...right.keys);
    left.values.push(...right.values);

    // Copy children if not leaf
    if (!left.isLeaf) {
      left.children.push(...right.children);
    }

    // Remove from parent
    parent.keys.splice(index, 1);
    parent.values.splice(index, 1);
    parent.children.splice(index + 1, 1);

    this.nodeCount--;
  }

  /**
   * Range query
   */
  rangeQuery(minKey: K, maxKey: K): RangeQueryResult<K, V> {
    const results: { key: K; value: V }[] = [];
    let scannedNodes = 0;

    const scanNode = (node: BTreeNode<K, V>): void => {
      scannedNodes++;

      for (let i = 0; i < node.keys.length; i++) {
        // Visit left child if not leaf and might have keys in range
        if (!node.isLeaf && this.compare(minKey, node.keys[i]) <= 0) {
          scanNode(node.children[i]);
        }

        // Add key if in range
        if (this.compare(node.keys[i], minKey) >= 0 && this.compare(node.keys[i], maxKey) <= 0) {
          results.push({ key: node.keys[i], value: node.values[i] });
        }

        // Stop if past max
        if (this.compare(node.keys[i], maxKey) > 0) {
          return;
        }
      }

      // Visit rightmost child
      if (!node.isLeaf && node.children.length > node.keys.length) {
        const lastKey = node.keys[node.keys.length - 1];
        if (this.compare(lastKey, maxKey) <= 0) {
          scanNode(node.children[node.children.length - 1]);
        }
      }
    };

    scanNode(this.root);

    return {
      results,
      count: results.length,
      scannedNodes
    };
  }

  /**
   * Get all keys in order (in-order traversal)
   */
  inOrder(): { key: K; value: V }[] {
    const result: { key: K; value: V }[] = [];

    const traverse = (node: BTreeNode<K, V>): void => {
      for (let i = 0; i < node.keys.length; i++) {
        if (!node.isLeaf) {
          traverse(node.children[i]);
        }
        result.push({ key: node.keys[i], value: node.values[i] });
      }
      if (!node.isLeaf && node.children.length > node.keys.length) {
        traverse(node.children[node.children.length - 1]);
      }
    };

    traverse(this.root);
    return result;
  }

  /**
   * Get tree visualization
   */
  visualize(): BTreeVisualization[] {
    const levels: BTreeVisualization[] = [];

    const traverse = (node: BTreeNode<K, V>, level: number): void => {
      if (!levels[level]) {
        levels[level] = { level, nodes: [] };
      }

      levels[level].nodes.push({
        keys: node.keys as unknown[],
        isLeaf: node.isLeaf,
        childCount: node.children.length
      });

      for (const child of node.children) {
        traverse(child, level + 1);
      }
    };

    traverse(this.root, 0);
    return levels;
  }

  /**
   * Get tree statistics
   */
  getStats(): BTreeStats {
    let height = 0;
    let totalKeys = 0;
    let leafNodes = 0;
    let internalNodes = 0;
    let totalCapacity = 0;

    const traverse = (node: BTreeNode<K, V>, level: number): void => {
      height = Math.max(height, level);
      totalKeys += node.keys.length;
      totalCapacity += 2 * this.t - 1;

      if (node.isLeaf) {
        leafNodes++;
      } else {
        internalNodes++;
        for (const child of node.children) {
          traverse(child, level + 1);
        }
      }
    };

    traverse(this.root, 1);

    return {
      height,
      totalNodes: this.nodeCount,
      totalKeys,
      leafNodes,
      internalNodes,
      minDegree: this.t,
      maxKeys: 2 * this.t - 1,
      fillFactor: totalCapacity > 0 ? totalKeys / totalCapacity : 0
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const btreeindexTool: UnifiedTool = {
  name: 'btree_index',
  description: 'B-tree index implementation for database indexing - supports insert, delete, search, range queries, and tree visualization',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'insert', 'search', 'delete', 'range', 'visualize', 'stats', 'bulk_insert', 'info', 'examples'],
        description: 'Operation to perform'
      },
      minDegree: {
        type: 'number',
        description: 'Minimum degree of B-tree (default 3). Each node has min t-1 and max 2t-1 keys.'
      },
      key: {
        type: 'number',
        description: 'Key to insert, search, or delete'
      },
      value: {
        type: 'string',
        description: 'Value to associate with key'
      },
      keys: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of keys for bulk operations'
      },
      values: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of values for bulk insert'
      },
      minKey: {
        type: 'number',
        description: 'Minimum key for range query'
      },
      maxKey: {
        type: 'number',
        description: 'Maximum key for range query'
      }
    },
    required: ['operation']
  }
};

// Global tree instance for demo
let demoTree: BTree<number, string> | null = null;

export async function executebtreeindex(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'create': {
        const minDegree = args.minDegree || 3;
        demoTree = new BTree<number, string>(minDegree);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create',
            success: true,
            minDegree,
            properties: {
              minKeysPerNode: minDegree - 1,
              maxKeysPerNode: 2 * minDegree - 1,
              minChildrenPerNode: minDegree,
              maxChildrenPerNode: 2 * minDegree
            },
            message: `B-tree created with minimum degree ${minDegree}`
          }, null, 2)
        };
      }

      case 'insert': {
        if (!demoTree) {
          demoTree = new BTree<number, string>(args.minDegree || 3);
        }

        const key = args.key !== undefined ? args.key : 50;
        const value = args.value || `value_${key}`;

        const result = demoTree.insert(key, value);
        const stats = demoTree.getStats();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'insert',
            key,
            value,
            success: result.success,
            splitsDuringInsert: result.splits,
            treeStats: stats,
            visualization: demoTree.visualize()
          }, null, 2)
        };
      }

      case 'bulk_insert': {
        if (!demoTree) {
          demoTree = new BTree<number, string>(args.minDegree || 3);
        }

        const keys: number[] = args.keys || [10, 20, 5, 6, 12, 30, 7, 17, 3, 8, 25, 35, 40, 15, 22];
        const values: string[] = args.values || keys.map((k: number) => `data_${k}`);

        const insertResults: { key: number; splits: number }[] = [];
        let totalSplits = 0;

        for (let i = 0; i < keys.length; i++) {
          const result = demoTree.insert(keys[i], values[i] || `value_${keys[i]}`);
          insertResults.push({ key: keys[i], splits: result.splits });
          totalSplits += result.splits;
        }

        const stats = demoTree.getStats();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'bulk_insert',
            keysInserted: keys.length,
            totalSplits,
            insertionOrder: insertResults,
            treeStats: stats,
            visualization: demoTree.visualize(),
            inOrderTraversal: demoTree.inOrder().map(item => item.key)
          }, null, 2)
        };
      }

      case 'search': {
        if (!demoTree) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'No tree exists. Use create or bulk_insert first.'
            }, null, 2),
            isError: true
          };
        }

        const key = args.key !== undefined ? args.key : 15;
        const result = demoTree.search(key);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'search',
            key,
            found: result.found,
            value: result.value,
            comparisons: result.comparisons,
            searchPath: result.path,
            complexity: `O(log_t(n)) where t=${demoTree.getStats().minDegree}`
          }, null, 2)
        };
      }

      case 'delete': {
        if (!demoTree) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'No tree exists. Use create or bulk_insert first.'
            }, null, 2),
            isError: true
          };
        }

        const key = args.key !== undefined ? args.key : 15;
        const result = demoTree.delete(key);
        const stats = demoTree.getStats();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'delete',
            key,
            found: result.found,
            success: result.success,
            treeStats: stats,
            visualization: demoTree.visualize()
          }, null, 2)
        };
      }

      case 'range': {
        if (!demoTree) {
          // Create demo tree with sample data
          demoTree = new BTree<number, string>(3);
          const sampleKeys = [10, 20, 5, 6, 12, 30, 7, 17, 3, 8, 25, 35, 40, 15, 22];
          for (const k of sampleKeys) {
            demoTree.insert(k, `data_${k}`);
          }
        }

        const minKey = args.minKey !== undefined ? args.minKey : 10;
        const maxKey = args.maxKey !== undefined ? args.maxKey : 25;

        const result = demoTree.rangeQuery(minKey, maxKey);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'range_query',
            range: { min: minKey, max: maxKey },
            results: result.results,
            count: result.count,
            scannedNodes: result.scannedNodes,
            efficiency: 'Range queries in B-trees are efficient because keys are sorted'
          }, null, 2)
        };
      }

      case 'visualize': {
        if (!demoTree) {
          // Create demo tree with sample data
          demoTree = new BTree<number, string>(3);
          const sampleKeys = [10, 20, 5, 6, 12, 30, 7, 17, 3, 8];
          for (const k of sampleKeys) {
            demoTree.insert(k, `data_${k}`);
          }
        }

        const visualization = demoTree.visualize();
        const stats = demoTree.getStats();
        const inOrder = demoTree.inOrder();

        // Create ASCII visualization
        let ascii = 'B-Tree Structure:\n';
        for (const level of visualization) {
          ascii += `Level ${level.level}: `;
          for (const node of level.nodes) {
            ascii += `[${node.keys.join(',')}] `;
          }
          ascii += '\n';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            asciiTree: ascii,
            levels: visualization,
            stats,
            sortedKeys: inOrder.map(item => item.key)
          }, null, 2)
        };
      }

      case 'stats': {
        if (!demoTree) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'No tree exists. Use create or bulk_insert first.'
            }, null, 2),
            isError: true
          };
        }

        const stats = demoTree.getStats();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'stats',
            treeStatistics: stats,
            complexityAnalysis: {
              search: `O(log_${stats.minDegree}(${stats.totalKeys})) = O(${Math.ceil(Math.log(stats.totalKeys + 1) / Math.log(stats.minDegree))})`,
              insert: `O(log_${stats.minDegree}(${stats.totalKeys}))`,
              delete: `O(log_${stats.minDegree}(${stats.totalKeys}))`,
              range: 'O(log(n) + k) where k is result size'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'B-Tree Index',
            description: 'Self-balancing tree data structure optimized for disk-based storage systems',
            properties: {
              balanced: 'All leaves at same depth',
              multiway: 'Nodes can have multiple keys (unlike binary trees)',
              sorted: 'Keys are sorted within each node',
              efficient: 'O(log n) for all operations'
            },
            operations: [
              { name: 'create', description: 'Create new B-tree with specified minimum degree' },
              { name: 'insert', description: 'Insert key-value pair' },
              { name: 'bulk_insert', description: 'Insert multiple key-value pairs' },
              { name: 'search', description: 'Search for a key' },
              { name: 'delete', description: 'Delete a key' },
              { name: 'range', description: 'Range query between min and max keys' },
              { name: 'visualize', description: 'Visualize tree structure' },
              { name: 'stats', description: 'Get tree statistics' }
            ],
            terminology: {
              minDegree: 'Minimum number of children for non-root internal nodes',
              order: 'Maximum number of children (2 * minDegree)',
              height: 'Number of levels in tree',
              fillFactor: 'Ratio of actual keys to maximum possible keys'
            },
            applications: [
              'Database indexes',
              'File systems (NTFS, HFS+, ext4)',
              'Key-value stores',
              'Search engines'
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Create B-tree',
                call: { operation: 'create', minDegree: 3 }
              },
              {
                name: 'Bulk insert',
                call: {
                  operation: 'bulk_insert',
                  keys: [50, 25, 75, 12, 37, 62, 87],
                  values: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
                }
              },
              {
                name: 'Search',
                call: { operation: 'search', key: 37 }
              },
              {
                name: 'Range query',
                call: { operation: 'range', minKey: 20, maxKey: 70 }
              },
              {
                name: 'Delete',
                call: { operation: 'delete', key: 25 }
              },
              {
                name: 'Visualize',
                call: { operation: 'visualize' }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isbtreeindexAvailable(): boolean { return true; }
