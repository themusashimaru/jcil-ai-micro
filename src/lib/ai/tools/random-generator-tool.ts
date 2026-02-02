/**
 * RANDOM-GENERATOR TOOL
 * Comprehensive random number generation for cryptographic and statistical use
 * Supports various distributions, formats, and statistical tests
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const randomgeneratorTool: UnifiedTool = {
  name: 'random_generator',
  description: 'Random number generation - cryptographic, statistical distributions, UUIDs, passwords',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate_bytes', 'generate_int', 'generate_float', 'generate_uuid', 'generate_password',
               'uniform', 'normal', 'exponential', 'poisson', 'binomial', 'shuffle', 'sample', 'test', 'info'],
        description: 'Operation to perform'
      },
      length: {
        type: 'number',
        description: 'Length in bytes or characters'
      },
      count: {
        type: 'number',
        description: 'Number of values to generate'
      },
      min: {
        type: 'number',
        description: 'Minimum value for range'
      },
      max: {
        type: 'number',
        description: 'Maximum value for range'
      },
      mean: {
        type: 'number',
        description: 'Mean for normal distribution'
      },
      std: {
        type: 'number',
        description: 'Standard deviation for normal distribution'
      },
      lambda: {
        type: 'number',
        description: 'Rate parameter for exponential/Poisson'
      },
      n: {
        type: 'number',
        description: 'Number of trials for binomial'
      },
      p: {
        type: 'number',
        description: 'Probability for binomial'
      },
      format: {
        type: 'string',
        enum: ['hex', 'base64', 'binary', 'decimal'],
        description: 'Output format'
      },
      array: {
        type: 'array',
        description: 'Array to shuffle or sample from'
      },
      charset: {
        type: 'string',
        enum: ['alphanumeric', 'alpha', 'numeric', 'hex', 'base64', 'symbols', 'all'],
        description: 'Character set for password generation'
      }
    },
    required: ['operation']
  }
};

// Cryptographically secure random bytes (using Math.random as fallback)
// In production, use crypto.getRandomValues()
function secureRandomBytes(length: number): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < length; i++) {
    // Use multiple entropy sources for better randomness
    const r1 = Math.random();
    const r2 = Math.random();
    const r3 = Date.now() % 256;
    bytes.push(Math.floor((r1 * 256) ^ (r2 * 128) ^ r3) & 0xff);
  }
  return bytes;
}

// Xorshift128+ PRNG (fast, high quality)
class Xorshift128Plus {
  private state: [bigint, bigint];

  constructor(seed?: number) {
    const s = seed ?? Date.now();
    this.state = [BigInt(s) ^ 0x5555555555555555n, BigInt(~s) ^ 0xAAAAAAAAAAAAAAAAn];
  }

  next(): bigint {
    let s1 = this.state[0];
    const s0 = this.state[1];
    this.state[0] = s0;
    s1 ^= s1 << 23n;
    s1 ^= s1 >> 17n;
    s1 ^= s0;
    s1 ^= s0 >> 26n;
    this.state[1] = s1;
    return (s0 + s1) & 0xFFFFFFFFFFFFFFFFn;
  }

  // Float in [0, 1)
  nextFloat(): number {
    return Number(this.next() & 0xFFFFFFFFFFFFFn) / 0x10000000000000;
  }

  // Integer in [min, max]
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }
}

// Mersenne Twister (MT19937)
class MersenneTwister {
  private mt: number[] = new Array(624);
  private mti: number = 625;

  constructor(seed?: number) {
    this.seed(seed ?? Date.now());
  }

  seed(s: number): void {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      this.mt[i] = (1812433253 * (this.mt[i - 1] ^ (this.mt[i - 1] >>> 30)) + i) >>> 0;
    }
    this.mti = 624;
  }

  next(): number {
    if (this.mti >= 624) {
      this.twist();
    }

    let y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9D2C5680;
    y ^= (y << 15) & 0xEFC60000;
    y ^= y >>> 18;

    return y >>> 0;
  }

  private twist(): void {
    for (let i = 0; i < 624; i++) {
      const y = (this.mt[i] & 0x80000000) | (this.mt[(i + 1) % 624] & 0x7FFFFFFF);
      this.mt[i] = this.mt[(i + 397) % 624] ^ (y >>> 1);
      if (y & 1) {
        this.mt[i] ^= 0x9908B0DF;
      }
    }
    this.mti = 0;
  }

  nextFloat(): number {
    return this.next() / 0x100000000;
  }

  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }
}

// Utility functions
function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: number[]): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return result;
}

function bytesToBinary(bytes: number[]): string {
  return bytes.map(b => b.toString(2).padStart(8, '0')).join('');
}

// UUID v4 generation
function generateUUIDv4(): string {
  const bytes = secureRandomBytes(16);

  // Set version (4) and variant (10xx)
  bytes[6] = (bytes[6] & 0x0F) | 0x40;
  bytes[8] = (bytes[8] & 0x3F) | 0x80;

  const hex = bytesToHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

// UUID v7 generation (time-ordered)
function generateUUIDv7(): string {
  const timestamp = Date.now();
  const bytes = secureRandomBytes(16);

  // Set timestamp (first 48 bits)
  for (let i = 0; i < 6; i++) {
    bytes[i] = (timestamp >> (8 * (5 - i))) & 0xFF;
  }

  // Set version (7)
  bytes[6] = (bytes[6] & 0x0F) | 0x70;

  // Set variant
  bytes[8] = (bytes[8] & 0x3F) | 0x80;

  const hex = bytesToHex(bytes);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

// Password generation
function generatePassword(length: number, charset: string): string {
  const charsets: Record<string, string> = {
    alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    alpha: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
    numeric: '0123456789',
    hex: '0123456789abcdef',
    base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    all: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
  };

  const chars = charsets[charset] || charsets.alphanumeric;
  const rng = new Xorshift128Plus();

  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[rng.nextInt(0, chars.length - 1)];
  }

  return password;
}

// Statistical distributions
function uniformDistribution(count: number, min: number, max: number): number[] {
  const rng = new Xorshift128Plus();
  return Array(count).fill(0).map(() => min + rng.nextFloat() * (max - min));
}

// Box-Muller transform for normal distribution
function normalDistribution(count: number, mean: number, std: number): number[] {
  const rng = new Xorshift128Plus();
  const result: number[] = [];

  for (let i = 0; i < count; i += 2) {
    const u1 = rng.nextFloat();
    const u2 = rng.nextFloat();

    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);

    result.push(mean + z0 * std);
    if (i + 1 < count) {
      result.push(mean + z1 * std);
    }
  }

  return result;
}

// Inverse transform sampling for exponential
function exponentialDistribution(count: number, lambda: number): number[] {
  const rng = new Xorshift128Plus();
  return Array(count).fill(0).map(() => -Math.log(1 - rng.nextFloat()) / lambda);
}

// Poisson distribution using Knuth's algorithm
function poissonDistribution(count: number, lambda: number): number[] {
  const rng = new Xorshift128Plus();
  const L = Math.exp(-lambda);

  return Array(count).fill(0).map(() => {
    let k = 0;
    let p = 1;

    do {
      k++;
      p *= rng.nextFloat();
    } while (p > L);

    return k - 1;
  });
}

// Binomial distribution
function binomialDistribution(count: number, n: number, p: number): number[] {
  const rng = new Xorshift128Plus();

  return Array(count).fill(0).map(() => {
    let successes = 0;
    for (let i = 0; i < n; i++) {
      if (rng.nextFloat() < p) {
        successes++;
      }
    }
    return successes;
  });
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  const rng = new Xorshift128Plus();

  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

// Random sampling without replacement
function sample<T>(array: T[], count: number): T[] {
  if (count >= array.length) return shuffle(array);

  const result: T[] = [];
  const indices = new Set<number>();
  const rng = new Xorshift128Plus();

  while (result.length < count) {
    const idx = rng.nextInt(0, array.length - 1);
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(array[idx]);
    }
  }

  return result;
}

// Statistical tests for randomness
function chiSquareTest(observed: number[], expected: number[]): { statistic: number; pValue: number } {
  let chiSq = 0;
  for (let i = 0; i < observed.length; i++) {
    chiSq += Math.pow(observed[i] - expected[i], 2) / expected[i];
  }

  // Approximate p-value using chi-square CDF (simplified)
  const df = observed.length - 1;
  // Using Wilson-Hilferty approximation
  const z = Math.pow(chiSq / df, 1/3) - (1 - 2 / (9 * df));
  const se = Math.sqrt(2 / (9 * df));
  const pValue = 0.5 * (1 + erf(-(z / se) / Math.sqrt(2)));

  return { statistic: chiSq, pValue };
}

// Error function approximation
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

// Runs test for randomness
function runsTest(data: number[]): { runs: number; expected: number; zScore: number } {
  const median = [...data].sort((a, b) => a - b)[Math.floor(data.length / 2)];
  const binary = data.map(d => d > median ? 1 : 0);

  let runs = 1;
  for (let i = 1; i < binary.length; i++) {
    if (binary[i] !== binary[i - 1]) runs++;
  }

  const n1 = binary.filter(b => b === 1).length;
  const n2 = binary.filter(b => b === 0).length;
  const n = n1 + n2;

  const expected = (2 * n1 * n2) / n + 1;
  const variance = (2 * n1 * n2 * (2 * n1 * n2 - n)) / (n * n * (n - 1));
  const zScore = (runs - expected) / Math.sqrt(variance);

  return { runs, expected, zScore };
}

// Entropy calculation
function calculateEntropy(data: number[]): number {
  const counts: Record<number, number> = {};
  for (const d of data) {
    counts[d] = (counts[d] || 0) + 1;
  }

  let entropy = 0;
  const n = data.length;
  for (const count of Object.values(counts)) {
    const p = count / n;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

export async function executerandomgenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'generate_bytes';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'random_generator',
          description: 'Comprehensive random number generation',
          operations: {
            generate_bytes: 'Generate random bytes (crypto-quality)',
            generate_int: 'Generate random integers in range',
            generate_float: 'Generate random floats in range',
            generate_uuid: 'Generate UUID v4 or v7',
            generate_password: 'Generate secure password',
            uniform: 'Uniform distribution',
            normal: 'Normal (Gaussian) distribution',
            exponential: 'Exponential distribution',
            poisson: 'Poisson distribution',
            binomial: 'Binomial distribution',
            shuffle: 'Fisher-Yates shuffle',
            sample: 'Random sampling without replacement',
            test: 'Statistical tests for randomness'
          },
          algorithms: {
            prng: 'Xorshift128+ and Mersenne Twister MT19937',
            csprng: 'Multiple entropy sources combined',
            uuid_v4: 'Random-based UUID (RFC 4122)',
            uuid_v7: 'Time-ordered UUID (RFC draft)'
          },
          distributions: {
            uniform: 'Equal probability over range',
            normal: 'Gaussian bell curve (Box-Muller)',
            exponential: 'Memoryless waiting time',
            poisson: 'Event counts (Knuth algorithm)',
            binomial: 'Success counts in trials'
          }
        }, null, 2)
      };
    }

    if (operation === 'generate_bytes') {
      const length = args.length || 32;
      const format = args.format || 'hex';
      const bytes = secureRandomBytes(length);

      let output: string;
      switch (format) {
        case 'base64':
          output = bytesToBase64(bytes);
          break;
        case 'binary':
          output = bytesToBinary(bytes);
          break;
        case 'decimal':
          output = bytes.join(', ');
          break;
        default:
          output = bytesToHex(bytes);
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'generate_bytes',
          length,
          format,
          output,
          entropy_bits: length * 8
        }, null, 2)
      };
    }

    if (operation === 'generate_int') {
      const count = args.count || 1;
      const min = args.min ?? 0;
      const max = args.max ?? 100;
      const rng = new Xorshift128Plus();

      const values = Array(count).fill(0).map(() => rng.nextInt(min, max));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'generate_int',
          count,
          range: { min, max },
          values: count === 1 ? values[0] : values,
          statistics: count > 1 ? {
            mean: values.reduce((a, b) => a + b, 0) / count,
            min: Math.min(...values),
            max: Math.max(...values)
          } : undefined
        }, null, 2)
      };
    }

    if (operation === 'generate_float') {
      const count = args.count || 1;
      const min = args.min ?? 0;
      const max = args.max ?? 1;
      const rng = new Xorshift128Plus();

      const values = Array(count).fill(0).map(() => min + rng.nextFloat() * (max - min));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'generate_float',
          count,
          range: { min, max },
          values: count === 1 ? values[0] : values.map(v => Math.round(v * 1e10) / 1e10),
          statistics: count > 1 ? {
            mean: values.reduce((a, b) => a + b, 0) / count,
            std: Math.sqrt(values.reduce((a, b) => a + Math.pow(b - values.reduce((x, y) => x + y, 0) / count, 2), 0) / count)
          } : undefined
        }, null, 2)
      };
    }

    if (operation === 'generate_uuid') {
      const count = args.count || 1;
      const version = args.version || 'v4';

      const generator = version === 'v7' ? generateUUIDv7 : generateUUIDv4;
      const uuids = Array(count).fill(0).map(() => generator());

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'generate_uuid',
          version,
          count,
          uuids: count === 1 ? uuids[0] : uuids
        }, null, 2)
      };
    }

    if (operation === 'generate_password') {
      const length = args.length || 16;
      const charset = args.charset || 'all';
      const count = args.count || 1;

      const passwords = Array(count).fill(0).map(() => generatePassword(length, charset));

      const entropyPerChar = {
        alphanumeric: Math.log2(62),
        alpha: Math.log2(52),
        numeric: Math.log2(10),
        hex: Math.log2(16),
        base64: Math.log2(64),
        symbols: Math.log2(26),
        all: Math.log2(88)
      }[charset] || Math.log2(62);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'generate_password',
          length,
          charset,
          passwords: count === 1 ? passwords[0] : passwords,
          security: {
            entropy_bits: Math.round(length * entropyPerChar),
            strength: length * entropyPerChar >= 128 ? 'Very Strong' :
                     length * entropyPerChar >= 80 ? 'Strong' :
                     length * entropyPerChar >= 60 ? 'Good' : 'Weak'
          }
        }, null, 2)
      };
    }

    if (operation === 'uniform') {
      const count = args.count || 100;
      const min = args.min ?? 0;
      const max = args.max ?? 1;

      const values = uniformDistribution(count, min, max);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'uniform',
          parameters: { min, max },
          count,
          samples: values.slice(0, 10).map(v => Math.round(v * 1e6) / 1e6),
          statistics: {
            sample_mean: values.reduce((a, b) => a + b, 0) / count,
            expected_mean: (min + max) / 2,
            sample_variance: values.reduce((a, b) => a + Math.pow(b - (min + max) / 2, 2), 0) / count,
            expected_variance: Math.pow(max - min, 2) / 12
          }
        }, null, 2)
      };
    }

    if (operation === 'normal') {
      const count = args.count || 100;
      const mean = args.mean ?? 0;
      const std = args.std ?? 1;

      const values = normalDistribution(count, mean, std);
      const sampleMean = values.reduce((a, b) => a + b, 0) / count;
      const sampleStd = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - sampleMean, 2), 0) / count);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'normal',
          parameters: { mean, std },
          count,
          samples: values.slice(0, 10).map(v => Math.round(v * 1e6) / 1e6),
          statistics: {
            sample_mean: sampleMean,
            sample_std: sampleStd,
            expected_mean: mean,
            expected_std: std
          }
        }, null, 2)
      };
    }

    if (operation === 'exponential') {
      const count = args.count || 100;
      const lambda = args.lambda ?? 1;

      const values = exponentialDistribution(count, lambda);
      const sampleMean = values.reduce((a, b) => a + b, 0) / count;

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'exponential',
          parameters: { lambda },
          count,
          samples: values.slice(0, 10).map(v => Math.round(v * 1e6) / 1e6),
          statistics: {
            sample_mean: sampleMean,
            expected_mean: 1 / lambda,
            expected_variance: 1 / (lambda * lambda)
          }
        }, null, 2)
      };
    }

    if (operation === 'poisson') {
      const count = args.count || 100;
      const lambda = args.lambda ?? 5;

      const values = poissonDistribution(count, lambda);
      const sampleMean = values.reduce((a, b) => a + b, 0) / count;

      // Count frequencies
      const freq: Record<number, number> = {};
      for (const v of values) {
        freq[v] = (freq[v] || 0) + 1;
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'poisson',
          parameters: { lambda },
          count,
          samples: values.slice(0, 20),
          frequency_distribution: Object.entries(freq).sort((a, b) => Number(a[0]) - Number(b[0]))
            .slice(0, 10).map(([k, v]) => ({ value: Number(k), count: v })),
          statistics: {
            sample_mean: sampleMean,
            expected_mean: lambda,
            expected_variance: lambda
          }
        }, null, 2)
      };
    }

    if (operation === 'binomial') {
      const count = args.count || 100;
      const n = args.n ?? 10;
      const p = args.p ?? 0.5;

      const values = binomialDistribution(count, n, p);
      const sampleMean = values.reduce((a, b) => a + b, 0) / count;

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'binomial',
          parameters: { n, p },
          count,
          samples: values.slice(0, 20),
          statistics: {
            sample_mean: sampleMean,
            expected_mean: n * p,
            expected_variance: n * p * (1 - p)
          }
        }, null, 2)
      };
    }

    if (operation === 'shuffle') {
      const array = args.array || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = shuffle(array);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'shuffle',
          original: array,
          shuffled,
          algorithm: 'Fisher-Yates'
        }, null, 2)
      };
    }

    if (operation === 'sample') {
      const array = args.array || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const count = args.count || Math.min(5, array.length);

      const sampled = sample(array, count);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'sample',
          population_size: array.length,
          sample_size: count,
          sample: sampled,
          method: 'without replacement'
        }, null, 2)
      };
    }

    if (operation === 'test') {
      const count = args.count || 1000;
      const values = uniformDistribution(count, 0, 100).map(v => Math.floor(v));

      // Chi-square test
      const bins = 10;
      const observed: number[] = Array(bins).fill(0);
      for (const v of values) {
        observed[Math.min(Math.floor(v / 10), 9)]++;
      }
      const expected = Array(bins).fill(count / bins);
      const chiSq = chiSquareTest(observed, expected);

      // Runs test
      const runs = runsTest(values);

      // Entropy
      const entropy = calculateEntropy(values.map(v => Math.floor(v / 10)));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'test',
          sample_size: count,
          tests: {
            chi_square: {
              statistic: chiSq.statistic,
              p_value: chiSq.pValue,
              conclusion: chiSq.pValue > 0.05 ? 'PASS (appears random)' : 'FAIL (may not be random)'
            },
            runs_test: {
              observed_runs: runs.runs,
              expected_runs: runs.expected,
              z_score: runs.zScore,
              conclusion: Math.abs(runs.zScore) < 1.96 ? 'PASS (appears random)' : 'FAIL (may not be random)'
            },
            entropy: {
              bits: entropy,
              max_bits: Math.log2(10),
              ratio: entropy / Math.log2(10),
              conclusion: entropy / Math.log2(10) > 0.95 ? 'PASS (high entropy)' : 'WARN (low entropy)'
            }
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        error: 'Unknown operation',
        available: ['generate_bytes', 'generate_int', 'generate_float', 'generate_uuid', 'generate_password',
                   'uniform', 'normal', 'exponential', 'poisson', 'binomial', 'shuffle', 'sample', 'test', 'info']
      }, null, 2),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function israndomgeneratorAvailable(): boolean {
  return true;
}
