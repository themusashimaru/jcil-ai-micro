/**
 * BUFFER-POOL TOOL
 * Database buffer pool manager simulation
 *
 * Implements:
 * - LRU (Least Recently Used) page replacement
 * - Clock algorithm (Second Chance)
 * - LRU-K variant
 * - Buffer pool statistics and monitoring
 * - Page pinning and dirty page tracking
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Page structure
interface Page {
  pageId: number;
  frameId: number;
  data: string;
  isDirty: boolean;
  pinCount: number;
  refBit: boolean;
  accessHistory: number[];  // Timestamps for LRU-K
  lastAccess: number;
}

// Buffer pool statistics
interface BufferPoolStats {
  totalFrames: number;
  usedFrames: number;
  freeFrames: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  evictions: number;
  dirtyEvictions: number;
  pinnedPages: number;
}

// Page table entry
interface PageTableEntry {
  pageId: number;
  frameId: number;
}

// Buffer Pool Manager class
class BufferPoolManager {
  private frames: (Page | null)[];
  private pageTable: Map<number, number>;  // pageId -> frameId
  private freeList: number[];
  private timestamp: number = 0;
  private stats: BufferPoolStats;
  private algorithm: 'lru' | 'clock' | 'lru-k';
  private k: number = 2;  // For LRU-K
  private clockHand: number = 0;

  constructor(poolSize: number, algorithm: 'lru' | 'clock' | 'lru-k' = 'lru', k: number = 2) {
    this.frames = new Array(poolSize).fill(null);
    this.pageTable = new Map();
    this.freeList = Array.from({ length: poolSize }, (_, i) => i);
    this.algorithm = algorithm;
    this.k = k;
    this.stats = {
      totalFrames: poolSize,
      usedFrames: 0,
      freeFrames: poolSize,
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      evictions: 0,
      dirtyEvictions: 0,
      pinnedPages: 0
    };
  }

  // Fetch a page
  fetchPage(pageId: number): { page: Page | null; action: string; frameId: number } {
    this.timestamp++;

    // Check if page is already in buffer pool
    if (this.pageTable.has(pageId)) {
      const frameId = this.pageTable.get(pageId)!;
      const page = this.frames[frameId]!;

      // Update access info
      page.lastAccess = this.timestamp;
      page.accessHistory.push(this.timestamp);
      if (page.accessHistory.length > this.k) {
        page.accessHistory.shift();
      }
      page.refBit = true;

      this.stats.hitCount++;
      this.updateHitRate();

      return { page, action: 'HIT', frameId };
    }

    // Page fault - need to load from disk
    this.stats.missCount++;
    this.updateHitRate();

    // Find a frame
    let frameId: number;
    let action: string;

    if (this.freeList.length > 0) {
      // Use free frame
      frameId = this.freeList.shift()!;
      action = 'LOADED (free frame)';
      this.stats.usedFrames++;
      this.stats.freeFrames--;
    } else {
      // Need to evict
      const evictionResult = this.selectVictim();
      if (evictionResult.frameId === -1) {
        return { page: null, action: 'ALL PAGES PINNED', frameId: -1 };
      }
      frameId = evictionResult.frameId;
      action = `LOADED (evicted page ${evictionResult.evictedPageId})`;

      // Write back if dirty
      const victim = this.frames[frameId]!;
      if (victim.isDirty) {
        this.stats.dirtyEvictions++;
        action += ' [dirty write-back]';
      }

      this.pageTable.delete(evictionResult.evictedPageId);
      this.stats.evictions++;
    }

    // Load new page
    const newPage: Page = {
      pageId,
      frameId,
      data: `Data for page ${pageId}`,
      isDirty: false,
      pinCount: 0,
      refBit: true,
      accessHistory: [this.timestamp],
      lastAccess: this.timestamp
    };

    this.frames[frameId] = newPage;
    this.pageTable.set(pageId, frameId);

    return { page: newPage, action, frameId };
  }

  // Select victim page based on replacement algorithm
  private selectVictim(): { frameId: number; evictedPageId: number } {
    switch (this.algorithm) {
      case 'lru':
        return this.selectVictimLRU();
      case 'clock':
        return this.selectVictimClock();
      case 'lru-k':
        return this.selectVictimLRUK();
      default:
        return this.selectVictimLRU();
    }
  }

  // LRU victim selection
  private selectVictimLRU(): { frameId: number; evictedPageId: number } {
    let victim = -1;
    let minAccess = Infinity;

    for (let i = 0; i < this.frames.length; i++) {
      const page = this.frames[i];
      if (page && page.pinCount === 0 && page.lastAccess < minAccess) {
        minAccess = page.lastAccess;
        victim = i;
      }
    }

    if (victim === -1) {
      return { frameId: -1, evictedPageId: -1 };
    }

    return { frameId: victim, evictedPageId: this.frames[victim]!.pageId };
  }

  // Clock (Second Chance) victim selection
  private selectVictimClock(): { frameId: number; evictedPageId: number } {
    const maxIterations = this.frames.length * 2;
    let iterations = 0;

    while (iterations < maxIterations) {
      const page = this.frames[this.clockHand];

      if (page && page.pinCount === 0) {
        if (page.refBit) {
          // Give second chance
          page.refBit = false;
        } else {
          // Found victim
          const victim = this.clockHand;
          this.clockHand = (this.clockHand + 1) % this.frames.length;
          return { frameId: victim, evictedPageId: page.pageId };
        }
      }

      this.clockHand = (this.clockHand + 1) % this.frames.length;
      iterations++;
    }

    return { frameId: -1, evictedPageId: -1 };
  }

  // LRU-K victim selection
  private selectVictimLRUK(): { frameId: number; evictedPageId: number } {
    let victim = -1;
    let minKthAccess = Infinity;

    for (let i = 0; i < this.frames.length; i++) {
      const page = this.frames[i];
      if (page && page.pinCount === 0) {
        // Get K-th access time (or first if less than K accesses)
        const kthAccess = page.accessHistory.length >= this.k
          ? page.accessHistory[page.accessHistory.length - this.k]
          : 0;  // Not accessed K times, prioritize for eviction

        if (kthAccess < minKthAccess) {
          minKthAccess = kthAccess;
          victim = i;
        }
      }
    }

    if (victim === -1) {
      return { frameId: -1, evictedPageId: -1 };
    }

    return { frameId: victim, evictedPageId: this.frames[victim]!.pageId };
  }

  // Pin a page
  pinPage(pageId: number): boolean {
    if (!this.pageTable.has(pageId)) {
      return false;
    }
    const frameId = this.pageTable.get(pageId)!;
    const page = this.frames[frameId]!;
    page.pinCount++;
    this.stats.pinnedPages = this.countPinnedPages();
    return true;
  }

  // Unpin a page
  unpinPage(pageId: number, isDirty: boolean = false): boolean {
    if (!this.pageTable.has(pageId)) {
      return false;
    }
    const frameId = this.pageTable.get(pageId)!;
    const page = this.frames[frameId]!;
    if (page.pinCount > 0) {
      page.pinCount--;
    }
    if (isDirty) {
      page.isDirty = true;
    }
    this.stats.pinnedPages = this.countPinnedPages();
    return true;
  }

  // Flush a specific page
  flushPage(pageId: number): { flushed: boolean; wasDirty: boolean } {
    if (!this.pageTable.has(pageId)) {
      return { flushed: false, wasDirty: false };
    }
    const frameId = this.pageTable.get(pageId)!;
    const page = this.frames[frameId]!;
    const wasDirty = page.isDirty;
    page.isDirty = false;
    return { flushed: true, wasDirty };
  }

  // Flush all pages
  flushAll(): { flushed: number; dirtyPages: number } {
    let flushed = 0;
    let dirtyPages = 0;

    for (const page of this.frames) {
      if (page && page.isDirty) {
        page.isDirty = false;
        dirtyPages++;
      }
      if (page) flushed++;
    }

    return { flushed, dirtyPages };
  }

  // Get statistics
  getStats(): BufferPoolStats {
    return { ...this.stats };
  }

  // Get buffer pool state
  getState(): {
    frames: { frameId: number; pageId: number | null; pinCount: number; isDirty: boolean; lastAccess: number }[];
    pageTable: { pageId: number; frameId: number }[];
  } {
    const frameState = this.frames.map((page, i) => ({
      frameId: i,
      pageId: page?.pageId ?? null,
      pinCount: page?.pinCount ?? 0,
      isDirty: page?.isDirty ?? false,
      lastAccess: page?.lastAccess ?? 0
    }));

    const tableState = Array.from(this.pageTable.entries()).map(([pageId, frameId]) => ({
      pageId,
      frameId
    }));

    return { frames: frameState, pageTable: tableState };
  }

  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount;
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0;
  }

  private countPinnedPages(): number {
    return this.frames.filter(p => p && p.pinCount > 0).length;
  }
}

// Global buffer pool for demo
let globalBufferPool: BufferPoolManager | null = null;

// Simulate workload
function simulateWorkload(
  pool: BufferPoolManager,
  pattern: 'sequential' | 'random' | 'temporal' | 'zipf',
  numAccesses: number,
  numPages: number
): { accesses: { pageId: number; result: string }[]; finalStats: BufferPoolStats } {
  const accesses: { pageId: number; result: string }[] = [];

  for (let i = 0; i < numAccesses; i++) {
    let pageId: number;

    switch (pattern) {
      case 'sequential':
        pageId = i % numPages;
        break;
      case 'random':
        pageId = Math.floor(Math.random() * numPages);
        break;
      case 'temporal':
        // 80% recent pages, 20% random
        if (Math.random() < 0.8 && i > 0) {
          pageId = accesses[Math.max(0, i - 1 - Math.floor(Math.random() * 5))].pageId;
        } else {
          pageId = Math.floor(Math.random() * numPages);
        }
        break;
      case 'zipf':
        // Zipf distribution - some pages much more popular
        const rank = Math.floor(Math.pow(Math.random(), 2) * numPages);
        pageId = rank;
        break;
      default:
        pageId = Math.floor(Math.random() * numPages);
    }

    const result = pool.fetchPage(pageId);
    accesses.push({ pageId, result: result.action });
  }

  return { accesses, finalStats: pool.getStats() };
}

export const bufferpoolTool: UnifiedTool = {
  name: 'buffer_pool',
  description: 'Database buffer pool manager - LRU, Clock, LRU-K page replacement, pinning, statistics',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'fetch', 'pin', 'unpin', 'flush', 'stats', 'state', 'simulate', 'compare', 'info', 'examples'],
        description: 'Operation to perform'
      },
      poolSize: { type: 'number', description: 'Buffer pool size (number of frames)' },
      algorithm: { type: 'string', enum: ['lru', 'clock', 'lru-k'], description: 'Replacement algorithm' },
      k: { type: 'number', description: 'K value for LRU-K' },
      pageId: { type: 'number', description: 'Page ID to operate on' },
      dirty: { type: 'boolean', description: 'Mark page as dirty on unpin' },
      pattern: { type: 'string', enum: ['sequential', 'random', 'temporal', 'zipf'], description: 'Access pattern for simulation' },
      numAccesses: { type: 'number', description: 'Number of accesses to simulate' },
      numPages: { type: 'number', description: 'Total number of distinct pages' }
    },
    required: ['operation']
  }
};

export async function executebufferpool(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'buffer-pool',
          description: 'Database buffer pool manager simulation',
          algorithms: {
            lru: 'Least Recently Used - evict page with oldest access',
            clock: 'Second Chance - circular scan with reference bits',
            'lru-k': 'LRU-K - consider K-th most recent access for history'
          },
          concepts: {
            frame: 'Physical slot in memory',
            page: 'Fixed-size block of data',
            pinning: 'Prevent page from being evicted',
            dirty: 'Page modified, needs write-back',
            hitRate: 'Fraction of accesses found in buffer'
          },
          operations: ['create', 'fetch', 'pin', 'unpin', 'flush', 'stats', 'state', 'simulate', 'compare', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Create LRU buffer pool with 5 frames',
              call: { operation: 'create', poolSize: 5, algorithm: 'lru' }
            },
            {
              description: 'Fetch page 10',
              call: { operation: 'fetch', pageId: 10 }
            },
            {
              description: 'Pin page 10',
              call: { operation: 'pin', pageId: 10 }
            },
            {
              description: 'Simulate workload',
              call: { operation: 'simulate', pattern: 'zipf', numAccesses: 100, numPages: 20 }
            },
            {
              description: 'Compare algorithms',
              call: { operation: 'compare', poolSize: 5, numAccesses: 200, numPages: 20 }
            }
          ]
        }, null, 2)
      };
    }

    if (operation === 'create') {
      const poolSize = args.poolSize || 5;
      const algorithm = args.algorithm || 'lru';
      const k = args.k || 2;

      globalBufferPool = new BufferPoolManager(poolSize, algorithm, k);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'create',
          poolSize,
          algorithm,
          k: algorithm === 'lru-k' ? k : undefined,
          stats: globalBufferPool.getStats()
        }, null, 2)
      };
    }

    if (operation === 'fetch') {
      if (!globalBufferPool) {
        globalBufferPool = new BufferPoolManager(5);
      }

      const pageId = args.pageId ?? 0;
      const result = globalBufferPool.fetchPage(pageId);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'fetch',
          pageId,
          result: result.action,
          frameId: result.frameId,
          stats: globalBufferPool.getStats()
        }, null, 2)
      };
    }

    if (operation === 'pin') {
      if (!globalBufferPool) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No buffer pool created' }),
          isError: true
        };
      }

      const pageId = args.pageId ?? 0;
      const success = globalBufferPool.pinPage(pageId);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'pin',
          pageId,
          success,
          message: success ? 'Page pinned' : 'Page not in buffer pool',
          stats: globalBufferPool.getStats()
        }, null, 2)
      };
    }

    if (operation === 'unpin') {
      if (!globalBufferPool) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No buffer pool created' }),
          isError: true
        };
      }

      const pageId = args.pageId ?? 0;
      const dirty = args.dirty ?? false;
      const success = globalBufferPool.unpinPage(pageId, dirty);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'unpin',
          pageId,
          markedDirty: dirty,
          success,
          stats: globalBufferPool.getStats()
        }, null, 2)
      };
    }

    if (operation === 'flush') {
      if (!globalBufferPool) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No buffer pool created' }),
          isError: true
        };
      }

      if (args.pageId !== undefined) {
        const result = globalBufferPool.flushPage(args.pageId);
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'flush',
            pageId: args.pageId,
            ...result
          }, null, 2)
        };
      } else {
        const result = globalBufferPool.flushAll();
        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'flush_all',
            ...result
          }, null, 2)
        };
      }
    }

    if (operation === 'stats') {
      if (!globalBufferPool) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No buffer pool created' }),
          isError: true
        };
      }

      const stats = globalBufferPool.getStats();

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'stats',
          ...stats,
          hitRate: (stats.hitRate * 100).toFixed(2) + '%'
        }, null, 2)
      };
    }

    if (operation === 'state') {
      if (!globalBufferPool) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'No buffer pool created' }),
          isError: true
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'state',
          ...globalBufferPool.getState()
        }, null, 2)
      };
    }

    if (operation === 'simulate') {
      const poolSize = args.poolSize || 5;
      const algorithm = args.algorithm || 'lru';
      const pattern = args.pattern || 'random';
      const numAccesses = Math.min(500, args.numAccesses || 100);
      const numPages = args.numPages || 20;

      const pool = new BufferPoolManager(poolSize, algorithm, args.k || 2);
      const result = simulateWorkload(pool, pattern, numAccesses, numPages);

      // Sample some accesses for output
      const sampleAccesses = result.accesses.slice(0, 10);

      return {
        toolCallId: id,
        content: JSON.stringify({
          simulation: {
            poolSize,
            algorithm,
            pattern,
            numAccesses,
            numPages
          },
          results: {
            totalAccesses: numAccesses,
            hits: result.finalStats.hitCount,
            misses: result.finalStats.missCount,
            hitRate: (result.finalStats.hitRate * 100).toFixed(2) + '%',
            evictions: result.finalStats.evictions,
            dirtyEvictions: result.finalStats.dirtyEvictions
          },
          sampleAccesses
        }, null, 2)
      };
    }

    if (operation === 'compare') {
      const poolSize = args.poolSize || 5;
      const pattern = args.pattern || 'zipf';
      const numAccesses = Math.min(500, args.numAccesses || 200);
      const numPages = args.numPages || 20;

      const algorithms: ('lru' | 'clock' | 'lru-k')[] = ['lru', 'clock', 'lru-k'];
      const results: { algorithm: string; hitRate: string; evictions: number }[] = [];

      for (const alg of algorithms) {
        const pool = new BufferPoolManager(poolSize, alg, 2);
        const result = simulateWorkload(pool, pattern, numAccesses, numPages);
        results.push({
          algorithm: alg,
          hitRate: (result.finalStats.hitRate * 100).toFixed(2) + '%',
          evictions: result.finalStats.evictions
        });
      }

      // Find best
      const best = results.reduce((a, b) =>
        parseFloat(a.hitRate) > parseFloat(b.hitRate) ? a : b
      );

      return {
        toolCallId: id,
        content: JSON.stringify({
          comparison: {
            poolSize,
            pattern,
            numAccesses,
            numPages
          },
          results,
          winner: {
            algorithm: best.algorithm,
            hitRate: best.hitRate
          }
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

export function isbufferpoolAvailable(): boolean { return true; }
