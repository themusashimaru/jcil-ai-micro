/**
 * HUFFMAN-CODING TOOL
 * Full Huffman encoding and decoding implementation
 *
 * Implements:
 * - Frequency analysis
 * - Huffman tree construction
 * - Optimal prefix-free code generation
 * - Encoding and decoding
 * - Compression ratio analysis
 * - Canonical Huffman codes
 * - Tree visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Huffman tree node
interface HuffmanNode {
  char: string | null;  // null for internal nodes
  frequency: number;
  left: HuffmanNode | null;
  right: HuffmanNode | null;
}

// Code table entry
interface CodeEntry {
  char: string;
  frequency: number;
  probability: number;
  code: string;
  codeLength: number;
}

// Compression statistics
interface CompressionStats {
  originalBits: number;
  compressedBits: number;
  compressionRatio: number;
  spaceSavings: number;
  avgCodeLength: number;
  entropy: number;
  efficiency: number;
}

// Priority queue for Huffman tree construction
class MinHeap {
  private heap: HuffmanNode[] = [];

  push(node: HuffmanNode): void {
    this.heap.push(node);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): HuffmanNode | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return min;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[parentIndex].frequency <= this.heap[index].frequency) break;
      [this.heap[parentIndex], this.heap[index]] = [this.heap[index], this.heap[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.heap[leftChild].frequency < this.heap[smallest].frequency) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].frequency < this.heap[smallest].frequency) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// Calculate character frequencies
function calculateFrequencies(text: string): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const char of text) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }
  return frequencies;
}

// Build Huffman tree
function buildHuffmanTree(frequencies: Map<string, number>): HuffmanNode | null {
  if (frequencies.size === 0) return null;

  const heap = new MinHeap();

  // Create leaf nodes
  for (const [char, freq] of frequencies) {
    heap.push({ char, frequency: freq, left: null, right: null });
  }

  // Handle single character case
  if (heap.size === 1) {
    const single = heap.pop()!;
    return { char: null, frequency: single.frequency, left: single, right: null };
  }

  // Build tree by combining lowest frequency nodes
  while (heap.size > 1) {
    const left = heap.pop()!;
    const right = heap.pop()!;

    const parent: HuffmanNode = {
      char: null,
      frequency: left.frequency + right.frequency,
      left,
      right
    };

    heap.push(parent);
  }

  return heap.pop() || null;
}

// Generate code table from Huffman tree
function generateCodeTable(
  root: HuffmanNode | null,
  prefix: string = '',
  table: Map<string, string> = new Map()
): Map<string, string> {
  if (!root) return table;

  if (root.char !== null) {
    // Leaf node
    table.set(root.char, prefix || '0');  // Single char case
  } else {
    // Internal node
    if (root.left) generateCodeTable(root.left, prefix + '0', table);
    if (root.right) generateCodeTable(root.right, prefix + '1', table);
  }

  return table;
}

// Encode text using Huffman codes
function encode(text: string, codeTable: Map<string, string>): string {
  let encoded = '';
  for (const char of text) {
    const code = codeTable.get(char);
    if (code === undefined) {
      throw new Error(`Character '${char}' not in code table`);
    }
    encoded += code;
  }
  return encoded;
}

// Decode encoded string using Huffman tree
function decode(encoded: string, root: HuffmanNode | null): string {
  if (!root) return '';

  let decoded = '';
  let current = root;

  // Handle single character tree
  if (root.char !== null) {
    return root.char.repeat(encoded.length);
  }

  for (const bit of encoded) {
    if (bit === '0') {
      current = current.left!;
    } else {
      current = current.right!;
    }

    if (current.char !== null) {
      decoded += current.char;
      current = root;
    }
  }

  return decoded;
}

// Calculate Shannon entropy
function calculateEntropy(frequencies: Map<string, number>): number {
  const total = Array.from(frequencies.values()).reduce((a, b) => a + b, 0);
  let entropy = 0;

  for (const freq of frequencies.values()) {
    const p = freq / total;
    if (p > 0) {
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

// Calculate compression statistics
function calculateStats(
  text: string,
  encoded: string,
  codeTable: Map<string, string>,
  frequencies: Map<string, number>
): CompressionStats {
  const total = text.length;
  const originalBits = total * 8;  // Assuming 8-bit ASCII
  const compressedBits = encoded.length;

  const compressionRatio = originalBits / compressedBits;
  const spaceSavings = (1 - compressedBits / originalBits) * 100;

  // Average code length
  let avgCodeLength = 0;
  for (const [char, freq] of frequencies) {
    const code = codeTable.get(char)!;
    avgCodeLength += (freq / total) * code.length;
  }

  const entropy = calculateEntropy(frequencies);
  const efficiency = entropy / avgCodeLength * 100;

  return {
    originalBits,
    compressedBits,
    compressionRatio,
    spaceSavings,
    avgCodeLength,
    entropy,
    efficiency
  };
}

// Generate canonical Huffman codes
function generateCanonicalCodes(codeTable: Map<string, string>): Map<string, string> {
  // Sort by code length, then by character
  const entries = Array.from(codeTable.entries()).sort((a, b) => {
    if (a[1].length !== b[1].length) return a[1].length - b[1].length;
    return a[0].localeCompare(b[0]);
  });

  const canonical = new Map<string, string>();
  let code = 0;
  let prevLength = 0;

  for (const [char, originalCode] of entries) {
    const length = originalCode.length;

    // Shift code to match new length
    if (length > prevLength) {
      code <<= (length - prevLength);
    }

    canonical.set(char, code.toString(2).padStart(length, '0'));
    code++;
    prevLength = length;
  }

  return canonical;
}

// Visualize Huffman tree as ASCII art
function visualizeTree(root: HuffmanNode | null, prefix: string = '', isLeft: boolean = true): string[] {
  if (!root) return [];

  const lines: string[] = [];
  const nodeStr = root.char !== null
    ? `[${root.char === ' ' ? 'SP' : root.char === '\n' ? 'NL' : root.char}:${root.frequency}]`
    : `(${root.frequency})`;

  if (root.right) {
    const rightLines = visualizeTree(root.right, prefix + (isLeft ? '│   ' : '    '), false);
    lines.push(...rightLines);
  }

  lines.push(prefix + (prefix ? (isLeft ? '└── ' : '┌── ') : '') + nodeStr);

  if (root.left) {
    const leftLines = visualizeTree(root.left, prefix + (isLeft ? '    ' : '│   '), true);
    lines.push(...leftLines);
  }

  return lines;
}

// Build code entries for display
function buildCodeEntries(
  frequencies: Map<string, number>,
  codeTable: Map<string, string>
): CodeEntry[] {
  const total = Array.from(frequencies.values()).reduce((a, b) => a + b, 0);
  const entries: CodeEntry[] = [];

  for (const [char, freq] of frequencies) {
    const code = codeTable.get(char)!;
    entries.push({
      char: char === ' ' ? '<space>' : char === '\n' ? '<newline>' : char === '\t' ? '<tab>' : char,
      frequency: freq,
      probability: freq / total,
      code,
      codeLength: code.length
    });
  }

  // Sort by frequency descending
  return entries.sort((a, b) => b.frequency - a.frequency);
}

// Serialize Huffman tree for transmission
function serializeTree(root: HuffmanNode | null): string {
  if (!root) return '';

  if (root.char !== null) {
    // Leaf: '1' + character code
    return '1' + root.char.charCodeAt(0).toString(16).padStart(2, '0');
  } else {
    // Internal: '0' + left subtree + right subtree
    return '0' + serializeTree(root.left) + serializeTree(root.right);
  }
}

// Deserialize Huffman tree
function deserializeTree(data: string, index: { value: number } = { value: 0 }): HuffmanNode | null {
  if (index.value >= data.length) return null;

  const flag = data[index.value++];

  if (flag === '1') {
    // Leaf node
    const charCode = parseInt(data.substr(index.value, 2), 16);
    index.value += 2;
    return { char: String.fromCharCode(charCode), frequency: 0, left: null, right: null };
  } else {
    // Internal node
    const left = deserializeTree(data, index);
    const right = deserializeTree(data, index);
    return { char: null, frequency: 0, left, right };
  }
}

export const huffmancodingTool: UnifiedTool = {
  name: 'huffman_coding',
  description: 'Huffman coding for optimal prefix-free compression',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['encode', 'decode', 'build_tree', 'analyze', 'canonical', 'visualize', 'info'],
        description: 'Operation to perform'
      },
      text: { type: 'string', description: 'Text to encode or analyze' },
      encoded: { type: 'string', description: 'Encoded binary string to decode' },
      tree: { type: 'string', description: 'Serialized Huffman tree' },
      frequencies: {
        type: 'object',
        description: 'Custom frequency table as {char: count} object',
        additionalProperties: { type: 'number' }
      }
    },
    required: ['operation']
  }
};

export async function executehuffmancoding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'huffman-coding',
          description: 'Huffman coding - optimal prefix-free compression',
          capabilities: [
            'Frequency analysis',
            'Huffman tree construction',
            'Variable-length code generation',
            'Text encoding and decoding',
            'Compression ratio analysis',
            'Canonical Huffman codes',
            'Tree visualization',
            'Tree serialization/deserialization'
          ],
          theory: {
            principle: 'Assigns shorter codes to more frequent symbols',
            optimality: 'Optimal among prefix-free codes for symbol-by-symbol encoding',
            complexity: 'O(n log n) construction, O(n) encoding/decoding',
            entropy: 'Average code length approaches Shannon entropy for large alphabets'
          },
          applications: [
            'DEFLATE (ZIP, gzip, PNG)',
            'JPEG compression',
            'MP3 audio',
            'Fax transmission (Modified Huffman)',
            'Data serialization'
          ]
        }, null, 2)
      };
    }

    if (operation === 'encode') {
      const text = args.text ?? 'hello world';
      const frequencies = calculateFrequencies(text);
      const tree = buildHuffmanTree(frequencies);
      const codeTable = generateCodeTable(tree);
      const encoded = encode(text, codeTable);
      const stats = calculateStats(text, encoded, codeTable, frequencies);
      const codeEntries = buildCodeEntries(frequencies, codeTable);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'encode',
          input: {
            text: text.length > 100 ? text.substring(0, 100) + '...' : text,
            length: text.length,
            uniqueChars: frequencies.size
          },
          encoded: {
            binary: encoded.length > 200 ? encoded.substring(0, 200) + '...' : encoded,
            length: encoded.length + ' bits'
          },
          codeTable: codeEntries.slice(0, 20).map(e => ({
            char: e.char,
            freq: e.frequency,
            prob: (e.probability * 100).toFixed(2) + '%',
            code: e.code,
            bits: e.codeLength
          })),
          statistics: {
            originalSize: stats.originalBits + ' bits (' + (stats.originalBits / 8) + ' bytes)',
            compressedSize: stats.compressedBits + ' bits (' + Math.ceil(stats.compressedBits / 8) + ' bytes)',
            compressionRatio: stats.compressionRatio.toFixed(3) + ':1',
            spaceSavings: stats.spaceSavings.toFixed(2) + '%',
            avgCodeLength: stats.avgCodeLength.toFixed(3) + ' bits/symbol',
            entropy: stats.entropy.toFixed(3) + ' bits/symbol',
            efficiency: stats.efficiency.toFixed(2) + '%'
          },
          serializedTree: serializeTree(tree)
        }, null, 2)
      };
    }

    if (operation === 'decode') {
      if (!args.encoded) {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Missing encoded string' }),
          isError: true
        };
      }

      let tree: HuffmanNode | null;

      if (args.tree) {
        // Use provided serialized tree
        tree = deserializeTree(args.tree);
      } else if (args.text) {
        // Build tree from original text
        const frequencies = calculateFrequencies(args.text);
        tree = buildHuffmanTree(frequencies);
      } else if (args.frequencies) {
        // Build tree from frequency table
        const freqMap = new Map<string, number>();
        for (const [char, freq] of Object.entries(args.frequencies)) {
          freqMap.set(char, freq as number);
        }
        tree = buildHuffmanTree(freqMap);
      } else {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Need tree, original text, or frequency table for decoding',
            hint: 'Provide tree, text, or frequencies parameter'
          }),
          isError: true
        };
      }

      const decoded = decode(args.encoded, tree);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'decode',
          input: {
            encoded: args.encoded.length > 200 ? args.encoded.substring(0, 200) + '...' : args.encoded,
            length: args.encoded.length + ' bits'
          },
          decoded: {
            text: decoded.length > 200 ? decoded.substring(0, 200) + '...' : decoded,
            length: decoded.length + ' characters'
          }
        }, null, 2)
      };
    }

    if (operation === 'build_tree') {
      let frequencies: Map<string, number>;

      if (args.frequencies) {
        frequencies = new Map<string, number>();
        for (const [char, freq] of Object.entries(args.frequencies)) {
          frequencies.set(char, freq as number);
        }
      } else if (args.text) {
        frequencies = calculateFrequencies(args.text);
      } else {
        return {
          toolCallId: id,
          content: JSON.stringify({ error: 'Need text or frequencies to build tree' }),
          isError: true
        };
      }

      const tree = buildHuffmanTree(frequencies);
      const codeTable = generateCodeTable(tree);
      const codeEntries = buildCodeEntries(frequencies, codeTable);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'build_tree',
          frequencies: Object.fromEntries(frequencies),
          codeTable: codeEntries.map(e => ({
            char: e.char,
            frequency: e.frequency,
            probability: (e.probability * 100).toFixed(2) + '%',
            code: e.code,
            codeLength: e.codeLength
          })),
          serializedTree: serializeTree(tree),
          entropy: calculateEntropy(frequencies).toFixed(4) + ' bits/symbol'
        }, null, 2)
      };
    }

    if (operation === 'analyze') {
      const text = args.text ?? 'the quick brown fox jumps over the lazy dog';
      const frequencies = calculateFrequencies(text);
      const tree = buildHuffmanTree(frequencies);
      const codeTable = generateCodeTable(tree);
      const encoded = encode(text, codeTable);
      const stats = calculateStats(text, encoded, codeTable, frequencies);
      const codeEntries = buildCodeEntries(frequencies, codeTable);

      // Theoretical limits
      const entropy = stats.entropy;
      const theoreticalMin = Math.ceil(text.length * entropy);
      const fixedLength = Math.ceil(Math.log2(frequencies.size)) * text.length;

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'analyze',
          input: {
            text: text.length > 100 ? text.substring(0, 100) + '...' : text,
            length: text.length,
            uniqueSymbols: frequencies.size
          },
          frequencyDistribution: codeEntries.slice(0, 15).map(e => ({
            char: e.char,
            count: e.frequency,
            percentage: (e.probability * 100).toFixed(2) + '%'
          })),
          huffmanCodes: codeEntries.slice(0, 15).map(e => ({
            char: e.char,
            code: e.code,
            length: e.codeLength
          })),
          compressionAnalysis: {
            asciiEncoding: stats.originalBits + ' bits',
            fixedLengthEncoding: fixedLength + ' bits',
            huffmanEncoding: stats.compressedBits + ' bits',
            theoreticalMinimum: theoreticalMin + ' bits (Shannon limit)',
            huffmanVsAscii: stats.spaceSavings.toFixed(2) + '% savings',
            huffmanVsFixed: ((1 - stats.compressedBits / fixedLength) * 100).toFixed(2) + '% savings'
          },
          theoreticalMetrics: {
            shannonEntropy: entropy.toFixed(4) + ' bits/symbol',
            avgCodeLength: stats.avgCodeLength.toFixed(4) + ' bits/symbol',
            redundancy: (stats.avgCodeLength - entropy).toFixed(4) + ' bits/symbol',
            efficiency: stats.efficiency.toFixed(2) + '%'
          }
        }, null, 2)
      };
    }

    if (operation === 'canonical') {
      const text = args.text ?? 'abracadabra';
      const frequencies = calculateFrequencies(text);
      const tree = buildHuffmanTree(frequencies);
      const standardCodes = generateCodeTable(tree);
      const canonicalCodes = generateCanonicalCodes(standardCodes);

      const comparison = Array.from(frequencies.keys()).map(char => ({
        char: char === ' ' ? '<space>' : char,
        frequency: frequencies.get(char),
        standardCode: standardCodes.get(char),
        canonicalCode: canonicalCodes.get(char)
      })).sort((a, b) => (a.standardCode?.length || 0) - (b.standardCode?.length || 0));

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'canonical_huffman',
          text: text.length > 50 ? text.substring(0, 50) + '...' : text,
          comparison,
          benefits: [
            'Codes can be reconstructed from just code lengths',
            'Simpler decoder implementation',
            'Used in DEFLATE, JPEG, and other standards'
          ]
        }, null, 2)
      };
    }

    if (operation === 'visualize') {
      const text = args.text ?? 'hello';
      const frequencies = calculateFrequencies(text);
      const tree = buildHuffmanTree(frequencies);
      const codeTable = generateCodeTable(tree);
      const visualization = visualizeTree(tree);

      return {
        toolCallId: id,
        content: JSON.stringify({
          operation: 'visualize',
          text,
          frequencies: Object.fromEntries(frequencies),
          tree: visualization.join('\n'),
          codes: Object.fromEntries(codeTable),
          legend: {
            '(n)': 'Internal node with frequency n',
            '[c:n]': 'Leaf node with character c and frequency n',
            '┌──': 'Right child (bit 1)',
            '└──': 'Left child (bit 0)'
          }
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: 'Unknown operation', operation }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function ishuffmancodingAvailable(): boolean {
  return true;
}
