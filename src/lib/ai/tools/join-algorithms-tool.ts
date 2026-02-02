/**
 * JOIN-ALGORITHMS TOOL
 * Multiple join algorithm implementations with cost comparison and performance metrics
 * Supports nested loop, sort-merge, hash joins with various optimizations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS' | 'SEMI' | 'ANTI';

interface Row {
  [key: string]: unknown;
}

interface Relation {
  name: string;
  rows: Row[];
  schema: { column: string; type: string }[];
}

interface JoinPredicate {
  leftColumn: string;
  rightColumn: string;
  operator: '=' | '<' | '>' | '<=' | '>=' | '<>';
}

interface JoinResult {
  rows: Row[];
  algorithm: string;
  metrics: JoinMetrics;
  explanation: string[];
}

interface JoinMetrics {
  comparisons: number;
  outputRows: number;
  memoryUsed: number;  // bytes
  ioOperations: number;
  cpuTime: number;  // milliseconds
  spilledToDisk: boolean;
  passes: number;
  hashCollisions?: number;
  sortOperations?: number;
  probeOperations?: number;
  buildOperations?: number;
}

interface AlgorithmComparison {
  algorithm: string;
  estimatedCost: number;
  metrics: Partial<JoinMetrics>;
  recommended: boolean;
  reason: string;
}

interface MemoryConfig {
  availableMemory: number;  // bytes
  pageSize: number;
  hashTableLoadFactor: number;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  availableMemory: 64 * 1024 * 1024,  // 64MB
  pageSize: 8192,
  hashTableLoadFactor: 0.75
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function estimateRowSize(row: Row): number {
  let size = 0;
  for (const value of Object.values(row)) {
    if (typeof value === 'string') {
      size += (value as string).length * 2;
    } else if (typeof value === 'number') {
      size += 8;
    } else if (typeof value === 'boolean') {
      size += 1;
    } else if (value === null) {
      size += 0;
    } else {
      size += 16;
    }
  }
  return size + 32;  // Object overhead
}

function hashValue(value: unknown): number {
  const str = String(value);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

function compareValues(a: unknown, b: unknown, operator: string): boolean {
  switch (operator) {
    case '=': return a === b;
    case '<>': return a !== b;
    case '<': return (a as number) < (b as number);
    case '>': return (a as number) > (b as number);
    case '<=': return (a as number) <= (b as number);
    case '>=': return (a as number) >= (b as number);
    default: return false;
  }
}

function mergeRows(leftRow: Row | null, rightRow: Row | null, leftPrefix: string, rightPrefix: string): Row {
  const result: Row = {};

  if (leftRow) {
    for (const [key, value] of Object.entries(leftRow)) {
      result[`${leftPrefix}.${key}`] = value;
    }
  }

  if (rightRow) {
    for (const [key, value] of Object.entries(rightRow)) {
      result[`${rightPrefix}.${key}`] = value;
    }
  }

  return result;
}

function createNullRow(schema: { column: string; type: string }[], prefix: string): Row {
  const result: Row = {};
  for (const col of schema) {
    result[`${prefix}.${col.column}`] = null;
  }
  return result;
}

// ============================================================================
// NESTED LOOP JOIN IMPLEMENTATIONS
// ============================================================================

/**
 * Simple Nested Loop Join
 * For each row in outer, scan all rows in inner
 */
function simpleNestedLoopJoin(
  outer: Relation,
  inner: Relation,
  predicate: JoinPredicate,
  joinType: JoinType
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let memoryUsed = 0;

  explanation.push(`Simple Nested Loop Join: O(n*m) complexity`);
  explanation.push(`Outer relation: ${outer.name} (${outer.rows.length} rows)`);
  explanation.push(`Inner relation: ${inner.name} (${inner.rows.length} rows)`);

  const matchedInner = new Set<number>();
  const matchedOuter = new Set<number>();

  for (let i = 0; i < outer.rows.length; i++) {
    const outerRow = outer.rows[i];
    let hasMatch = false;

    for (let j = 0; j < inner.rows.length; j++) {
      const innerRow = inner.rows[j];
      comparisons++;

      const outerValue = outerRow[predicate.leftColumn];
      const innerValue = innerRow[predicate.rightColumn];

      if (compareValues(outerValue, innerValue, predicate.operator)) {
        hasMatch = true;
        matchedOuter.add(i);
        matchedInner.add(j);

        if (joinType === 'SEMI') {
          result.push(mergeRows(outerRow, null, outer.name, inner.name));
          break;
        } else if (joinType !== 'ANTI') {
          result.push(mergeRows(outerRow, innerRow, outer.name, inner.name));
        }
      }
    }

    // Handle LEFT/FULL outer join - unmatched outer rows
    if (!hasMatch && (joinType === 'LEFT' || joinType === 'FULL')) {
      result.push(mergeRows(outerRow, createNullRow(inner.schema, inner.name), outer.name, inner.name));
    }

    // Handle ANTI join
    if (!hasMatch && joinType === 'ANTI') {
      result.push(mergeRows(outerRow, null, outer.name, inner.name));
    }
  }

  // Handle RIGHT/FULL outer join - unmatched inner rows
  if (joinType === 'RIGHT' || joinType === 'FULL') {
    for (let j = 0; j < inner.rows.length; j++) {
      if (!matchedInner.has(j)) {
        result.push(mergeRows(createNullRow(outer.schema, outer.name), inner.rows[j], outer.name, inner.name));
      }
    }
  }

  memoryUsed = result.reduce((sum, row) => sum + estimateRowSize(row), 0);
  const cpuTime = Date.now() - startTime;

  explanation.push(`Total comparisons: ${comparisons}`);
  explanation.push(`Output rows: ${result.length}`);

  return {
    rows: result,
    algorithm: 'Simple Nested Loop Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations: outer.rows.length + (outer.rows.length * inner.rows.length),
      cpuTime,
      spilledToDisk: false,
      passes: 1
    },
    explanation
  };
}

/**
 * Block Nested Loop Join
 * Load blocks of outer relation to reduce I/O
 */
function blockNestedLoopJoin(
  outer: Relation,
  inner: Relation,
  predicate: JoinPredicate,
  joinType: JoinType,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let ioOperations = 0;

  // Calculate block size based on available memory
  const avgRowSize = outer.rows.length > 0 ? estimateRowSize(outer.rows[0]) : 100;
  const blockSize = Math.floor(config.availableMemory / avgRowSize);
  const numBlocks = Math.ceil(outer.rows.length / blockSize);

  explanation.push(`Block Nested Loop Join with block size: ${blockSize} rows`);
  explanation.push(`Number of blocks: ${numBlocks}`);

  const matchedInner = new Set<number>();
  const matchedOuter = new Set<number>();

  // Process outer relation in blocks
  for (let blockStart = 0; blockStart < outer.rows.length; blockStart += blockSize) {
    const blockEnd = Math.min(blockStart + blockSize, outer.rows.length);
    const block = outer.rows.slice(blockStart, blockEnd);
    ioOperations += block.length;  // Reading block

    // For each inner row, compare with all rows in current block
    for (let j = 0; j < inner.rows.length; j++) {
      const innerRow = inner.rows[j];
      ioOperations++;

      for (let i = 0; i < block.length; i++) {
        const outerRow = block[i];
        const outerIdx = blockStart + i;
        comparisons++;

        const outerValue = outerRow[predicate.leftColumn];
        const innerValue = innerRow[predicate.rightColumn];

        if (compareValues(outerValue, innerValue, predicate.operator)) {
          matchedOuter.add(outerIdx);
          matchedInner.add(j);

          if (joinType === 'SEMI') {
            if (!matchedOuter.has(outerIdx - 1)) {  // Only add once
              result.push(mergeRows(outerRow, null, outer.name, inner.name));
            }
          } else if (joinType !== 'ANTI') {
            result.push(mergeRows(outerRow, innerRow, outer.name, inner.name));
          }
        }
      }
    }
  }

  // Handle outer join unmatched rows
  if (joinType === 'LEFT' || joinType === 'FULL') {
    for (let i = 0; i < outer.rows.length; i++) {
      if (!matchedOuter.has(i)) {
        result.push(mergeRows(outer.rows[i], createNullRow(inner.schema, inner.name), outer.name, inner.name));
      }
    }
  }

  if (joinType === 'RIGHT' || joinType === 'FULL') {
    for (let j = 0; j < inner.rows.length; j++) {
      if (!matchedInner.has(j)) {
        result.push(mergeRows(createNullRow(outer.schema, outer.name), inner.rows[j], outer.name, inner.name));
      }
    }
  }

  if (joinType === 'ANTI') {
    for (let i = 0; i < outer.rows.length; i++) {
      if (!matchedOuter.has(i)) {
        result.push(mergeRows(outer.rows[i], null, outer.name, inner.name));
      }
    }
  }

  const memoryUsed = blockSize * avgRowSize;
  const cpuTime = Date.now() - startTime;

  explanation.push(`Total comparisons: ${comparisons}`);
  explanation.push(`I/O operations reduced by blocking: ${ioOperations}`);

  return {
    rows: result,
    algorithm: 'Block Nested Loop Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations,
      cpuTime,
      spilledToDisk: false,
      passes: numBlocks
    },
    explanation
  };
}

/**
 * Index Nested Loop Join
 * Use index on inner relation for faster lookups
 */
function indexNestedLoopJoin(
  outer: Relation,
  inner: Relation,
  predicate: JoinPredicate,
  joinType: JoinType
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let probeOperations = 0;

  explanation.push(`Index Nested Loop Join: O(n * log(m)) complexity`);
  explanation.push(`Building index on inner relation column: ${predicate.rightColumn}`);

  // Build hash index on inner relation
  const index = new Map<unknown, Row[]>();
  for (const row of inner.rows) {
    const key = row[predicate.rightColumn];
    if (!index.has(key)) {
      index.set(key, []);
    }
    index.get(key)!.push(row);
  }

  const matchedInner = new Set<number>();
  const matchedOuter = new Set<number>();

  // Probe index for each outer row
  for (let i = 0; i < outer.rows.length; i++) {
    const outerRow = outer.rows[i];
    const searchKey = outerRow[predicate.leftColumn];
    probeOperations++;

    const matches = predicate.operator === '=' ? (index.get(searchKey) || []) : [];

    // For non-equality predicates, scan all
    if (predicate.operator !== '=') {
      for (const [key, rows] of index.entries()) {
        if (compareValues(searchKey, key, predicate.operator)) {
          matches.push(...rows);
        }
        comparisons++;
      }
    }

    if (matches.length > 0) {
      matchedOuter.add(i);
      for (const innerRow of matches) {
        comparisons++;
        const innerIdx = inner.rows.indexOf(innerRow);
        matchedInner.add(innerIdx);

        if (joinType === 'SEMI') {
          result.push(mergeRows(outerRow, null, outer.name, inner.name));
          break;
        } else if (joinType !== 'ANTI') {
          result.push(mergeRows(outerRow, innerRow, outer.name, inner.name));
        }
      }
    } else if (joinType === 'LEFT' || joinType === 'FULL') {
      result.push(mergeRows(outerRow, createNullRow(inner.schema, inner.name), outer.name, inner.name));
    } else if (joinType === 'ANTI') {
      result.push(mergeRows(outerRow, null, outer.name, inner.name));
    }
  }

  if (joinType === 'RIGHT' || joinType === 'FULL') {
    for (let j = 0; j < inner.rows.length; j++) {
      if (!matchedInner.has(j)) {
        result.push(mergeRows(createNullRow(outer.schema, outer.name), inner.rows[j], outer.name, inner.name));
      }
    }
  }

  const memoryUsed = index.size * 64 + inner.rows.reduce((sum, row) => sum + estimateRowSize(row), 0);
  const cpuTime = Date.now() - startTime;

  explanation.push(`Index entries: ${index.size}`);
  explanation.push(`Probe operations: ${probeOperations}`);
  explanation.push(`Comparisons: ${comparisons}`);

  return {
    rows: result,
    algorithm: 'Index Nested Loop Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations: outer.rows.length + index.size,
      cpuTime,
      spilledToDisk: false,
      passes: 1,
      probeOperations,
      buildOperations: inner.rows.length
    },
    explanation
  };
}

// ============================================================================
// SORT-MERGE JOIN
// ============================================================================

function sortMergeJoin(
  left: Relation,
  right: Relation,
  predicate: JoinPredicate,
  joinType: JoinType
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let sortOperations = 0;

  explanation.push(`Sort-Merge Join: O(n log n + m log m + n + m) complexity`);
  explanation.push(`Sorting both relations on join columns`);

  // Sort both relations
  const sortedLeft = [...left.rows].sort((a, b) => {
    sortOperations++;
    const aVal = a[predicate.leftColumn] as string | number;
    const bVal = b[predicate.leftColumn] as string | number;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });

  const sortedRight = [...right.rows].sort((a, b) => {
    sortOperations++;
    const aVal = a[predicate.rightColumn] as string | number;
    const bVal = b[predicate.rightColumn] as string | number;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
    return 0;
  });

  const matchedLeft = new Set<number>();
  const matchedRight = new Set<number>();

  // Merge phase
  let i = 0;
  let j = 0;

  while (i < sortedLeft.length && j < sortedRight.length) {
    const leftRow = sortedLeft[i];
    const rightRow = sortedRight[j];
    const leftVal = leftRow[predicate.leftColumn];
    const rightVal = rightRow[predicate.rightColumn];
    comparisons++;

    if (leftVal === rightVal) {
      // Find all matching rows on both sides
      const matchStartJ = j;

      // Mark as matched
      const leftOrigIdx = left.rows.indexOf(leftRow);
      matchedLeft.add(leftOrigIdx);

      // Handle duplicates on right side
      while (j < sortedRight.length && sortedRight[j][predicate.rightColumn] === leftVal) {
        const rightOrigIdx = right.rows.indexOf(sortedRight[j]);
        matchedRight.add(rightOrigIdx);

        if (joinType === 'SEMI') {
          // Only output left row once
          if (j === matchStartJ) {
            result.push(mergeRows(leftRow, null, left.name, right.name));
          }
        } else if (joinType !== 'ANTI') {
          result.push(mergeRows(leftRow, sortedRight[j], left.name, right.name));
        }
        j++;
        comparisons++;
      }

      // Check if next left row also matches
      const nextLeftVal = i + 1 < sortedLeft.length ? sortedLeft[i + 1][predicate.leftColumn] : null;
      if (nextLeftVal === leftVal) {
        j = matchStartJ;  // Reset j for duplicate handling
      }
      i++;
    } else if ((leftVal as string | number) < (rightVal as string | number)) {
      if (joinType === 'LEFT' || joinType === 'FULL') {
        const leftOrigIdx = left.rows.indexOf(leftRow);
        if (!matchedLeft.has(leftOrigIdx)) {
          result.push(mergeRows(leftRow, createNullRow(right.schema, right.name), left.name, right.name));
        }
      }
      if (joinType === 'ANTI') {
        const leftOrigIdx = left.rows.indexOf(leftRow);
        if (!matchedLeft.has(leftOrigIdx)) {
          result.push(mergeRows(leftRow, null, left.name, right.name));
        }
      }
      i++;
    } else {
      if (joinType === 'RIGHT' || joinType === 'FULL') {
        const rightOrigIdx = right.rows.indexOf(rightRow);
        if (!matchedRight.has(rightOrigIdx)) {
          result.push(mergeRows(createNullRow(left.schema, left.name), rightRow, left.name, right.name));
        }
      }
      j++;
    }
  }

  // Handle remaining rows for outer joins
  while (i < sortedLeft.length && (joinType === 'LEFT' || joinType === 'FULL' || joinType === 'ANTI')) {
    const leftOrigIdx = left.rows.indexOf(sortedLeft[i]);
    if (!matchedLeft.has(leftOrigIdx)) {
      if (joinType === 'ANTI') {
        result.push(mergeRows(sortedLeft[i], null, left.name, right.name));
      } else {
        result.push(mergeRows(sortedLeft[i], createNullRow(right.schema, right.name), left.name, right.name));
      }
    }
    i++;
  }

  while (j < sortedRight.length && (joinType === 'RIGHT' || joinType === 'FULL')) {
    const rightOrigIdx = right.rows.indexOf(sortedRight[j]);
    if (!matchedRight.has(rightOrigIdx)) {
      result.push(mergeRows(createNullRow(left.schema, left.name), sortedRight[j], left.name, right.name));
    }
    j++;
  }

  const memoryUsed = (sortedLeft.length + sortedRight.length) *
    (estimateRowSize(sortedLeft[0] || {}) + estimateRowSize(sortedRight[0] || {})) / 2;
  const cpuTime = Date.now() - startTime;

  explanation.push(`Sort operations: ${sortOperations}`);
  explanation.push(`Merge comparisons: ${comparisons}`);
  explanation.push(`Output rows: ${result.length}`);

  return {
    rows: result,
    algorithm: 'Sort-Merge Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations: left.rows.length + right.rows.length,
      cpuTime,
      spilledToDisk: memoryUsed > DEFAULT_MEMORY_CONFIG.availableMemory,
      passes: 1,
      sortOperations
    },
    explanation
  };
}

// ============================================================================
// HASH JOIN IMPLEMENTATIONS
// ============================================================================

/**
 * Classic Hash Join
 * Build hash table on smaller relation, probe with larger
 */
function classicHashJoin(
  build: Relation,
  probe: Relation,
  predicate: JoinPredicate,
  joinType: JoinType
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let hashCollisions = 0;
  let buildOperations = 0;
  let probeOperations = 0;

  explanation.push(`Classic Hash Join: O(n + m) average complexity`);
  explanation.push(`Build relation: ${build.name} (${build.rows.length} rows)`);
  explanation.push(`Probe relation: ${probe.name} (${probe.rows.length} rows)`);

  // Build phase - create hash table
  const hashTable = new Map<number, Row[]>();

  for (const row of build.rows) {
    const key = row[predicate.rightColumn];
    const hash = hashValue(key);
    buildOperations++;

    if (!hashTable.has(hash)) {
      hashTable.set(hash, []);
    } else {
      hashCollisions++;
    }
    hashTable.get(hash)!.push(row);
  }

  explanation.push(`Hash table buckets: ${hashTable.size}`);
  explanation.push(`Hash collisions: ${hashCollisions}`);

  const matchedBuild = new Set<number>();
  const matchedProbe = new Set<number>();

  // Probe phase
  for (let i = 0; i < probe.rows.length; i++) {
    const probeRow = probe.rows[i];
    const key = probeRow[predicate.leftColumn];
    const hash = hashValue(key);
    probeOperations++;

    const bucket = hashTable.get(hash) || [];
    let hasMatch = false;

    for (const buildRow of bucket) {
      comparisons++;
      if (probeRow[predicate.leftColumn] === buildRow[predicate.rightColumn]) {
        hasMatch = true;
        matchedProbe.add(i);
        const buildIdx = build.rows.indexOf(buildRow);
        matchedBuild.add(buildIdx);

        if (joinType === 'SEMI') {
          result.push(mergeRows(probeRow, null, probe.name, build.name));
          break;
        } else if (joinType !== 'ANTI') {
          result.push(mergeRows(probeRow, buildRow, probe.name, build.name));
        }
      }
    }

    if (!hasMatch && (joinType === 'LEFT' || joinType === 'FULL')) {
      result.push(mergeRows(probeRow, createNullRow(build.schema, build.name), probe.name, build.name));
    }
    if (!hasMatch && joinType === 'ANTI') {
      result.push(mergeRows(probeRow, null, probe.name, build.name));
    }
  }

  // Handle RIGHT/FULL outer join
  if (joinType === 'RIGHT' || joinType === 'FULL') {
    for (let j = 0; j < build.rows.length; j++) {
      if (!matchedBuild.has(j)) {
        result.push(mergeRows(createNullRow(probe.schema, probe.name), build.rows[j], probe.name, build.name));
      }
    }
  }

  const memoryUsed = build.rows.reduce((sum, row) => sum + estimateRowSize(row), 0) + hashTable.size * 32;
  const cpuTime = Date.now() - startTime;

  explanation.push(`Build operations: ${buildOperations}`);
  explanation.push(`Probe operations: ${probeOperations}`);
  explanation.push(`Comparisons: ${comparisons}`);

  return {
    rows: result,
    algorithm: 'Classic Hash Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations: build.rows.length + probe.rows.length,
      cpuTime,
      spilledToDisk: false,
      passes: 1,
      hashCollisions,
      buildOperations,
      probeOperations
    },
    explanation
  };
}

/**
 * Grace Hash Join
 * Partition both relations when memory is limited
 */
function graceHashJoin(
  build: Relation,
  probe: Relation,
  predicate: JoinPredicate,
  joinType: JoinType,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let hashCollisions = 0;
  let ioOperations = 0;

  // Estimate partition count based on memory
  const avgRowSize = estimateRowSize(build.rows[0] || {});
  const memoryForHashTable = config.availableMemory * 0.8;
  const rowsPerPartition = Math.floor(memoryForHashTable / avgRowSize);
  const numPartitions = Math.ceil(build.rows.length / rowsPerPartition);

  explanation.push(`Grace Hash Join: Memory-efficient partitioned hash join`);
  explanation.push(`Number of partitions: ${numPartitions}`);
  explanation.push(`Rows per partition: ~${rowsPerPartition}`);

  // Partition both relations
  const buildPartitions: Row[][] = Array.from({ length: numPartitions }, () => []);
  const probePartitions: Row[][] = Array.from({ length: numPartitions }, () => []);

  // Partition build relation
  for (const row of build.rows) {
    const hash = hashValue(row[predicate.rightColumn]);
    const partitionIdx = hash % numPartitions;
    buildPartitions[partitionIdx].push(row);
    ioOperations++;  // Write to partition
  }

  // Partition probe relation
  for (const row of probe.rows) {
    const hash = hashValue(row[predicate.leftColumn]);
    const partitionIdx = hash % numPartitions;
    probePartitions[partitionIdx].push(row);
    ioOperations++;  // Write to partition
  }

  explanation.push(`Partitioning complete. Processing ${numPartitions} partition pairs.`);

  const matchedBuild = new Set<string>();
  const matchedProbe = new Set<string>();

  // Process each partition pair
  for (let p = 0; p < numPartitions; p++) {
    const buildPart = buildPartitions[p];
    const probePart = probePartitions[p];

    if (buildPart.length === 0 && probePart.length === 0) continue;

    ioOperations += buildPart.length + probePart.length;  // Read partitions

    // Build hash table for this partition
    const hashTable = new Map<number, Row[]>();
    for (const row of buildPart) {
      const key = row[predicate.rightColumn];
      const hash = hashValue(key);
      if (!hashTable.has(hash)) {
        hashTable.set(hash, []);
      } else {
        hashCollisions++;
      }
      hashTable.get(hash)!.push(row);
    }

    // Probe this partition
    for (const probeRow of probePart) {
      const key = probeRow[predicate.leftColumn];
      const hash = hashValue(key);
      const bucket = hashTable.get(hash) || [];
      let hasMatch = false;

      for (const buildRow of bucket) {
        comparisons++;
        if (probeRow[predicate.leftColumn] === buildRow[predicate.rightColumn]) {
          hasMatch = true;
          const probeKey = `${p}-${probePart.indexOf(probeRow)}`;
          const buildKey = `${p}-${buildPart.indexOf(buildRow)}`;
          matchedProbe.add(probeKey);
          matchedBuild.add(buildKey);

          if (joinType === 'SEMI') {
            result.push(mergeRows(probeRow, null, probe.name, build.name));
            break;
          } else if (joinType !== 'ANTI') {
            result.push(mergeRows(probeRow, buildRow, probe.name, build.name));
          }
        }
      }

      if (!hasMatch && (joinType === 'LEFT' || joinType === 'FULL')) {
        result.push(mergeRows(probeRow, createNullRow(build.schema, build.name), probe.name, build.name));
      }
      if (!hasMatch && joinType === 'ANTI') {
        result.push(mergeRows(probeRow, null, probe.name, build.name));
      }
    }

    // Handle unmatched build rows for RIGHT/FULL join
    if (joinType === 'RIGHT' || joinType === 'FULL') {
      for (let i = 0; i < buildPart.length; i++) {
        const buildKey = `${p}-${i}`;
        if (!matchedBuild.has(buildKey)) {
          result.push(mergeRows(createNullRow(probe.schema, probe.name), buildPart[i], probe.name, build.name));
        }
      }
    }
  }

  const memoryUsed = rowsPerPartition * avgRowSize;
  const cpuTime = Date.now() - startTime;

  explanation.push(`Total comparisons: ${comparisons}`);
  explanation.push(`I/O operations: ${ioOperations}`);

  return {
    rows: result,
    algorithm: 'Grace Hash Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations,
      cpuTime,
      spilledToDisk: true,
      passes: 2,  // Partition + Join
      hashCollisions
    },
    explanation
  };
}

/**
 * Hybrid Hash Join
 * Keep first partition in memory, spill rest to disk
 */
function hybridHashJoin(
  build: Relation,
  probe: Relation,
  predicate: JoinPredicate,
  joinType: JoinType,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): JoinResult {
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];
  let comparisons = 0;
  let hashCollisions = 0;
  let ioOperations = 0;

  const avgRowSize = estimateRowSize(build.rows[0] || {});
  const memoryForInMemory = config.availableMemory * 0.6;
  const inMemoryRows = Math.floor(memoryForInMemory / avgRowSize);
  const numPartitions = Math.ceil((build.rows.length - inMemoryRows) / inMemoryRows) + 1;

  explanation.push(`Hybrid Hash Join: First partition kept in memory`);
  explanation.push(`In-memory capacity: ${inMemoryRows} rows`);
  explanation.push(`Additional partitions: ${numPartitions - 1}`);

  // First partition (in-memory hash table)
  const inMemoryHashTable = new Map<number, Row[]>();
  const spilledBuildPartitions: Row[][] = Array.from({ length: numPartitions - 1 }, () => []);
  const spilledProbePartitions: Row[][] = Array.from({ length: numPartitions - 1 }, () => []);

  // Partition build relation
  for (let i = 0; i < build.rows.length; i++) {
    const row = build.rows[i];
    const hash = hashValue(row[predicate.rightColumn]);
    const partitionIdx = hash % numPartitions;

    if (partitionIdx === 0 && inMemoryHashTable.size * avgRowSize < memoryForInMemory) {
      // Keep in memory
      if (!inMemoryHashTable.has(hash)) {
        inMemoryHashTable.set(hash, []);
      } else {
        hashCollisions++;
      }
      inMemoryHashTable.get(hash)!.push(row);
    } else {
      // Spill to disk
      const spillIdx = partitionIdx === 0 ? 0 : partitionIdx - 1;
      if (spillIdx < spilledBuildPartitions.length) {
        spilledBuildPartitions[spillIdx].push(row);
      }
      ioOperations++;
    }
  }

  explanation.push(`In-memory hash table size: ${inMemoryHashTable.size} buckets`);

  const matchedProbeHybrid = new Set<string>();

  // Probe with in-memory hash table first
  for (let i = 0; i < probe.rows.length; i++) {
    const probeRow = probe.rows[i];
    const hash = hashValue(probeRow[predicate.leftColumn]);
    const partitionIdx = hash % numPartitions;

    if (partitionIdx === 0) {
      const bucket = inMemoryHashTable.get(hash) || [];
      let hasMatch = false;

      for (const buildRow of bucket) {
        comparisons++;
        if (probeRow[predicate.leftColumn] === buildRow[predicate.rightColumn]) {
          hasMatch = true;
          matchedProbeHybrid.add(`mem-${i}`);

          if (joinType === 'SEMI') {
            result.push(mergeRows(probeRow, null, probe.name, build.name));
            break;
          } else if (joinType !== 'ANTI') {
            result.push(mergeRows(probeRow, buildRow, probe.name, build.name));
          }
        }
      }

      if (!hasMatch && (joinType === 'LEFT' || joinType === 'FULL')) {
        result.push(mergeRows(probeRow, createNullRow(build.schema, build.name), probe.name, build.name));
      }
      if (!hasMatch && joinType === 'ANTI') {
        result.push(mergeRows(probeRow, null, probe.name, build.name));
      }
    } else {
      // Spill probe row
      const spillIdx = partitionIdx - 1;
      if (spillIdx < spilledProbePartitions.length) {
        spilledProbePartitions[spillIdx].push(probeRow);
      }
      ioOperations++;
    }
  }

  // Process spilled partitions (similar to Grace)
  for (let p = 0; p < spilledBuildPartitions.length; p++) {
    const buildPart = spilledBuildPartitions[p];
    const probePart = spilledProbePartitions[p];

    if (buildPart.length === 0 && probePart.length === 0) continue;

    ioOperations += buildPart.length + probePart.length;

    const hashTable = new Map<number, Row[]>();
    for (const row of buildPart) {
      const hash = hashValue(row[predicate.rightColumn]);
      if (!hashTable.has(hash)) {
        hashTable.set(hash, []);
      }
      hashTable.get(hash)!.push(row);
    }

    for (let i = 0; i < probePart.length; i++) {
      const probeRow = probePart[i];
      const hash = hashValue(probeRow[predicate.leftColumn]);
      const bucket = hashTable.get(hash) || [];
      let hasMatch = false;

      for (const buildRow of bucket) {
        comparisons++;
        if (probeRow[predicate.leftColumn] === buildRow[predicate.rightColumn]) {
          hasMatch = true;
          matchedProbeHybrid.add(`spill-${p}-${i}`);

          if (joinType === 'SEMI') {
            result.push(mergeRows(probeRow, null, probe.name, build.name));
            break;
          } else if (joinType !== 'ANTI') {
            result.push(mergeRows(probeRow, buildRow, probe.name, build.name));
          }
        }
      }

      if (!hasMatch && (joinType === 'LEFT' || joinType === 'FULL')) {
        result.push(mergeRows(probeRow, createNullRow(build.schema, build.name), probe.name, build.name));
      }
      if (!hasMatch && joinType === 'ANTI') {
        result.push(mergeRows(probeRow, null, probe.name, build.name));
      }
    }
  }

  const memoryUsed = inMemoryRows * avgRowSize;
  const cpuTime = Date.now() - startTime;

  explanation.push(`Total comparisons: ${comparisons}`);
  explanation.push(`Spilled I/O operations: ${ioOperations}`);

  return {
    rows: result,
    algorithm: 'Hybrid Hash Join',
    metrics: {
      comparisons,
      outputRows: result.length,
      memoryUsed,
      ioOperations,
      cpuTime,
      spilledToDisk: ioOperations > 0,
      passes: ioOperations > 0 ? 2 : 1,
      hashCollisions
    },
    explanation
  };
}

// ============================================================================
// CROSS JOIN
// ============================================================================

export function crossJoin(_left: Relation, _right: Relation): JoinResult {
  const left = _left;
  const right = _right;
  const startTime = Date.now();
  const result: Row[] = [];
  const explanation: string[] = [];

  explanation.push(`Cross Join: Cartesian product`);
  explanation.push(`Left: ${left.rows.length} rows, Right: ${right.rows.length} rows`);
  explanation.push(`Output: ${left.rows.length * right.rows.length} rows`);

  for (const leftRow of left.rows) {
    for (const rightRow of right.rows) {
      result.push(mergeRows(leftRow, rightRow, left.name, right.name));
    }
  }

  const memoryUsed = result.reduce((sum, row) => sum + estimateRowSize(row), 0);
  const cpuTime = Date.now() - startTime;

  return {
    rows: result,
    algorithm: 'Cross Join',
    metrics: {
      comparisons: 0,
      outputRows: result.length,
      memoryUsed,
      ioOperations: left.rows.length + right.rows.length,
      cpuTime,
      spilledToDisk: false,
      passes: 1
    },
    explanation
  };
}

// ============================================================================
// ALGORITHM COMPARISON
// ============================================================================

function compareAlgorithms(
  left: Relation,
  right: Relation,
  predicate: JoinPredicate,
  _joinType: JoinType,
  config: MemoryConfig = DEFAULT_MEMORY_CONFIG
): AlgorithmComparison[] {
  const comparisons: AlgorithmComparison[] = [];
  const leftSize = left.rows.length;
  const rightSize = right.rows.length;
  const avgRowSize = (estimateRowSize(left.rows[0] || {}) + estimateRowSize(right.rows[0] || {})) / 2;

  // Nested Loop
  const nlCost = leftSize * rightSize;
  comparisons.push({
    algorithm: 'Simple Nested Loop',
    estimatedCost: nlCost,
    metrics: { comparisons: nlCost, passes: 1 },
    recommended: leftSize * rightSize < 10000,
    reason: 'Good for small relations or when no indexes/memory available'
  });

  // Block Nested Loop
  const blockSize = Math.floor(config.availableMemory / avgRowSize);
  const blocks = Math.ceil(leftSize / blockSize);
  const bnlCost = leftSize + blocks * rightSize;
  comparisons.push({
    algorithm: 'Block Nested Loop',
    estimatedCost: bnlCost,
    metrics: { comparisons: leftSize * rightSize, passes: blocks },
    recommended: config.availableMemory < leftSize * avgRowSize,
    reason: 'Reduces I/O when memory is limited'
  });

  // Index Nested Loop
  const inlCost = leftSize * Math.log2(rightSize + 1);
  comparisons.push({
    algorithm: 'Index Nested Loop',
    estimatedCost: inlCost,
    metrics: { comparisons: Math.ceil(inlCost), probeOperations: leftSize },
    recommended: predicate.operator === '=' && rightSize > 100,
    reason: 'Efficient when index exists on inner relation'
  });

  // Sort-Merge
  const smCost = leftSize * Math.log2(leftSize + 1) + rightSize * Math.log2(rightSize + 1) + leftSize + rightSize;
  comparisons.push({
    algorithm: 'Sort-Merge',
    estimatedCost: smCost,
    metrics: { comparisons: leftSize + rightSize, sortOperations: Math.ceil(smCost) },
    recommended: predicate.operator === '=' && (leftSize > 1000 || rightSize > 1000),
    reason: 'Good for large sorted or nearly-sorted data'
  });

  // Classic Hash
  const hashCost = leftSize + rightSize;
  const hashMemory = Math.min(leftSize, rightSize) * avgRowSize;
  const fitsInMemory = hashMemory < config.availableMemory;
  comparisons.push({
    algorithm: 'Classic Hash',
    estimatedCost: hashCost,
    metrics: { comparisons: rightSize, buildOperations: leftSize, probeOperations: rightSize },
    recommended: fitsInMemory && predicate.operator === '=',
    reason: fitsInMemory ? 'Optimal for equi-joins when build fits in memory' : 'Build relation too large for memory'
  });

  // Grace Hash
  const graceCost = 3 * (leftSize + rightSize);  // Partition + Read + Join
  comparisons.push({
    algorithm: 'Grace Hash',
    estimatedCost: graceCost,
    metrics: { comparisons: rightSize, passes: 2 },
    recommended: !fitsInMemory && predicate.operator === '=',
    reason: 'Memory-efficient partitioned hash join'
  });

  // Sort by cost and mark recommendation
  comparisons.sort((a, b) => a.estimatedCost - b.estimatedCost);

  // Mark the best one as recommended
  if (predicate.operator === '=') {
    comparisons[0].recommended = true;
  }

  return comparisons;
}

// ============================================================================
// SAMPLE DATA GENERATION
// ============================================================================

function generateSampleRelation(name: string, size: number, schema: { column: string; type: string }[]): Relation {
  const rows: Row[] = [];

  for (let i = 0; i < size; i++) {
    const row: Row = {};
    for (const col of schema) {
      switch (col.type) {
        case 'int':
          row[col.column] = Math.floor(Math.random() * size * 2);
          break;
        case 'string':
          row[col.column] = `${col.column}_${i}`;
          break;
        case 'float':
          row[col.column] = Math.random() * 1000;
          break;
        default:
          row[col.column] = i;
      }
    }
    rows.push(row);
  }

  return { name, rows, schema };
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

let leftRelation: Relation | null = null;
let rightRelation: Relation | null = null;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const joinalgorithmsTool: UnifiedTool = {
  name: 'join_algorithms',
  description: 'Multiple join algorithm implementations with cost comparison and performance metrics',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['nested_loop_join', 'sort_merge_join', 'hash_join', 'index_join',
               'compare_algorithms', 'estimate_cost', 'optimize_join', 'analyze_predicate',
               'create_relation', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['simple_nested_loop', 'block_nested_loop', 'index_nested_loop',
               'sort_merge', 'classic_hash', 'grace_hash', 'hybrid_hash', 'cross'],
        description: 'Specific join algorithm to use'
      },
      joinType: {
        type: 'string',
        enum: ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'SEMI', 'ANTI'],
        description: 'Type of join'
      },
      leftColumn: {
        type: 'string',
        description: 'Join column from left relation'
      },
      rightColumn: {
        type: 'string',
        description: 'Join column from right relation'
      },
      leftSize: {
        type: 'number',
        description: 'Size of left relation'
      },
      rightSize: {
        type: 'number',
        description: 'Size of right relation'
      },
      memoryLimit: {
        type: 'number',
        description: 'Available memory in bytes'
      }
    },
    required: ['operation']
  }
};

export async function executejoinalgorithms(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'create_relation': {
        const name = args.name || 'relation';
        const size = args.size || 100;
        const isLeft = args.isLeft !== false;

        const schema = args.schema || [
          { column: 'id', type: 'int' },
          { column: 'value', type: 'string' },
          { column: 'amount', type: 'float' }
        ];

        const relation = generateSampleRelation(name, size, schema);

        if (isLeft) {
          leftRelation = relation;
        } else {
          rightRelation = relation;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create_relation',
            name,
            size,
            schema,
            sampleRows: relation.rows.slice(0, 3),
            position: isLeft ? 'left' : 'right'
          }, null, 2)
        };
      }

      case 'nested_loop_join': {
        const algorithm = args.algorithm || 'simple_nested_loop';
        const joinType = (args.joinType || 'INNER') as JoinType;
        const leftColumn = args.leftColumn || 'id';
        const rightColumn = args.rightColumn || 'id';

        // Ensure relations exist
        if (!leftRelation || !rightRelation) {
          leftRelation = generateSampleRelation('employees', args.leftSize || 50, [
            { column: 'id', type: 'int' },
            { column: 'name', type: 'string' },
            { column: 'dept_id', type: 'int' }
          ]);
          rightRelation = generateSampleRelation('departments', args.rightSize || 10, [
            { column: 'id', type: 'int' },
            { column: 'dept_name', type: 'string' }
          ]);
        }

        const predicate: JoinPredicate = {
          leftColumn,
          rightColumn,
          operator: '='
        };

        let result: JoinResult;
        switch (algorithm) {
          case 'block_nested_loop':
            result = blockNestedLoopJoin(leftRelation, rightRelation, predicate, joinType);
            break;
          case 'index_nested_loop':
            result = indexNestedLoopJoin(leftRelation, rightRelation, predicate, joinType);
            break;
          default:
            result = simpleNestedLoopJoin(leftRelation, rightRelation, predicate, joinType);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'nested_loop_join',
            algorithm: result.algorithm,
            joinType,
            predicate: `${leftColumn} = ${rightColumn}`,
            metrics: result.metrics,
            explanation: result.explanation,
            sampleOutput: result.rows.slice(0, 5),
            totalRows: result.rows.length
          }, null, 2)
        };
      }

      case 'sort_merge_join': {
        const joinType = (args.joinType || 'INNER') as JoinType;
        const leftColumn = args.leftColumn || 'id';
        const rightColumn = args.rightColumn || 'id';

        if (!leftRelation || !rightRelation) {
          leftRelation = generateSampleRelation('orders', args.leftSize || 100, [
            { column: 'id', type: 'int' },
            { column: 'customer_id', type: 'int' },
            { column: 'amount', type: 'float' }
          ]);
          rightRelation = generateSampleRelation('customers', args.rightSize || 30, [
            { column: 'id', type: 'int' },
            { column: 'name', type: 'string' }
          ]);
        }

        const predicate: JoinPredicate = {
          leftColumn,
          rightColumn,
          operator: '='
        };

        const result = sortMergeJoin(leftRelation, rightRelation, predicate, joinType);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'sort_merge_join',
            algorithm: result.algorithm,
            joinType,
            predicate: `${leftColumn} = ${rightColumn}`,
            metrics: result.metrics,
            explanation: result.explanation,
            sampleOutput: result.rows.slice(0, 5),
            totalRows: result.rows.length
          }, null, 2)
        };
      }

      case 'hash_join': {
        const algorithm = args.algorithm || 'classic_hash';
        const joinType = (args.joinType || 'INNER') as JoinType;
        const leftColumn = args.leftColumn || 'id';
        const rightColumn = args.rightColumn || 'id';
        const memoryLimit = args.memoryLimit || DEFAULT_MEMORY_CONFIG.availableMemory;

        if (!leftRelation || !rightRelation) {
          leftRelation = generateSampleRelation('transactions', args.leftSize || 200, [
            { column: 'id', type: 'int' },
            { column: 'account_id', type: 'int' },
            { column: 'amount', type: 'float' }
          ]);
          rightRelation = generateSampleRelation('accounts', args.rightSize || 50, [
            { column: 'id', type: 'int' },
            { column: 'holder', type: 'string' }
          ]);
        }

        const predicate: JoinPredicate = {
          leftColumn,
          rightColumn,
          operator: '='
        };

        const config = { ...DEFAULT_MEMORY_CONFIG, availableMemory: memoryLimit };

        // Determine build and probe (smaller on build side)
        const [build, probe] = leftRelation.rows.length <= rightRelation.rows.length
          ? [leftRelation, rightRelation]
          : [rightRelation, leftRelation];

        let result: JoinResult;
        switch (algorithm) {
          case 'grace_hash':
            result = graceHashJoin(build, probe, predicate, joinType, config);
            break;
          case 'hybrid_hash':
            result = hybridHashJoin(build, probe, predicate, joinType, config);
            break;
          default:
            result = classicHashJoin(build, probe, predicate, joinType);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'hash_join',
            algorithm: result.algorithm,
            joinType,
            predicate: `${leftColumn} = ${rightColumn}`,
            buildRelation: build.name,
            probeRelation: probe.name,
            metrics: result.metrics,
            explanation: result.explanation,
            sampleOutput: result.rows.slice(0, 5),
            totalRows: result.rows.length
          }, null, 2)
        };
      }

      case 'index_join': {
        const joinType = (args.joinType || 'INNER') as JoinType;
        const leftColumn = args.leftColumn || 'id';
        const rightColumn = args.rightColumn || 'id';

        if (!leftRelation || !rightRelation) {
          leftRelation = generateSampleRelation('products', args.leftSize || 100, [
            { column: 'id', type: 'int' },
            { column: 'category_id', type: 'int' },
            { column: 'price', type: 'float' }
          ]);
          rightRelation = generateSampleRelation('categories', args.rightSize || 20, [
            { column: 'id', type: 'int' },
            { column: 'name', type: 'string' }
          ]);
        }

        const predicate: JoinPredicate = {
          leftColumn,
          rightColumn,
          operator: '='
        };

        const result = indexNestedLoopJoin(leftRelation, rightRelation, predicate, joinType);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'index_join',
            algorithm: result.algorithm,
            joinType,
            predicate: `${leftColumn} = ${rightColumn}`,
            metrics: result.metrics,
            explanation: result.explanation,
            sampleOutput: result.rows.slice(0, 5),
            totalRows: result.rows.length
          }, null, 2)
        };
      }

      case 'compare_algorithms': {
        const leftSize = args.leftSize || 1000;
        const rightSize = args.rightSize || 200;
        const memoryLimit = args.memoryLimit || DEFAULT_MEMORY_CONFIG.availableMemory;

        const left = generateSampleRelation('left', leftSize, [
          { column: 'id', type: 'int' },
          { column: 'value', type: 'string' }
        ]);
        const right = generateSampleRelation('right', rightSize, [
          { column: 'id', type: 'int' },
          { column: 'data', type: 'string' }
        ]);

        const predicate: JoinPredicate = {
          leftColumn: 'id',
          rightColumn: 'id',
          operator: '='
        };

        const config = { ...DEFAULT_MEMORY_CONFIG, availableMemory: memoryLimit };
        const comparisons = compareAlgorithms(left, right, predicate, 'INNER', config);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare_algorithms',
            inputSizes: { left: leftSize, right: rightSize },
            memoryLimit,
            algorithms: comparisons,
            recommendation: comparisons.find(c => c.recommended)?.algorithm || comparisons[0].algorithm,
            analysis: {
              smallJoinThreshold: 10000,
              hashJoinMemoryRequired: Math.min(leftSize, rightSize) * 100,
              sortMergeEfficiency: 'O(n log n + m log m)',
              nestedLoopComplexity: 'O(n * m)'
            }
          }, null, 2)
        };
      }

      case 'estimate_cost': {
        const algorithm = args.algorithm || 'classic_hash';
        const leftSize = args.leftSize || 1000;
        const rightSize = args.rightSize || 200;

        let cost: number;
        let explanation: string;

        switch (algorithm) {
          case 'simple_nested_loop':
            cost = leftSize * rightSize;
            explanation = `O(n*m) = ${leftSize} * ${rightSize} = ${cost} comparisons`;
            break;
          case 'block_nested_loop':
            const blockSize = 1000;
            const blocks = Math.ceil(leftSize / blockSize);
            cost = leftSize + blocks * rightSize;
            explanation = `O(n + ceil(n/B)*m) = ${leftSize} + ${blocks}*${rightSize} = ${cost} I/O`;
            break;
          case 'index_nested_loop':
            cost = leftSize * Math.ceil(Math.log2(rightSize + 1));
            explanation = `O(n * log(m)) = ${leftSize} * ${Math.ceil(Math.log2(rightSize + 1))} = ${cost} lookups`;
            break;
          case 'sort_merge':
            const sortCost = leftSize * Math.ceil(Math.log2(leftSize + 1)) + rightSize * Math.ceil(Math.log2(rightSize + 1));
            cost = sortCost + leftSize + rightSize;
            explanation = `O(n log n + m log m + n + m) = ${cost}`;
            break;
          case 'classic_hash':
          case 'grace_hash':
          case 'hybrid_hash':
            cost = leftSize + rightSize;
            explanation = `O(n + m) = ${leftSize} + ${rightSize} = ${cost} (optimal)`;
            break;
          default:
            cost = leftSize * rightSize;
            explanation = 'Unknown algorithm';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'estimate_cost',
            algorithm,
            inputSizes: { left: leftSize, right: rightSize },
            estimatedCost: cost,
            explanation,
            comparisons: {
              nestedLoop: leftSize * rightSize,
              indexNested: leftSize * Math.ceil(Math.log2(rightSize + 1)),
              sortMerge: leftSize * Math.ceil(Math.log2(leftSize + 1)) + rightSize * Math.ceil(Math.log2(rightSize + 1)) + leftSize + rightSize,
              hash: leftSize + rightSize
            }
          }, null, 2)
        };
      }

      case 'optimize_join': {
        const leftSize = args.leftSize || 10000;
        const rightSize = args.rightSize || 500;
        const memoryLimit = args.memoryLimit || 64 * 1024 * 1024;
        const joinType = args.joinType || 'INNER';
        const predicateOperator = args.predicateOperator || '=';

        const avgRowSize = 100;
        const buildSize = Math.min(leftSize, rightSize);
        const hashTableMemory = buildSize * avgRowSize * 1.5;
        const fitsInMemory = hashTableMemory < memoryLimit;

        let recommendation: string;
        let reason: string;

        if (predicateOperator !== '=') {
          recommendation = 'Sort-Merge Join or Nested Loop';
          reason = 'Non-equi join predicates cannot use hash join efficiently';
        } else if (leftSize * rightSize < 10000) {
          recommendation = 'Simple Nested Loop Join';
          reason = 'Small input sizes make simple algorithm efficient';
        } else if (fitsInMemory) {
          recommendation = 'Classic Hash Join';
          reason = `Build relation (${buildSize} rows) fits in memory (${(hashTableMemory / 1024 / 1024).toFixed(1)}MB < ${(memoryLimit / 1024 / 1024).toFixed(1)}MB)`;
        } else if (hashTableMemory < memoryLimit * 3) {
          recommendation = 'Hybrid Hash Join';
          reason = 'Partial memory fit allows keeping some partitions in memory';
        } else {
          recommendation = 'Grace Hash Join';
          reason = 'Large relations require disk-based partitioning';
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'optimize_join',
            input: {
              leftSize,
              rightSize,
              memoryLimit: `${(memoryLimit / 1024 / 1024).toFixed(1)}MB`,
              joinType,
              predicateOperator
            },
            analysis: {
              buildRelationSize: buildSize,
              estimatedHashTableMemory: `${(hashTableMemory / 1024 / 1024).toFixed(1)}MB`,
              fitsInMemory
            },
            recommendation,
            reason,
            alternativeOptions: [
              { algorithm: 'Sort-Merge', suitable: predicateOperator === '=', reason: 'Good for sorted data or when memory is very limited' },
              { algorithm: 'Index Nested Loop', suitable: rightSize < 1000, reason: 'Efficient with index on inner relation' }
            ]
          }, null, 2)
        };
      }

      case 'analyze_predicate': {
        const predicate = args.predicate || 'a.id = b.id';

        // Parse predicate
        const parts = predicate.split(/\s*(=|<>|!=|<=|>=|<|>)\s*/);
        const leftExpr = parts[0]?.trim();
        const operator = parts[1]?.trim();
        const rightExpr = parts[2]?.trim();

        const isEquiJoin = operator === '=';
        const isRangeJoin = ['<', '>', '<=', '>='].includes(operator);
        const isNonEquiJoin = ['<>', '!='].includes(operator);

        const supportedAlgorithms = [];
        if (isEquiJoin) {
          supportedAlgorithms.push(
            { algorithm: 'Hash Join', efficiency: 'O(n+m)', recommended: true },
            { algorithm: 'Sort-Merge Join', efficiency: 'O(n log n + m log m)', recommended: true },
            { algorithm: 'Nested Loop', efficiency: 'O(n*m)', recommended: false }
          );
        } else if (isRangeJoin) {
          supportedAlgorithms.push(
            { algorithm: 'Sort-Merge Join (Band Join)', efficiency: 'O(n log n + m log m + output)', recommended: true },
            { algorithm: 'Nested Loop', efficiency: 'O(n*m)', recommended: false }
          );
        } else {
          supportedAlgorithms.push(
            { algorithm: 'Nested Loop', efficiency: 'O(n*m)', recommended: true }
          );
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_predicate',
            predicate,
            parsed: {
              leftExpression: leftExpr,
              operator,
              rightExpression: rightExpr
            },
            classification: {
              isEquiJoin,
              isRangeJoin,
              isNonEquiJoin,
              type: isEquiJoin ? 'Equi-Join' : isRangeJoin ? 'Range Join' : 'Theta Join'
            },
            supportedAlgorithms,
            indexRecommendation: isEquiJoin
              ? 'Hash index on join columns recommended'
              : 'B-tree index on join columns recommended for range predicates'
          }, null, 2)
        };
      }

      case 'demo': {
        // Create sample relations
        const employees = generateSampleRelation('employees', 20, [
          { column: 'id', type: 'int' },
          { column: 'name', type: 'string' },
          { column: 'dept_id', type: 'int' }
        ]);

        const departments = generateSampleRelation('departments', 5, [
          { column: 'id', type: 'int' },
          { column: 'dept_name', type: 'string' }
        ]);

        // Fix dept_id to be within department range
        for (const emp of employees.rows) {
          emp.dept_id = Math.floor(Math.random() * 5);
        }
        for (let i = 0; i < departments.rows.length; i++) {
          departments.rows[i].id = i;
          departments.rows[i].dept_name = `Department_${i}`;
        }

        const predicate: JoinPredicate = {
          leftColumn: 'dept_id',
          rightColumn: 'id',
          operator: '='
        };

        // Run all algorithms
        const results = {
          nestedLoop: simpleNestedLoopJoin(employees, departments, predicate, 'INNER'),
          sortMerge: sortMergeJoin(employees, departments, predicate, 'INNER'),
          hashJoin: classicHashJoin(departments, employees, predicate, 'INNER')
        };

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Comparing join algorithms on employees-departments join',
            relations: {
              employees: { size: employees.rows.length, sample: employees.rows.slice(0, 3) },
              departments: { size: departments.rows.length, sample: departments.rows }
            },
            predicate: 'employees.dept_id = departments.id',
            results: {
              nestedLoop: {
                algorithm: results.nestedLoop.algorithm,
                outputRows: results.nestedLoop.metrics.outputRows,
                comparisons: results.nestedLoop.metrics.comparisons,
                cpuTime: results.nestedLoop.metrics.cpuTime
              },
              sortMerge: {
                algorithm: results.sortMerge.algorithm,
                outputRows: results.sortMerge.metrics.outputRows,
                comparisons: results.sortMerge.metrics.comparisons,
                sortOperations: results.sortMerge.metrics.sortOperations,
                cpuTime: results.sortMerge.metrics.cpuTime
              },
              hashJoin: {
                algorithm: results.hashJoin.algorithm,
                outputRows: results.hashJoin.metrics.outputRows,
                comparisons: results.hashJoin.metrics.comparisons,
                hashCollisions: results.hashJoin.metrics.hashCollisions,
                cpuTime: results.hashJoin.metrics.cpuTime
              }
            },
            sampleJoinedRows: results.hashJoin.rows.slice(0, 5)
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Join Algorithms',
            description: 'Comprehensive join algorithm implementations with performance analysis',
            algorithms: {
              nestedLoop: {
                simple: 'O(n*m) - Basic nested loop',
                block: 'O(n*m) with reduced I/O - Uses memory blocks',
                index: 'O(n*log(m)) - Uses index on inner relation'
              },
              sortMerge: 'O(n log n + m log m + n + m) - Sort both, then merge',
              hash: {
                classic: 'O(n + m) - Build hash table, probe',
                grace: 'O(3*(n+m)) - Partitioned for large data',
                hybrid: 'O(n + m) to O(3*(n+m)) - Adaptive approach'
              }
            },
            joinTypes: ['INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'SEMI', 'ANTI'],
            operations: [
              'nested_loop_join - Execute nested loop variants',
              'sort_merge_join - Execute sort-merge join',
              'hash_join - Execute hash join variants',
              'index_join - Execute index nested loop join',
              'compare_algorithms - Compare all algorithms',
              'estimate_cost - Estimate join cost',
              'optimize_join - Get optimization recommendation',
              'analyze_predicate - Analyze join predicate'
            ],
            metrics: [
              'comparisons - Number of tuple comparisons',
              'outputRows - Number of result rows',
              'memoryUsed - Memory consumption',
              'ioOperations - I/O operations count',
              'cpuTime - Execution time',
              'spilledToDisk - Whether external storage was used'
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
                name: 'Simple nested loop join',
                call: {
                  operation: 'nested_loop_join',
                  algorithm: 'simple_nested_loop',
                  joinType: 'INNER',
                  leftColumn: 'dept_id',
                  rightColumn: 'id'
                }
              },
              {
                name: 'Hash join with custom sizes',
                call: {
                  operation: 'hash_join',
                  algorithm: 'classic_hash',
                  joinType: 'LEFT',
                  leftSize: 500,
                  rightSize: 100
                }
              },
              {
                name: 'Compare all algorithms',
                call: {
                  operation: 'compare_algorithms',
                  leftSize: 5000,
                  rightSize: 1000,
                  memoryLimit: 16777216
                }
              },
              {
                name: 'Get join optimization',
                call: {
                  operation: 'optimize_join',
                  leftSize: 100000,
                  rightSize: 5000,
                  memoryLimit: 67108864,
                  joinType: 'INNER'
                }
              },
              {
                name: 'Analyze predicate',
                call: {
                  operation: 'analyze_predicate',
                  predicate: 'orders.customer_id = customers.id'
                }
              },
              {
                name: 'Demo all algorithms',
                call: { operation: 'demo' }
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

export function isjoinalgorithmsAvailable(): boolean { return true; }
