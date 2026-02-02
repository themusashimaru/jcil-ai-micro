/**
 * CACHE-SIMULATOR TOOL
 * CPU cache hierarchy simulation with multiple replacement policies
 *
 * Simulates L1, L2, L3 caches and TLB with configurable parameters,
 * tracks hit/miss statistics, and visualizes cache behavior.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

type ReplacementPolicy = 'LRU' | 'FIFO' | 'Random' | 'LFU' | 'PLRU';
type WritePolicy = 'write_back' | 'write_through';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type CacheLevel = 'L1' | 'L2' | 'L3';

interface CacheConfig {
  size: number;           // Total cache size in bytes
  lineSize: number;       // Cache line size in bytes
  associativity: number;  // Number of ways (1 = direct mapped)
  policy: ReplacementPolicy;
  writePolicy: WritePolicy;
  hitLatency: number;     // Cycles for cache hit
  missLatency: number;    // Cycles for cache miss
}

interface CacheLine {
  valid: boolean;
  dirty: boolean;
  tag: number;
  data: Uint8Array;
  lastAccess: number;  // For LRU
  insertOrder: number; // For FIFO
  frequency: number;   // For LFU
  plruBit?: boolean;   // For PLRU
}

interface CacheSet {
  lines: CacheLine[];
  plruTree?: boolean[]; // For tree-based PLRU
}

interface CacheState {
  config: CacheConfig;
  sets: CacheSet[];
  numSets: number;
  indexBits: number;
  offsetBits: number;
  tagBits: number;
  accessCount: number;
  hits: number;
  misses: number;
  readHits: number;
  readMisses: number;
  writeHits: number;
  writeMisses: number;
  evictions: number;
  writebacks: number;
  totalLatency: number;
}

interface AccessResult {
  hit: boolean;
  address: number;
  tag: number;
  setIndex: number;
  offset: number;
  evicted: boolean;
  evictedTag?: number;
  writeback: boolean;
  latency: number;
}

interface CacheHierarchy {
  L1: CacheState;
  L2?: CacheState;
  L3?: CacheState;
}

interface HierarchyStats {
  totalAccesses: number;
  L1HitRate: number;
  L2HitRate?: number;
  L3HitRate?: number;
  averageLatency: number;
  totalLatency: number;
  cpi: number; // Cycles per instruction (assuming 1 mem access per instruction)
}

interface TLBEntry {
  valid: boolean;
  virtualPage: number;
  physicalFrame: number;
  lastAccess: number;
  accessRights: 'RWX' | 'RW' | 'RX' | 'R';
}

interface TLBState {
  entries: TLBEntry[];
  size: number;
  pageSize: number;
  hits: number;
  misses: number;
}

// ============================================================================
// CACHE IMPLEMENTATION
// ============================================================================

function createCache(config: CacheConfig): CacheState {
  const numLines = Math.floor(config.size / config.lineSize);
  const numSets = Math.floor(numLines / config.associativity);

  const indexBits = Math.log2(numSets);
  const offsetBits = Math.log2(config.lineSize);
  const tagBits = 32 - indexBits - offsetBits;

  const sets: CacheSet[] = [];

  for (let i = 0; i < numSets; i++) {
    const lines: CacheLine[] = [];
    for (let j = 0; j < config.associativity; j++) {
      lines.push({
        valid: false,
        dirty: false,
        tag: 0,
        data: new Uint8Array(config.lineSize),
        lastAccess: 0,
        insertOrder: 0,
        frequency: 0
      });
    }

    // For PLRU tree (needs 2^(ways-1) - 1 bits for power-of-2 ways)
    const plruTree = config.policy === 'PLRU'
      ? new Array(config.associativity - 1).fill(false)
      : undefined;

    sets.push({ lines, plruTree });
  }

  return {
    config,
    sets,
    numSets,
    indexBits,
    offsetBits,
    tagBits,
    accessCount: 0,
    hits: 0,
    misses: 0,
    readHits: 0,
    readMisses: 0,
    writeHits: 0,
    writeMisses: 0,
    evictions: 0,
    writebacks: 0,
    totalLatency: 0
  };
}

function getAddressParts(cache: CacheState, address: number): { tag: number; setIndex: number; offset: number } {
  const offset = address & ((1 << cache.offsetBits) - 1);
  const setIndex = (address >> cache.offsetBits) & ((1 << cache.indexBits) - 1);
  const tag = address >> (cache.offsetBits + cache.indexBits);

  return { tag, setIndex, offset };
}

function findLine(cache: CacheState, setIndex: number, tag: number): CacheLine | null {
  const set = cache.sets[setIndex];
  for (const line of set.lines) {
    if (line.valid && line.tag === tag) {
      return line;
    }
  }
  return null;
}

function selectVictim(cache: CacheState, setIndex: number): number {
  const set = cache.sets[setIndex];
  const { policy, associativity } = cache.config;

  // First, check for invalid lines
  for (let i = 0; i < associativity; i++) {
    if (!set.lines[i].valid) {
      return i;
    }
  }

  // All lines valid, apply replacement policy
  switch (policy) {
    case 'LRU': {
      let lruIndex = 0;
      let lruTime = Infinity;
      for (let i = 0; i < associativity; i++) {
        if (set.lines[i].lastAccess < lruTime) {
          lruTime = set.lines[i].lastAccess;
          lruIndex = i;
        }
      }
      return lruIndex;
    }

    case 'FIFO': {
      let fifoIndex = 0;
      let fifoOrder = Infinity;
      for (let i = 0; i < associativity; i++) {
        if (set.lines[i].insertOrder < fifoOrder) {
          fifoOrder = set.lines[i].insertOrder;
          fifoIndex = i;
        }
      }
      return fifoIndex;
    }

    case 'Random':
      return Math.floor(Math.random() * associativity);

    case 'LFU': {
      let lfuIndex = 0;
      let lfuFreq = Infinity;
      for (let i = 0; i < associativity; i++) {
        if (set.lines[i].frequency < lfuFreq) {
          lfuFreq = set.lines[i].frequency;
          lfuIndex = i;
        }
      }
      return lfuIndex;
    }

    case 'PLRU': {
      // Tree-based pseudo-LRU for power-of-2 ways
      if (!set.plruTree) return 0;

      let index = 0;
      for (let level = 0; level < Math.log2(associativity); level++) {
        const treeIndex = (1 << level) - 1 + (index >> (Math.log2(associativity) - level - 1));
        if (treeIndex < set.plruTree.length) {
          if (!set.plruTree[treeIndex]) {
            index = index * 2;
          } else {
            index = index * 2 + 1;
          }
        }
      }
      return Math.min(index, associativity - 1);
    }

    default:
      return 0;
  }
}

function updatePLRU(cache: CacheState, setIndex: number, wayIndex: number): void {
  const set = cache.sets[setIndex];
  if (!set.plruTree) return;

  // Update tree bits to point away from accessed way
  let index = wayIndex;
  for (let level = Math.log2(cache.config.associativity) - 1; level >= 0; level--) {
    const treeIndex = (1 << level) - 1 + (index >> 1);
    if (treeIndex < set.plruTree.length) {
      set.plruTree[treeIndex] = (index & 1) === 0;
    }
    index = index >> 1;
  }
}

function accessCache(cache: CacheState, address: number, isWrite: boolean): AccessResult {
  cache.accessCount++;

  const { tag, setIndex, offset } = getAddressParts(cache, address);
  const line = findLine(cache, setIndex, tag);

  if (line) {
    // Cache hit
    cache.hits++;
    if (isWrite) {
      cache.writeHits++;
      line.dirty = cache.config.writePolicy === 'write_back';
    } else {
      cache.readHits++;
    }

    line.lastAccess = cache.accessCount;
    line.frequency++;

    // Update PLRU if applicable
    const wayIndex = cache.sets[setIndex].lines.indexOf(line);
    updatePLRU(cache, setIndex, wayIndex);

    cache.totalLatency += cache.config.hitLatency;

    return {
      hit: true,
      address,
      tag,
      setIndex,
      offset,
      evicted: false,
      writeback: false,
      latency: cache.config.hitLatency
    };
  }

  // Cache miss
  cache.misses++;
  if (isWrite) {
    cache.writeMisses++;
  } else {
    cache.readMisses++;
  }

  // Select victim line
  const victimIndex = selectVictim(cache, setIndex);
  const victimLine = cache.sets[setIndex].lines[victimIndex];

  let evicted = false;
  let evictedTag: number | undefined;
  let writeback = false;

  if (victimLine.valid) {
    evicted = true;
    evictedTag = victimLine.tag;
    cache.evictions++;

    if (victimLine.dirty) {
      writeback = true;
      cache.writebacks++;
    }
  }

  // Load new line
  victimLine.valid = true;
  victimLine.tag = tag;
  victimLine.dirty = isWrite && cache.config.writePolicy === 'write_back';
  victimLine.lastAccess = cache.accessCount;
  victimLine.insertOrder = cache.accessCount;
  victimLine.frequency = 1;

  updatePLRU(cache, setIndex, victimIndex);

  const latency = cache.config.missLatency + (writeback ? cache.config.missLatency : 0);
  cache.totalLatency += latency;

  return {
    hit: false,
    address,
    tag,
    setIndex,
    offset,
    evicted,
    evictedTag,
    writeback,
    latency
  };
}

function flushCache(cache: CacheState): { writebacks: number; linesCleared: number } {
  let writebacks = 0;
  let linesCleared = 0;

  for (const set of cache.sets) {
    for (const line of set.lines) {
      if (line.valid) {
        if (line.dirty) {
          writebacks++;
        }
        line.valid = false;
        line.dirty = false;
        linesCleared++;
      }
    }
  }

  return { writebacks, linesCleared };
}

function getCacheStats(cache: CacheState): Record<string, unknown> {
  const hitRate = cache.accessCount > 0 ? cache.hits / cache.accessCount : 0;
  const missRate = cache.accessCount > 0 ? cache.misses / cache.accessCount : 0;
  const avgLatency = cache.accessCount > 0 ? cache.totalLatency / cache.accessCount : 0;

  let validLines = 0;
  let dirtyLines = 0;
  for (const set of cache.sets) {
    for (const line of set.lines) {
      if (line.valid) validLines++;
      if (line.dirty) dirtyLines++;
    }
  }

  return {
    config: {
      size: `${cache.config.size} bytes`,
      lineSize: `${cache.config.lineSize} bytes`,
      associativity: cache.config.associativity === 1
        ? 'Direct mapped'
        : `${cache.config.associativity}-way set associative`,
      sets: cache.numSets,
      policy: cache.config.policy,
      writePolicy: cache.config.writePolicy
    },
    statistics: {
      totalAccesses: cache.accessCount,
      hits: cache.hits,
      misses: cache.misses,
      hitRate: (hitRate * 100).toFixed(2) + '%',
      missRate: (missRate * 100).toFixed(2) + '%',
      readHits: cache.readHits,
      readMisses: cache.readMisses,
      writeHits: cache.writeHits,
      writeMisses: cache.writeMisses,
      evictions: cache.evictions,
      writebacks: cache.writebacks,
      averageLatency: avgLatency.toFixed(2) + ' cycles'
    },
    state: {
      validLines,
      dirtyLines,
      utilization: ((validLines / (cache.numSets * cache.config.associativity)) * 100).toFixed(2) + '%'
    }
  };
}

// ============================================================================
// CACHE HIERARCHY
// ============================================================================

function createCacheHierarchy(withL2: boolean = true, withL3: boolean = true): CacheHierarchy {
  const hierarchy: CacheHierarchy = {
    L1: createCache({
      size: 32 * 1024,      // 32 KB
      lineSize: 64,
      associativity: 8,
      policy: 'LRU',
      writePolicy: 'write_back',
      hitLatency: 1,
      missLatency: 10
    })
  };

  if (withL2) {
    hierarchy.L2 = createCache({
      size: 256 * 1024,     // 256 KB
      lineSize: 64,
      associativity: 8,
      policy: 'LRU',
      writePolicy: 'write_back',
      hitLatency: 10,
      missLatency: 50
    });
  }

  if (withL3) {
    hierarchy.L3 = createCache({
      size: 8 * 1024 * 1024, // 8 MB
      lineSize: 64,
      associativity: 16,
      policy: 'PLRU',
      writePolicy: 'write_back',
      hitLatency: 50,
      missLatency: 200
    });
  }

  return hierarchy;
}

function accessHierarchy(hierarchy: CacheHierarchy, address: number, isWrite: boolean): {
  level: string;
  latency: number;
  results: Record<string, AccessResult>;
} {
  const results: Record<string, AccessResult> = {};

  // Try L1
  const l1Result = accessCache(hierarchy.L1, address, isWrite);
  results.L1 = l1Result;

  if (l1Result.hit) {
    return { level: 'L1', latency: l1Result.latency, results };
  }

  // L1 miss, try L2
  if (hierarchy.L2) {
    const l2Result = accessCache(hierarchy.L2, address, isWrite);
    results.L2 = l2Result;

    if (l2Result.hit) {
      // Fill L1 from L2
      accessCache(hierarchy.L1, address, false);
      return { level: 'L2', latency: l1Result.latency + l2Result.latency, results };
    }

    // L2 miss, try L3
    if (hierarchy.L3) {
      const l3Result = accessCache(hierarchy.L3, address, isWrite);
      results.L3 = l3Result;

      // Fill L1 and L2 from L3 or memory
      accessCache(hierarchy.L2, address, false);
      accessCache(hierarchy.L1, address, false);

      return {
        level: l3Result.hit ? 'L3' : 'Memory',
        latency: l1Result.latency + l2Result.latency + l3Result.latency,
        results
      };
    }

    // No L3, load from memory
    accessCache(hierarchy.L1, address, false);
    return { level: 'Memory', latency: l1Result.latency + l2Result.latency, results };
  }

  // No L2, load from memory
  return { level: 'Memory', latency: l1Result.latency, results };
}

function getHierarchyStats(hierarchy: CacheHierarchy): HierarchyStats {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _l1Stats = getCacheStats(hierarchy.L1);
  const totalAccesses = hierarchy.L1.accessCount;

  let totalLatency = hierarchy.L1.totalLatency;
  if (hierarchy.L2) totalLatency += hierarchy.L2.totalLatency;
  if (hierarchy.L3) totalLatency += hierarchy.L3.totalLatency;

  const stats: HierarchyStats = {
    totalAccesses,
    L1HitRate: hierarchy.L1.accessCount > 0 ? hierarchy.L1.hits / hierarchy.L1.accessCount : 0,
    averageLatency: totalAccesses > 0 ? totalLatency / totalAccesses : 0,
    totalLatency,
    cpi: totalAccesses > 0 ? 1 + (totalLatency / totalAccesses) : 1
  };

  if (hierarchy.L2) {
    stats.L2HitRate = hierarchy.L2.accessCount > 0 ? hierarchy.L2.hits / hierarchy.L2.accessCount : 0;
  }

  if (hierarchy.L3) {
    stats.L3HitRate = hierarchy.L3.accessCount > 0 ? hierarchy.L3.hits / hierarchy.L3.accessCount : 0;
  }

  return stats;
}

// ============================================================================
// TLB IMPLEMENTATION
// ============================================================================

function createTLB(size: number = 64, pageSize: number = 4096): TLBState {
  const entries: TLBEntry[] = [];
  for (let i = 0; i < size; i++) {
    entries.push({
      valid: false,
      virtualPage: 0,
      physicalFrame: 0,
      lastAccess: 0,
      accessRights: 'RWX'
    });
  }

  return {
    entries,
    size,
    pageSize,
    hits: 0,
    misses: 0
  };
}

function lookupTLB(tlb: TLBState, virtualAddress: number, accessCount: number): {
  hit: boolean;
  physicalAddress?: number;
  entry?: TLBEntry;
} {
  const virtualPage = Math.floor(virtualAddress / tlb.pageSize);
  const offset = virtualAddress % tlb.pageSize;

  for (const entry of tlb.entries) {
    if (entry.valid && entry.virtualPage === virtualPage) {
      tlb.hits++;
      entry.lastAccess = accessCount;
      const physicalAddress = entry.physicalFrame * tlb.pageSize + offset;
      return { hit: true, physicalAddress, entry };
    }
  }

  tlb.misses++;
  return { hit: false };
}

function insertTLB(tlb: TLBState, virtualPage: number, physicalFrame: number, accessCount: number): {
  evicted: boolean;
  evictedPage?: number;
} {
  // Find invalid or LRU entry
  let victim = 0;
  let lruTime = Infinity;

  for (let i = 0; i < tlb.entries.length; i++) {
    if (!tlb.entries[i].valid) {
      victim = i;
      break;
    }
    if (tlb.entries[i].lastAccess < lruTime) {
      lruTime = tlb.entries[i].lastAccess;
      victim = i;
    }
  }

  const evicted = tlb.entries[victim].valid;
  const evictedPage = evicted ? tlb.entries[victim].virtualPage : undefined;

  tlb.entries[victim] = {
    valid: true,
    virtualPage,
    physicalFrame,
    lastAccess: accessCount,
    accessRights: 'RWX'
  };

  return { evicted, evictedPage };
}

// ============================================================================
// ACCESS PATTERN GENERATORS
// ============================================================================

function generateAccessPattern(pattern: string, count: number, config: {
  baseAddr?: number;
  stride?: number;
  arraySize?: number;
}): number[] {
  const addresses: number[] = [];
  const baseAddr = config.baseAddr || 0x1000;
  const stride = config.stride || 64;
  const arraySize = config.arraySize || 1024;

  switch (pattern) {
    case 'sequential':
      for (let i = 0; i < count; i++) {
        addresses.push(baseAddr + (i * 4));
      }
      break;

    case 'strided':
      for (let i = 0; i < count; i++) {
        addresses.push(baseAddr + (i * stride));
      }
      break;

    case 'random':
      for (let i = 0; i < count; i++) {
        addresses.push(baseAddr + Math.floor(Math.random() * arraySize) * 4);
      }
      break;

    case 'temporal': {
      // Access same locations repeatedly (good temporal locality)
      const hotSet = Array.from({ length: 10 }, (_, i) => baseAddr + i * 64);
      for (let i = 0; i < count; i++) {
        addresses.push(hotSet[i % hotSet.length]);
      }
      break;
    }

    case 'thrashing': {
      // Access pattern that causes cache thrashing
      // Access N+1 elements where cache has N lines
      const numElements = 1025; // Just over typical L1 cache size / line size
      for (let i = 0; i < count; i++) {
        addresses.push(baseAddr + (i % numElements) * 64);
      }
      break;
    }

    case 'matrix_row': {
      // Row-major matrix traversal (good for cache)
      const cols = Math.sqrt(arraySize);
      for (let i = 0; i < count && i < arraySize; i++) {
        addresses.push(baseAddr + i * 4);
      }
      break;
    }

    case 'matrix_col': {
      // Column-major traversal (poor cache performance)
      const rows = Math.floor(Math.sqrt(arraySize));
      const cols = rows;
      for (let i = 0; i < count && i < arraySize; i++) {
        const row = i % rows;
        const col = Math.floor(i / rows);
        addresses.push(baseAddr + (row * cols + col) * 4);
      }
      break;
    }

    default:
      // Default to sequential
      for (let i = 0; i < count; i++) {
        addresses.push(baseAddr + (i * 4));
      }
  }

  return addresses;
}

// ============================================================================
// TOOL DEFINITION AND EXECUTOR
// ============================================================================

export const cachesimulatorTool: UnifiedTool = {
  name: 'cache_simulator',
  description: 'Simulate cache hierarchies - L1, L2, L3, TLB with multiple replacement policies',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['access', 'stats', 'configure', 'flush', 'simulate', 'pattern', 'hierarchy', 'tlb', 'info'],
        description: 'Operation to perform'
      },
      policy: {
        type: 'string',
        enum: ['LRU', 'FIFO', 'Random', 'LFU', 'PLRU'],
        description: 'Cache replacement policy'
      },
      address: {
        type: 'number',
        description: 'Memory address to access'
      },
      addresses: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of addresses to access'
      },
      is_write: {
        type: 'boolean',
        description: 'Whether access is a write'
      },
      cache_config: {
        type: 'object',
        properties: {
          size: { type: 'number' },
          lineSize: { type: 'number' },
          associativity: { type: 'number' }
        }
      },
      pattern: {
        type: 'string',
        enum: ['sequential', 'strided', 'random', 'temporal', 'thrashing', 'matrix_row', 'matrix_col'],
        description: 'Access pattern to simulate'
      },
      count: {
        type: 'number',
        description: 'Number of accesses to simulate'
      }
    },
    required: ['operation']
  }
};

// Global state for persistent simulation
let globalCache: CacheState | null = null;
let globalHierarchy: CacheHierarchy | null = null;
let globalTLB: TLBState | null = null;

export async function executecachesimulator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    switch (operation) {
      case 'configure': {
        const config: CacheConfig = {
          size: args.cache_config?.size || 32 * 1024,
          lineSize: args.cache_config?.lineSize || 64,
          associativity: args.cache_config?.associativity || 8,
          policy: args.policy || 'LRU',
          writePolicy: args.write_policy || 'write_back',
          hitLatency: args.cache_config?.hitLatency || 1,
          missLatency: args.cache_config?.missLatency || 10
        };

        globalCache = createCache(config);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure',
            message: 'Cache configured successfully',
            config: {
              size: `${config.size / 1024} KB`,
              lineSize: `${config.lineSize} bytes`,
              associativity: config.associativity === 1 ? 'Direct mapped' : `${config.associativity}-way`,
              sets: globalCache.numSets,
              policy: config.policy,
              writePolicy: config.writePolicy,
              addressBits: {
                tag: globalCache.tagBits,
                index: globalCache.indexBits,
                offset: globalCache.offsetBits
              }
            }
          }, null, 2)
        };
      }

      case 'access': {
        if (!globalCache) {
          globalCache = createCache({
            size: 32 * 1024,
            lineSize: 64,
            associativity: 8,
            policy: args.policy || 'LRU',
            writePolicy: 'write_back',
            hitLatency: 1,
            missLatency: 10
          });
        }

        const address = args.address || 0x1000;
        const isWrite = args.is_write || false;
        const result = accessCache(globalCache, address, isWrite);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'access',
            address: `0x${address.toString(16)}`,
            type: isWrite ? 'write' : 'read',
            result: {
              hit: result.hit,
              tag: `0x${result.tag.toString(16)}`,
              setIndex: result.setIndex,
              offset: result.offset,
              evicted: result.evicted,
              evictedTag: result.evictedTag ? `0x${result.evictedTag.toString(16)}` : undefined,
              writeback: result.writeback,
              latency: `${result.latency} cycles`
            },
            currentStats: {
              accesses: globalCache.accessCount,
              hitRate: ((globalCache.hits / globalCache.accessCount) * 100).toFixed(2) + '%'
            }
          }, null, 2)
        };
      }

      case 'simulate': {
        const policy = args.policy || 'LRU';
        const cache = createCache({
          size: args.cache_config?.size || 32 * 1024,
          lineSize: args.cache_config?.lineSize || 64,
          associativity: args.cache_config?.associativity || 8,
          policy: policy as ReplacementPolicy,
          writePolicy: 'write_back',
          hitLatency: 1,
          missLatency: 10
        });

        const addresses: number[] = args.addresses || generateAccessPattern(
          args.pattern || 'sequential',
          args.count || 100,
          { baseAddr: 0x1000 }
        );

        const trace: { address: string; hit: boolean }[] = [];

        for (let i = 0; i < addresses.length; i++) {
          const result = accessCache(cache, addresses[i], false);
          if (i < 20) {
            trace.push({
              address: `0x${addresses[i].toString(16)}`,
              hit: result.hit
            });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'simulate',
            pattern: args.pattern || 'custom',
            accessCount: addresses.length,
            policy,
            results: getCacheStats(cache),
            trace: trace.length > 0 ? trace : undefined
          }, null, 2)
        };
      }

      case 'pattern': {
        const patterns = ['sequential', 'strided', 'random', 'temporal', 'thrashing', 'matrix_row', 'matrix_col'];
        const count = args.count || 1000;
        const results: Record<string, unknown> = {};

        for (const pattern of patterns) {
          const cache = createCache({
            size: 32 * 1024,
            lineSize: 64,
            associativity: 8,
            policy: 'LRU',
            writePolicy: 'write_back',
            hitLatency: 1,
            missLatency: 10
          });

          const addresses = generateAccessPattern(pattern, count, { baseAddr: 0x1000 });
          for (const addr of addresses) {
            accessCache(cache, addr, false);
          }

          results[pattern] = {
            hitRate: ((cache.hits / cache.accessCount) * 100).toFixed(2) + '%',
            missRate: ((cache.misses / cache.accessCount) * 100).toFixed(2) + '%',
            evictions: cache.evictions
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'pattern',
            accessCount: count,
            cacheSize: '32 KB',
            results,
            analysis: {
              best: 'temporal (repeated access to hot set)',
              worst: 'thrashing (working set > cache size)',
              rowVsCol: 'Row-major much better due to spatial locality'
            }
          }, null, 2)
        };
      }

      case 'hierarchy': {
        globalHierarchy = createCacheHierarchy(true, true);

        const addresses = args.addresses || generateAccessPattern(
          args.pattern || 'random',
          args.count || 1000,
          { baseAddr: 0x1000, arraySize: 100000 }
        );

        const trace: { address: string; level: string; latency: number }[] = [];

        for (let i = 0; i < addresses.length; i++) {
          const result = accessHierarchy(globalHierarchy, addresses[i], false);
          if (i < 20) {
            trace.push({
              address: `0x${addresses[i].toString(16)}`,
              level: result.level,
              latency: result.latency
            });
          }
        }

        const stats = getHierarchyStats(globalHierarchy);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'hierarchy',
            levels: {
              L1: getCacheStats(globalHierarchy.L1),
              L2: globalHierarchy.L2 ? getCacheStats(globalHierarchy.L2) : undefined,
              L3: globalHierarchy.L3 ? getCacheStats(globalHierarchy.L3) : undefined
            },
            hierarchyStats: {
              totalAccesses: stats.totalAccesses,
              L1HitRate: (stats.L1HitRate * 100).toFixed(2) + '%',
              L2HitRate: stats.L2HitRate ? (stats.L2HitRate * 100).toFixed(2) + '%' : undefined,
              L3HitRate: stats.L3HitRate ? (stats.L3HitRate * 100).toFixed(2) + '%' : undefined,
              averageLatency: stats.averageLatency.toFixed(2) + ' cycles',
              effectiveCPI: stats.cpi.toFixed(2)
            },
            trace: trace.length > 0 ? trace : undefined
          }, null, 2)
        };
      }

      case 'tlb': {
        globalTLB = createTLB(args.tlb_size || 64, args.page_size || 4096);

        const count = args.count || 100;
        const addresses: number[] = [];

        // Generate virtual addresses across multiple pages
        for (let i = 0; i < count; i++) {
          const page = Math.floor(Math.random() * 100);
          const offset = Math.floor(Math.random() * globalTLB.pageSize);
          addresses.push(page * globalTLB.pageSize + offset);
        }

        const trace: { virtualAddr: string; hit: boolean; physicalAddr?: string }[] = [];
        let accessCount = 0;

        for (const vaddr of addresses) {
          accessCount++;
          const result = lookupTLB(globalTLB, vaddr, accessCount);

          if (!result.hit) {
            // Simulate page table walk and TLB fill
            const virtualPage = Math.floor(vaddr / globalTLB.pageSize);
            const physicalFrame = virtualPage + 0x100; // Simple mapping
            insertTLB(globalTLB, virtualPage, physicalFrame, accessCount);
          }

          if (trace.length < 20) {
            trace.push({
              virtualAddr: `0x${vaddr.toString(16)}`,
              hit: result.hit,
              physicalAddr: result.physicalAddress ? `0x${result.physicalAddress.toString(16)}` : undefined
            });
          }
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'tlb',
            config: {
              entries: globalTLB.size,
              pageSize: `${globalTLB.pageSize} bytes`
            },
            statistics: {
              accesses: globalTLB.hits + globalTLB.misses,
              hits: globalTLB.hits,
              misses: globalTLB.misses,
              hitRate: (globalTLB.hits / (globalTLB.hits + globalTLB.misses) * 100).toFixed(2) + '%'
            },
            trace: trace.length > 0 ? trace : undefined
          }, null, 2)
        };
      }

      case 'stats': {
        if (!globalCache) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'stats',
              error: 'No cache configured. Use configure or access operation first.'
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'stats',
            ...getCacheStats(globalCache)
          }, null, 2)
        };
      }

      case 'flush': {
        if (!globalCache) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'flush',
              error: 'No cache to flush'
            }, null, 2)
          };
        }

        const result = flushCache(globalCache);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'flush',
            writebacks: result.writebacks,
            linesCleared: result.linesCleared
          }, null, 2)
        };
      }

      case 'info':
      default: {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'cache_simulator',
            description: 'CPU cache hierarchy simulation and analysis',
            replacementPolicies: {
              LRU: 'Least Recently Used - evict line accessed longest ago',
              FIFO: 'First In First Out - evict oldest line',
              Random: 'Random replacement - simple but unpredictable',
              LFU: 'Least Frequently Used - evict line with fewest accesses',
              PLRU: 'Pseudo-LRU - tree-based approximation of LRU'
            },
            cacheTypes: {
              directMapped: 'Each address maps to exactly one line (fast, high conflict)',
              setAssociative: 'N-way: N possible locations per address (balanced)',
              fullyAssociative: 'Any line can hold any address (flexible, slow lookup)'
            },
            writePolicies: {
              writeBack: 'Update memory only on eviction (faster, needs dirty bit)',
              writeThrough: 'Update memory immediately (simpler, more traffic)'
            },
            hierarchyLevels: {
              L1: '32KB, 8-way, 1 cycle hit',
              L2: '256KB, 8-way, 10 cycle hit',
              L3: '8MB, 16-way, 50 cycle hit',
              Memory: '~200 cycles'
            },
            accessPatterns: [
              'sequential - Linear traversal (best spatial locality)',
              'strided - Fixed stride access',
              'random - Random addresses (worst case)',
              'temporal - Hot set repeated access',
              'thrashing - Working set exceeds cache',
              'matrix_row - Row-major traversal',
              'matrix_col - Column-major traversal (poor locality)'
            ],
            operations: ['access', 'stats', 'configure', 'flush', 'simulate', 'pattern', 'hierarchy', 'tlb']
          }, null, 2)
        };
      }
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iscachesimulatorAvailable(): boolean {
  return true;
}
