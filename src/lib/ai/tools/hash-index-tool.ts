/**
 * HASH-INDEX TOOL
 * Complete hash index implementation for database indexing
 * Supports static, extendible, and linear hashing schemes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type HashingScheme = 'static' | 'extendible' | 'linear';
type OverflowHandling = 'chaining' | 'open_addressing';
type HashFunction = 'division' | 'multiplication' | 'murmur' | 'fnv1a';

interface HashEntry<K, V> {
  key: K;
  value: V;
  hash: number;
  deleted?: boolean;
}

interface Bucket<K, V> {
  id: number;
  entries: HashEntry<K, V>[];
  localDepth: number;  // For extendible hashing
  overflowBucket?: Bucket<K, V>;  // For chaining
  splitPointer?: number;  // For linear hashing
}

interface HashIndexStats {
  totalEntries: number;
  totalBuckets: number;
  bucketCapacity: number;
  loadFactor: number;
  overflowBuckets: number;
  collisions: number;
  avgBucketOccupancy: number;
  maxBucketOccupancy: number;
  minBucketOccupancy: number;
  hashFunction: HashFunction;
  scheme: HashingScheme;
  globalDepth?: number;  // For extendible
  splitPointer?: number;  // For linear
  level?: number;  // For linear
}

interface LookupResult<V> {
  found: boolean;
  value?: V;
  bucketId: number;
  probeCount: number;
  hashValue: number;
}

interface BucketDistribution {
  bucketId: number;
  entryCount: number;
  occupancyPercent: number;
  hasOverflow: boolean;
  localDepth?: number;
}

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

function divisionHash(key: string, tableSize: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % tableSize;
}

function multiplicationHash(key: string, tableSize: number): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const A = 0.6180339887; // (sqrt(5) - 1) / 2
  return Math.floor(tableSize * ((hash * A) % 1));
}

function murmurHash(key: string, tableSize: number): number {
  let h = 0xdeadbeef;
  for (let i = 0; i < key.length; i++) {
    h = Math.imul(h ^ key.charCodeAt(i), 0x5bd1e995);
    h ^= h >>> 15;
  }
  return (h >>> 0) % tableSize;
}

function fnv1aHash(key: string, tableSize: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % tableSize;
}

function getHashFunction(type: HashFunction): (key: string, tableSize: number) => number {
  switch (type) {
    case 'division': return divisionHash;
    case 'multiplication': return multiplicationHash;
    case 'murmur': return murmurHash;
    case 'fnv1a': return fnv1aHash;
    default: return divisionHash;
  }
}

// ============================================================================
// STATIC HASH INDEX
// ============================================================================

class StaticHashIndex<K extends string, V> {
  private buckets: Bucket<K, V>[];
  private numBuckets: number;
  private bucketCapacity: number;
  private hashFn: (key: string, tableSize: number) => number;
  private hashFnType: HashFunction;
  private overflowMode: OverflowHandling;
  private stats: { collisions: number; overflowBuckets: number };

  constructor(
    numBuckets: number = 16,
    bucketCapacity: number = 4,
    hashFnType: HashFunction = 'murmur',
    overflowMode: OverflowHandling = 'chaining'
  ) {
    this.numBuckets = numBuckets;
    this.bucketCapacity = bucketCapacity;
    this.hashFn = getHashFunction(hashFnType);
    this.hashFnType = hashFnType;
    this.overflowMode = overflowMode;
    this.buckets = [];
    this.stats = { collisions: 0, overflowBuckets: 0 };

    for (let i = 0; i < numBuckets; i++) {
      this.buckets.push({
        id: i,
        entries: [],
        localDepth: 0
      });
    }
  }

  private hash(key: K): number {
    return this.hashFn(key, this.numBuckets);
  }

  insert(key: K, value: V): { success: boolean; bucketId: number; collision: boolean; overflow: boolean } {
    const hashValue = this.hash(key);
    const bucket = this.buckets[hashValue];
    let overflow = false;

    // Check for existing key
    for (const entry of bucket.entries) {
      if (entry.key === key && !entry.deleted) {
        entry.value = value;
        return { success: true, bucketId: hashValue, collision: false, overflow: false };
      }
    }

    // Check collision
    const collision = bucket.entries.filter(e => !e.deleted).length > 0;
    if (collision) this.stats.collisions++;

    // Try to insert in main bucket
    if (bucket.entries.filter(e => !e.deleted).length < this.bucketCapacity) {
      bucket.entries.push({ key, value, hash: hashValue });
      return { success: true, bucketId: hashValue, collision, overflow: false };
    }

    // Handle overflow
    if (this.overflowMode === 'chaining') {
      // Find or create overflow bucket
      let currentBucket = bucket;
      while (currentBucket.overflowBucket) {
        currentBucket = currentBucket.overflowBucket;
        if (currentBucket.entries.filter(e => !e.deleted).length < this.bucketCapacity) {
          currentBucket.entries.push({ key, value, hash: hashValue });
          return { success: true, bucketId: hashValue, collision: true, overflow: true };
        }
      }
      // Create new overflow bucket
      const overflowBucket: Bucket<K, V> = {
        id: this.buckets.length + this.stats.overflowBuckets,
        entries: [{ key, value, hash: hashValue }],
        localDepth: 0
      };
      currentBucket.overflowBucket = overflowBucket;
      this.stats.overflowBuckets++;
      overflow = true;
    } else {
      // Open addressing (linear probing)
      let probeIndex = (hashValue + 1) % this.numBuckets;
      let probeCount = 1;
      while (probeCount < this.numBuckets) {
        const probeBucket = this.buckets[probeIndex];
        if (probeBucket.entries.filter(e => !e.deleted).length < this.bucketCapacity) {
          probeBucket.entries.push({ key, value, hash: hashValue });
          return { success: true, bucketId: probeIndex, collision: true, overflow: false };
        }
        probeIndex = (probeIndex + 1) % this.numBuckets;
        probeCount++;
      }
      return { success: false, bucketId: -1, collision: true, overflow: false };
    }

    return { success: true, bucketId: hashValue, collision, overflow };
  }

  lookup(key: K): LookupResult<V> {
    const hashValue = this.hash(key);
    let bucket: Bucket<K, V> | undefined = this.buckets[hashValue];
    let probeCount = 1;

    while (bucket) {
      for (const entry of bucket.entries) {
        if (entry.key === key && !entry.deleted) {
          return {
            found: true,
            value: entry.value,
            bucketId: bucket.id,
            probeCount,
            hashValue
          };
        }
      }

      if (this.overflowMode === 'chaining') {
        bucket = bucket.overflowBucket;
        probeCount++;
      } else {
        // Linear probing
        const nextIndex = (hashValue + probeCount) % this.numBuckets;
        if (probeCount >= this.numBuckets || nextIndex === hashValue) {
          break;
        }
        bucket = this.buckets[nextIndex];
        probeCount++;
      }
    }

    return {
      found: false,
      bucketId: hashValue,
      probeCount,
      hashValue
    };
  }

  delete(key: K): { success: boolean; bucketId: number } {
    const hashValue = this.hash(key);
    let bucket: Bucket<K, V> | undefined = this.buckets[hashValue];

    while (bucket) {
      for (const entry of bucket.entries) {
        if (entry.key === key && !entry.deleted) {
          entry.deleted = true;
          return { success: true, bucketId: bucket.id };
        }
      }
      bucket = bucket.overflowBucket;
    }

    return { success: false, bucketId: hashValue };
  }

  getStatistics(): HashIndexStats {
    let totalEntries = 0;
    let maxOccupancy = 0;
    let minOccupancy = this.bucketCapacity;
    let overflowCount = 0;

    for (const bucket of this.buckets) {
      let bucketEntries = bucket.entries.filter(e => !e.deleted).length;
      let current: Bucket<K, V> | undefined = bucket.overflowBucket;

      while (current) {
        bucketEntries += current.entries.filter(e => !e.deleted).length;
        overflowCount++;
        current = current.overflowBucket;
      }

      totalEntries += bucketEntries;
      maxOccupancy = Math.max(maxOccupancy, bucketEntries);
      minOccupancy = Math.min(minOccupancy, bucketEntries);
    }

    return {
      totalEntries,
      totalBuckets: this.numBuckets,
      bucketCapacity: this.bucketCapacity,
      loadFactor: totalEntries / (this.numBuckets * this.bucketCapacity),
      overflowBuckets: overflowCount,
      collisions: this.stats.collisions,
      avgBucketOccupancy: totalEntries / this.numBuckets,
      maxBucketOccupancy: maxOccupancy,
      minBucketOccupancy: minOccupancy,
      hashFunction: this.hashFnType,
      scheme: 'static'
    };
  }

  getBucketDistribution(): BucketDistribution[] {
    return this.buckets.map(bucket => {
      let entryCount = bucket.entries.filter(e => !e.deleted).length;
      let hasOverflow = false;
      let current = bucket.overflowBucket;
      while (current) {
        entryCount += current.entries.filter(e => !e.deleted).length;
        hasOverflow = true;
        current = current.overflowBucket;
      }
      return {
        bucketId: bucket.id,
        entryCount,
        occupancyPercent: (entryCount / this.bucketCapacity) * 100,
        hasOverflow
      };
    });
  }
}

// ============================================================================
// EXTENDIBLE HASH INDEX
// ============================================================================

class ExtendibleHashIndex<K extends string, V> {
  private directory: number[];  // Maps directory entries to bucket indices
  private buckets: Map<number, Bucket<K, V>>;
  private globalDepth: number;
  private bucketCapacity: number;
  private hashFn: (key: string, tableSize: number) => number;
  private hashFnType: HashFunction;
  private nextBucketId: number;
  private stats: { splits: number; collisions: number };

  constructor(bucketCapacity: number = 4, hashFnType: HashFunction = 'murmur') {
    this.globalDepth = 1;
    this.bucketCapacity = bucketCapacity;
    this.hashFn = getHashFunction(hashFnType);
    this.hashFnType = hashFnType;
    this.nextBucketId = 0;
    this.stats = { splits: 0, collisions: 0 };

    // Initialize with 2 buckets
    this.buckets = new Map();
    this.buckets.set(0, this.createBucket(0, 1));
    this.buckets.set(1, this.createBucket(1, 1));
    this.directory = [0, 1];
  }

  private createBucket(id: number, localDepth: number): Bucket<K, V> {
    return {
      id,
      entries: [],
      localDepth
    };
  }

  private hash(key: K): number {
    // Use full hash for extendible hashing
    return this.hashFn(key, 0x7FFFFFFF);
  }

  private getBucketIndex(hashValue: number): number {
    // Use last globalDepth bits
    const mask = (1 << this.globalDepth) - 1;
    return hashValue & mask;
  }

  insert(key: K, value: V): { success: boolean; bucketId: number; split: boolean; directoryDoubled: boolean } {
    const hashValue = this.hash(key);
    const directoryIndex = this.getBucketIndex(hashValue);
    const bucketId = this.directory[directoryIndex];
    const bucket = this.buckets.get(bucketId)!;

    // Check for existing key
    for (const entry of bucket.entries) {
      if (entry.key === key) {
        entry.value = value;
        return { success: true, bucketId, split: false, directoryDoubled: false };
      }
    }

    if (bucket.entries.length > 0) this.stats.collisions++;

    // Insert if space available
    if (bucket.entries.length < this.bucketCapacity) {
      bucket.entries.push({ key, value, hash: hashValue });
      return { success: true, bucketId, split: false, directoryDoubled: false };
    }

    // Need to split
    let directoryDoubled = false;

    if (bucket.localDepth === this.globalDepth) {
      // Double directory
      const oldSize = this.directory.length;
      for (let i = 0; i < oldSize; i++) {
        this.directory.push(this.directory[i]);
      }
      this.globalDepth++;
      directoryDoubled = true;
    }

    // Split the bucket
    const newBucketId = this.nextBucketId++;
    const newBucket = this.createBucket(newBucketId, bucket.localDepth + 1);
    bucket.localDepth++;
    this.buckets.set(newBucketId, newBucket);
    this.stats.splits++;

    // Update directory pointers
    const localMask = 1 << (bucket.localDepth - 1);
    for (let i = 0; i < this.directory.length; i++) {
      if (this.directory[i] === bucketId) {
        if (i & localMask) {
          this.directory[i] = newBucketId;
        }
      }
    }

    // Redistribute entries
    const oldEntries = [...bucket.entries];
    bucket.entries = [];

    for (const entry of oldEntries) {
      const idx = this.getBucketIndex(entry.hash);
      const targetBucketId = this.directory[idx];
      const targetBucket = this.buckets.get(targetBucketId)!;
      targetBucket.entries.push(entry);
    }

    // Insert the new entry
    const newIdx = this.getBucketIndex(hashValue);
    const targetBucketId = this.directory[newIdx];
    const targetBucket = this.buckets.get(targetBucketId)!;

    if (targetBucket.entries.length < this.bucketCapacity) {
      targetBucket.entries.push({ key, value, hash: hashValue });
      return { success: true, bucketId: targetBucketId, split: true, directoryDoubled };
    }

    // Recursive split if needed
    return this.insert(key, value);
  }

  lookup(key: K): LookupResult<V> {
    const hashValue = this.hash(key);
    const directoryIndex = this.getBucketIndex(hashValue);
    const bucketId = this.directory[directoryIndex];
    const bucket = this.buckets.get(bucketId)!;

    for (const entry of bucket.entries) {
      if (entry.key === key) {
        return {
          found: true,
          value: entry.value,
          bucketId,
          probeCount: 1,
          hashValue
        };
      }
    }

    return {
      found: false,
      bucketId,
      probeCount: 1,
      hashValue
    };
  }

  delete(key: K): { success: boolean; bucketId: number } {
    const hashValue = this.hash(key);
    const directoryIndex = this.getBucketIndex(hashValue);
    const bucketId = this.directory[directoryIndex];
    const bucket = this.buckets.get(bucketId)!;

    const index = bucket.entries.findIndex(e => e.key === key);
    if (index !== -1) {
      bucket.entries.splice(index, 1);
      return { success: true, bucketId };
    }

    return { success: false, bucketId };
  }

  getStatistics(): HashIndexStats {
    let totalEntries = 0;
    let maxOccupancy = 0;
    let minOccupancy = this.bucketCapacity;

    for (const bucket of this.buckets.values()) {
      totalEntries += bucket.entries.length;
      maxOccupancy = Math.max(maxOccupancy, bucket.entries.length);
      minOccupancy = Math.min(minOccupancy, bucket.entries.length);
    }

    return {
      totalEntries,
      totalBuckets: this.buckets.size,
      bucketCapacity: this.bucketCapacity,
      loadFactor: totalEntries / (this.buckets.size * this.bucketCapacity),
      overflowBuckets: 0,
      collisions: this.stats.collisions,
      avgBucketOccupancy: totalEntries / this.buckets.size,
      maxBucketOccupancy: maxOccupancy,
      minBucketOccupancy: this.buckets.size > 0 ? minOccupancy : 0,
      hashFunction: this.hashFnType,
      scheme: 'extendible',
      globalDepth: this.globalDepth
    };
  }

  getBucketDistribution(): BucketDistribution[] {
    const result: BucketDistribution[] = [];
    for (const bucket of this.buckets.values()) {
      result.push({
        bucketId: bucket.id,
        entryCount: bucket.entries.length,
        occupancyPercent: (bucket.entries.length / this.bucketCapacity) * 100,
        hasOverflow: false,
        localDepth: bucket.localDepth
      });
    }
    return result;
  }

  getDirectory(): { index: number; bucketId: number; pattern: string }[] {
    return this.directory.map((bucketId, index) => ({
      index,
      bucketId,
      pattern: index.toString(2).padStart(this.globalDepth, '0')
    }));
  }
}

// ============================================================================
// LINEAR HASH INDEX
// ============================================================================

class LinearHashIndex<K extends string, V> {
  private buckets: Bucket<K, V>[];
  private level: number;
  private splitPointer: number;
  private bucketCapacity: number;
  private loadFactorThreshold: number;
  private hashFn: (key: string, tableSize: number) => number;
  private hashFnType: HashFunction;
  private stats: { splits: number; collisions: number; overflowBuckets: number };

  constructor(
    initialBuckets: number = 4,
    bucketCapacity: number = 4,
    loadFactorThreshold: number = 0.8,
    hashFnType: HashFunction = 'murmur'
  ) {
    this.level = 0;
    this.splitPointer = 0;
    this.bucketCapacity = bucketCapacity;
    this.loadFactorThreshold = loadFactorThreshold;
    this.hashFn = getHashFunction(hashFnType);
    this.hashFnType = hashFnType;
    this.stats = { splits: 0, collisions: 0, overflowBuckets: 0 };

    this.buckets = [];
    for (let i = 0; i < initialBuckets; i++) {
      this.buckets.push({
        id: i,
        entries: [],
        localDepth: 0
      });
    }
  }

  private getBucketIndex(key: K): number {
    const n = Math.pow(2, this.level);
    let index = this.hashFn(key, n) % (n * (this.buckets.length - this.splitPointer));

    // Adjust for split pointer
    const initialBuckets = this.buckets.length - this.splitPointer;
    if (index < this.splitPointer) {
      // Use next level hash
      index = this.hashFn(key, n * 2) % (n * 2 * initialBuckets);
      if (index >= this.buckets.length) {
        index = index % this.buckets.length;
      }
    }

    return Math.min(index, this.buckets.length - 1);
  }

  private getLoadFactor(): number {
    let totalEntries = 0;
    for (const bucket of this.buckets) {
      totalEntries += bucket.entries.filter(e => !e.deleted).length;
      let overflow = bucket.overflowBucket;
      while (overflow) {
        totalEntries += overflow.entries.filter(e => !e.deleted).length;
        overflow = overflow.overflowBucket;
      }
    }
    return totalEntries / (this.buckets.length * this.bucketCapacity);
  }

  private split(): void {
    const bucketToSplit = this.buckets[this.splitPointer];

    // Create new bucket
    const newBucket: Bucket<K, V> = {
      id: this.buckets.length,
      entries: [],
      localDepth: 0
    };
    this.buckets.push(newBucket);

    // Collect all entries from bucket and overflow chains
    const allEntries: HashEntry<K, V>[] = [...bucketToSplit.entries];
    let overflow = bucketToSplit.overflowBucket;
    while (overflow) {
      allEntries.push(...overflow.entries);
      overflow = overflow.overflowBucket;
    }

    // Clear original bucket
    bucketToSplit.entries = [];
    bucketToSplit.overflowBucket = undefined;

    // Redistribute entries
    for (const entry of allEntries) {
      if (entry.deleted) continue;
      const newIndex = this.getBucketIndex(entry.key as K);
      const targetBucket = this.buckets[newIndex];
      this.insertIntoBucket(targetBucket, entry);
    }

    // Advance split pointer
    this.splitPointer++;
    const n = Math.pow(2, this.level);
    if (this.splitPointer >= n) {
      this.splitPointer = 0;
      this.level++;
    }

    this.stats.splits++;
  }

  private insertIntoBucket(bucket: Bucket<K, V>, entry: HashEntry<K, V>): void {
    if (bucket.entries.length < this.bucketCapacity) {
      bucket.entries.push(entry);
      return;
    }

    // Handle overflow
    let current = bucket;
    while (current.overflowBucket) {
      current = current.overflowBucket;
      if (current.entries.length < this.bucketCapacity) {
        current.entries.push(entry);
        return;
      }
    }

    // Create overflow bucket
    const overflowBucket: Bucket<K, V> = {
      id: -1,  // Overflow buckets don't have regular IDs
      entries: [entry],
      localDepth: 0
    };
    current.overflowBucket = overflowBucket;
    this.stats.overflowBuckets++;
  }

  insert(key: K, value: V): { success: boolean; bucketId: number; split: boolean } {
    const bucketIndex = this.getBucketIndex(key);
    const bucket = this.buckets[bucketIndex];

    // Check for existing key
    let current: Bucket<K, V> | undefined = bucket;
    while (current) {
      for (const entry of current.entries) {
        if (entry.key === key && !entry.deleted) {
          entry.value = value;
          return { success: true, bucketId: bucketIndex, split: false };
        }
      }
      current = current.overflowBucket;
    }

    if (bucket.entries.length > 0) this.stats.collisions++;

    const hashValue = this.hashFn(key, this.buckets.length);
    this.insertIntoBucket(bucket, { key, value, hash: hashValue });

    // Check if split needed
    let didSplit = false;
    if (this.getLoadFactor() > this.loadFactorThreshold) {
      this.split();
      didSplit = true;
    }

    return { success: true, bucketId: bucketIndex, split: didSplit };
  }

  lookup(key: K): LookupResult<V> {
    const bucketIndex = this.getBucketIndex(key);
    const hashValue = this.hashFn(key, this.buckets.length);
    let bucket: Bucket<K, V> | undefined = this.buckets[bucketIndex];
    let probeCount = 1;

    while (bucket) {
      for (const entry of bucket.entries) {
        if (entry.key === key && !entry.deleted) {
          return {
            found: true,
            value: entry.value,
            bucketId: bucketIndex,
            probeCount,
            hashValue
          };
        }
      }
      bucket = bucket.overflowBucket;
      probeCount++;
    }

    return {
      found: false,
      bucketId: bucketIndex,
      probeCount,
      hashValue
    };
  }

  delete(key: K): { success: boolean; bucketId: number } {
    const bucketIndex = this.getBucketIndex(key);
    let bucket: Bucket<K, V> | undefined = this.buckets[bucketIndex];

    while (bucket) {
      for (const entry of bucket.entries) {
        if (entry.key === key && !entry.deleted) {
          entry.deleted = true;
          return { success: true, bucketId: bucketIndex };
        }
      }
      bucket = bucket.overflowBucket;
    }

    return { success: false, bucketId: bucketIndex };
  }

  getStatistics(): HashIndexStats {
    let totalEntries = 0;
    let maxOccupancy = 0;
    let minOccupancy = this.bucketCapacity;
    let overflowCount = 0;

    for (const bucket of this.buckets) {
      let bucketEntries = bucket.entries.filter(e => !e.deleted).length;
      let current = bucket.overflowBucket;
      while (current) {
        bucketEntries += current.entries.filter(e => !e.deleted).length;
        overflowCount++;
        current = current.overflowBucket;
      }
      totalEntries += bucketEntries;
      maxOccupancy = Math.max(maxOccupancy, bucketEntries);
      minOccupancy = Math.min(minOccupancy, bucketEntries);
    }

    return {
      totalEntries,
      totalBuckets: this.buckets.length,
      bucketCapacity: this.bucketCapacity,
      loadFactor: this.getLoadFactor(),
      overflowBuckets: overflowCount,
      collisions: this.stats.collisions,
      avgBucketOccupancy: totalEntries / this.buckets.length,
      maxBucketOccupancy: maxOccupancy,
      minBucketOccupancy: this.buckets.length > 0 ? minOccupancy : 0,
      hashFunction: this.hashFnType,
      scheme: 'linear',
      splitPointer: this.splitPointer,
      level: this.level
    };
  }

  getBucketDistribution(): BucketDistribution[] {
    return this.buckets.map((bucket, index) => {
      let entryCount = bucket.entries.filter(e => !e.deleted).length;
      let hasOverflow = false;
      let current = bucket.overflowBucket;
      while (current) {
        entryCount += current.entries.filter(e => !e.deleted).length;
        hasOverflow = true;
        current = current.overflowBucket;
      }
      return {
        bucketId: index,
        entryCount,
        occupancyPercent: (entryCount / this.bucketCapacity) * 100,
        hasOverflow
      };
    });
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const hashindexTool: UnifiedTool = {
  name: 'hash_index',
  description: 'Database hash index with static, extendible, and linear hashing schemes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'create_index', 'insert', 'lookup', 'delete', 'resize',
          'get_bucket_distribution', 'analyze_performance', 'configure_hash_function',
          'get_statistics', 'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      scheme: {
        type: 'string',
        enum: ['static', 'extendible', 'linear'],
        description: 'Hashing scheme to use'
      },
      hashFunction: {
        type: 'string',
        enum: ['division', 'multiplication', 'murmur', 'fnv1a'],
        description: 'Hash function to use'
      },
      key: {
        type: 'string',
        description: 'Key to insert/lookup/delete'
      },
      value: {
        type: 'string',
        description: 'Value to associate with key'
      },
      numBuckets: {
        type: 'number',
        description: 'Number of initial buckets'
      },
      bucketCapacity: {
        type: 'number',
        description: 'Maximum entries per bucket'
      },
      overflowHandling: {
        type: 'string',
        enum: ['chaining', 'open_addressing'],
        description: 'How to handle bucket overflow'
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

// Global instances
let staticIndex: StaticHashIndex<string, string> | null = null;
let extendibleIndex: ExtendibleHashIndex<string, string> | null = null;
let linearIndex: LinearHashIndex<string, string> | null = null;
let currentScheme: HashingScheme = 'static';

function getIndex(): StaticHashIndex<string, string> | ExtendibleHashIndex<string, string> | LinearHashIndex<string, string> {
  switch (currentScheme) {
    case 'static':
      if (!staticIndex) staticIndex = new StaticHashIndex();
      return staticIndex;
    case 'extendible':
      if (!extendibleIndex) extendibleIndex = new ExtendibleHashIndex();
      return extendibleIndex;
    case 'linear':
      if (!linearIndex) linearIndex = new LinearHashIndex();
      return linearIndex;
  }
}

export async function executehashindex(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'create_index': {
        const scheme: HashingScheme = args.scheme || 'static';
        const hashFunction: HashFunction = args.hashFunction || 'murmur';
        const numBuckets = args.numBuckets || 16;
        const bucketCapacity = args.bucketCapacity || 4;
        const overflowHandling: OverflowHandling = args.overflowHandling || 'chaining';

        currentScheme = scheme;

        switch (scheme) {
          case 'static':
            staticIndex = new StaticHashIndex(numBuckets, bucketCapacity, hashFunction, overflowHandling);
            break;
          case 'extendible':
            extendibleIndex = new ExtendibleHashIndex(bucketCapacity, hashFunction);
            break;
          case 'linear':
            linearIndex = new LinearHashIndex(numBuckets, bucketCapacity, 0.8, hashFunction);
            break;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'create_index',
            scheme,
            hashFunction,
            configuration: {
              numBuckets: scheme === 'extendible' ? 2 : numBuckets,
              bucketCapacity,
              overflowHandling: scheme === 'static' ? overflowHandling : 'N/A'
            },
            schemeDescription: {
              static: 'Fixed number of buckets. Uses overflow chains or open addressing.',
              extendible: 'Directory doubles as needed. Buckets split individually.',
              linear: 'Gradual splitting. No directory. Good for concurrent access.'
            }[scheme],
            message: `Created ${scheme} hash index with ${hashFunction} hash function`
          }, null, 2)
        };
      }

      case 'insert': {
        const key = args.key || 'key1';
        const value = args.value || 'value1';
        const index = getIndex();

        const result = index.insert(key, value);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'insert',
            key,
            value,
            scheme: currentScheme,
            ...result,
            stats: index.getStatistics()
          }, null, 2)
        };
      }

      case 'lookup': {
        const key = args.key || 'key1';
        const index = getIndex();

        const result = index.lookup(key);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'lookup',
            key,
            scheme: currentScheme,
            ...result,
            explanation: result.found
              ? `Found in bucket ${result.bucketId} after ${result.probeCount} probe(s)`
              : `Not found after ${result.probeCount} probe(s)`
          }, null, 2)
        };
      }

      case 'delete': {
        const key = args.key || 'key1';
        const index = getIndex();

        const result = index.delete(key);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'delete',
            key,
            scheme: currentScheme,
            ...result,
            stats: index.getStatistics()
          }, null, 2)
        };
      }

      case 'get_bucket_distribution': {
        const index = getIndex();
        const distribution = index.getBucketDistribution();

        // Create histogram
        const histogram: Record<string, number> = {};
        for (const bucket of distribution) {
          const range = bucket.entryCount <= 1 ? '0-1' :
                        bucket.entryCount <= 2 ? '2' :
                        bucket.entryCount <= 3 ? '3' :
                        bucket.entryCount <= 4 ? '4' : '5+';
          histogram[range] = (histogram[range] || 0) + 1;
        }

        // Add directory info for extendible
        let directoryInfo;
        if (currentScheme === 'extendible' && extendibleIndex) {
          directoryInfo = extendibleIndex.getDirectory();
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_bucket_distribution',
            scheme: currentScheme,
            distribution,
            histogram,
            directoryInfo,
            stats: index.getStatistics()
          }, null, 2)
        };
      }

      case 'analyze_performance': {
        const index = getIndex();
        const stats = index.getStatistics();

        // Calculate performance metrics
        const avgProbesPerLookup = 1 + (stats.overflowBuckets / stats.totalBuckets);
        const collisionRate = stats.totalEntries > 0 ? stats.collisions / stats.totalEntries : 0;
        const storageEfficiency = stats.loadFactor;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_performance',
            scheme: currentScheme,
            metrics: {
              avgProbesPerLookup: avgProbesPerLookup.toFixed(2),
              collisionRate: (collisionRate * 100).toFixed(2) + '%',
              storageEfficiency: (storageEfficiency * 100).toFixed(2) + '%',
              loadFactor: stats.loadFactor.toFixed(3),
              bucketUtilization: {
                average: stats.avgBucketOccupancy.toFixed(2),
                max: stats.maxBucketOccupancy,
                min: stats.minBucketOccupancy
              }
            },
            recommendations: [
              stats.loadFactor > 0.7 ? 'Consider resizing - load factor is high' : null,
              stats.overflowBuckets > stats.totalBuckets * 0.1 ? 'Many overflow buckets - consider different scheme' : null,
              collisionRate > 0.5 ? 'High collision rate - consider different hash function' : null
            ].filter(Boolean),
            stats
          }, null, 2)
        };
      }

      case 'configure_hash_function': {
        const hashFunction: HashFunction = args.hashFunction || 'murmur';

        // Recreate index with new hash function
        const scheme = currentScheme;
        const stats = getIndex().getStatistics();

        switch (scheme) {
          case 'static':
            staticIndex = new StaticHashIndex(stats.totalBuckets, stats.bucketCapacity, hashFunction);
            break;
          case 'extendible':
            extendibleIndex = new ExtendibleHashIndex(stats.bucketCapacity, hashFunction);
            break;
          case 'linear':
            linearIndex = new LinearHashIndex(4, stats.bucketCapacity, 0.8, hashFunction);
            break;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'configure_hash_function',
            hashFunction,
            hashFunctionDetails: {
              division: 'Simple modulo operation. Fast but can have clustering.',
              multiplication: 'Knuth multiplicative method. Better distribution.',
              murmur: 'MurmurHash-inspired. Good balance of speed and distribution.',
              fnv1a: 'FNV-1a hash. Simple, fast, good for strings.'
            }[hashFunction],
            note: 'Index recreated - previous entries cleared'
          }, null, 2)
        };
      }

      case 'get_statistics': {
        const index = getIndex();
        const stats = index.getStatistics();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_statistics',
            ...stats
          }, null, 2)
        };
      }

      case 'demo': {
        const results: Record<string, unknown>[] = [];

        // Demo all three schemes
        const schemes: HashingScheme[] = ['static', 'extendible', 'linear'];
        const testData = [
          { key: 'user:001', value: 'Alice' },
          { key: 'user:002', value: 'Bob' },
          { key: 'user:003', value: 'Charlie' },
          { key: 'user:004', value: 'Diana' },
          { key: 'user:005', value: 'Eve' },
          { key: 'user:006', value: 'Frank' },
          { key: 'user:007', value: 'Grace' },
          { key: 'user:008', value: 'Henry' }
        ];

        for (const scheme of schemes) {
          currentScheme = scheme;

          switch (scheme) {
            case 'static':
              staticIndex = new StaticHashIndex(4, 2, 'murmur', 'chaining');
              break;
            case 'extendible':
              extendibleIndex = new ExtendibleHashIndex(2, 'murmur');
              break;
            case 'linear':
              linearIndex = new LinearHashIndex(2, 2, 0.75, 'murmur');
              break;
          }

          const index = getIndex();
          const insertResults: Array<{ key: string; result: unknown }> = [];

          for (const entry of testData) {
            const result = index.insert(entry.key, entry.value);
            insertResults.push({ key: entry.key, result });
          }

          const lookupResult = index.lookup('user:005');
          const stats = index.getStatistics();
          const distribution = index.getBucketDistribution();

          results.push({
            scheme,
            insertResults: insertResults.slice(0, 3), // Show first 3
            sampleLookup: { key: 'user:005', ...lookupResult },
            stats,
            bucketDistribution: distribution.slice(0, 5) // Show first 5 buckets
          });
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Comparison of three hashing schemes with same data',
            testDataCount: testData.length,
            schemeComparisons: results,
            summary: {
              static: 'Fixed buckets, handles overflow with chains. Simple but may need manual resize.',
              extendible: 'Dynamic directory, only affected buckets split. Good for unpredictable growth.',
              linear: 'Gradual splitting without directory. Good for concurrent access.'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Hash Index',
            description: 'Database hash index implementation with multiple hashing schemes',
            schemes: {
              static: {
                description: 'Fixed number of buckets with overflow handling',
                pros: ['Simple implementation', 'Predictable memory usage'],
                cons: ['Requires manual resizing', 'Performance degrades with high load'],
                overflowHandling: ['chaining (linked list)', 'open_addressing (linear probing)']
              },
              extendible: {
                description: 'Dynamic hashing with directory that doubles as needed',
                pros: ['No overflow chains', 'Efficient space usage', 'Only affected buckets split'],
                cons: ['Directory overhead', 'Complex implementation'],
                features: ['Global depth', 'Local depth per bucket', 'Directory doubling']
              },
              linear: {
                description: 'Gradual splitting based on load factor',
                pros: ['No directory', 'Smooth growth', 'Good for concurrent access'],
                cons: ['Overflow chains possible', 'Split order not based on load'],
                features: ['Level-based hashing', 'Split pointer', 'Automatic splitting']
              }
            },
            hashFunctions: {
              division: 'h(k) = k mod m',
              multiplication: 'h(k) = floor(m * (k * A mod 1))',
              murmur: 'MurmurHash family - fast and good distribution',
              fnv1a: 'Fowler-Noll-Vo hash - simple and effective'
            },
            operations: [
              'create_index - Create new hash index',
              'insert - Add key-value pair',
              'lookup - Find value by key',
              'delete - Remove entry',
              'get_bucket_distribution - View bucket occupancy',
              'analyze_performance - Performance metrics',
              'configure_hash_function - Change hash function'
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
                name: 'Create static hash index',
                call: {
                  operation: 'create_index',
                  scheme: 'static',
                  numBuckets: 16,
                  bucketCapacity: 4,
                  hashFunction: 'murmur'
                }
              },
              {
                name: 'Create extendible hash index',
                call: {
                  operation: 'create_index',
                  scheme: 'extendible',
                  bucketCapacity: 4
                }
              },
              {
                name: 'Create linear hash index',
                call: {
                  operation: 'create_index',
                  scheme: 'linear',
                  numBuckets: 4,
                  bucketCapacity: 4
                }
              },
              {
                name: 'Insert entry',
                call: {
                  operation: 'insert',
                  key: 'employee:12345',
                  value: '{"name":"John","dept":"Engineering"}'
                }
              },
              {
                name: 'Lookup entry',
                call: {
                  operation: 'lookup',
                  key: 'employee:12345'
                }
              },
              {
                name: 'View bucket distribution',
                call: { operation: 'get_bucket_distribution' }
              },
              {
                name: 'Analyze performance',
                call: { operation: 'analyze_performance' }
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

export function ishashindexAvailable(): boolean { return true; }
