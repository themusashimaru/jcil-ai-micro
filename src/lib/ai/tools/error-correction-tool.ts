// ============================================================================
// ERROR CORRECTION CODES TOOL - TIER GODMODE
// ============================================================================
// Educational demonstrations of error detection and correction codes:
// Hamming codes, CRC, Reed-Solomon basics, parity checks, and checksums.
// Pure TypeScript implementation for learning.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// PARITY CHECKS
// ============================================================================

function calculateParity(bits: number[], even: boolean = true): number {
  const sum = bits.reduce((a, b) => a + b, 0);
  return even ? sum % 2 : (sum + 1) % 2;
}

function addParityBit(data: string, even: boolean = true): { result: string; parity: number } {
  const bits = data.split('').map(Number);
  const parity = calculateParity(bits, even);
  return { result: data + parity, parity };
}

function checkParity(data: string, even: boolean = true): { valid: boolean; parity: number } {
  const bits = data.split('').map(Number);
  const parity = calculateParity(bits, even);
  return { valid: parity === 0, parity };
}

// ============================================================================
// HAMMING CODE (7,4)
// ============================================================================

function hammingEncode74(data: string): {
  encoded: string;
  steps: string[];
  positions: Record<string, string>;
} {
  if (data.length !== 4 || !/^[01]+$/.test(data)) {
    throw new Error('Hamming(7,4) requires exactly 4 data bits (e.g., "1011")');
  }

  const d = data.split('').map(Number);
  const steps: string[] = [];

  // Positions: p1, p2, d1, p4, d2, d3, d4
  // Data bits at positions 3, 5, 6, 7 (1-indexed)
  // Parity bits at positions 1, 2, 4

  // Calculate parity bits
  // p1 covers positions 1, 3, 5, 7 (binary: ***1)
  const p1 = (d[0] + d[1] + d[3]) % 2;
  steps.push(`p1 covers d1,d2,d4: ${d[0]}⊕${d[1]}⊕${d[3]} = ${p1}`);

  // p2 covers positions 2, 3, 6, 7 (binary: **1*)
  const p2 = (d[0] + d[2] + d[3]) % 2;
  steps.push(`p2 covers d1,d3,d4: ${d[0]}⊕${d[2]}⊕${d[3]} = ${p2}`);

  // p4 covers positions 4, 5, 6, 7 (binary: *1**)
  const p4 = (d[1] + d[2] + d[3]) % 2;
  steps.push(`p4 covers d2,d3,d4: ${d[1]}⊕${d[2]}⊕${d[3]} = ${p4}`);

  const encoded = `${p1}${p2}${d[0]}${p4}${d[1]}${d[2]}${d[3]}`;
  steps.push(`Encoded: [p1=${p1}][p2=${p2}][d1=${d[0]}][p4=${p4}][d2=${d[1]}][d3=${d[2]}][d4=${d[3]}]`);

  return {
    encoded,
    steps,
    positions: {
      '1': `p1=${p1}`,
      '2': `p2=${p2}`,
      '3': `d1=${d[0]}`,
      '4': `p4=${p4}`,
      '5': `d2=${d[1]}`,
      '6': `d3=${d[2]}`,
      '7': `d4=${d[3]}`,
    },
  };
}

function hammingDecode74(received: string): {
  data: string;
  error_position: number | null;
  corrected: string;
  syndrome: number;
  steps: string[];
} {
  if (received.length !== 7 || !/^[01]+$/.test(received)) {
    throw new Error('Hamming(7,4) decode requires exactly 7 bits');
  }

  const r = received.split('').map(Number);
  const steps: string[] = [];

  // Calculate syndrome
  // s1 = p1 ⊕ d1 ⊕ d2 ⊕ d4 (positions 1,3,5,7)
  const s1 = (r[0] + r[2] + r[4] + r[6]) % 2;
  steps.push(`s1 = r1⊕r3⊕r5⊕r7 = ${r[0]}⊕${r[2]}⊕${r[4]}⊕${r[6]} = ${s1}`);

  // s2 = p2 ⊕ d1 ⊕ d3 ⊕ d4 (positions 2,3,6,7)
  const s2 = (r[1] + r[2] + r[5] + r[6]) % 2;
  steps.push(`s2 = r2⊕r3⊕r6⊕r7 = ${r[1]}⊕${r[2]}⊕${r[5]}⊕${r[6]} = ${s2}`);

  // s4 = p4 ⊕ d2 ⊕ d3 ⊕ d4 (positions 4,5,6,7)
  const s4 = (r[3] + r[4] + r[5] + r[6]) % 2;
  steps.push(`s4 = r4⊕r5⊕r6⊕r7 = ${r[3]}⊕${r[4]}⊕${r[5]}⊕${r[6]} = ${s4}`);

  // Syndrome = s4*4 + s2*2 + s1 (error position, 1-indexed, 0 = no error)
  const syndrome = s4 * 4 + s2 * 2 + s1;
  steps.push(`Syndrome = ${s4}×4 + ${s2}×2 + ${s1}×1 = ${syndrome}`);

  const corrected = [...r];
  let errorPosition: number | null = null;

  if (syndrome !== 0) {
    errorPosition = syndrome;
    corrected[syndrome - 1] = 1 - corrected[syndrome - 1];
    steps.push(`Error detected at position ${syndrome}, correcting bit`);
  } else {
    steps.push('No error detected (syndrome = 0)');
  }

  // Extract data bits (positions 3, 5, 6, 7 → indices 2, 4, 5, 6)
  const data = `${corrected[2]}${corrected[4]}${corrected[5]}${corrected[6]}`;
  steps.push(`Extracted data: ${data}`);

  return {
    data,
    error_position: errorPosition,
    corrected: corrected.join(''),
    syndrome,
    steps,
  };
}

// ============================================================================
// HAMMING SECDED (8,4) - Single Error Correction, Double Error Detection
// ============================================================================

function hammingEncodeSECDED(data: string): { encoded: string; steps: string[] } {
  const hamming74 = hammingEncode74(data);
  const bits = hamming74.encoded.split('').map(Number);

  // Add overall parity bit
  const overallParity = bits.reduce((a, b) => a + b, 0) % 2;
  const encoded = overallParity + hamming74.encoded;

  return {
    encoded,
    steps: [
      ...hamming74.steps,
      `Overall parity (p0): ${bits.join('⊕')} = ${overallParity}`,
      `SECDED encoded: ${encoded}`,
    ],
  };
}

function hammingDecodeSECDED(received: string): {
  data: string;
  error_type: 'none' | 'single' | 'double';
  corrected: string | null;
  steps: string[];
} {
  if (received.length !== 8) {
    throw new Error('SECDED requires 8 bits');
  }

  const p0 = parseInt(received[0], 10);
  const hamming7 = received.slice(1);

  const steps: string[] = [];

  // Check overall parity
  const bits = received.split('').map(Number);
  const overallParity = bits.reduce((a, b) => a + b, 0) % 2;
  steps.push(`Overall parity check: ${overallParity === 0 ? 'PASS' : 'FAIL'}`);

  // Decode Hamming(7,4)
  const decoded = hammingDecode74(hamming7);
  steps.push(...decoded.steps.map((s) => `  ${s}`));

  let errorType: 'none' | 'single' | 'double';
  let corrected: string | null;

  if (decoded.syndrome === 0 && overallParity === 0) {
    errorType = 'none';
    corrected = received;
    steps.push('No errors detected');
  } else if (decoded.syndrome !== 0 && overallParity === 1) {
    errorType = 'single';
    corrected = p0 + decoded.corrected;
    steps.push('Single error detected and corrected');
  } else if (decoded.syndrome !== 0 && overallParity === 0) {
    errorType = 'double';
    corrected = null;
    steps.push('DOUBLE ERROR DETECTED - Cannot correct!');
  } else {
    // syndrome === 0 && overallParity === 1 → error in p0
    errorType = 'single';
    corrected = (1 - p0) + hamming7;
    steps.push('Error in overall parity bit, corrected');
  }

  return {
    data: decoded.data,
    error_type: errorType,
    corrected,
    steps,
  };
}

// ============================================================================
// CRC (Cyclic Redundancy Check)
// ============================================================================

function crcCalculate(
  data: string,
  polynomial: string
): { crc: string; remainder: string; steps: string[] } {
  const steps: string[] = [];

  // Append zeros for division
  const polyLen = polynomial.length;
  const dividend = data + '0'.repeat(polyLen - 1);
  steps.push(`Data with appended zeros: ${dividend}`);
  steps.push(`Polynomial (divisor): ${polynomial}`);

  // XOR division
  const dividendArr = dividend.split('');
  let i = 0;

  while (i <= dividendArr.length - polyLen) {
    if (dividendArr[i] === '1') {
      for (let j = 0; j < polyLen; j++) {
        dividendArr[i + j] = dividendArr[i + j] === polynomial[j] ? '0' : '1';
      }
      steps.push(`XOR at position ${i}: ${dividendArr.join('')}`);
    }
    i++;
  }

  const remainder = dividendArr.slice(-(polyLen - 1)).join('');
  steps.push(`Remainder (CRC): ${remainder}`);

  return {
    crc: remainder,
    remainder,
    steps,
  };
}

function crcVerify(
  dataWithCRC: string,
  polynomial: string
): { valid: boolean; remainder: string } {
  const polyLen = polynomial.length;
  const dividendArr = dataWithCRC.split('');
  let i = 0;

  while (i <= dividendArr.length - polyLen) {
    if (dividendArr[i] === '1') {
      for (let j = 0; j < polyLen; j++) {
        dividendArr[i + j] = dividendArr[i + j] === polynomial[j] ? '0' : '1';
      }
    }
    i++;
  }

  const remainder = dividendArr.slice(-(polyLen - 1)).join('');
  return {
    valid: remainder === '0'.repeat(polyLen - 1),
    remainder,
  };
}

// Standard CRC polynomials
const CRC_POLYNOMIALS = {
  'CRC-4': '10011',
  'CRC-8': '100000111',
  'CRC-16-CCITT': '10001000000100001',
  'CRC-32': '100000100110000010001110110110111',
};

// ============================================================================
// CHECKSUM ALGORITHMS
// ============================================================================

function checksumSimple(data: number[]): { checksum: number; verification: number } {
  const sum = data.reduce((a, b) => a + b, 0);
  const checksum = sum % 256;
  return {
    checksum,
    verification: (256 - checksum) % 256,
  };
}

function luhnChecksum(digits: string): {
  valid: boolean;
  checkDigit: number;
  steps: string[];
} {
  const steps: string[] = [];
  const nums = digits.split('').map(Number);

  // Double every second digit from right (for validation)
  // For generating check digit, double from second-to-last
  const processed = nums.map((n, i) => {
    const pos = nums.length - 1 - i;
    const shouldDouble = pos % 2 === 1;

    if (shouldDouble) {
      const doubled = n * 2;
      const result = doubled > 9 ? doubled - 9 : doubled;
      steps.push(`Position ${i}: ${n} × 2 = ${doubled}${doubled > 9 ? ` → ${result}` : ''}`);
      return result;
    }
    return n;
  });

  const sum = processed.reduce((a, b) => a + b, 0);
  steps.push(`Sum: ${sum}`);

  const checkDigit = (10 - (sum % 10)) % 10;

  return {
    valid: sum % 10 === 0,
    checkDigit,
    steps,
  };
}

function isbn10Checksum(isbn: string): { valid: boolean; checkDigit: string } {
  const digits = isbn.replace(/-/g, '').slice(0, 9);
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? '0' : remainder === 1 ? 'X' : (11 - remainder).toString();

  const fullISBN = isbn.replace(/-/g, '');
  const lastChar = fullISBN[9];
  const valid = fullISBN.length === 10 && lastChar?.toUpperCase() === checkDigit;

  return { valid, checkDigit };
}

// ============================================================================
// REPETITION CODE
// ============================================================================

function repetitionEncode(bit: string, n: number = 3): string {
  return bit.repeat(n);
}

function repetitionDecode(received: string): { bit: string; confidence: number } {
  const ones = (received.match(/1/g) || []).length;
  const zeros = received.length - ones;
  const bit = ones > zeros ? '1' : '0';
  const confidence = Math.max(ones, zeros) / received.length;
  return { bit, confidence };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const errorCorrectionTool: UnifiedTool = {
  name: 'error_correction',
  description: `Error detection and correction code demonstrations.

Operations:

Parity:
- parity_add: Add parity bit to data
- parity_check: Check parity of received data

Hamming Codes:
- hamming_encode: Encode 4 data bits to 7-bit Hamming(7,4)
- hamming_decode: Decode and correct single-bit errors
- secded_encode: Hamming(8,4) with double-error detection
- secded_decode: Decode SECDED with error classification

CRC:
- crc_calculate: Calculate CRC checksum
- crc_verify: Verify data with CRC

Checksums:
- checksum: Simple modular checksum
- luhn: Luhn algorithm (credit cards)
- isbn10: ISBN-10 check digit

Repetition:
- repetition_encode: Simple repetition code
- repetition_decode: Majority voting decode

Learn:
- explain: Explain error correction concepts`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'parity_add', 'parity_check',
          'hamming_encode', 'hamming_decode',
          'secded_encode', 'secded_decode',
          'crc_calculate', 'crc_verify',
          'checksum', 'luhn', 'isbn10',
          'repetition_encode', 'repetition_decode',
          'explain',
        ],
        description: 'Operation to perform',
      },
      data: { type: 'string', description: 'Binary data or input' },
      polynomial: { type: 'string', description: 'CRC polynomial or preset name' },
      even_parity: { type: 'boolean', description: 'Use even parity (default true)' },
      repetitions: { type: 'number', description: 'Number of repetitions' },
      topic: { type: 'string', description: 'Topic to explain' },
      introduce_error: { type: 'number', description: 'Position to flip bit (1-indexed)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeErrorCorrection(
  toolCall: UnifiedToolCall
): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, data } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'parity_add': {
        if (!data) throw new Error('data required');
        const evenParity = args.even_parity !== false;
        const parity = addParityBit(data, evenParity);
        result = {
          operation: 'parity_add',
          input: data,
          parity_type: evenParity ? 'even' : 'odd',
          parity_bit: parity.parity,
          result: parity.result,
          explanation: `Added ${evenParity ? 'even' : 'odd'} parity bit to make total 1s ${evenParity ? 'even' : 'odd'}`,
        };
        break;
      }

      case 'parity_check': {
        if (!data) throw new Error('data required');
        const evenParity = args.even_parity !== false;
        const check = checkParity(data, evenParity);
        result = {
          operation: 'parity_check',
          input: data,
          parity_type: evenParity ? 'even' : 'odd',
          valid: check.valid,
          calculated_parity: check.parity,
          explanation: check.valid
            ? 'Parity check passed - no single-bit errors detected'
            : 'Parity check FAILED - error detected!',
        };
        break;
      }

      case 'hamming_encode': {
        if (!data) throw new Error('data required (4 bits)');
        const encoded = hammingEncode74(data);

        // Optionally introduce error for demonstration
        let withError = encoded.encoded;
        let errorInfo = null;
        if (args.introduce_error) {
          const pos = args.introduce_error - 1;
          const bits = withError.split('');
          bits[pos] = bits[pos] === '0' ? '1' : '0';
          withError = bits.join('');
          errorInfo = { position: args.introduce_error, corrupted: withError };
        }

        result = {
          operation: 'hamming_encode',
          input: data,
          encoded: encoded.encoded,
          positions: encoded.positions,
          steps: encoded.steps,
          error_introduced: errorInfo,
          explanation: 'Hamming(7,4) can detect and correct any single-bit error',
        };
        break;
      }

      case 'hamming_decode': {
        if (!data) throw new Error('data required (7 bits)');
        const decoded = hammingDecode74(data);
        result = {
          operation: 'hamming_decode',
          received: data,
          syndrome: decoded.syndrome,
          error_position: decoded.error_position,
          corrected: decoded.corrected,
          extracted_data: decoded.data,
          steps: decoded.steps,
        };
        break;
      }

      case 'secded_encode': {
        if (!data) throw new Error('data required (4 bits)');
        const encoded = hammingEncodeSECDED(data);
        result = {
          operation: 'secded_encode',
          input: data,
          encoded: encoded.encoded,
          steps: encoded.steps,
          explanation: 'SECDED adds overall parity for double-error detection',
        };
        break;
      }

      case 'secded_decode': {
        if (!data) throw new Error('data required (8 bits)');
        const decoded = hammingDecodeSECDED(data);
        result = {
          operation: 'secded_decode',
          received: data,
          error_type: decoded.error_type,
          corrected: decoded.corrected,
          extracted_data: decoded.data,
          steps: decoded.steps,
        };
        break;
      }

      case 'crc_calculate': {
        if (!data) throw new Error('data required');
        let polynomial = args.polynomial || 'CRC-4';
        if (polynomial in CRC_POLYNOMIALS) {
          polynomial = CRC_POLYNOMIALS[polynomial as keyof typeof CRC_POLYNOMIALS];
        }
        const crcResult = crcCalculate(data, polynomial);
        result = {
          operation: 'crc_calculate',
          data,
          polynomial,
          crc: crcResult.crc,
          transmitted: data + crcResult.crc,
          steps: crcResult.steps,
          explanation: 'CRC detects burst errors and many bit-flip patterns',
        };
        break;
      }

      case 'crc_verify': {
        if (!data) throw new Error('data required');
        let polynomial = args.polynomial || 'CRC-4';
        if (polynomial in CRC_POLYNOMIALS) {
          polynomial = CRC_POLYNOMIALS[polynomial as keyof typeof CRC_POLYNOMIALS];
        }
        const verify = crcVerify(data, polynomial);
        result = {
          operation: 'crc_verify',
          received: data,
          polynomial,
          valid: verify.valid,
          remainder: verify.remainder,
          explanation: verify.valid
            ? 'CRC check passed - no errors detected'
            : 'CRC check FAILED - data corrupted!',
        };
        break;
      }

      case 'checksum': {
        const bytes = data
          ? data.split('').map((c: string) => c.charCodeAt(0))
          : [0x45, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65];
        const check = checksumSimple(bytes);
        result = {
          operation: 'checksum',
          data: bytes.map((b: number) => b.toString(16).padStart(2, '0')).join(' '),
          checksum: check.checksum,
          checksum_hex: check.checksum.toString(16).padStart(2, '0'),
          verification_byte: check.verification,
        };
        break;
      }

      case 'luhn': {
        if (!data) throw new Error('data required (digits)');
        const luhn = luhnChecksum(data);
        result = {
          operation: 'luhn',
          input: data,
          valid: luhn.valid,
          check_digit: luhn.checkDigit,
          with_check_digit: data.slice(0, -1) + luhn.checkDigit,
          steps: luhn.steps,
          used_in: ['Credit card numbers', 'IMEI numbers', 'National ID numbers'],
        };
        break;
      }

      case 'isbn10': {
        if (!data) throw new Error('data required (ISBN)');
        const isbn = isbn10Checksum(data);
        result = {
          operation: 'isbn10',
          input: data,
          valid: isbn.valid,
          correct_check_digit: isbn.checkDigit,
        };
        break;
      }

      case 'repetition_encode': {
        if (!data) throw new Error('data required (binary)');
        const n = args.repetitions || 3;
        const encoded = data.split('').map((b: string) => repetitionEncode(b, n)).join('');
        result = {
          operation: 'repetition_encode',
          input: data,
          repetitions: n,
          encoded,
          explanation: `Each bit repeated ${n} times. Can correct up to ${Math.floor((n - 1) / 2)} errors per bit.`,
        };
        break;
      }

      case 'repetition_decode': {
        if (!data) throw new Error('data required');
        const n = args.repetitions || 3;
        const chunks: string[] = [];
        for (let i = 0; i < data.length; i += n) {
          chunks.push(data.slice(i, i + n));
        }
        const decoded = chunks.map((chunk) => {
          const result = repetitionDecode(chunk);
          return { chunk, ...result };
        });
        result = {
          operation: 'repetition_decode',
          input: data,
          chunk_size: n,
          decoded_bits: decoded.map((d) => d.bit).join(''),
          details: decoded,
        };
        break;
      }

      case 'explain': {
        const topic = args.topic || 'overview';
        const explanations: Record<string, unknown> = {
          overview: {
            title: 'Error Correction Codes Overview',
            content: [
              'Error correction codes add redundancy to detect and correct transmission errors.',
              'Key concepts:',
              '- Hamming distance: minimum bit flips between valid codewords',
              '- Detection: can detect d errors if Hamming distance > d',
              '- Correction: can correct t errors if Hamming distance > 2t',
            ],
            types: {
              'Parity': 'Detects odd number of bit flips',
              'Hamming': 'Corrects single-bit errors, detects double',
              'CRC': 'Detects burst errors, widely used in networks',
              'Reed-Solomon': 'Corrects burst errors, used in CDs/DVDs/QR codes',
            },
          },
          hamming: {
            title: 'Hamming Codes',
            content: [
              'Hamming(7,4) encodes 4 data bits into 7 bits',
              'Parity bits at positions 1, 2, 4 (powers of 2)',
              'Each parity bit covers specific data positions',
              'Syndrome identifies error position directly',
              'SECDED adds overall parity for double-error detection',
            ],
          },
          crc: {
            title: 'Cyclic Redundancy Check',
            content: [
              'Treats data as polynomial and divides by generator polynomial',
              'Remainder becomes the CRC checksum',
              'Very good at detecting burst errors',
              'Common polynomials: CRC-32 (Ethernet), CRC-16 (Modbus)',
            ],
          },
        };
        result = {
          operation: 'explain',
          topic,
          explanation: explanations[topic] || explanations['overview'],
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isErrorCorrectionAvailable(): boolean {
  return true;
}
