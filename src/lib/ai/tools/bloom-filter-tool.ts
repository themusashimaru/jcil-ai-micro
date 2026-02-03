/**
 * BLOOM-FILTER TOOL
 * Probabilistic data structure for space-efficient membership testing
 * Supports standard and counting Bloom filters with optimal parameter calculation
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface BloomFilterStats {
  size: number;           // Number of bits
  hashCount: number;      // Number of hash functions
  insertedCount: number;  // Approximate number of inserted elements
  fillRatio: number;      // Proportion of bits set to 1
  falsePositiveRate: number;  // Current estimated FPR
}

export interface BloomFilterConfig {
  expectedElements: number;
  falsePositiveRate: number;
  size?: number;
  hashCount?: number;
}

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

/**
 * Simple hash function using string representation
 */
function hash1(item: string): number {
  let hash = 0;
  for (let i = 0; i < item.length; i++) {
    const char = item.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Second hash function (djb2 variant)
 */
function hash2(item: string): number {
  let hash = 5381;
  for (let i = 0; i < item.length; i++) {
    hash = ((hash << 5) + hash) ^ item.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Generate k hash values using double hashing
 * h_i(x) = h1(x) + i * h2(x)
 */
function getHashes(item: string, k: number, m: number): number[] {
  const h1 = hash1(item);
  const h2 = hash2(item);
  const hashes: number[] = [];

  for (let i = 0; i < k; i++) {
    hashes.push(Math.abs((h1 + i * h2) % m));
  }

  return hashes;
}

// ============================================================================
// BLOOM FILTER IMPLEMENTATIONS
// ============================================================================

/**
 * Standard Bloom Filter
 */
class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashCount: number;
  private insertedCount: number;

  constructor(size: number, hashCount: number) {
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
    this.insertedCount = 0;
  }

  /**
   * Create optimal Bloom filter for given parameters
   */
  static createOptimal(expectedElements: number, falsePositiveRate: number): BloomFilter {
    // m = -n * ln(p) / (ln(2)^2)
    const m = Math.ceil(-expectedElements * Math.log(falsePositiveRate) / (Math.LN2 * Math.LN2));
    // k = (m/n) * ln(2)
    const k = Math.round((m / expectedElements) * Math.LN2);
    return new BloomFilter(m, Math.max(1, k));
  }

  private getBit(index: number): boolean {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    return (this.bits[byteIndex] & (1 << bitIndex)) !== 0;
  }

  private setBit(index: number): void {
    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    this.bits[byteIndex] |= (1 << bitIndex);
  }

  /**
   * Insert an element
   */
  insert(item: string): { hashes: number[]; newBitsSet: number } {
    const hashes = getHashes(item, this.hashCount, this.size);
    let newBitsSet = 0;

    for (const hash of hashes) {
      if (!this.getBit(hash)) {
        this.setBit(hash);
        newBitsSet++;
      }
    }

    this.insertedCount++;
    return { hashes, newBitsSet };
  }

  /**
   * Check if element might be in set
   */
  query(item: string): { mightExist: boolean; hashes: number[]; allBitsSet: boolean[] } {
    const hashes = getHashes(item, this.hashCount, this.size);
    const allBitsSet = hashes.map(h => this.getBit(h));
    const mightExist = allBitsSet.every(b => b);

    return { mightExist, hashes, allBitsSet };
  }

  /**
   * Get current statistics
   */
  getStats(): BloomFilterStats {
    let bitsSet = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.getBit(i)) bitsSet++;
    }

    const fillRatio = bitsSet / this.size;
    // FPR = (1 - e^(-kn/m))^k ≈ fillRatio^k
    const falsePositiveRate = Math.pow(fillRatio, this.hashCount);

    return {
      size: this.size,
      hashCount: this.hashCount,
      insertedCount: this.insertedCount,
      fillRatio,
      falsePositiveRate
    };
  }

  /**
   * Get bit array visualization (first 100 bits)
   */
  visualize(): string {
    let viz = '';
    const limit = Math.min(100, this.size);
    for (let i = 0; i < limit; i++) {
      viz += this.getBit(i) ? '1' : '0';
      if ((i + 1) % 10 === 0) viz += ' ';
    }
    if (this.size > 100) viz += '...';
    return viz;
  }

  /**
   * Union two Bloom filters
   */
  union(other: BloomFilter): BloomFilter {
    if (this.size !== other.size || this.hashCount !== other.hashCount) {
      throw new Error('Bloom filters must have same size and hash count');
    }

    const result = new BloomFilter(this.size, this.hashCount);
    for (let i = 0; i < this.bits.length; i++) {
      result.bits[i] = this.bits[i] | other.bits[i];
    }
    result.insertedCount = this.insertedCount + other.insertedCount;
    return result;
  }

  /**
   * Intersection of two Bloom filters
   */
  intersection(other: BloomFilter): BloomFilter {
    if (this.size !== other.size || this.hashCount !== other.hashCount) {
      throw new Error('Bloom filters must have same size and hash count');
    }

    const result = new BloomFilter(this.size, this.hashCount);
    for (let i = 0; i < this.bits.length; i++) {
      result.bits[i] = this.bits[i] & other.bits[i];
    }
    return result;
  }
}

/**
 * Counting Bloom Filter (supports deletion)
 */
class CountingBloomFilter {
  private counters: Uint8Array;
  private size: number;
  private hashCount: number;
  private insertedCount: number;
  private maxCount: number;

  constructor(size: number, hashCount: number, counterBits: number = 4) {
    this.size = size;
    this.hashCount = hashCount;
    this.counters = new Uint8Array(size);
    this.insertedCount = 0;
    this.maxCount = (1 << counterBits) - 1;
  }

  static createOptimal(expectedElements: number, falsePositiveRate: number): CountingBloomFilter {
    const m = Math.ceil(-expectedElements * Math.log(falsePositiveRate) / (Math.LN2 * Math.LN2));
    const k = Math.round((m / expectedElements) * Math.LN2);
    return new CountingBloomFilter(m, Math.max(1, k));
  }

  /**
   * Insert an element
   */
  insert(item: string): { hashes: number[]; incremented: boolean[] } {
    const hashes = getHashes(item, this.hashCount, this.size);
    const incremented: boolean[] = [];

    for (const hash of hashes) {
      if (this.counters[hash] < this.maxCount) {
        this.counters[hash]++;
        incremented.push(true);
      } else {
        incremented.push(false); // Counter overflow
      }
    }

    this.insertedCount++;
    return { hashes, incremented };
  }

  /**
   * Delete an element
   */
  delete(item: string): { success: boolean; hashes: number[]; decremented: boolean[] } {
    const queryResult = this.query(item);
    if (!queryResult.mightExist) {
      return { success: false, hashes: queryResult.hashes, decremented: [] };
    }

    const hashes = queryResult.hashes;
    const decremented: boolean[] = [];

    for (const hash of hashes) {
      if (this.counters[hash] > 0) {
        this.counters[hash]--;
        decremented.push(true);
      } else {
        decremented.push(false);
      }
    }

    this.insertedCount = Math.max(0, this.insertedCount - 1);
    return { success: true, hashes, decremented };
  }

  /**
   * Query for membership
   */
  query(item: string): { mightExist: boolean; hashes: number[]; counters: number[] } {
    const hashes = getHashes(item, this.hashCount, this.size);
    const counters = hashes.map(h => this.counters[h]);
    const mightExist = counters.every(c => c > 0);

    return { mightExist, hashes, counters };
  }

  /**
   * Get statistics
   */
  getStats(): BloomFilterStats & { nonZeroCounters: number } {
    let nonZero = 0;
    for (let i = 0; i < this.size; i++) {
      if (this.counters[i] > 0) nonZero++;
    }

    const fillRatio = nonZero / this.size;
    const falsePositiveRate = Math.pow(fillRatio, this.hashCount);

    return {
      size: this.size,
      hashCount: this.hashCount,
      insertedCount: this.insertedCount,
      fillRatio,
      falsePositiveRate,
      nonZeroCounters: nonZero
    };
  }
}

/**
 * Calculate optimal Bloom filter parameters
 */
function calculateOptimalParameters(
  expectedElements: number,
  targetFPR: number
): {
  optimalSize: number;
  optimalHashCount: number;
  bitsPerElement: number;
  actualFPR: number;
} {
  // m = -n * ln(p) / (ln(2)^2)
  const m = Math.ceil(-expectedElements * Math.log(targetFPR) / (Math.LN2 * Math.LN2));
  // k = (m/n) * ln(2)
  const k = Math.round((m / expectedElements) * Math.LN2);
  // Actual FPR = (1 - e^(-kn/m))^k
  const actualFPR = Math.pow(1 - Math.exp(-k * expectedElements / m), k);

  return {
    optimalSize: m,
    optimalHashCount: Math.max(1, k),
    bitsPerElement: m / expectedElements,
    actualFPR
  };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const bloomfilterTool: UnifiedTool = {
  name: 'bloom_filter',
  description: 'Probabilistic data structure for space-efficient set membership testing with configurable false positive rate',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['create', 'insert', 'query', 'delete', 'stats', 'calculate', 'union', 'demo', 'info', 'examples'],
        description: 'Operation to perform'
      },
      type: {
        type: 'string',
        enum: ['standard', 'counting'],
        description: 'Type of Bloom filter (standard or counting for deletion support)'
      },
      expectedElements: {
        type: 'number',
        description: 'Expected number of elements to insert'
      },
      falsePositiveRate: {
        type: 'number',
        description: 'Target false positive rate (0-1)'
      },
      size: {
        type: 'number',
        description: 'Bit array size (optional, calculated if not provided)'
      },
      hashCount: {
        type: 'number',
        description: 'Number of hash functions (optional, calculated if not provided)'
      },
      item: {
        type: 'string',
        description: 'Item to insert or query'
      },
      items: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple items to insert or query'
      }
    },
    required: ['operation']
  }
};

// Global filter instances for demo
let standardFilter: BloomFilter | null = null;
let countingFilter: CountingBloomFilter | null = null;

export async function executebloomfilter(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'create': {
        const type = args.type || 'standard';
        const expectedElements = args.expectedElements || 1000;
        const falsePositiveRate = args.falsePositiveRate || 0.01;

        const params = calculateOptimalParameters(expectedElements, falsePositiveRate);

        if (type === 'counting') {
          countingFilter = CountingBloomFilter.createOptimal(expectedElements, falsePositiveRate);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'create',
              type: 'counting',
              parameters: {
                expectedElements,
                targetFalsePositiveRate: falsePositiveRate,
                size: params.optimalSize,
                hashCount: params.optimalHashCount,
                bitsPerElement: params.bitsPerElement.toFixed(2),
                actualFPR: params.actualFPR.toExponential(4)
              },
              features: ['insert', 'query', 'delete (unique to counting)'],
              message: 'Counting Bloom filter created'
            }, null, 2)
          };
        } else {
          standardFilter = BloomFilter.createOptimal(expectedElements, falsePositiveRate);
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'create',
              type: 'standard',
              parameters: {
                expectedElements,
                targetFalsePositiveRate: falsePositiveRate,
                size: params.optimalSize,
                hashCount: params.optimalHashCount,
                bitsPerElement: params.bitsPerElement.toFixed(2),
                actualFPR: params.actualFPR.toExponential(4)
              },
              features: ['insert', 'query'],
              message: 'Standard Bloom filter created'
            }, null, 2)
          };
        }
      }

      case 'insert': {
        const items: string[] = args.items || (args.item ? [args.item] : ['apple', 'banana', 'cherry', 'date', 'elderberry']);
        const type = args.type || 'standard';

        if (type === 'counting') {
          if (!countingFilter) {
            countingFilter = CountingBloomFilter.createOptimal(1000, 0.01);
          }

          const results = items.map(item => ({
            item,
            ...countingFilter!.insert(item)
          }));

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'insert',
              type: 'counting',
              inserted: results,
              stats: countingFilter.getStats()
            }, null, 2)
          };
        } else {
          if (!standardFilter) {
            standardFilter = BloomFilter.createOptimal(1000, 0.01);
          }

          const results = items.map(item => ({
            item,
            ...standardFilter!.insert(item)
          }));

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'insert',
              type: 'standard',
              inserted: results,
              stats: standardFilter.getStats(),
              bitVisualization: standardFilter.visualize()
            }, null, 2)
          };
        }
      }

      case 'query': {
        const items: string[] = args.items || (args.item ? [args.item] : ['apple', 'banana', 'fig', 'grape']);
        const type = args.type || 'standard';

        if (type === 'counting') {
          if (!countingFilter) {
            return {
              toolCallId: id,
              content: JSON.stringify({
                error: 'No counting filter exists. Use create first.'
              }, null, 2),
              isError: true
            };
          }

          const results = items.map(item => ({
            item,
            ...countingFilter!.query(item)
          }));

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'query',
              type: 'counting',
              results,
              explanation: 'mightExist=true means element MAY be in set (could be false positive). mightExist=false means element is DEFINITELY NOT in set.'
            }, null, 2)
          };
        } else {
          if (!standardFilter) {
            return {
              toolCallId: id,
              content: JSON.stringify({
                error: 'No standard filter exists. Use create first.'
              }, null, 2),
              isError: true
            };
          }

          const results = items.map(item => ({
            item,
            ...standardFilter!.query(item)
          }));

          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'query',
              type: 'standard',
              results,
              explanation: 'mightExist=true means element MAY be in set (could be false positive). mightExist=false means element is DEFINITELY NOT in set.'
            }, null, 2)
          };
        }
      }

      case 'delete': {
        const item = args.item || 'apple';

        if (!countingFilter) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'Deletion requires a counting Bloom filter. Create one with type: "counting".'
            }, null, 2),
            isError: true
          };
        }

        const result = countingFilter.delete(item);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'delete',
            item,
            ...result,
            stats: countingFilter.getStats(),
            note: 'Deletion only works with counting Bloom filters'
          }, null, 2)
        };
      }

      case 'stats': {
        const type = args.type || 'standard';

        if (type === 'counting' && countingFilter) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'stats',
              type: 'counting',
              statistics: countingFilter.getStats()
            }, null, 2)
          };
        } else if (standardFilter) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'stats',
              type: 'standard',
              statistics: standardFilter.getStats(),
              bitVisualization: standardFilter.visualize()
            }, null, 2)
          };
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'No filter exists. Use create first.'
          }, null, 2),
          isError: true
        };
      }

      case 'calculate': {
        const expectedElements = args.expectedElements || 10000;
        const falsePositiveRate = args.falsePositiveRate || 0.01;

        const params = calculateOptimalParameters(expectedElements, falsePositiveRate);

        // Calculate for different FPRs
        const comparisons = [0.1, 0.01, 0.001, 0.0001].map(fpr => ({
          targetFPR: fpr,
          ...calculateOptimalParameters(expectedElements, fpr),
          memoryBytes: Math.ceil(calculateOptimalParameters(expectedElements, fpr).optimalSize / 8)
        }));

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'calculate',
            input: {
              expectedElements,
              targetFalsePositiveRate: falsePositiveRate
            },
            optimalParameters: {
              bitArraySize: params.optimalSize,
              numberOfHashFunctions: params.optimalHashCount,
              bitsPerElement: params.bitsPerElement.toFixed(2),
              actualFPR: params.actualFPR.toExponential(4),
              memoryBytes: Math.ceil(params.optimalSize / 8),
              memoryKB: (params.optimalSize / 8 / 1024).toFixed(2)
            },
            fprComparison: comparisons,
            formulas: {
              optimalSize: 'm = -n * ln(p) / ln(2)²',
              optimalHashes: 'k = (m/n) * ln(2)',
              actualFPR: 'p = (1 - e^(-kn/m))^k'
            }
          }, null, 2)
        };
      }

      case 'demo': {
        // Create a demo showing false positives
        const filter = BloomFilter.createOptimal(100, 0.1); // 10% FPR for demo

        // Insert some items
        const inserted = ['cat', 'dog', 'bird', 'fish', 'rabbit'];
        for (const item of inserted) {
          filter.insert(item);
        }

        // Query both inserted and non-inserted items
        const queries = ['cat', 'dog', 'elephant', 'tiger', 'bird', 'snake', 'fish', 'whale'];
        const results = queries.map(item => {
          const result = filter.query(item);
          const wasInserted = inserted.includes(item);
          const isFalsePositive = result.mightExist && !wasInserted;
          return {
            item,
            wasInserted,
            mightExist: result.mightExist,
            isFalsePositive,
            verdict: wasInserted
              ? (result.mightExist ? 'TRUE POSITIVE' : 'FALSE NEGATIVE (impossible!)')
              : (result.mightExist ? 'FALSE POSITIVE' : 'TRUE NEGATIVE')
          };
        });

        const falsePositives = results.filter(r => r.isFalsePositive).length;
        const trueNegatives = results.filter(r => !r.wasInserted && !r.mightExist).length;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Demonstration of Bloom filter behavior with intentionally high FPR',
            filterParameters: filter.getStats(),
            insertedItems: inserted,
            queryResults: results,
            summary: {
              falsePositives,
              trueNegatives,
              observedFPR: falsePositives / queries.filter(q => !inserted.includes(q)).length,
              note: 'False negatives are IMPOSSIBLE in Bloom filters - if item was inserted, query will always return true'
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Bloom Filter',
            description: 'Space-efficient probabilistic data structure for set membership testing',
            properties: {
              noFalseNegatives: 'If query returns false, element is DEFINITELY NOT in set',
              possibleFalsePositives: 'If query returns true, element MIGHT be in set',
              spaceEfficient: 'Uses ~10 bits per element for 1% FPR',
              noStorage: 'Does not store actual elements, only hashes'
            },
            types: {
              standard: {
                description: 'Basic Bloom filter',
                operations: ['insert', 'query'],
                canDelete: false
              },
              counting: {
                description: 'Bloom filter with counters instead of bits',
                operations: ['insert', 'query', 'delete'],
                canDelete: true,
                tradeoff: 'Uses more memory (typically 4 bits per counter)'
              }
            },
            applications: [
              'Database query optimization',
              'Web caching',
              'Spam filtering',
              'Network routers (IP lookup)',
              'Cryptocurrency (Bitcoin SPV)',
              'Spell checkers',
              'CDN content lookup'
            ],
            complexity: {
              insert: 'O(k) where k is number of hash functions',
              query: 'O(k)',
              space: 'O(m) where m is bit array size'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Create standard Bloom filter',
                call: {
                  operation: 'create',
                  type: 'standard',
                  expectedElements: 10000,
                  falsePositiveRate: 0.01
                }
              },
              {
                name: 'Create counting Bloom filter',
                call: {
                  operation: 'create',
                  type: 'counting',
                  expectedElements: 5000,
                  falsePositiveRate: 0.001
                }
              },
              {
                name: 'Insert items',
                call: {
                  operation: 'insert',
                  items: ['user123', 'user456', 'user789']
                }
              },
              {
                name: 'Query items',
                call: {
                  operation: 'query',
                  items: ['user123', 'user999']
                }
              },
              {
                name: 'Delete item (counting only)',
                call: {
                  operation: 'delete',
                  item: 'user456'
                }
              },
              {
                name: 'Calculate optimal parameters',
                call: {
                  operation: 'calculate',
                  expectedElements: 1000000,
                  falsePositiveRate: 0.001
                }
              },
              {
                name: 'Demo with false positives',
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

export function isbloomfilterAvailable(): boolean { return true; }
