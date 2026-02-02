/**
 * LSM-TREE TOOL
 * Log-Structured Merge-Tree storage engine implementation
 * Supports MemTable, SSTables, compaction strategies, and amplification analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type CompactionStrategy = 'size_tiered' | 'leveled' | 'fifo';

interface KeyValue {
  key: string;
  value: string;
  timestamp: number;
  tombstone: boolean;
}

interface BloomFilter {
  bits: Uint8Array;
  size: number;
  hashCount: number;
  insert(key: string): void;
  mightContain(key: string): boolean;
  falsePositiveRate(): number;
}

interface BlockIndex {
  firstKey: string;
  lastKey: string;
  offset: number;
  size: number;
}

interface SSTable {
  id: number;
  level: number;
  entries: KeyValue[];
  bloomFilter: BloomFilter;
  blockIndex: BlockIndex[];
  minKey: string;
  maxKey: string;
  size: number;
  createdAt: number;
  compressed: boolean;
  compressionRatio: number;
}

interface MemTable {
  entries: Map<string, KeyValue>;
  size: number;
  maxSize: number;
}

interface LSMStats {
  memTableSize: number;
  memTableEntries: number;
  levels: number;
  sstablesPerLevel: number[];
  totalSSTables: number;
  totalEntries: number;
  totalSize: number;
  writeAmplification: number;
  readAmplification: number;
  spaceAmplification: number;
  compactionsPerformed: number;
  flushesPerformed: number;
  bloomFilterHits: number;
  bloomFilterMisses: number;
}

interface CompactionResult {
  fromLevel: number;
  toLevel: number;
  inputSSTables: number;
  outputSSTables: number;
  entriesMerged: number;
  tombstonesRemoved: number;
  bytesWritten: number;
}

// ============================================================================
// BLOOM FILTER IMPLEMENTATION
// ============================================================================

function createBloomFilter(expectedElements: number, fpr: number = 0.01): BloomFilter {
  const size = Math.ceil(-expectedElements * Math.log(fpr) / (Math.LN2 * Math.LN2));
  const hashCount = Math.round((size / expectedElements) * Math.LN2);
  const bits = new Uint8Array(Math.ceil(size / 8));

  const hash1 = (key: string): number => {
    let h = 0;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) - h) + key.charCodeAt(i);
      h = h & h;
    }
    return Math.abs(h);
  };

  const hash2 = (key: string): number => {
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) + h) ^ key.charCodeAt(i);
    }
    return Math.abs(h);
  };

  return {
    bits,
    size,
    hashCount,
    insert(key: string): void {
      const h1 = hash1(key);
      const h2 = hash2(key);
      for (let i = 0; i < this.hashCount; i++) {
        const idx = Math.abs((h1 + i * h2) % this.size);
        const byteIdx = Math.floor(idx / 8);
        const bitIdx = idx % 8;
        this.bits[byteIdx] |= (1 << bitIdx);
      }
    },
    mightContain(key: string): boolean {
      const h1 = hash1(key);
      const h2 = hash2(key);
      for (let i = 0; i < this.hashCount; i++) {
        const idx = Math.abs((h1 + i * h2) % this.size);
        const byteIdx = Math.floor(idx / 8);
        const bitIdx = idx % 8;
        if ((this.bits[byteIdx] & (1 << bitIdx)) === 0) {
          return false;
        }
      }
      return true;
    },
    falsePositiveRate(): number {
      let setBits = 0;
      for (let i = 0; i < this.size; i++) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = i % 8;
        if ((this.bits[byteIdx] & (1 << bitIdx)) !== 0) {
          setBits++;
        }
      }
      const fillRatio = setBits / this.size;
      return Math.pow(fillRatio, this.hashCount);
    }
  };
}

// ============================================================================
// LSM TREE IMPLEMENTATION
// ============================================================================

class LSMTree {
  private memTable: MemTable;
  private immutableMemTable: MemTable | null = null;
  private levels: SSTable[][] = [];
  private maxLevels: number = 7;
  private memTableMaxSize: number = 4 * 1024 * 1024; // 4MB
  private levelSizeMultiplier: number = 10;
  private compactionStrategy: CompactionStrategy = 'leveled';
  private sstableCounter: number = 0;
  private stats: LSMStats;
  private totalBytesWritten: number = 0;
  private totalBytesRead: number = 0;
  private uniqueKeys: Set<string> = new Set();

  constructor() {
    this.memTable = this.createMemTable();
    for (let i = 0; i < this.maxLevels; i++) {
      this.levels.push([]);
    }
    this.stats = this.initStats();
  }

  private createMemTable(): MemTable {
    return {
      entries: new Map(),
      size: 0,
      maxSize: this.memTableMaxSize
    };
  }

  private initStats(): LSMStats {
    return {
      memTableSize: 0,
      memTableEntries: 0,
      levels: this.maxLevels,
      sstablesPerLevel: new Array(this.maxLevels).fill(0),
      totalSSTables: 0,
      totalEntries: 0,
      totalSize: 0,
      writeAmplification: 1,
      readAmplification: 1,
      spaceAmplification: 1,
      compactionsPerformed: 0,
      flushesPerformed: 0,
      bloomFilterHits: 0,
      bloomFilterMisses: 0
    };
  }

  /**
   * Put a key-value pair
   */
  put(key: string, value: string): {
    success: boolean;
    memTableFlushed: boolean;
    compactionTriggered: boolean;
  } {
    const entry: KeyValue = {
      key,
      value,
      timestamp: Date.now(),
      tombstone: false
    };

    const entrySize = key.length + value.length + 16; // Approximate size
    this.uniqueKeys.add(key);

    // Check if memtable needs flush
    let memTableFlushed = false;
    let compactionTriggered = false;

    if (this.memTable.size + entrySize > this.memTable.maxSize) {
      this.flush();
      memTableFlushed = true;

      // Check if compaction needed
      if (this.shouldCompact()) {
        this.compact();
        compactionTriggered = true;
      }
    }

    this.memTable.entries.set(key, entry);
    this.memTable.size += entrySize;
    this.totalBytesWritten += entrySize;

    this.updateStats();
    return { success: true, memTableFlushed, compactionTriggered };
  }

  /**
   * Delete a key (tombstone)
   */
  delete(key: string): { success: boolean; found: boolean } {
    const entry: KeyValue = {
      key,
      value: '',
      timestamp: Date.now(),
      tombstone: true
    };

    const entrySize = key.length + 16;

    if (this.memTable.size + entrySize > this.memTable.maxSize) {
      this.flush();
    }

    this.memTable.entries.set(key, entry);
    this.memTable.size += entrySize;
    this.totalBytesWritten += entrySize;

    this.updateStats();
    return { success: true, found: true };
  }

  /**
   * Get a value by key
   */
  get(key: string): {
    found: boolean;
    value?: string;
    source: 'memtable' | 'immutable_memtable' | `level_${number}` | 'not_found';
    levelsSearched: number;
    bloomFilterChecks: number;
    bloomFilterHits: number;
  } {
    let levelsSearched = 0;
    let bloomFilterChecks = 0;
    let bloomFilterHits = 0;

    // Check memtable first
    const memEntry = this.memTable.entries.get(key);
    if (memEntry) {
      this.totalBytesRead += key.length + (memEntry.value?.length || 0);
      if (memEntry.tombstone) {
        return { found: false, source: 'memtable', levelsSearched, bloomFilterChecks, bloomFilterHits };
      }
      return {
        found: true,
        value: memEntry.value,
        source: 'memtable',
        levelsSearched,
        bloomFilterChecks,
        bloomFilterHits
      };
    }

    // Check immutable memtable
    if (this.immutableMemTable) {
      const immEntry = this.immutableMemTable.entries.get(key);
      if (immEntry) {
        this.totalBytesRead += key.length + (immEntry.value?.length || 0);
        if (immEntry.tombstone) {
          return { found: false, source: 'immutable_memtable', levelsSearched, bloomFilterChecks, bloomFilterHits };
        }
        return {
          found: true,
          value: immEntry.value,
          source: 'immutable_memtable',
          levelsSearched,
          bloomFilterChecks,
          bloomFilterHits
        };
      }
    }

    // Check each level (top-down for leveled, all in L0 for size-tiered)
    for (let level = 0; level < this.levels.length; level++) {
      const sstables = this.levels[level];
      if (sstables.length === 0) continue;

      levelsSearched++;

      for (const sstable of sstables) {
        // Skip if key outside range
        if (key < sstable.minKey || key > sstable.maxKey) {
          continue;
        }

        // Check bloom filter
        bloomFilterChecks++;
        if (!sstable.bloomFilter.mightContain(key)) {
          this.stats.bloomFilterHits++;
          bloomFilterHits++;
          continue;
        }
        this.stats.bloomFilterMisses++;

        // Binary search in SSTable
        const entry = this.searchSSTable(sstable, key);
        if (entry) {
          this.totalBytesRead += key.length + (entry.value?.length || 0);
          if (entry.tombstone) {
            return {
              found: false,
              source: `level_${level}` as const,
              levelsSearched,
              bloomFilterChecks,
              bloomFilterHits
            };
          }
          return {
            found: true,
            value: entry.value,
            source: `level_${level}` as const,
            levelsSearched,
            bloomFilterChecks,
            bloomFilterHits
          };
        }
      }
    }

    return {
      found: false,
      source: 'not_found',
      levelsSearched,
      bloomFilterChecks,
      bloomFilterHits
    };
  }

  /**
   * Range scan
   */
  rangeScan(startKey: string, endKey: string): {
    entries: Array<{ key: string; value: string }>;
    count: number;
    levelsScanned: number;
    sstablesScanned: number;
  } {
    const results = new Map<string, KeyValue>();
    let sstablesScanned = 0;

    // Scan memtable
    for (const [key, entry] of this.memTable.entries) {
      if (key >= startKey && key <= endKey && !entry.tombstone) {
        results.set(key, entry);
      }
    }

    // Scan immutable memtable
    if (this.immutableMemTable) {
      for (const [key, entry] of this.immutableMemTable.entries) {
        if (key >= startKey && key <= endKey && !entry.tombstone) {
          if (!results.has(key) || results.get(key)!.timestamp < entry.timestamp) {
            results.set(key, entry);
          }
        }
      }
    }

    // Scan levels
    let levelsScanned = 0;
    for (const level of this.levels) {
      if (level.length === 0) continue;
      levelsScanned++;

      for (const sstable of level) {
        if (sstable.maxKey < startKey || sstable.minKey > endKey) {
          continue;
        }
        sstablesScanned++;

        for (const entry of sstable.entries) {
          if (entry.key >= startKey && entry.key <= endKey && !entry.tombstone) {
            if (!results.has(entry.key) || results.get(entry.key)!.timestamp < entry.timestamp) {
              results.set(entry.key, entry);
            }
          }
        }
      }
    }

    const entries = Array.from(results.values())
      .filter(e => !e.tombstone)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(e => ({ key: e.key, value: e.value }));

    return {
      entries,
      count: entries.length,
      levelsScanned,
      sstablesScanned
    };
  }

  /**
   * Binary search in SSTable
   */
  private searchSSTable(sstable: SSTable, key: string): KeyValue | null {
    let left = 0;
    let right = sstable.entries.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const cmp = key.localeCompare(sstable.entries[mid].key);

      if (cmp === 0) {
        return sstable.entries[mid];
      } else if (cmp < 0) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return null;
  }

  /**
   * Flush memtable to L0 SSTable
   */
  flush(): { sstableId: number; entriesWritten: number; bytesWritten: number } {
    if (this.memTable.entries.size === 0) {
      return { sstableId: -1, entriesWritten: 0, bytesWritten: 0 };
    }

    // Convert memtable to sorted array
    const entries = Array.from(this.memTable.entries.values())
      .sort((a, b) => a.key.localeCompare(b.key));

    // Create SSTable
    const sstable = this.createSSTable(entries, 0);
    this.levels[0].push(sstable);

    // Reset memtable
    const bytesWritten = this.memTable.size;
    this.totalBytesWritten += bytesWritten;
    this.memTable = this.createMemTable();
    this.stats.flushesPerformed++;

    this.updateStats();
    return {
      sstableId: sstable.id,
      entriesWritten: entries.length,
      bytesWritten
    };
  }

  /**
   * Create an SSTable from entries
   */
  private createSSTable(entries: KeyValue[], level: number): SSTable {
    const bloomFilter = createBloomFilter(Math.max(entries.length, 10));
    const blockIndex: BlockIndex[] = [];
    let totalSize = 0;

    // Build bloom filter and block index
    const blockSize = 4096;
    let currentBlock: KeyValue[] = [];
    let currentOffset = 0;

    for (const entry of entries) {
      bloomFilter.insert(entry.key);
      totalSize += entry.key.length + entry.value.length + 16;

      currentBlock.push(entry);
      if (currentBlock.length * 100 >= blockSize) {
        blockIndex.push({
          firstKey: currentBlock[0].key,
          lastKey: currentBlock[currentBlock.length - 1].key,
          offset: currentOffset,
          size: currentBlock.length * 100
        });
        currentOffset += currentBlock.length * 100;
        currentBlock = [];
      }
    }

    if (currentBlock.length > 0) {
      blockIndex.push({
        firstKey: currentBlock[0].key,
        lastKey: currentBlock[currentBlock.length - 1].key,
        offset: currentOffset,
        size: currentBlock.length * 100
      });
    }

    // Simulate compression
    const compressionRatio = 0.5 + Math.random() * 0.3; // 50-80% compression

    return {
      id: this.sstableCounter++,
      level,
      entries,
      bloomFilter,
      blockIndex,
      minKey: entries[0]?.key || '',
      maxKey: entries[entries.length - 1]?.key || '',
      size: totalSize * compressionRatio,
      createdAt: Date.now(),
      compressed: true,
      compressionRatio
    };
  }

  /**
   * Check if compaction is needed
   */
  private shouldCompact(): boolean {
    switch (this.compactionStrategy) {
      case 'size_tiered':
        // Compact when L0 has too many SSTables
        return this.levels[0].length >= 4;

      case 'leveled':
        // Compact when level exceeds size limit
        for (let i = 0; i < this.levels.length; i++) {
          const levelSize = this.levels[i].reduce((sum, s) => sum + s.size, 0);
          const maxSize = this.memTableMaxSize * Math.pow(this.levelSizeMultiplier, i);
          if (levelSize > maxSize) {
            return true;
          }
        }
        return false;

      case 'fifo':
        // Compact oldest when total size exceeds limit
        const totalSize = this.levels.flat().reduce((sum, s) => sum + s.size, 0);
        return totalSize > this.memTableMaxSize * 100;

      default:
        return false;
    }
  }

  /**
   * Perform compaction
   */
  compact(): CompactionResult[] {
    const results: CompactionResult[] = [];

    switch (this.compactionStrategy) {
      case 'size_tiered':
        results.push(...this.sizeTieredCompaction());
        break;
      case 'leveled':
        results.push(...this.leveledCompaction());
        break;
      case 'fifo':
        results.push(...this.fifoCompaction());
        break;
    }

    this.stats.compactionsPerformed += results.length;
    this.updateStats();
    return results;
  }

  /**
   * Size-tiered compaction: merge similar-sized SSTables
   */
  private sizeTieredCompaction(): CompactionResult[] {
    const results: CompactionResult[] = [];

    for (let level = 0; level < this.levels.length - 1; level++) {
      if (this.levels[level].length < 4) continue;

      // Sort by size and take similar-sized ones
      const sorted = [...this.levels[level]].sort((a, b) => a.size - b.size);
      const toMerge = sorted.slice(0, 4);

      if (toMerge.length < 2) continue;

      // Merge entries
      const merged = this.mergeSSTables(toMerge);
      const newSSTable = this.createSSTable(merged.entries, level + 1);

      // Remove old SSTables
      for (const sstable of toMerge) {
        const idx = this.levels[level].indexOf(sstable);
        if (idx !== -1) this.levels[level].splice(idx, 1);
      }

      // Add new SSTable
      this.levels[level + 1].push(newSSTable);

      results.push({
        fromLevel: level,
        toLevel: level + 1,
        inputSSTables: toMerge.length,
        outputSSTables: 1,
        entriesMerged: merged.entries.length,
        tombstonesRemoved: merged.tombstonesRemoved,
        bytesWritten: newSSTable.size
      });

      this.totalBytesWritten += newSSTable.size;
    }

    return results;
  }

  /**
   * Leveled compaction: merge overlapping key ranges
   */
  private leveledCompaction(): CompactionResult[] {
    const results: CompactionResult[] = [];

    for (let level = 0; level < this.levels.length - 1; level++) {
      const levelSize = this.levels[level].reduce((sum, s) => sum + s.size, 0);
      const maxSize = this.memTableMaxSize * Math.pow(this.levelSizeMultiplier, level);

      if (levelSize <= maxSize) continue;

      // Pick SSTable to compact (oldest or most overlapping)
      const sstable = this.levels[level][0];
      if (!sstable) continue;

      // Find overlapping SSTables in next level
      const overlapping = this.levels[level + 1].filter(
        s => !(s.maxKey < sstable.minKey || s.minKey > sstable.maxKey)
      );

      // Merge all together
      const toMerge = [sstable, ...overlapping];
      const merged = this.mergeSSTables(toMerge);

      // Remove old SSTables
      const idx = this.levels[level].indexOf(sstable);
      if (idx !== -1) this.levels[level].splice(idx, 1);

      for (const s of overlapping) {
        const i = this.levels[level + 1].indexOf(s);
        if (i !== -1) this.levels[level + 1].splice(i, 1);
      }

      // Create new SSTable(s) - split if too large
      const newSSTable = this.createSSTable(merged.entries, level + 1);
      this.levels[level + 1].push(newSSTable);

      results.push({
        fromLevel: level,
        toLevel: level + 1,
        inputSSTables: toMerge.length,
        outputSSTables: 1,
        entriesMerged: merged.entries.length,
        tombstonesRemoved: merged.tombstonesRemoved,
        bytesWritten: newSSTable.size
      });

      this.totalBytesWritten += newSSTable.size;
    }

    return results;
  }

  /**
   * FIFO compaction: delete oldest SSTables
   */
  private fifoCompaction(): CompactionResult[] {
    const results: CompactionResult[] = [];
    const totalSize = this.levels.flat().reduce((sum, s) => sum + s.size, 0);
    const maxSize = this.memTableMaxSize * 100;

    if (totalSize <= maxSize) return results;

    // Find and remove oldest SSTables
    const allSSTables = this.levels.flat().sort((a, b) => a.createdAt - b.createdAt);
    let removed = 0;
    let removedSize = 0;

    for (const sstable of allSSTables) {
      if (totalSize - removedSize <= maxSize) break;

      for (let level = 0; level < this.levels.length; level++) {
        const idx = this.levels[level].indexOf(sstable);
        if (idx !== -1) {
          this.levels[level].splice(idx, 1);
          removed++;
          removedSize += sstable.size;
          break;
        }
      }
    }

    if (removed > 0) {
      results.push({
        fromLevel: -1,
        toLevel: -1,
        inputSSTables: removed,
        outputSSTables: 0,
        entriesMerged: 0,
        tombstonesRemoved: removed,
        bytesWritten: 0
      });
    }

    return results;
  }

  /**
   * Merge multiple SSTables
   */
  private mergeSSTables(sstables: SSTable[]): { entries: KeyValue[]; tombstonesRemoved: number } {
    const merged = new Map<string, KeyValue>();
    let tombstonesRemoved = 0;

    // Merge all entries, keeping most recent
    for (const sstable of sstables) {
      for (const entry of sstable.entries) {
        const existing = merged.get(entry.key);
        if (!existing || existing.timestamp < entry.timestamp) {
          merged.set(entry.key, entry);
        }
      }
    }

    // Remove tombstones (only at last level in real implementation)
    const entries: KeyValue[] = [];
    for (const entry of merged.values()) {
      if (entry.tombstone) {
        tombstonesRemoved++;
      } else {
        entries.push(entry);
      }
    }

    // Sort by key
    entries.sort((a, b) => a.key.localeCompare(b.key));

    return { entries, tombstonesRemoved };
  }

  /**
   * Calculate amplification factors
   */
  analyzeAmplification(): {
    writeAmplification: number;
    readAmplification: number;
    spaceAmplification: number;
    details: {
      totalBytesWritten: number;
      totalBytesRead: number;
      logicalDataSize: number;
      physicalDataSize: number;
      levels: Array<{ level: number; sstables: number; size: number }>;
    };
  } {
    const logicalDataSize = this.uniqueKeys.size * 100; // Approximate
    const physicalDataSize = this.levels.flat().reduce((sum, s) => sum + s.size, 0) + this.memTable.size;

    // Write amplification = total bytes written / logical bytes written
    const writeAmplification = logicalDataSize > 0 ? this.totalBytesWritten / logicalDataSize : 1;

    // Read amplification = levels that need to be checked for a read
    const readAmplification = this.levels.filter(l => l.length > 0).length + 1; // +1 for memtable

    // Space amplification = physical size / logical size
    const spaceAmplification = logicalDataSize > 0 ? physicalDataSize / logicalDataSize : 1;

    const levelDetails = this.levels.map((level, i) => ({
      level: i,
      sstables: level.length,
      size: level.reduce((sum, s) => sum + s.size, 0)
    }));

    return {
      writeAmplification,
      readAmplification,
      spaceAmplification,
      details: {
        totalBytesWritten: this.totalBytesWritten,
        totalBytesRead: this.totalBytesRead,
        logicalDataSize,
        physicalDataSize,
        levels: levelDetails
      }
    };
  }

  /**
   * Update statistics
   */
  private updateStats(): void {
    this.stats.memTableSize = this.memTable.size;
    this.stats.memTableEntries = this.memTable.entries.size;
    this.stats.sstablesPerLevel = this.levels.map(l => l.length);
    this.stats.totalSSTables = this.levels.flat().length;
    this.stats.totalEntries = this.memTable.entries.size +
      this.levels.flat().reduce((sum, s) => sum + s.entries.length, 0);
    this.stats.totalSize = this.memTable.size +
      this.levels.flat().reduce((sum, s) => sum + s.size, 0);

    const amp = this.analyzeAmplification();
    this.stats.writeAmplification = amp.writeAmplification;
    this.stats.readAmplification = amp.readAmplification;
    this.stats.spaceAmplification = amp.spaceAmplification;
  }

  /**
   * Get statistics
   */
  getStatistics(): LSMStats & {
    compactionStrategy: CompactionStrategy;
    levelDetails: Array<{
      level: number;
      sstables: number;
      totalSize: number;
      minKey?: string;
      maxKey?: string;
    }>;
  } {
    this.updateStats();

    const levelDetails = this.levels.map((level, i) => {
      const minKey = level.length > 0 ? level.reduce((min, s) => s.minKey < min ? s.minKey : min, level[0].minKey) : undefined;
      const maxKey = level.length > 0 ? level.reduce((max, s) => s.maxKey > max ? s.maxKey : max, level[0].maxKey) : undefined;
      return {
        level: i,
        sstables: level.length,
        totalSize: level.reduce((sum, s) => sum + s.size, 0),
        minKey,
        maxKey
      };
    });

    return {
      ...this.stats,
      compactionStrategy: this.compactionStrategy,
      levelDetails
    };
  }

  /**
   * Configure compaction strategy
   */
  configureCompaction(strategy: CompactionStrategy, options?: {
    memTableMaxSize?: number;
    levelSizeMultiplier?: number;
    maxLevels?: number;
  }): void {
    this.compactionStrategy = strategy;
    if (options?.memTableMaxSize) this.memTableMaxSize = options.memTableMaxSize;
    if (options?.levelSizeMultiplier) this.levelSizeMultiplier = options.levelSizeMultiplier;
    if (options?.maxLevels) {
      this.maxLevels = options.maxLevels;
      while (this.levels.length < this.maxLevels) {
        this.levels.push([]);
      }
    }
  }

  /**
   * Reset for testing
   */
  reset(): void {
    this.memTable = this.createMemTable();
    this.immutableMemTable = null;
    this.levels = [];
    for (let i = 0; i < this.maxLevels; i++) {
      this.levels.push([]);
    }
    this.sstableCounter = 0;
    this.totalBytesWritten = 0;
    this.totalBytesRead = 0;
    this.uniqueKeys.clear();
    this.stats = this.initStats();
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const lsmtreeTool: UnifiedTool = {
  name: 'lsm_tree',
  description: 'Log-Structured Merge-Tree storage engine with MemTable, SSTables, compaction strategies, and amplification analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'put', 'get', 'delete', 'range_scan', 'flush', 'compact',
          'get_statistics', 'analyze_amplification', 'configure_compaction',
          'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      key: {
        type: 'string',
        description: 'Key for put/get/delete operations'
      },
      value: {
        type: 'string',
        description: 'Value for put operation'
      },
      startKey: {
        type: 'string',
        description: 'Start key for range scan'
      },
      endKey: {
        type: 'string',
        description: 'End key for range scan'
      },
      strategy: {
        type: 'string',
        enum: ['size_tiered', 'leveled', 'fifo'],
        description: 'Compaction strategy'
      },
      memTableMaxSize: {
        type: 'number',
        description: 'Maximum memtable size in bytes'
      },
      levelSizeMultiplier: {
        type: 'number',
        description: 'Size multiplier between levels'
      },
      entries: {
        type: 'array',
        items: { type: 'object' },
        description: 'Bulk entries to insert [{key, value}, ...]'
      }
    },
    required: ['operation']
  }
};

// Global instance
let lsmTree: LSMTree | null = null;

function getLSMTree(): LSMTree {
  if (!lsmTree) {
    lsmTree = new LSMTree();
  }
  return lsmTree;
}

export async function executelsmtree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const tree = getLSMTree();

    switch (operation) {
      case 'put': {
        const key = args.key || 'key1';
        const value = args.value || 'value1';

        const result = tree.put(key, value);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'put',
            key,
            value,
            ...result,
            explanation: 'Write path: Key-value written to MemTable (in-memory). ' +
              (result.memTableFlushed ? 'MemTable was full, flushed to L0 SSTable. ' : '') +
              (result.compactionTriggered ? 'Compaction was triggered.' : '')
          }, null, 2)
        };
      }

      case 'get': {
        const key = args.key || 'key1';
        const result = tree.get(key);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get',
            key,
            ...result,
            explanation: 'Read path: Checked MemTable first, then immutable MemTable, ' +
              `then ${result.levelsSearched} level(s). Bloom filters checked: ${result.bloomFilterChecks}, ` +
              `Bloom filter hits (avoided disk reads): ${result.bloomFilterHits}`
          }, null, 2)
        };
      }

      case 'delete': {
        const key = args.key || 'key1';
        const result = tree.delete(key);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'delete',
            key,
            ...result,
            explanation: 'Delete implemented as tombstone write. Actual deletion happens during compaction.'
          }, null, 2)
        };
      }

      case 'range_scan': {
        const startKey = args.startKey || 'a';
        const endKey = args.endKey || 'z';

        const result = tree.rangeScan(startKey, endKey);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'range_scan',
            startKey,
            endKey,
            ...result,
            explanation: `Scanned ${result.levelsScanned} levels and ${result.sstablesScanned} SSTables. ` +
              'Results merged and deduplicated using timestamps.'
          }, null, 2)
        };
      }

      case 'flush': {
        const result = tree.flush();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'flush',
            ...result,
            explanation: result.entriesWritten > 0
              ? `MemTable flushed to L0 SSTable #${result.sstableId}. ` +
                `${result.entriesWritten} entries written, ${result.bytesWritten} bytes.`
              : 'MemTable was empty, nothing to flush.'
          }, null, 2)
        };
      }

      case 'compact': {
        const results = tree.compact();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compact',
            compactionResults: results,
            stats: tree.getStatistics(),
            explanation: results.length > 0
              ? `Performed ${results.length} compaction(s). ` +
                `Total entries merged: ${results.reduce((s, r) => s + r.entriesMerged, 0)}, ` +
                `Tombstones removed: ${results.reduce((s, r) => s + r.tombstonesRemoved, 0)}`
              : 'No compaction needed.'
          }, null, 2)
        };
      }

      case 'get_statistics': {
        const stats = tree.getStatistics();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_statistics',
            ...stats
          }, null, 2)
        };
      }

      case 'analyze_amplification': {
        const analysis = tree.analyzeAmplification();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_amplification',
            ...analysis,
            interpretation: {
              writeAmplification: `Each byte written by user results in ~${analysis.writeAmplification.toFixed(2)} bytes written to disk (due to compaction)`,
              readAmplification: `A read may check up to ${analysis.readAmplification} levels`,
              spaceAmplification: `Physical storage is ~${analysis.spaceAmplification.toFixed(2)}x the logical data size`
            },
            tradeoffs: {
              size_tiered: 'Lower write amp, higher space amp, good for write-heavy workloads',
              leveled: 'Higher write amp, lower space amp, better for read-heavy workloads',
              fifo: 'Lowest write amp, no compaction merging, good for time-series data'
            }
          }, null, 2)
        };
      }

      case 'configure_compaction': {
        const strategy = (args.strategy || 'leveled') as CompactionStrategy;
        tree.configureCompaction(strategy, {
          memTableMaxSize: args.memTableMaxSize,
          levelSizeMultiplier: args.levelSizeMultiplier
        });

        const strategyDetails: Record<CompactionStrategy, { description: string; pros: string[]; cons: string[] }> = {
          size_tiered: {
            description: 'Groups similar-sized SSTables for compaction',
            pros: ['Lower write amplification', 'Good for write-heavy workloads'],
            cons: ['Higher space amplification', 'Less predictable read performance']
          },
          leveled: {
            description: 'Maintains sorted runs per level, compacts overlapping ranges',
            pros: ['Lower space amplification', 'Predictable read performance'],
            cons: ['Higher write amplification']
          },
          fifo: {
            description: 'Deletes oldest SSTables when space limit reached',
            pros: ['Minimal write amplification', 'Simple implementation'],
            cons: ['Only suitable for time-series data', 'No deduplication']
          }
        };

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure_compaction',
            strategy,
            options: {
              memTableMaxSize: args.memTableMaxSize,
              levelSizeMultiplier: args.levelSizeMultiplier
            },
            strategyDetails: strategyDetails[strategy]
          }, null, 2)
        };
      }

      case 'demo': {
        tree.reset();

        const results: Record<string, unknown>[] = [];

        // 1. Insert several key-value pairs
        const entries = [
          { key: 'user:1001', value: JSON.stringify({ name: 'Alice', age: 30 }) },
          { key: 'user:1002', value: JSON.stringify({ name: 'Bob', age: 25 }) },
          { key: 'user:1003', value: JSON.stringify({ name: 'Charlie', age: 35 }) },
          { key: 'order:5001', value: JSON.stringify({ user: 1001, amount: 99.99 }) },
          { key: 'order:5002', value: JSON.stringify({ user: 1002, amount: 149.99 }) }
        ];

        for (const entry of entries) {
          tree.put(entry.key, entry.value);
        }

        results.push({
          step: 1,
          description: 'Inserted 5 key-value pairs into MemTable',
          memTableState: {
            entries: tree.getStatistics().memTableEntries,
            size: tree.getStatistics().memTableSize
          }
        });

        // 2. Read a value
        const readResult = tree.get('user:1002');
        results.push({
          step: 2,
          description: 'Read user:1002 from MemTable',
          result: readResult
        });

        // 3. Flush to SSTable
        const flushResult = tree.flush();
        results.push({
          step: 3,
          description: 'Flush MemTable to L0 SSTable',
          result: flushResult,
          levelState: tree.getStatistics().levelDetails
        });

        // 4. Insert more and read (checking SSTable)
        tree.put('user:1004', JSON.stringify({ name: 'Diana', age: 28 }));
        const readResult2 = tree.get('user:1001');  // This is in SSTable now
        results.push({
          step: 4,
          description: 'Read user:1001 (now in SSTable)',
          result: readResult2
        });

        // 5. Delete a key
        tree.delete('user:1003');
        const readDeleted = tree.get('user:1003');
        results.push({
          step: 5,
          description: 'Delete user:1003 (tombstone)',
          readAfterDelete: readDeleted
        });

        // 6. Range scan
        const rangeResult = tree.rangeScan('order:', 'order:~');
        results.push({
          step: 6,
          description: 'Range scan for all orders',
          result: rangeResult
        });

        // 7. Amplification analysis
        const ampAnalysis = tree.analyzeAmplification();
        results.push({
          step: 7,
          description: 'Amplification analysis',
          analysis: ampAnalysis
        });

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            scenarios: results,
            finalStats: tree.getStatistics()
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'LSM-Tree Storage Engine',
            description: 'Log-Structured Merge-Tree for write-optimized storage',
            components: {
              memTable: 'In-memory sorted structure (Red-Black tree or Skip List)',
              sstable: 'Sorted String Table - immutable sorted file on disk',
              bloomFilter: 'Probabilistic filter to avoid unnecessary disk reads',
              blockIndex: 'Index for efficient key lookup within SSTable'
            },
            operations: {
              write: 'Write to MemTable (fast, in-memory) -> Flush to L0 SSTable',
              read: 'Check MemTable -> Immutable MemTable -> L0 -> L1 -> ... -> Ln',
              delete: 'Write tombstone marker, actual deletion during compaction',
              compaction: 'Merge SSTables to reduce levels and remove tombstones'
            },
            compactionStrategies: {
              size_tiered: 'Group similar-sized SSTables, lower write amp',
              leveled: 'Maintain sorted runs, lower space amp',
              fifo: 'Delete oldest, good for time-series'
            },
            amplificationFactors: {
              write: 'Bytes written to disk / Bytes written by user',
              read: 'Number of levels checked for a read',
              space: 'Physical size / Logical size'
            },
            usedBy: ['RocksDB', 'LevelDB', 'Cassandra', 'HBase', 'ScyllaDB']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Put a key-value pair',
                call: { operation: 'put', key: 'user:123', value: '{"name":"Alice"}' }
              },
              {
                name: 'Get a value',
                call: { operation: 'get', key: 'user:123' }
              },
              {
                name: 'Delete a key',
                call: { operation: 'delete', key: 'user:123' }
              },
              {
                name: 'Range scan',
                call: { operation: 'range_scan', startKey: 'user:', endKey: 'user:~' }
              },
              {
                name: 'Flush MemTable',
                call: { operation: 'flush' }
              },
              {
                name: 'Trigger compaction',
                call: { operation: 'compact' }
              },
              {
                name: 'Configure leveled compaction',
                call: { operation: 'configure_compaction', strategy: 'leveled' }
              },
              {
                name: 'Analyze amplification',
                call: { operation: 'analyze_amplification' }
              },
              {
                name: 'Run demo',
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

export function islsmtreeAvailable(): boolean { return true; }
