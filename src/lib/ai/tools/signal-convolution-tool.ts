/**
 * SIGNAL-CONVOLUTION TOOL
 * Complete signal convolution, correlation, and deconvolution
 *
 * This implementation provides:
 * - Linear convolution (time-domain and FFT-based)
 * - Circular/cyclic convolution
 * - Cross-correlation
 * - Auto-correlation
 * - Deconvolution (Wiener filter approach)
 * - Support for different output modes (full, same, valid)
 *
 * Applications:
 * - Digital signal processing
 * - Image filtering
 * - System identification
 * - Echo cancellation
 * - Template matching
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// COMPLEX NUMBER SUPPORT FOR FFT
// ============================================================================

interface Complex {
  re: number;
  im: number;
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re
  };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  };
}

function complexMag(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

function complexConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

// ============================================================================
// FFT IMPLEMENTATION (Cooley-Tukey)
// ============================================================================

function fft(signal: Complex[], inverse: boolean = false): Complex[] {
  const n = signal.length;

  if (n <= 1) return [...signal];

  // Ensure power of 2
  if ((n & (n - 1)) !== 0) {
    throw new Error('FFT requires power of 2 length');
  }

  // Bit-reversal permutation
  const result = [...signal];
  const bits = Math.log2(n);

  for (let i = 0; i < n; i++) {
    let reversed = 0;
    for (let j = 0; j < bits; j++) {
      reversed = (reversed << 1) | ((i >> j) & 1);
    }
    if (reversed > i) {
      [result[i], result[reversed]] = [result[reversed], result[i]];
    }
  }

  // Cooley-Tukey iterative FFT
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (inverse ? 2 : -2) * Math.PI / size;

    const wBase: Complex = {
      re: Math.cos(angle),
      im: Math.sin(angle)
    };

    for (let i = 0; i < n; i += size) {
      let w: Complex = { re: 1, im: 0 };

      for (let j = 0; j < halfSize; j++) {
        const even = result[i + j];
        const odd = complexMul(w, result[i + j + halfSize]);

        result[i + j] = complexAdd(even, odd);
        result[i + j + halfSize] = complexSub(even, odd);

        w = complexMul(w, wBase);
      }
    }
  }

  // Normalize for inverse FFT
  if (inverse) {
    for (let i = 0; i < n; i++) {
      result[i].re /= n;
      result[i].im /= n;
    }
  }

  return result;
}

function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function realToComplex(signal: number[]): Complex[] {
  return signal.map(x => ({ re: x, im: 0 }));
}

function complexToReal(signal: Complex[]): number[] {
  return signal.map(x => x.re);
}

// ============================================================================
// CONVOLUTION ALGORITHMS
// ============================================================================

/**
 * Linear convolution using direct computation (O(n*m))
 */
function linearConvolveDirect(signal: number[], kernel: number[]): number[] {
  const n = signal.length;
  const m = kernel.length;
  const result = new Array(n + m - 1).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      result[i + j] += signal[i] * kernel[j];
    }
  }

  return result;
}

/**
 * Linear convolution using FFT (O(n log n))
 */
function linearConvolveFFT(signal: number[], kernel: number[]): number[] {
  const outputLength = signal.length + kernel.length - 1;
  const fftLength = nextPowerOf2(outputLength);

  // Zero-pad signals
  const paddedSignal = [...signal, ...new Array(fftLength - signal.length).fill(0)];
  const paddedKernel = [...kernel, ...new Array(fftLength - kernel.length).fill(0)];

  // FFT both signals
  const signalFFT = fft(realToComplex(paddedSignal));
  const kernelFFT = fft(realToComplex(paddedKernel));

  // Multiply in frequency domain
  const productFFT = signalFFT.map((s, i) => complexMul(s, kernelFFT[i]));

  // Inverse FFT
  const result = fft(productFFT, true);

  // Return real parts, trimmed to correct length
  return complexToReal(result).slice(0, outputLength);
}

/**
 * Circular/cyclic convolution
 */
function circularConvolve(signal: number[], kernel: number[]): number[] {
  const n = Math.max(signal.length, kernel.length);

  // Zero-pad to same length
  const paddedSignal = [...signal, ...new Array(Math.max(0, n - signal.length)).fill(0)];
  const paddedKernel = [...kernel, ...new Array(Math.max(0, n - kernel.length)).fill(0)];

  // Use FFT length that's power of 2
  const fftLength = nextPowerOf2(n);
  const signalPadded = [...paddedSignal, ...new Array(fftLength - n).fill(0)];
  const kernelPadded = [...paddedKernel, ...new Array(fftLength - n).fill(0)];

  // FFT
  const signalFFT = fft(realToComplex(signalPadded));
  const kernelFFT = fft(realToComplex(kernelPadded));

  // Multiply
  const productFFT = signalFFT.map((s, i) => complexMul(s, kernelFFT[i]));

  // Inverse FFT
  const result = fft(productFFT, true);

  // Return first n elements
  return complexToReal(result).slice(0, n);
}

/**
 * Apply output mode trimming
 */
function applyMode(result: number[], signalLength: number, kernelLength: number, mode: string): number[] {
  switch (mode) {
    case 'full':
      return result;
    case 'same':
      // Return output same size as input signal
      const start = Math.floor((kernelLength - 1) / 2);
      return result.slice(start, start + signalLength);
    case 'valid':
      // Only fully overlapping parts
      const validStart = kernelLength - 1;
      const validEnd = result.length - kernelLength + 1;
      if (validEnd <= validStart) return [];
      return result.slice(validStart, validEnd);
    default:
      return result;
  }
}

// ============================================================================
// CORRELATION ALGORITHMS
// ============================================================================

/**
 * Cross-correlation: measures similarity between two signals
 * Correlation(x, y)[k] = sum(x[n] * y[n+k])
 */
function crossCorrelate(signal1: number[], signal2: number[]): number[] {
  // Cross-correlation is convolution with reversed kernel
  const reversed = [...signal2].reverse();
  return linearConvolveFFT(signal1, reversed);
}

/**
 * Auto-correlation: correlation of signal with itself
 */
function autoCorrelate(signal: number[]): number[] {
  return crossCorrelate(signal, signal);
}

/**
 * Normalized cross-correlation (returns values between -1 and 1)
 */
function normalizedCrossCorrelate(signal1: number[], signal2: number[]): number[] {
  const correlation = crossCorrelate(signal1, signal2);

  // Calculate energies
  const energy1 = signal1.reduce((sum, x) => sum + x * x, 0);
  const energy2 = signal2.reduce((sum, x) => sum + x * x, 0);

  const norm = Math.sqrt(energy1 * energy2);
  if (norm === 0) return correlation.map(() => 0);

  return correlation.map(c => c / norm);
}

// ============================================================================
// DECONVOLUTION
// ============================================================================

/**
 * Wiener deconvolution for system identification
 * Given output y and input x, find impulse response h where y = x * h
 */
function wienerDeconvolve(
  signal: number[],
  kernel: number[],
  noiseLevel: number = 0.01
): { result: number[]; success: boolean; error?: string } {
  try {
    const n = Math.max(signal.length, kernel.length);
    const fftLength = nextPowerOf2(n * 2);

    // Zero-pad
    const paddedSignal = [...signal, ...new Array(fftLength - signal.length).fill(0)];
    const paddedKernel = [...kernel, ...new Array(fftLength - kernel.length).fill(0)];

    // FFT
    const signalFFT = fft(realToComplex(paddedSignal));
    const kernelFFT = fft(realToComplex(paddedKernel));

    // Wiener filter: H^* / (|H|^2 + noise)
    const resultFFT: Complex[] = [];
    for (let i = 0; i < fftLength; i++) {
      const H = kernelFFT[i];
      const Y = signalFFT[i];
      const Hconj = complexConj(H);
      const Hmag2 = H.re * H.re + H.im * H.im;

      // Regularization to prevent division by near-zero
      const regularized = Hmag2 + noiseLevel;

      // (Y * H^*) / (|H|^2 + noise)
      const numerator = complexMul(Y, Hconj);
      resultFFT.push({
        re: numerator.re / regularized,
        im: numerator.im / regularized
      });
    }

    // Inverse FFT
    const result = fft(resultFFT, true);

    return {
      result: complexToReal(result).slice(0, signal.length),
      success: true
    };
  } catch (e) {
    return {
      result: [],
      success: false,
      error: e instanceof Error ? e.message : 'Deconvolution failed'
    };
  }
}

/**
 * Simple inverse filtering (more susceptible to noise)
 */
function inverseFilter(
  signal: number[],
  kernel: number[],
  threshold: number = 1e-6
): { result: number[]; success: boolean; error?: string } {
  try {
    const n = Math.max(signal.length, kernel.length);
    const fftLength = nextPowerOf2(n * 2);

    const paddedSignal = [...signal, ...new Array(fftLength - signal.length).fill(0)];
    const paddedKernel = [...kernel, ...new Array(fftLength - kernel.length).fill(0)];

    const signalFFT = fft(realToComplex(paddedSignal));
    const kernelFFT = fft(realToComplex(paddedKernel));

    const resultFFT: Complex[] = [];
    for (let i = 0; i < fftLength; i++) {
      const mag = complexMag(kernelFFT[i]);
      if (mag < threshold) {
        // Skip near-zero frequencies
        resultFFT.push({ re: 0, im: 0 });
      } else {
        resultFFT.push(complexDiv(signalFFT[i], kernelFFT[i]));
      }
    }

    const result = fft(resultFFT, true);

    return {
      result: complexToReal(result).slice(0, signal.length),
      success: true
    };
  } catch (e) {
    return {
      result: [],
      success: false,
      error: e instanceof Error ? e.message : 'Inverse filtering failed'
    };
  }
}

// ============================================================================
// SIGNAL ANALYSIS UTILITIES
// ============================================================================

function computeEnergy(signal: number[]): number {
  return signal.reduce((sum, x) => sum + x * x, 0);
}

function computePower(signal: number[]): number {
  return computeEnergy(signal) / signal.length;
}

function computeRMS(signal: number[]): number {
  return Math.sqrt(computePower(signal));
}

function findPeaks(signal: number[], threshold: number = 0): { index: number; value: number }[] {
  const peaks: { index: number; value: number }[] = [];

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > signal[i - 1] && signal[i] > signal[i + 1] && signal[i] > threshold) {
      peaks.push({ index: i, value: signal[i] });
    }
  }

  return peaks.sort((a, b) => b.value - a.value);
}

// ============================================================================
// TOOL INTERFACE
// ============================================================================

export const signalconvolutionTool: UnifiedTool = {
  name: 'signal_convolution',
  description: 'Signal convolution, correlation, and deconvolution for DSP applications',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['convolve', 'correlate', 'autocorrelate', 'deconvolve', 'circular', 'analyze', 'info'],
        description: 'Operation to perform'
      },
      signal: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input signal'
      },
      kernel: {
        type: 'array',
        items: { type: 'number' },
        description: 'Convolution kernel or second signal for correlation'
      },
      mode: {
        type: 'string',
        enum: ['full', 'same', 'valid'],
        description: 'Output mode: full (default), same (output size matches signal), valid (only fully overlapping)'
      },
      method: {
        type: 'string',
        enum: ['auto', 'direct', 'fft'],
        description: 'Computation method: auto (default), direct (O(nm)), fft (O(n log n))'
      },
      normalize: {
        type: 'boolean',
        description: 'Normalize correlation output to [-1, 1]'
      },
      noise_level: {
        type: 'number',
        description: 'Noise level for Wiener deconvolution (default: 0.01)'
      }
    },
    required: ['operation']
  }
};

export async function executesignalconvolution(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal,
      kernel,
      mode = 'full',
      method = 'auto',
      normalize = false,
      noise_level = 0.01
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        name: 'Signal Convolution Tool',
        description: 'Convolution, correlation, and deconvolution for signal processing',
        operations: {
          convolve: 'Linear convolution of signal with kernel',
          correlate: 'Cross-correlation between two signals',
          autocorrelate: 'Auto-correlation of a signal with itself',
          deconvolve: 'Deconvolution using Wiener filter',
          circular: 'Circular/cyclic convolution',
          analyze: 'Analyze signal properties'
        },
        outputModes: {
          full: 'Full output of length N + M - 1',
          same: 'Output same length as input signal',
          valid: 'Only fully overlapping region'
        },
        methods: {
          direct: 'Direct computation O(N*M) - better for small kernels',
          fft: 'FFT-based O(N log N) - better for large signals',
          auto: 'Automatically choose based on sizes'
        },
        applications: [
          'FIR filtering',
          'Image processing (blur, edge detection)',
          'Audio effects (reverb, echo)',
          'Pattern matching',
          'System identification',
          'Channel equalization'
        ],
        mathematics: {
          linearConvolution: '(f * g)[n] = Σ f[k] · g[n-k]',
          crossCorrelation: '(f ⋆ g)[n] = Σ f[k] · g[k+n]',
          circularConvolution: '(f ⊛ g)[n] = Σ f[k] · g[(n-k) mod N]'
        }
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Analyze operation
    if (operation === 'analyze') {
      if (!signal || !Array.isArray(signal)) {
        return { toolCallId: id, content: 'Error: signal array required for analyze', isError: true };
      }

      const energy = computeEnergy(signal);
      const rms = computeRMS(signal);
      const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
      const variance = signal.reduce((sum, x) => sum + (x - mean) ** 2, 0) / signal.length;
      const peaks = findPeaks(signal);
      const autoCorr = autoCorrelate(signal);
      const maxLag = autoCorr.indexOf(Math.max(...autoCorr.slice(1)));

      const analysis = {
        operation: 'analyze',
        signal: {
          length: signal.length,
          min: Math.min(...signal),
          max: Math.max(...signal),
          range: Math.max(...signal) - Math.min(...signal)
        },
        statistics: {
          mean,
          variance,
          standardDeviation: Math.sqrt(variance),
          energy,
          power: energy / signal.length,
          rms
        },
        peaks: {
          count: peaks.length,
          top5: peaks.slice(0, 5)
        },
        autocorrelation: {
          peak: Math.max(...autoCorr),
          firstNonZeroLag: maxLag,
          interpretation: maxLag > 1 ? `Possible periodicity at lag ${maxLag}` : 'No clear periodicity detected'
        }
      };

      return { toolCallId: id, content: JSON.stringify(analysis, null, 2) };
    }

    // Validate inputs for other operations
    if (!signal || !Array.isArray(signal)) {
      return { toolCallId: id, content: 'Error: signal array required', isError: true };
    }

    // Auto-correlation doesn't need kernel
    if (operation === 'autocorrelate') {
      const result = autoCorrelate(signal);
      const trimmed = applyMode(result, signal.length, signal.length, mode);

      const output = {
        operation: 'autocorrelate',
        input: {
          signal: signal.slice(0, 10).concat(signal.length > 10 ? ['...'] : []),
          length: signal.length
        },
        output: {
          result: trimmed.slice(0, 20).concat(trimmed.length > 20 ? ['...'] : []),
          length: trimmed.length,
          peak: Math.max(...trimmed),
          peakIndex: trimmed.indexOf(Math.max(...trimmed))
        },
        mode,
        interpretation: 'Peak at index 0 represents signal energy. Secondary peaks indicate periodicity.'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    // Other operations need kernel
    if (!kernel || !Array.isArray(kernel)) {
      return { toolCallId: id, content: 'Error: kernel array required for this operation', isError: true };
    }

    // Linear convolution
    if (operation === 'convolve') {
      // Choose method
      const useFFT = method === 'fft' ||
        (method === 'auto' && signal.length * kernel.length > 1000);

      const rawResult = useFFT
        ? linearConvolveFFT(signal, kernel)
        : linearConvolveDirect(signal, kernel);

      const result = applyMode(rawResult, signal.length, kernel.length, mode);

      const output = {
        operation: 'convolve',
        input: {
          signalLength: signal.length,
          kernelLength: kernel.length
        },
        output: {
          result: result.slice(0, 30).concat(result.length > 30 ? ['...'] : []),
          length: result.length,
          fullLength: signal.length + kernel.length - 1
        },
        mode,
        method: useFFT ? 'fft' : 'direct',
        computation: {
          algorithm: useFFT ? 'FFT-based (O(n log n))' : 'Direct (O(n*m))',
          reason: method === 'auto' ? 'Auto-selected based on input sizes' : 'User specified'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    // Cross-correlation
    if (operation === 'correlate') {
      const rawResult = normalize
        ? normalizedCrossCorrelate(signal, kernel)
        : crossCorrelate(signal, kernel);

      const result = applyMode(rawResult, signal.length, kernel.length, mode);
      const maxIdx = result.indexOf(Math.max(...result));
      const lag = maxIdx - Math.floor((signal.length + kernel.length - 2) / 2);

      const output = {
        operation: 'correlate',
        input: {
          signal1Length: signal.length,
          signal2Length: kernel.length
        },
        output: {
          result: result.slice(0, 30).concat(result.length > 30 ? ['...'] : []),
          length: result.length,
          normalized: normalize
        },
        mode,
        analysis: {
          maxCorrelation: Math.max(...result),
          maxCorrelationIndex: maxIdx,
          estimatedLag: lag,
          interpretation: `Maximum correlation at index ${maxIdx} suggests signal2 is ${lag >= 0 ? 'delayed' : 'advanced'} by ${Math.abs(lag)} samples relative to signal1`
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    // Circular convolution
    if (operation === 'circular') {
      const result = circularConvolve(signal, kernel);

      const output = {
        operation: 'circular',
        input: {
          signalLength: signal.length,
          kernelLength: kernel.length
        },
        output: {
          result: result.slice(0, 30).concat(result.length > 30 ? ['...'] : []),
          length: result.length
        },
        note: 'Circular convolution wraps around at boundaries, equivalent to DFT-based multiplication'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    // Deconvolution
    if (operation === 'deconvolve') {
      const { result, success, error } = wienerDeconvolve(signal, kernel, noise_level);

      if (!success) {
        return { toolCallId: id, content: JSON.stringify({
          operation: 'deconvolve',
          success: false,
          error
        }, null, 2) };
      }

      // Verify by reconvolving
      const verification = linearConvolveFFT(result, kernel);
      const mse = signal.slice(0, verification.length).reduce((sum, x, i) =>
        sum + (x - verification[i]) ** 2, 0) / signal.length;

      const output = {
        operation: 'deconvolve',
        input: {
          outputSignalLength: signal.length,
          kernelLength: kernel.length
        },
        output: {
          result: result.slice(0, 30).concat(result.length > 30 ? ['...'] : []),
          length: result.length
        },
        parameters: {
          noiseLevel: noise_level,
          method: 'Wiener filter'
        },
        verification: {
          reconvolutionMSE: mse,
          quality: mse < 0.01 ? 'Excellent' : mse < 0.1 ? 'Good' : mse < 1 ? 'Fair' : 'Poor'
        },
        notes: [
          'Deconvolution recovers an estimate of the input given output and kernel',
          'Wiener filter provides regularization against noise amplification',
          'Increase noise_level parameter if result is too noisy'
        ]
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Error: Unknown operation '${operation}'`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function issignalconvolutionAvailable(): boolean {
  return true;
}
