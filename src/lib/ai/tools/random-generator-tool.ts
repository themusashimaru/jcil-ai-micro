/**
 * RANDOM-GENERATOR TOOL
 * Cryptographically secure random number generation
 * Uses crypto.getRandomValues and various distribution methods
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const randomgeneratorTool: UnifiedTool = {
  name: 'random_generator',
  description: 'Cryptographically secure random number generation',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate_bytes', 'generate_int', 'generate_uuid', 'generate_password',
               'generate_key', 'shuffle', 'sample', 'distribution', 'demo', 'info'],
        description: 'Operation to perform'
      },
      length: {
        type: 'number',
        description: 'Length in bytes or characters (default: 32)'
      },
      min: {
        type: 'number',
        description: 'Minimum value for integer generation'
      },
      max: {
        type: 'number',
        description: 'Maximum value for integer generation'
      },
      count: {
        type: 'number',
        description: 'Number of values to generate (default: 1)'
      },
      charset: {
        type: 'string',
        enum: ['alphanumeric', 'alphabetic', 'numeric', 'hex', 'base64', 'symbols', 'all'],
        description: 'Character set for password generation'
      },
      distribution: {
        type: 'string',
        enum: ['uniform', 'normal', 'exponential', 'poisson'],
        description: 'Probability distribution'
      },
      items: {
        type: 'array',
        items: { type: 'string' },
        description: 'Items to shuffle or sample from'
      }
    },
    required: ['operation']
  }
};

// Character sets
const CHARSETS = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numeric: '0123456789',
  hex: '0123456789abcdef',
  base64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  alphabetic: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  all: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
};

// Cryptographically secure random bytes (using Math.random as fallback for demo)
// In production, this would use crypto.getRandomValues
function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  // Use crypto API if available
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto (demo only)
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return bytes;
}

// Generate random integer in range [min, max] (inclusive)
function secureRandomInt(min: number, max: number): number {
  const range = max - min + 1;

  // Calculate how many bytes we need
  const bytesNeeded = Math.ceil(Math.log2(range) / 8) || 1;
  const maxValue = Math.pow(256, bytesNeeded);
  const limit = maxValue - (maxValue % range);

  let value: number;
  do {
    const bytes = secureRandomBytes(bytesNeeded);
    value = bytes.reduce((acc, byte, i) => acc + byte * Math.pow(256, i), 0);
  } while (value >= limit);

  return min + (value % range);
}

// Generate multiple random integers
function secureRandomInts(min: number, max: number, count: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(secureRandomInt(min, max));
  }
  return result;
}

// Generate UUID v4
function generateUUID(): string {
  const bytes = secureRandomBytes(16);

  // Set version (4) and variant (10xx)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Generate random string from character set
function generateRandomString(length: number, charset: string): string {
  const chars = charset;
  let result = '';

  for (let i = 0; i < length; i++) {
    const idx = secureRandomInt(0, chars.length - 1);
    result += chars[idx];
  }

  return result;
}

// Generate cryptographic key
function generateKey(bits: number): { hex: string; base64: string; bytes: number[] } {
  const bytes = secureRandomBytes(bits / 8);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

  // Simple base64 encoding
  const base64Chars = CHARSETS.base64;
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1] ?? 0;
    const b3 = bytes[i + 2] ?? 0;

    base64 += base64Chars[(b1 >> 2) & 0x3f];
    base64 += base64Chars[((b1 << 4) | (b2 >> 4)) & 0x3f];
    base64 += i + 1 < bytes.length ? base64Chars[((b2 << 2) | (b3 >> 6)) & 0x3f] : '=';
    base64 += i + 2 < bytes.length ? base64Chars[b3 & 0x3f] : '=';
  }

  return { hex, base64, bytes: Array.from(bytes) };
}

// Fisher-Yates shuffle
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(0, i);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Random sample without replacement
function sample<T>(array: T[], count: number): T[] {
  if (count >= array.length) return shuffle(array);

  const result: T[] = [];
  const indices = new Set<number>();

  while (indices.size < count) {
    const idx = secureRandomInt(0, array.length - 1);
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(array[idx]);
    }
  }

  return result;
}

// Box-Muller transform for normal distribution
function normalRandom(mean: number = 0, stddev: number = 1): number {
  const u1 = secureRandomInt(1, 1000000) / 1000000;
  const u2 = secureRandomInt(1, 1000000) / 1000000;

  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stddev * z0;
}

// Exponential distribution
function exponentialRandom(lambda: number = 1): number {
  const u = secureRandomInt(1, 1000000) / 1000000;
  return -Math.log(u) / lambda;
}

// Poisson distribution
function poissonRandom(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;

  do {
    k++;
    p *= secureRandomInt(1, 1000000) / 1000000;
  } while (p > L);

  return k - 1;
}

// Calculate entropy
function calculateEntropy(length: number, charsetSize: number): number {
  return length * Math.log2(charsetSize);
}

// Estimate password strength
function estimateStrength(password: string): {
  entropy: number;
  strength: string;
  crack_time: string;
} {
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);

  let charsetSize = 0;
  if (hasLower) charsetSize += 26;
  if (hasUpper) charsetSize += 26;
  if (hasDigit) charsetSize += 10;
  if (hasSymbol) charsetSize += 32;

  const entropy = password.length * Math.log2(charsetSize || 1);

  let strength: string;
  if (entropy < 28) strength = 'Very Weak';
  else if (entropy < 36) strength = 'Weak';
  else if (entropy < 60) strength = 'Moderate';
  else if (entropy < 128) strength = 'Strong';
  else strength = 'Very Strong';

  // Estimate crack time at 10 billion guesses/second
  const combinations = Math.pow(2, entropy);
  const seconds = combinations / (10e9 * 2); // Average case
  let crackTime: string;

  if (seconds < 1) crackTime = 'Instant';
  else if (seconds < 60) crackTime = `${Math.round(seconds)} seconds`;
  else if (seconds < 3600) crackTime = `${Math.round(seconds / 60)} minutes`;
  else if (seconds < 86400) crackTime = `${Math.round(seconds / 3600)} hours`;
  else if (seconds < 31536000) crackTime = `${Math.round(seconds / 86400)} days`;
  else if (seconds < 31536000 * 1000) crackTime = `${Math.round(seconds / 31536000)} years`;
  else crackTime = 'Centuries+';

  return { entropy: Math.round(entropy), strength, crack_time: crackTime };
}

export async function executerandomgenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      length = 32,
      min = 0,
      max = 100,
      count = 1,
      charset = 'alphanumeric',
      distribution = 'uniform',
      items
    } = args;

    if (operation === 'info') {
      const info = {
        tool: 'random_generator',
        description: 'Cryptographically secure random number and data generation',
        operations: {
          generate_bytes: 'Generate random bytes (hex encoded)',
          generate_int: 'Generate random integer(s) in range',
          generate_uuid: 'Generate UUID v4',
          generate_password: 'Generate secure password',
          generate_key: 'Generate cryptographic key',
          shuffle: 'Cryptographically shuffle an array',
          sample: 'Random sampling without replacement',
          distribution: 'Generate from probability distributions'
        },
        charsets: Object.keys(CHARSETS),
        distributions: ['uniform', 'normal', 'exponential', 'poisson'],
        security: {
          source: 'crypto.getRandomValues (CSPRNG)',
          entropy: 'Configurable based on output size',
          resistance: 'Resistant to prediction and bias attacks'
        },
        use_cases: [
          'Password generation',
          'Session tokens',
          'API keys',
          'Nonces and IVs',
          'Randomized algorithms'
        ]
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'demo') {
      const demos = {
        random_bytes: Array.from(secureRandomBytes(16)).map(b => b.toString(16).padStart(2, '0')).join(''),
        random_int: secureRandomInt(1, 100),
        uuid: generateUUID(),
        password_16: generateRandomString(16, CHARSETS.all),
        key_256: generateKey(256).hex,
        shuffle_demo: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
        sample_demo: sample(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 3),
        normal_samples: Array.from({ length: 10 }, () => normalRandom(0, 1).toFixed(3)),
        exponential_samples: Array.from({ length: 10 }, () => exponentialRandom(1).toFixed(3))
      };

      const passwordDemo = generateRandomString(16, CHARSETS.all);
      const strengthAnalysis = estimateStrength(passwordDemo);

      const result = {
        operation: 'demo',
        demonstrations: demos,
        password_analysis: {
          password: passwordDemo,
          ...strengthAnalysis
        },
        entropy_examples: {
          '8_char_alpha': `${calculateEntropy(8, 52).toFixed(0)} bits`,
          '12_char_alphanumeric': `${calculateEntropy(12, 62).toFixed(0)} bits`,
          '16_char_all': `${calculateEntropy(16, 94).toFixed(0)} bits`,
          '32_byte_key': '256 bits'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'generate_bytes') {
      const bytes = secureRandomBytes(length);
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');

      const result = {
        operation: 'generate_bytes',
        length,
        hex,
        bytes: Array.from(bytes),
        entropy_bits: length * 8
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'generate_int') {
      const values = secureRandomInts(min, max, count);

      const result = {
        operation: 'generate_int',
        min,
        max,
        count,
        values: count === 1 ? values[0] : values,
        range_size: max - min + 1,
        entropy_per_value: Math.log2(max - min + 1).toFixed(2) + ' bits'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'generate_uuid') {
      const uuids = Array.from({ length: count }, () => generateUUID());

      const result = {
        operation: 'generate_uuid',
        version: 4,
        count,
        uuids: count === 1 ? uuids[0] : uuids,
        entropy: '122 bits (6 bits used for version/variant)'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'generate_password') {
      const charsetStr = CHARSETS[charset as keyof typeof CHARSETS] || CHARSETS.alphanumeric;
      const passwords = Array.from({ length: count }, () => generateRandomString(length, charsetStr));

      const firstPassword = passwords[0];
      const strength = estimateStrength(firstPassword);

      const result = {
        operation: 'generate_password',
        length,
        charset,
        charset_size: charsetStr.length,
        passwords: count === 1 ? passwords[0] : passwords,
        strength_analysis: strength
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'generate_key') {
      const bits = length * 8; // length is in bytes
      const key = generateKey(bits);

      const result = {
        operation: 'generate_key',
        bits,
        bytes: length,
        hex: key.hex,
        base64: key.base64,
        recommended_uses: bits >= 256 ? 'AES-256, general cryptography' :
                          bits >= 128 ? 'AES-128, session keys' :
                          'Not recommended for cryptographic use'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'shuffle') {
      if (!items || !Array.isArray(items)) {
        return { toolCallId: id, content: 'Error: items array required', isError: true };
      }

      const shuffled = shuffle(items);

      const result = {
        operation: 'shuffle',
        original: items,
        shuffled,
        permutation_entropy: `${Math.log2(items.reduce((a, _, i) => a * (i + 1), 1)).toFixed(2)} bits`
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'sample') {
      if (!items || !Array.isArray(items)) {
        return { toolCallId: id, content: 'Error: items array required', isError: true };
      }

      const sampled = sample(items, Math.min(count, items.length));

      const result = {
        operation: 'sample',
        population: items,
        sample_size: sampled.length,
        sampled,
        combinations: `C(${items.length}, ${sampled.length})`
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'distribution') {
      let values: number[];

      switch (distribution) {
        case 'normal':
          values = Array.from({ length: count }, () =>
            normalRandom(min, max)); // min=mean, max=stddev
          break;
        case 'exponential':
          values = Array.from({ length: count }, () =>
            exponentialRandom(min || 1)); // min=lambda
          break;
        case 'poisson':
          values = Array.from({ length: count }, () =>
            poissonRandom(min || 5)); // min=lambda
          break;
        case 'uniform':
        default:
          values = secureRandomInts(min, max, count).map(v => v);
      }

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;

      const result = {
        operation: 'distribution',
        distribution,
        count,
        parameters: distribution === 'normal' ? { mean: min, stddev: max } :
                    distribution === 'exponential' || distribution === 'poisson' ? { lambda: min || 1 } :
                    { min, max },
        values: values.map(v => Math.round(v * 1000) / 1000),
        statistics: {
          mean: mean.toFixed(4),
          variance: variance.toFixed(4),
          stddev: Math.sqrt(variance).toFixed(4),
          min: Math.min(...values).toFixed(4),
          max: Math.max(...values).toFixed(4)
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return {
      toolCallId: id,
      content: `Error: Unknown operation '${operation}'`,
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function israndomgeneratorAvailable(): boolean { return true; }
