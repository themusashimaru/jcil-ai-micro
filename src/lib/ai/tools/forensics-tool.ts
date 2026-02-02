/**
 * FORENSICS TOOL
 *
 * Digital forensics: file analysis, hash verification,
 * metadata extraction, timeline analysis, and evidence handling.
 *
 * Part of TIER CYBERSECURITY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// HASH FUNCTIONS
// ============================================================================

function simpleHash(data: string, algorithm: string): string {
  // Simple hash implementations for demonstration
  let hash = 0;

  if (algorithm === 'djb2') {
    hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash) + data.charCodeAt(i);
      hash = hash & 0xFFFFFFFF;
    }
  } else if (algorithm === 'sdbm') {
    for (let i = 0; i < data.length; i++) {
      hash = data.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
      hash = hash & 0xFFFFFFFF;
    }
  } else {
    // FNV-1a
    hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data.charCodeAt(i);
      hash = (hash * 16777619) & 0xFFFFFFFF;
    }
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function checksumVerify(data: string, expectedHash: string, algorithm: string): boolean {
  const computed = simpleHash(data, algorithm);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

// ============================================================================
// FILE SIGNATURE ANALYSIS
// ============================================================================

const FILE_SIGNATURES: Record<string, { hex: string; extension: string; description: string }> = {
  'FFD8FF': { hex: 'FFD8FF', extension: 'jpg/jpeg', description: 'JPEG image' },
  '89504E47': { hex: '89504E47', extension: 'png', description: 'PNG image' },
  '47494638': { hex: '47494638', extension: 'gif', description: 'GIF image' },
  '25504446': { hex: '25504446', extension: 'pdf', description: 'PDF document' },
  '504B0304': { hex: '504B0304', extension: 'zip/docx/xlsx', description: 'ZIP archive or Office document' },
  '7F454C46': { hex: '7F454C46', extension: 'elf', description: 'Linux executable (ELF)' },
  '4D5A': { hex: '4D5A', extension: 'exe/dll', description: 'Windows executable (PE)' },
  '52617221': { hex: '52617221', extension: 'rar', description: 'RAR archive' },
  '1F8B08': { hex: '1F8B08', extension: 'gz', description: 'GZIP compressed' },
  '377ABCAF': { hex: '377ABCAF', extension: '7z', description: '7-Zip archive' },
};

function identifyFileType(hexSignature: string): { type: string; extension: string } | null {
  const upperHex = hexSignature.toUpperCase().replace(/\s/g, '');
  for (const [sig, info] of Object.entries(FILE_SIGNATURES)) {
    if (upperHex.startsWith(sig)) {
      return { type: info.description, extension: info.extension };
    }
  }
  return null;
}

// ============================================================================
// TIMESTAMP ANALYSIS
// ============================================================================

function parseTimestamp(timestamp: number, format: string): Record<string, unknown> {
  let date: Date;

  if (format === 'unix') {
    date = new Date(timestamp * 1000);
  } else if (format === 'unix_ms') {
    date = new Date(timestamp);
  } else if (format === 'filetime') {
    // Windows FILETIME (100ns intervals since 1601)
    const unixMs = (timestamp / 10000) - 11644473600000;
    date = new Date(unixMs);
  } else if (format === 'mac_absolute') {
    // Mac absolute time (seconds since 2001-01-01)
    date = new Date((timestamp + 978307200) * 1000);
  } else {
    date = new Date(timestamp);
  }

  return {
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toString(),
    unix: Math.floor(date.getTime() / 1000),
    unix_ms: date.getTime(),
  };
}

export function timelineDiff(timestamp1: number, timestamp2: number): Record<string, number> {
  const diffMs = Math.abs(timestamp2 - timestamp1);
  const diffSec = Math.floor(diffMs / 1000);

  return {
    milliseconds: diffMs,
    seconds: diffSec,
    minutes: Math.floor(diffSec / 60),
    hours: Math.floor(diffSec / 3600),
    days: Math.floor(diffSec / 86400),
  };
}

// ============================================================================
// STRING ANALYSIS
// ============================================================================

function extractStrings(hexData: string, minLength: number = 4): string[] {
  // Convert hex to ASCII and find printable strings
  const strings: string[] = [];
  let current = '';

  for (let i = 0; i < hexData.length; i += 2) {
    const byte = parseInt(hexData.substr(i, 2), 16);
    if (byte >= 32 && byte <= 126) {
      current += String.fromCharCode(byte);
    } else {
      if (current.length >= minLength) {
        strings.push(current);
      }
      current = '';
    }
  }

  if (current.length >= minLength) {
    strings.push(current);
  }

  return strings;
}

function detectEncodings(data: string): string[] {
  const encodings: string[] = [];

  // Base64 check
  if (/^[A-Za-z0-9+/]+=*$/.test(data) && data.length % 4 === 0) {
    encodings.push('Possible Base64');
  }

  // Hex check
  if (/^[0-9A-Fa-f]+$/.test(data) && data.length % 2 === 0) {
    encodings.push('Possible Hex encoding');
  }

  // URL encoding check
  if (/%[0-9A-Fa-f]{2}/.test(data)) {
    encodings.push('URL encoded content detected');
  }

  // ROT13 potential (heuristic)
  if (/^[A-Za-z\s]+$/.test(data)) {
    encodings.push('Could be ROT13 or simple substitution');
  }

  return encodings.length > 0 ? encodings : ['Plain text or unknown encoding'];
}

// ============================================================================
// ENTROPY ANALYSIS
// ============================================================================

function calculateEntropy(data: string): number {
  const freq: Record<string, number> = {};
  for (const char of data) {
    freq[char] = (freq[char] || 0) + 1;
  }

  let entropy = 0;
  const len = data.length;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function entropyAnalysis(entropy: number): string {
  if (entropy < 3) return 'Low entropy - likely plain text or structured data';
  if (entropy < 5) return 'Medium entropy - possibly compressed or encoded';
  if (entropy < 7) return 'High entropy - likely encrypted or compressed';
  return 'Very high entropy - strongly suggests encryption or random data';
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const forensicsTool: UnifiedTool = {
  name: 'forensics',
  description: `Digital forensics analysis tools.

Operations:
- hash: Calculate and verify hashes
- file_signature: Identify file types from magic bytes
- timestamp: Parse and convert timestamps
- strings: Extract strings from hex data
- entropy: Calculate data entropy
- encoding: Detect data encodings`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['hash', 'file_signature', 'timestamp', 'strings', 'entropy', 'encoding'],
        description: 'Forensics operation',
      },
      data: { type: 'string', description: 'Data to analyze' },
      hex_data: { type: 'string', description: 'Hex-encoded data' },
      algorithm: { type: 'string', enum: ['fnv1a', 'djb2', 'sdbm'], description: 'Hash algorithm' },
      expected_hash: { type: 'string', description: 'Expected hash for verification' },
      timestamp: { type: 'number', description: 'Timestamp value' },
      timestamp_format: { type: 'string', enum: ['unix', 'unix_ms', 'filetime', 'mac_absolute'], description: 'Timestamp format' },
      min_string_length: { type: 'number', description: 'Minimum string length to extract' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeForensics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'hash': {
        const { data = 'test data', algorithm = 'fnv1a', expected_hash } = args;
        const hash = simpleHash(data, algorithm);

        const hashResult: Record<string, unknown> = {
          operation: 'hash',
          input_length: data.length,
          algorithm: algorithm,
          hash: hash,
        };

        if (expected_hash) {
          const matches = checksumVerify(data, expected_hash, algorithm);
          hashResult.verification = {
            expected: expected_hash,
            computed: hash,
            matches: matches,
            integrity: matches ? 'VERIFIED' : 'MISMATCH - Data may be altered',
          };
        }

        hashResult.note = 'For production use, employ SHA-256/SHA-512';
        result = hashResult;
        break;
      }

      case 'file_signature': {
        const { hex_data = '89504E470D0A1A0A' } = args;
        const identified = identifyFileType(hex_data);

        result = {
          operation: 'file_signature',
          input_hex: hex_data.substring(0, 16) + (hex_data.length > 16 ? '...' : ''),
          identification: identified || { type: 'Unknown', extension: 'unknown' },
          known_signatures: Object.entries(FILE_SIGNATURES).map(([sig, info]) => ({
            signature: sig,
            type: info.description,
            extension: info.extension,
          })),
        };
        break;
      }

      case 'timestamp': {
        const { timestamp = Math.floor(Date.now() / 1000), timestamp_format = 'unix' } = args;
        const parsed = parseTimestamp(timestamp, timestamp_format);

        result = {
          operation: 'timestamp',
          input: timestamp,
          format: timestamp_format,
          parsed: parsed,
          current_time: {
            unix: Math.floor(Date.now() / 1000),
            iso: new Date().toISOString(),
          },
        };
        break;
      }

      case 'strings': {
        const { hex_data = '48656C6C6F20576F726C6421', min_string_length = 4 } = args;
        const strings = extractStrings(hex_data, min_string_length);

        result = {
          operation: 'strings',
          input_hex_length: hex_data.length,
          min_length: min_string_length,
          strings_found: strings.length,
          strings: strings.slice(0, 50), // Limit output
          truncated: strings.length > 50,
        };
        break;
      }

      case 'entropy': {
        const { data = 'Hello World! This is a test.' } = args;
        const entropy = calculateEntropy(data);
        const analysis = entropyAnalysis(entropy);

        result = {
          operation: 'entropy',
          input_length: data.length,
          unique_characters: new Set(data).size,
          entropy_bits_per_char: Math.round(entropy * 1000) / 1000,
          max_possible_entropy: Math.log2(new Set(data).size),
          analysis: analysis,
          scale: {
            '0-3': 'Plain text, repeated patterns',
            '3-5': 'Natural language, some structure',
            '5-7': 'Compressed or encoded data',
            '7-8': 'Encrypted or random data',
          },
        };
        break;
      }

      case 'encoding': {
        const { data = 'SGVsbG8gV29ybGQh' } = args;
        const detectedEncodings = detectEncodings(data);

        const decoded: Record<string, string | null> = {};

        // Try to decode
        if (/^[A-Za-z0-9+/]+=*$/.test(data)) {
          try {
            decoded['base64'] = Buffer.from(data, 'base64').toString('utf8');
          } catch {
            decoded['base64'] = null;
          }
        }

        if (/^[0-9A-Fa-f]+$/.test(data) && data.length % 2 === 0) {
          let hex = '';
          for (let i = 0; i < data.length; i += 2) {
            hex += String.fromCharCode(parseInt(data.substr(i, 2), 16));
          }
          decoded['hex'] = hex;
        }

        result = {
          operation: 'encoding',
          input: data.substring(0, 50) + (data.length > 50 ? '...' : ''),
          input_length: data.length,
          detected_encodings: detectedEncodings,
          decoded_attempts: decoded,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Forensics Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isForensicsAvailable(): boolean { return true; }

// ESLint unused function references
void _timelineDiff;
