/**
 * REED-SOLOMON TOOL
 * Complete Reed-Solomon error correction codec
 *
 * Reed-Solomon codes are powerful error-correcting codes used in:
 * - QR codes (RS over GF(2^8))
 * - CDs and DVDs (Cross-Interleaved RS)
 * - Satellite and deep-space communication
 * - RAID-6 storage systems
 *
 * This implementation provides:
 * - Galois Field GF(2^8) arithmetic
 * - Systematic RS encoding
 * - Syndrome computation
 * - Berlekamp-Massey error locator polynomial
 * - Chien search for error locations
 * - Forney algorithm for error magnitudes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// GALOIS FIELD GF(2^8) ARITHMETIC
// Uses primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D for QR codes)
// ============================================================================

class GaloisField {
  readonly size: number;
  readonly primitive: number;
  readonly expTable: number[];
  readonly logTable: number[];

  constructor(primitive: number = 0x11D, generator: number = 2) {
    this.size = 256;
    this.primitive = primitive;
    this.expTable = new Array(512);
    this.logTable = new Array(256);

    // Build exponential and logarithm tables
    let x = 1;
    for (let i = 0; i < 255; i++) {
      this.expTable[i] = x;
      this.logTable[x] = i;
      x = this.multiply_noTable(x, generator);
    }
    // Extend exp table for easier multiplication
    for (let i = 255; i < 512; i++) {
      this.expTable[i] = this.expTable[i - 255];
    }
  }

  private multiply_noTable(a: number, b: number): number {
    // Russian peasant multiplication in GF(2^8)
    let result = 0;
    while (b > 0) {
      if (b & 1) result ^= a;
      b >>= 1;
      a <<= 1;
      if (a & 0x100) a ^= this.primitive;
    }
    return result;
  }

  add(a: number, b: number): number {
    return a ^ b;
  }

  subtract(a: number, b: number): number {
    return a ^ b; // Same as add in GF(2^n)
  }

  multiply(a: number, b: number): number {
    if (a === 0 || b === 0) return 0;
    return this.expTable[this.logTable[a] + this.logTable[b]];
  }

  divide(a: number, b: number): number {
    if (b === 0) throw new Error('Division by zero in Galois Field');
    if (a === 0) return 0;
    return this.expTable[(this.logTable[a] - this.logTable[b] + 255) % 255];
  }

  power(a: number, n: number): number {
    if (a === 0) return n === 0 ? 1 : 0;
    return this.expTable[(this.logTable[a] * n) % 255];
  }

  inverse(a: number): number {
    if (a === 0) throw new Error('Cannot invert zero');
    return this.expTable[255 - this.logTable[a]];
  }

  exp(n: number): number {
    return this.expTable[n % 255];
  }

  log(a: number): number {
    if (a === 0) throw new Error('Log of zero undefined');
    return this.logTable[a];
  }
}

// ============================================================================
// POLYNOMIAL OPERATIONS OVER GF(2^8)
// ============================================================================

class GFPolynomial {
  readonly coefficients: number[];
  readonly gf: GaloisField;

  constructor(coefficients: number[], gf: GaloisField) {
    this.gf = gf;
    // Remove leading zeros
    let firstNonZero = 0;
    while (firstNonZero < coefficients.length - 1 && coefficients[firstNonZero] === 0) {
      firstNonZero++;
    }
    this.coefficients = coefficients.slice(firstNonZero);
  }

  get degree(): number {
    return this.coefficients.length - 1;
  }

  getCoefficient(degree: number): number {
    return this.coefficients[this.coefficients.length - 1 - degree] || 0;
  }

  evaluate(x: number): number {
    if (x === 0) return this.getCoefficient(0);
    let result = this.coefficients[0];
    for (let i = 1; i < this.coefficients.length; i++) {
      result = this.gf.add(this.gf.multiply(result, x), this.coefficients[i]);
    }
    return result;
  }

  multiply(other: GFPolynomial): GFPolynomial {
    const result = new Array(this.coefficients.length + other.coefficients.length - 1).fill(0);
    for (let i = 0; i < this.coefficients.length; i++) {
      for (let j = 0; j < other.coefficients.length; j++) {
        result[i + j] = this.gf.add(
          result[i + j],
          this.gf.multiply(this.coefficients[i], other.coefficients[j])
        );
      }
    }
    return new GFPolynomial(result, this.gf);
  }

  multiplyScalar(scalar: number): GFPolynomial {
    const result = this.coefficients.map(c => this.gf.multiply(c, scalar));
    return new GFPolynomial(result, this.gf);
  }

  add(other: GFPolynomial): GFPolynomial {
    const maxLen = Math.max(this.coefficients.length, other.coefficients.length);
    const result = new Array(maxLen).fill(0);
    const thisOffset = maxLen - this.coefficients.length;
    const otherOffset = maxLen - other.coefficients.length;
    for (let i = 0; i < this.coefficients.length; i++) {
      result[i + thisOffset] = this.coefficients[i];
    }
    for (let i = 0; i < other.coefficients.length; i++) {
      result[i + otherOffset] = this.gf.add(result[i + otherOffset], other.coefficients[i]);
    }
    return new GFPolynomial(result, this.gf);
  }

  divide(divisor: GFPolynomial): { quotient: GFPolynomial; remainder: GFPolynomial } {
    if (divisor.coefficients.length === 1 && divisor.coefficients[0] === 0) {
      throw new Error('Division by zero polynomial');
    }

    const quotient = new Array(Math.max(this.coefficients.length - divisor.coefficients.length + 1, 1)).fill(0);
    let remainder = [...this.coefficients];

    const divisorLeadingCoeff = divisor.coefficients[0];
    const divisorDegree = divisor.coefficients.length;

    for (let i = 0; i <= remainder.length - divisorDegree; i++) {
      const coeff = this.gf.divide(remainder[i], divisorLeadingCoeff);
      quotient[i] = coeff;
      if (coeff !== 0) {
        for (let j = 0; j < divisorDegree; j++) {
          remainder[i + j] = this.gf.subtract(
            remainder[i + j],
            this.gf.multiply(divisor.coefficients[j], coeff)
          );
        }
      }
    }

    const remainderStart = remainder.length - divisorDegree + 1;
    return {
      quotient: new GFPolynomial(quotient, this.gf),
      remainder: new GFPolynomial(remainder.slice(remainderStart), this.gf)
    };
  }
}

// ============================================================================
// REED-SOLOMON CODEC
// ============================================================================

class ReedSolomonCodec {
  readonly gf: GaloisField;
  readonly nsym: number; // Number of error correction symbols
  readonly fcr: number;  // First consecutive root
  readonly generator: GFPolynomial;

  constructor(nsym: number = 10, fcr: number = 0, primitive: number = 0x11D) {
    this.gf = new GaloisField(primitive);
    this.nsym = nsym;
    this.fcr = fcr;
    this.generator = this.buildGenerator();
  }

  private buildGenerator(): GFPolynomial {
    let g = new GFPolynomial([1], this.gf);
    for (let i = 0; i < this.nsym; i++) {
      const root = this.gf.exp(i + this.fcr);
      g = g.multiply(new GFPolynomial([1, root], this.gf));
    }
    return g;
  }

  encode(data: number[]): number[] {
    // Systematic encoding: message + parity
    // Parity = -(data * x^nsym) mod generator
    const dataWithParity = [...data, ...new Array(this.nsym).fill(0)];
    const dataPoly = new GFPolynomial(data, this.gf);

    // Multiply by x^nsym
    const shifted = new GFPolynomial([...data, ...new Array(this.nsym).fill(0)], this.gf);

    // Divide by generator
    const { remainder } = shifted.divide(this.generator);

    // XOR remainder into parity positions
    const parityStart = data.length;
    for (let i = 0; i < remainder.coefficients.length; i++) {
      dataWithParity[parityStart + (this.nsym - remainder.coefficients.length) + i] = remainder.coefficients[i];
    }

    return dataWithParity;
  }

  computeSyndromes(received: number[]): number[] {
    const syndromes = new Array(this.nsym).fill(0);
    const poly = new GFPolynomial(received, this.gf);

    for (let i = 0; i < this.nsym; i++) {
      syndromes[i] = poly.evaluate(this.gf.exp(i + this.fcr));
    }

    return syndromes;
  }

  hasErrors(syndromes: number[]): boolean {
    return syndromes.some(s => s !== 0);
  }

  // Berlekamp-Massey algorithm to find error locator polynomial
  berlekampMassey(syndromes: number[]): GFPolynomial {
    const n = syndromes.length;

    // Error locator polynomial σ(x)
    let sigma = new GFPolynomial([1], this.gf);
    let oldSigma = new GFPolynomial([1], this.gf);

    for (let i = 0; i < n; i++) {
      // Compute discrepancy
      let delta = syndromes[i];
      for (let j = 1; j <= sigma.degree; j++) {
        delta = this.gf.add(delta, this.gf.multiply(
          sigma.getCoefficient(j),
          syndromes[i - j]
        ));
      }

      // Shift old sigma
      oldSigma = new GFPolynomial([...oldSigma.coefficients, 0], this.gf);

      if (delta !== 0) {
        if (oldSigma.degree > sigma.degree) {
          const newSigma = oldSigma.multiplyScalar(delta);
          oldSigma = sigma.multiplyScalar(this.gf.inverse(delta));
          sigma = newSigma;
        }
        sigma = sigma.add(oldSigma.multiplyScalar(delta));
      }
    }

    return sigma;
  }

  // Chien search to find error locations
  chienSearch(sigma: GFPolynomial, n: number): number[] {
    const errors: number[] = [];

    for (let i = 0; i < n; i++) {
      // Evaluate at α^(-i)
      const x = this.gf.exp(255 - i);
      if (sigma.evaluate(x) === 0) {
        errors.push(n - 1 - i);
      }
    }

    return errors;
  }

  // Forney algorithm to find error magnitudes
  forney(syndromes: number[], sigma: GFPolynomial, errorPositions: number[], n: number): number[] {
    // Compute error evaluator polynomial Ω(x) = S(x) * σ(x) mod x^nsym
    const syndromePoly = new GFPolynomial([0, ...syndromes], this.gf);
    let omega = syndromePoly.multiply(sigma);

    // Take mod x^nsym (keep only last nsym+1 coefficients)
    if (omega.coefficients.length > this.nsym + 1) {
      omega = new GFPolynomial(
        omega.coefficients.slice(omega.coefficients.length - this.nsym - 1),
        this.gf
      );
    }

    // Compute formal derivative of sigma
    const sigmaDerivCoeffs: number[] = [];
    for (let i = sigma.degree; i >= 1; i--) {
      if (i % 2 === 1) {
        sigmaDerivCoeffs.push(sigma.getCoefficient(i));
      } else {
        sigmaDerivCoeffs.push(0);
      }
    }
    sigmaDerivCoeffs.reverse();
    const sigmaDeriv = new GFPolynomial(sigmaDerivCoeffs.length > 0 ? sigmaDerivCoeffs : [0], this.gf);

    // Compute error magnitudes
    const magnitudes: number[] = [];
    for (const pos of errorPositions) {
      const xiInv = this.gf.exp(255 - (n - 1 - pos));
      const omegaVal = omega.evaluate(xiInv);
      const sigmaDerivVal = sigmaDeriv.evaluate(xiInv);

      if (sigmaDerivVal === 0) {
        magnitudes.push(0);
      } else {
        // Y_i = X_i * Ω(X_i^-1) / σ'(X_i^-1)
        const xi = this.gf.exp(n - 1 - pos);
        let magnitude = this.gf.multiply(xi, this.gf.divide(omegaVal, sigmaDerivVal));

        // Apply FCR correction if needed
        if (this.fcr !== 0) {
          magnitude = this.gf.multiply(magnitude, this.gf.power(xiInv, this.fcr));
        }

        magnitudes.push(magnitude);
      }
    }

    return magnitudes;
  }

  decode(received: number[]): { data: number[]; corrected: number; errors: number[] } {
    const syndromes = this.computeSyndromes(received);

    if (!this.hasErrors(syndromes)) {
      return {
        data: received.slice(0, received.length - this.nsym),
        corrected: 0,
        errors: []
      };
    }

    // Find error locator polynomial
    const sigma = this.berlekampMassey(syndromes);

    // Find error positions
    const errorPositions = this.chienSearch(sigma, received.length);

    // Check if number of errors matches degree of sigma
    if (errorPositions.length !== sigma.degree) {
      throw new Error(`Decoding failed: found ${errorPositions.length} errors but sigma degree is ${sigma.degree}`);
    }

    // Check if we can correct this many errors
    if (errorPositions.length > this.nsym / 2) {
      throw new Error(`Too many errors to correct: ${errorPositions.length} > ${Math.floor(this.nsym / 2)}`);
    }

    // Find error magnitudes
    const magnitudes = this.forney(syndromes, sigma, errorPositions, received.length);

    // Correct errors
    const corrected = [...received];
    for (let i = 0; i < errorPositions.length; i++) {
      corrected[errorPositions[i]] = this.gf.subtract(corrected[errorPositions[i]], magnitudes[i]);
    }

    return {
      data: corrected.slice(0, corrected.length - this.nsym),
      corrected: errorPositions.length,
      errors: errorPositions
    };
  }
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const reedsolomonTool: UnifiedTool = {
  name: 'reed_solomon',
  description: 'Reed-Solomon error correction codec for QR codes, CDs, DVDs, and data transmission',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['encode', 'decode', 'syndrome', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      data: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input data bytes (0-255)'
      },
      nsym: {
        type: 'number',
        description: 'Number of error correction symbols (default: 10)'
      },
      fcr: {
        type: 'number',
        description: 'First consecutive root (default: 0)'
      },
      primitive: {
        type: 'number',
        description: 'Primitive polynomial (default: 0x11D for QR codes)'
      },
      error_positions: {
        type: 'array',
        items: { type: 'number' },
        description: 'Positions to introduce errors (for testing)'
      },
      error_values: {
        type: 'array',
        items: { type: 'number' },
        description: 'Error values to XOR at error positions'
      }
    },
    required: ['operation']
  }
};

export async function executereedsolomon(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, data, nsym = 10, fcr = 0, primitive = 0x11D, error_positions, error_values } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Reed-Solomon Error Correction',
        description: 'Systematic Reed-Solomon codec over GF(2^8)',
        operations: {
          encode: 'Encode data with RS parity symbols',
          decode: 'Decode and correct errors in received data',
          syndrome: 'Compute error syndromes',
          analyze: 'Analyze RS parameters and capabilities'
        },
        parameters: {
          nsym: 'Number of parity symbols (can correct nsym/2 errors)',
          fcr: 'First consecutive root of generator polynomial',
          primitive: 'Primitive polynomial for GF(2^8)'
        },
        commonConfigs: {
          'QR Code': { nsym: 'varies by level', primitive: '0x11D', fcr: 0 },
          'DVD': { nsym: 16, primitive: '0x11D', fcr: 0 },
          'CD (CIRC)': { nsym: 4, primitive: '0x11D', fcr: 0 }
        },
        galoisField: {
          size: 256,
          defaultPrimitive: '0x11D (x^8 + x^4 + x^3 + x^2 + 1)',
          generator: 2
        },
        capabilities: {
          maxCorrectableErrors: 'floor(nsym / 2)',
          maxDetectableErrors: 'nsym',
          erasureCorrection: 'Up to nsym erasures if positions known'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Analyze operation
    if (operation === 'analyze') {
      const codec = new ReedSolomonCodec(nsym, fcr, primitive);
      const analysis = {
        parameters: {
          nsym,
          fcr,
          primitive: `0x${primitive.toString(16).toUpperCase()}`
        },
        generatorPolynomial: {
          degree: codec.generator.degree,
          coefficients: codec.generator.coefficients.map(c => `0x${c.toString(16).toUpperCase()}`)
        },
        capabilities: {
          errorCorrectionCapability: Math.floor(nsym / 2),
          errorDetectionCapability: nsym,
          erasureCorrectionCapability: nsym,
          codeRate: data ? `${data.length}/${data.length + nsym}` : `k/(k+${nsym})`
        },
        galoisField: {
          size: 256,
          primitive: `0x${primitive.toString(16).toUpperCase()}`,
          firstElements: Array.from({ length: 10 }, (_, i) => codec.gf.exp(i))
        }
      };
      return { toolCallId: id, content: JSON.stringify(analysis, null, 2) };
    }

    // Validate data for other operations
    if (!data || !Array.isArray(data)) {
      return { toolCallId: id, content: 'Error: data array required for encode/decode/syndrome operations', isError: true };
    }

    // Validate data values
    for (const byte of data) {
      if (byte < 0 || byte > 255 || !Number.isInteger(byte)) {
        return { toolCallId: id, content: `Error: data values must be integers 0-255, got ${byte}`, isError: true };
      }
    }

    const codec = new ReedSolomonCodec(nsym, fcr, primitive);

    // Encode operation
    if (operation === 'encode') {
      const encoded = codec.encode(data);

      // Optionally introduce errors for testing
      let withErrors = encoded;
      if (error_positions && error_values) {
        withErrors = [...encoded];
        for (let i = 0; i < Math.min(error_positions.length, error_values.length); i++) {
          const pos = error_positions[i];
          if (pos >= 0 && pos < withErrors.length) {
            withErrors[pos] ^= error_values[i];
          }
        }
      }

      const result = {
        operation: 'encode',
        input: {
          data,
          length: data.length
        },
        output: {
          encoded: withErrors,
          length: withErrors.length,
          dataBytes: data.length,
          parityBytes: nsym
        },
        ...(error_positions ? {
          errorsIntroduced: {
            positions: error_positions.slice(0, error_values?.length || 0),
            values: error_values?.slice(0, error_positions.length) || []
          }
        } : {}),
        generator: {
          degree: codec.generator.degree,
          roots: Array.from({ length: nsym }, (_, i) => codec.gf.exp(i + fcr))
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Syndrome operation
    if (operation === 'syndrome') {
      const syndromes = codec.computeSyndromes(data);
      const hasErrors = codec.hasErrors(syndromes);

      const result = {
        operation: 'syndrome',
        input: {
          received: data,
          length: data.length
        },
        syndromes: {
          values: syndromes,
          hex: syndromes.map(s => `0x${s.toString(16).toUpperCase().padStart(2, '0')}`),
          allZero: !hasErrors
        },
        errorDetected: hasErrors,
        interpretation: hasErrors
          ? 'Non-zero syndromes indicate errors in received data'
          : 'All syndromes are zero, data appears error-free'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    // Decode operation
    if (operation === 'decode') {
      try {
        const decoded = codec.decode(data);

        const result = {
          operation: 'decode',
          input: {
            received: data,
            length: data.length
          },
          output: {
            data: decoded.data,
            dataLength: decoded.data.length
          },
          correction: {
            errorsFound: decoded.corrected,
            errorPositions: decoded.errors,
            maxCorrectable: Math.floor(nsym / 2),
            success: true
          },
          syndromes: {
            before: codec.computeSyndromes(data),
            after: decoded.corrected > 0
              ? codec.computeSyndromes([...decoded.data, ...data.slice(-nsym)])
              : 'N/A (no corrections needed)'
          }
        };

        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      } catch (decodeError) {
        const syndromes = codec.computeSyndromes(data);
        const result = {
          operation: 'decode',
          input: {
            received: data,
            length: data.length
          },
          error: decodeError instanceof Error ? decodeError.message : 'Decoding failed',
          syndromes: {
            values: syndromes,
            nonZeroCount: syndromes.filter(s => s !== 0).length
          },
          suggestion: 'Too many errors to correct. Ensure error count ≤ ' + Math.floor(nsym / 2)
        };
        return { toolCallId: id, content: JSON.stringify(result, null, 2) };
      }
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isreedsolomonAvailable(): boolean {
  return true;
}
