/**
 * LZ-COMPRESSION TOOL
 * Lempel-Ziv family compression algorithms
 *
 * Implements:
 * - LZ77 (sliding window compression)
 * - LZ78 (dictionary-based compression)
 * - LZW (Lempel-Ziv-Welch)
 * - LZSS (LZ77 with flags)
 * - Compression analysis and statistics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const lzcompressionTool: UnifiedTool = {
  name: 'lz_compression',
  description: 'LZ77/LZ78/LZW/LZSS compression and decompression',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['compress', 'decompress', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      algorithm: {
        type: 'string',
        enum: ['LZ77', 'LZ78', 'LZW', 'LZSS'],
        description: 'Compression algorithm (default: LZ77)'
      },
      data: {
        type: 'string',
        description: 'Data to compress (string)'
      },
      compressed_data: {
        type: 'string',
        description: 'Compressed data to decompress (JSON encoded)'
      },
      window_size: {
        type: 'integer',
        description: 'LZ77/LZSS window size (default: 4096)'
      },
      lookahead_size: {
        type: 'integer',
        description: 'LZ77/LZSS lookahead buffer size (default: 18)'
      },
      min_match_length: {
        type: 'integer',
        description: 'Minimum match length for LZSS (default: 3)'
      }
    },
    required: ['operation']
  }
};

// LZ77 Token type
interface LZ77Token {
  offset: number;    // Distance back in the window
  length: number;    // Length of match
  next: string;      // Next character after match
}

// LZ78 Token type
interface LZ78Token {
  index: number;     // Dictionary index (0 for no match)
  char: string;      // Character to append
}

// LZW uses just numbers (dictionary indices)
type LZWCode = number;

// LZSS Token (can be literal or reference)
interface LZSSToken {
  isLiteral: boolean;
  value: string | { offset: number; length: number };
}

// LZ77 Compression
function lz77Compress(data: string, windowSize: number, lookaheadSize: number): LZ77Token[] {
  const tokens: LZ77Token[] = [];
  let cursor = 0;

  while (cursor < data.length) {
    let bestOffset = 0;
    let bestLength = 0;

    // Search window boundaries
    const windowStart = Math.max(0, cursor - windowSize);
    const windowEnd = cursor;
    const lookaheadEnd = Math.min(data.length, cursor + lookaheadSize);

    // Find longest match in the window
    for (let i = windowStart; i < windowEnd; i++) {
      let matchLength = 0;
      while (
        cursor + matchLength < lookaheadEnd &&
        data[i + matchLength] === data[cursor + matchLength] &&
        matchLength < lookaheadSize
      ) {
        matchLength++;
      }

      if (matchLength > bestLength) {
        bestLength = matchLength;
        bestOffset = cursor - i;
      }
    }

    // Get next character after match
    const nextCharIndex = cursor + bestLength;
    const nextChar = nextCharIndex < data.length ? data[nextCharIndex] : '';

    tokens.push({
      offset: bestOffset,
      length: bestLength,
      next: nextChar
    });

    cursor += bestLength + 1;
  }

  return tokens;
}

// LZ77 Decompression
function lz77Decompress(tokens: LZ77Token[]): string {
  let result = '';

  for (const token of tokens) {
    if (token.length > 0 && token.offset > 0) {
      // Copy from earlier in result
      const start = result.length - token.offset;
      for (let i = 0; i < token.length; i++) {
        result += result[start + i];
      }
    }
    if (token.next) {
      result += token.next;
    }
  }

  return result;
}

// LZ78 Compression
function lz78Compress(data: string): LZ78Token[] {
  const dictionary: Map<string, number> = new Map();
  const tokens: LZ78Token[] = [];
  let dictIndex = 1;
  let currentString = '';

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const combined = currentString + char;

    if (dictionary.has(combined)) {
      currentString = combined;
    } else {
      // Output token
      const index = dictionary.get(currentString) || 0;
      tokens.push({ index, char });

      // Add new entry to dictionary
      dictionary.set(combined, dictIndex++);
      currentString = '';
    }
  }

  // Handle remaining string
  if (currentString.length > 0) {
    const index = dictionary.get(currentString) || 0;
    tokens.push({ index, char: '' });
  }

  return tokens;
}

// LZ78 Decompression
function lz78Decompress(tokens: LZ78Token[]): string {
  const dictionary: Map<number, string> = new Map();
  dictionary.set(0, '');
  let dictIndex = 1;
  let result = '';

  for (const token of tokens) {
    const prefix = dictionary.get(token.index) || '';
    const entry = prefix + token.char;
    result += entry;
    dictionary.set(dictIndex++, entry);
  }

  return result;
}

// LZW Compression
function lzwCompress(data: string): LZWCode[] {
  // Initialize dictionary with single characters
  const dictionary: Map<string, number> = new Map();
  for (let i = 0; i < 256; i++) {
    dictionary.set(String.fromCharCode(i), i);
  }

  const codes: LZWCode[] = [];
  let dictSize = 256;
  let currentString = '';

  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    const combined = currentString + char;

    if (dictionary.has(combined)) {
      currentString = combined;
    } else {
      // Output code for current string
      codes.push(dictionary.get(currentString)!);

      // Add new entry to dictionary (limit to 12-bit codes)
      if (dictSize < 4096) {
        dictionary.set(combined, dictSize++);
      }
      currentString = char;
    }
  }

  // Output code for remaining string
  if (currentString.length > 0) {
    codes.push(dictionary.get(currentString)!);
  }

  return codes;
}

// LZW Decompression
function lzwDecompress(codes: LZWCode[]): string {
  // Initialize dictionary with single characters
  const dictionary: Map<number, string> = new Map();
  for (let i = 0; i < 256; i++) {
    dictionary.set(i, String.fromCharCode(i));
  }

  if (codes.length === 0) return '';

  let dictSize = 256;
  let result = dictionary.get(codes[0]) || '';
  let previous = result;

  for (let i = 1; i < codes.length; i++) {
    const code = codes[i];
    let entry: string;

    if (dictionary.has(code)) {
      entry = dictionary.get(code)!;
    } else if (code === dictSize) {
      // Special case: code not yet in dictionary
      entry = previous + previous[0];
    } else {
      throw new Error(`Invalid LZW code: ${code}`);
    }

    result += entry;

    // Add new entry to dictionary
    if (dictSize < 4096) {
      dictionary.set(dictSize++, previous + entry[0]);
    }

    previous = entry;
  }

  return result;
}

// LZSS Compression (LZ77 variant with flags)
function lzssCompress(data: string, windowSize: number, lookaheadSize: number, minMatchLength: number): LZSSToken[] {
  const tokens: LZSSToken[] = [];
  let cursor = 0;

  while (cursor < data.length) {
    let bestOffset = 0;
    let bestLength = 0;

    const windowStart = Math.max(0, cursor - windowSize);
    const windowEnd = cursor;
    const lookaheadEnd = Math.min(data.length, cursor + lookaheadSize);

    // Find longest match
    for (let i = windowStart; i < windowEnd; i++) {
      let matchLength = 0;
      while (
        cursor + matchLength < lookaheadEnd &&
        data[i + matchLength] === data[cursor + matchLength] &&
        matchLength < lookaheadSize
      ) {
        matchLength++;
      }

      if (matchLength > bestLength) {
        bestLength = matchLength;
        bestOffset = cursor - i;
      }
    }

    if (bestLength >= minMatchLength) {
      // Use reference token
      tokens.push({
        isLiteral: false,
        value: { offset: bestOffset, length: bestLength }
      });
      cursor += bestLength;
    } else {
      // Use literal token
      tokens.push({
        isLiteral: true,
        value: data[cursor]
      });
      cursor++;
    }
  }

  return tokens;
}

// LZSS Decompression
function lzssDecompress(tokens: LZSSToken[]): string {
  let result = '';

  for (const token of tokens) {
    if (token.isLiteral) {
      result += token.value as string;
    } else {
      const ref = token.value as { offset: number; length: number };
      const start = result.length - ref.offset;
      for (let i = 0; i < ref.length; i++) {
        result += result[start + i];
      }
    }
  }

  return result;
}

// Analyze compression statistics
function analyzeCompression(
  original: string,
  algorithm: string,
  compressed: LZ77Token[] | LZ78Token[] | LZWCode[] | LZSSToken[]
): {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  spaceSavings: number;
  tokenCount: number;
  averageTokenSize: number;
  entropy: number;
} {
  const originalSize = original.length;
  let compressedSize: number;
  let tokenCount: number;

  switch (algorithm) {
    case 'LZ77': {
      const tokens = compressed as LZ77Token[];
      tokenCount = tokens.length;
      // Estimate: offset (12 bits) + length (4 bits) + char (8 bits) = 24 bits per token
      compressedSize = Math.ceil(tokenCount * 3);
      break;
    }
    case 'LZ78': {
      const tokens = compressed as LZ78Token[];
      tokenCount = tokens.length;
      // Estimate: index (variable, ~12 bits avg) + char (8 bits) = ~20 bits per token
      compressedSize = Math.ceil(tokenCount * 2.5);
      break;
    }
    case 'LZW': {
      const codes = compressed as LZWCode[];
      tokenCount = codes.length;
      // 12-bit codes
      compressedSize = Math.ceil(tokenCount * 1.5);
      break;
    }
    case 'LZSS': {
      const tokens = compressed as LZSSToken[];
      tokenCount = tokens.length;
      // 1 bit flag + either 8 bits (literal) or 16 bits (reference)
      let bits = 0;
      for (const token of tokens) {
        bits += 1; // flag bit
        if (token.isLiteral) {
          bits += 8;
        } else {
          bits += 16; // offset + length
        }
      }
      compressedSize = Math.ceil(bits / 8);
      break;
    }
    default:
      compressedSize = 0;
      tokenCount = 0;
  }

  // Calculate entropy of original data
  const charCounts = new Map<string, number>();
  for (const char of original) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }
  let entropy = 0;
  for (const count of charCounts.values()) {
    const p = count / original.length;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  const compressionRatio = compressedSize / originalSize;
  const spaceSavings = 1 - compressionRatio;

  return {
    originalSize,
    compressedSize,
    compressionRatio,
    spaceSavings,
    tokenCount,
    averageTokenSize: compressedSize / tokenCount,
    entropy
  };
}

export async function executelzcompression(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation as string;
    const algorithm = (args.algorithm as string) || 'LZ77';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'lz_compression',
          description: 'Lempel-Ziv family lossless compression algorithms',
          algorithms: {
            LZ77: {
              description: 'Sliding window compression (1977)',
              output: 'Sequence of (offset, length, next_char) tuples',
              usage: 'Base for DEFLATE (gzip, PNG), LZH',
              params: ['window_size (default: 4096)', 'lookahead_size (default: 18)']
            },
            LZ78: {
              description: 'Dictionary-based compression (1978)',
              output: 'Sequence of (dictionary_index, char) tuples',
              usage: 'Base for LZW and other dictionary methods',
              advantage: 'No sliding window needed'
            },
            LZW: {
              description: 'Lempel-Ziv-Welch (1984)',
              output: 'Sequence of dictionary codes',
              usage: 'GIF, early TIFF, Unix compress',
              advantage: 'Simple, single-pass compression'
            },
            LZSS: {
              description: 'LZ77 with optional literal flags (1982)',
              output: 'Flags + literals or (offset, length) pairs',
              usage: 'More efficient than LZ77 for short matches',
              params: ['min_match_length (default: 3)']
            }
          },
          operations: {
            compress: 'Compress string data',
            decompress: 'Decompress compressed data',
            analyze: 'Analyze compression statistics'
          },
          concepts: {
            sliding_window: 'LZ77/LZSS look back in a fixed-size window for matches',
            dictionary: 'LZ78/LZW build a dictionary of seen phrases',
            back_reference: 'Pointer to earlier occurrence of a pattern',
            entropy: 'Theoretical minimum bits per symbol'
          }
        }, null, 2)
      };
    }

    const windowSize = args.window_size ?? 4096;
    const lookaheadSize = args.lookahead_size ?? 18;
    const minMatchLength = args.min_match_length ?? 3;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'compress': {
        const data = args.data as string;
        if (!data) throw new Error('Data is required for compression');

        let compressed: LZ77Token[] | LZ78Token[] | LZWCode[] | LZSSToken[];
        let compressedJson: string;

        switch (algorithm) {
          case 'LZ77':
            compressed = lz77Compress(data, windowSize, lookaheadSize);
            compressedJson = JSON.stringify(compressed);
            break;
          case 'LZ78':
            compressed = lz78Compress(data);
            compressedJson = JSON.stringify(compressed);
            break;
          case 'LZW':
            compressed = lzwCompress(data);
            compressedJson = JSON.stringify(compressed);
            break;
          case 'LZSS':
            compressed = lzssCompress(data, windowSize, lookaheadSize, minMatchLength);
            compressedJson = JSON.stringify(compressed);
            break;
          default:
            throw new Error(`Unknown algorithm: ${algorithm}`);
        }

        const stats = analyzeCompression(data, algorithm, compressed);

        result = {
          algorithm,
          compressed_data: compressedJson,
          statistics: {
            original_size_bytes: stats.originalSize,
            compressed_size_bytes: stats.compressedSize,
            compression_ratio: stats.compressionRatio.toFixed(3),
            space_savings: (stats.spaceSavings * 100).toFixed(1) + '%',
            token_count: stats.tokenCount,
            source_entropy_bits_per_char: stats.entropy.toFixed(3)
          },
          parameters: {
            window_size: windowSize,
            lookahead_size: lookaheadSize,
            min_match_length: algorithm === 'LZSS' ? minMatchLength : undefined
          }
        };
        break;
      }

      case 'decompress': {
        const compressedData = args.compressed_data as string;
        if (!compressedData) throw new Error('Compressed data is required');

        let decompressed: string;

        try {
          const parsed = JSON.parse(compressedData);

          switch (algorithm) {
            case 'LZ77':
              decompressed = lz77Decompress(parsed as LZ77Token[]);
              break;
            case 'LZ78':
              decompressed = lz78Decompress(parsed as LZ78Token[]);
              break;
            case 'LZW':
              decompressed = lzwDecompress(parsed as LZWCode[]);
              break;
            case 'LZSS':
              decompressed = lzssDecompress(parsed as LZSSToken[]);
              break;
            default:
              throw new Error(`Unknown algorithm: ${algorithm}`);
          }
        } catch (e) {
          throw new Error(`Failed to parse compressed data: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }

        result = {
          algorithm,
          decompressed_data: decompressed,
          length: decompressed.length
        };
        break;
      }

      case 'analyze': {
        const data = args.data as string;
        if (!data) throw new Error('Data is required for analysis');

        // Compress with all algorithms and compare
        const results: Record<string, {
          compressed_size: number;
          compression_ratio: number;
          token_count: number;
        }> = {};

        const lz77Tokens = lz77Compress(data, windowSize, lookaheadSize);
        const lz77Stats = analyzeCompression(data, 'LZ77', lz77Tokens);
        results['LZ77'] = {
          compressed_size: lz77Stats.compressedSize,
          compression_ratio: lz77Stats.compressionRatio,
          token_count: lz77Stats.tokenCount
        };

        const lz78Tokens = lz78Compress(data);
        const lz78Stats = analyzeCompression(data, 'LZ78', lz78Tokens);
        results['LZ78'] = {
          compressed_size: lz78Stats.compressedSize,
          compression_ratio: lz78Stats.compressionRatio,
          token_count: lz78Stats.tokenCount
        };

        const lzwCodes = lzwCompress(data);
        const lzwStats = analyzeCompression(data, 'LZW', lzwCodes);
        results['LZW'] = {
          compressed_size: lzwStats.compressedSize,
          compression_ratio: lzwStats.compressionRatio,
          token_count: lzwStats.tokenCount
        };

        const lzssTokens = lzssCompress(data, windowSize, lookaheadSize, minMatchLength);
        const lzssStats = analyzeCompression(data, 'LZSS', lzssTokens);
        results['LZSS'] = {
          compressed_size: lzssStats.compressedSize,
          compression_ratio: lzssStats.compressionRatio,
          token_count: lzssStats.tokenCount
        };

        // Find best algorithm
        let bestAlgo = 'LZ77';
        let bestRatio = results['LZ77'].compression_ratio;
        for (const [algo, stats] of Object.entries(results)) {
          if (stats.compression_ratio < bestRatio) {
            bestRatio = stats.compression_ratio;
            bestAlgo = algo;
          }
        }

        // Calculate character statistics
        const charCounts = new Map<string, number>();
        for (const char of data) {
          charCounts.set(char, (charCounts.get(char) || 0) + 1);
        }
        const uniqueChars = charCounts.size;
        const mostCommon = Array.from(charCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([char, count]) => ({
            char: char === ' ' ? '(space)' : char === '\n' ? '(newline)' : char,
            count,
            frequency: (count / data.length * 100).toFixed(1) + '%'
          }));

        result = {
          original_size: data.length,
          entropy_bits_per_char: lz77Stats.entropy.toFixed(3),
          theoretical_minimum_bytes: Math.ceil(data.length * lz77Stats.entropy / 8),
          unique_characters: uniqueChars,
          most_common_characters: mostCommon,
          algorithm_comparison: results,
          best_algorithm: bestAlgo,
          best_compression_ratio: bestRatio.toFixed(3),
          recommendation: bestRatio > 0.9 ? 'Data has low redundancy, compression may not be worthwhile' :
                          bestRatio > 0.7 ? 'Moderate compression achieved' :
                          bestRatio > 0.5 ? 'Good compression achieved' :
                          'Excellent compression achieved'
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify({
        operation,
        ...result
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islzcompressionAvailable(): boolean { return true; }
