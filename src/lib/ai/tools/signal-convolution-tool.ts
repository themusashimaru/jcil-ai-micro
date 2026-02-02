/**
 * SIGNAL-CONVOLUTION TOOL
 * Signal convolution, correlation, and deconvolution with real DSP algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const signalconvolutionTool: UnifiedTool = {
  name: 'signal_convolution',
  description: 'Signal convolution, correlation, and deconvolution',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['convolve', 'correlate', 'deconvolve', 'autocorrelate', 'info'], description: 'Operation' },
      mode: { type: 'string', enum: ['full', 'same', 'valid'], description: 'Output mode' },
      signal1: { type: 'array', items: { type: 'number' }, description: 'First signal' },
      signal2: { type: 'array', items: { type: 'number' }, description: 'Second signal (kernel/filter)' },
      method: { type: 'string', enum: ['direct', 'fft'], description: 'Computation method' }
    },
    required: ['operation']
  }
};

// Complex number for FFT
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
  if (denom < 1e-15) return { re: 0, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  };
}

function complexAbs(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

// FFT implementation (Cooley-Tukey radix-2)
function fft(x: Complex[], inverse: boolean = false): Complex[] {
  const N = x.length;

  // Base case
  if (N <= 1) return x;

  // Pad to power of 2
  let n = 1;
  while (n < N) n *= 2;

  const padded = [...x];
  while (padded.length < n) {
    padded.push({ re: 0, im: 0 });
  }

  // Bit-reversal permutation
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    let reversed = 0;
    let temp = i;
    for (let j = 0; j < Math.log2(n); j++) {
      reversed = (reversed << 1) | (temp & 1);
      temp >>= 1;
    }
    result[i] = { ...padded[reversed] };
  }

  // Cooley-Tukey iterative FFT
  for (let size = 2; size <= n; size *= 2) {
    const halfSize = size / 2;
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    const wn: Complex = { re: Math.cos(angle), im: Math.sin(angle) };

    for (let i = 0; i < n; i += size) {
      let w: Complex = { re: 1, im: 0 };
      for (let j = 0; j < halfSize; j++) {
        const u = result[i + j];
        const t = complexMul(w, result[i + j + halfSize]);
        result[i + j] = complexAdd(u, t);
        result[i + j + halfSize] = complexSub(u, t);
        w = complexMul(w, wn);
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

// Direct convolution: (x * h)[n] = Σ x[k] * h[n-k]
function convolveDirect(x: number[], h: number[], mode: string): number[] {
  const M = x.length;
  const N = h.length;
  const L = M + N - 1;  // Full convolution length

  // Compute full convolution
  const full: number[] = new Array(L).fill(0);
  for (let n = 0; n < L; n++) {
    for (let k = 0; k < M; k++) {
      const hIndex = n - k;
      if (hIndex >= 0 && hIndex < N) {
        full[n] += x[k] * h[hIndex];
      }
    }
  }

  // Return based on mode
  if (mode === 'full') return full;
  if (mode === 'same') {
    const start = Math.floor((N - 1) / 2);
    return full.slice(start, start + M);
  }
  if (mode === 'valid') {
    const validLen = Math.max(M, N) - Math.min(M, N) + 1;
    const start = Math.min(M, N) - 1;
    return full.slice(start, start + validLen);
  }
  return full;
}

// FFT-based convolution (faster for large signals)
function convolveFFT(x: number[], h: number[], mode: string): number[] {
  const M = x.length;
  const N = h.length;
  const L = M + N - 1;

  // Pad to power of 2 for efficiency
  let fftSize = 1;
  while (fftSize < L) fftSize *= 2;

  // Convert to complex and pad
  const xComplex: Complex[] = x.map(v => ({ re: v, im: 0 }));
  const hComplex: Complex[] = h.map(v => ({ re: v, im: 0 }));
  while (xComplex.length < fftSize) xComplex.push({ re: 0, im: 0 });
  while (hComplex.length < fftSize) hComplex.push({ re: 0, im: 0 });

  // FFT both signals
  const X = fft(xComplex, false);
  const H = fft(hComplex, false);

  // Multiply in frequency domain
  const Y: Complex[] = X.map((xi, i) => complexMul(xi, H[i]));

  // Inverse FFT
  const y = fft(Y, true);

  // Extract real parts
  const full = y.slice(0, L).map(c => c.re);

  // Return based on mode
  if (mode === 'full') return full;
  if (mode === 'same') {
    const start = Math.floor((N - 1) / 2);
    return full.slice(start, start + M);
  }
  if (mode === 'valid') {
    const validLen = Math.max(M, N) - Math.min(M, N) + 1;
    const start = Math.min(M, N) - 1;
    return full.slice(start, start + validLen);
  }
  return full;
}

// Cross-correlation: (x ⋆ h)[n] = Σ x[k] * h[k+n]
function correlate(x: number[], h: number[], mode: string): number[] {
  // Correlation is convolution with time-reversed h
  const hReversed = [...h].reverse();
  return convolveDirect(x, hReversed, mode);
}

// Autocorrelation: (x ⋆ x)[n]
function autocorrelate(x: number[]): number[] {
  return correlate(x, x, 'full');
}

// Wiener deconvolution (regularized)
function deconvolve(y: number[], h: number[], noiseVariance: number = 0.01): number[] {
  const M = y.length;
  const N = h.length;

  // Estimate original signal length
  const L = M;  // Assume same length

  // Pad to power of 2
  let fftSize = 1;
  while (fftSize < Math.max(M, N)) fftSize *= 2;

  // Convert to complex and pad
  const yComplex: Complex[] = y.map(v => ({ re: v, im: 0 }));
  const hComplex: Complex[] = h.map(v => ({ re: v, im: 0 }));
  while (yComplex.length < fftSize) yComplex.push({ re: 0, im: 0 });
  while (hComplex.length < fftSize) hComplex.push({ re: 0, im: 0 });

  // FFT
  const Y = fft(yComplex, false);
  const H = fft(hComplex, false);

  // Wiener filter: X = Y * H* / (|H|² + λ)
  // where λ is regularization (related to noise)
  const X: Complex[] = H.map((hi, i) => {
    const hConj: Complex = { re: hi.re, im: -hi.im };
    const hMagSq = hi.re * hi.re + hi.im * hi.im;
    const numerator = complexMul(Y[i], hConj);
    const denominator = hMagSq + noiseVariance;
    return { re: numerator.re / denominator, im: numerator.im / denominator };
  });

  // Inverse FFT
  const x = fft(X, true);

  return x.slice(0, L).map(c => c.re);
}

// Create visualization
function createConvolutionPlot(signal1: number[], signal2: number[], result: number[]): string {
  const width = 50;
  const height = 6;

  function plotSignal(sig: number[], label: string): string[] {
    const max = Math.max(...sig.map(Math.abs), 0.001);
    const lines: string[] = [];
    const compressed = sig.length > width
      ? Array.from({ length: width }, (_, i) => sig[Math.floor(i * sig.length / width)])
      : sig;

    const plot = compressed.map(v => {
      const normalized = v / max;
      if (normalized > 0.5) return '█';
      if (normalized > 0.25) return '▄';
      if (normalized > 0) return '▁';
      if (normalized > -0.25) return ' ';
      if (normalized > -0.5) return '▄';
      return '█';
    }).join('');

    lines.push(`${label}: ${plot}`);
    return lines;
  }

  const lines = [
    ...plotSignal(signal1, 'Signal 1'),
    ...plotSignal(signal2, 'Signal 2'),
    '         ' + '─'.repeat(40) + ' (convolution)',
    ...plotSignal(result, 'Result  ')
  ];

  return lines.join('\n');
}

export async function executesignalconvolution(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'signal-convolution',
        description: 'Signal convolution, correlation, and deconvolution',

        operations: {
          convolve: {
            description: 'Convolves two signals',
            formula: '(x * h)[n] = Σ x[k] · h[n-k]',
            applications: ['Filtering', 'Smoothing', 'Edge detection', 'System response']
          },
          correlate: {
            description: 'Cross-correlates two signals',
            formula: '(x ⋆ h)[n] = Σ x[k] · h[k+n]',
            applications: ['Pattern matching', 'Time delay estimation', 'Signal detection']
          },
          autocorrelate: {
            description: 'Signal with itself',
            formula: 'R_xx[n] = Σ x[k] · x[k+n]',
            applications: ['Periodicity detection', 'Power spectral density']
          },
          deconvolve: {
            description: 'Recover original signal from convolved output',
            method: 'Wiener deconvolution with regularization',
            applications: ['Image deblurring', 'Echo cancellation', 'System identification']
          }
        },

        modes: {
          full: 'Complete convolution result (length M + N - 1)',
          same: 'Output same size as first input (centered)',
          valid: 'Only positions where signals fully overlap'
        },

        methods: {
          direct: {
            description: 'Direct time-domain computation',
            complexity: 'O(M × N)',
            bestFor: 'Short signals or kernels'
          },
          fft: {
            description: 'FFT-based frequency domain multiplication',
            complexity: 'O((M+N) log(M+N))',
            bestFor: 'Large signals',
            principle: 'Convolution in time ↔ Multiplication in frequency'
          }
        },

        properties: {
          commutative: 'x * h = h * x',
          associative: '(x * h) * g = x * (h * g)',
          distributive: 'x * (h + g) = x * h + x * g',
          identity: 'x * δ = x (where δ is unit impulse)'
        },

        example: {
          signal1: [1, 2, 3, 4],
          signal2: [1, 1, 1],
          convolution_full: [1, 3, 6, 9, 7, 4],
          note: 'Moving average with window of 3'
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    const mode = args.mode || 'full';
    const method = args.method || 'direct';

    // Default test signals if not provided
    const signal1 = args.signal1 || [1, 2, 3, 4, 5, 4, 3, 2, 1];
    const signal2 = args.signal2 || [1, 0, -1];  // Edge detector

    if (operation === 'convolve') {
      const startTime = Date.now();
      const result = method === 'fft'
        ? convolveFFT(signal1, signal2, mode)
        : convolveDirect(signal1, signal2, mode);
      const elapsed = Date.now() - startTime;

      // Create visualization
      const plot = createConvolutionPlot(signal1, signal2, result);

      const output = {
        operation: 'convolution',
        mode,
        method,

        signal1: {
          values: signal1.slice(0, 20),
          length: signal1.length
        },
        signal2: {
          values: signal2.slice(0, 20),
          length: signal2.length
        },

        result: {
          values: result.map(v => Number(v.toFixed(8))).slice(0, 30),
          length: result.length,
          expectedLength: mode === 'full' ? signal1.length + signal2.length - 1
            : mode === 'same' ? signal1.length
            : Math.abs(signal1.length - signal2.length) + 1
        },

        statistics: {
          resultMin: Math.min(...result),
          resultMax: Math.max(...result),
          resultSum: result.reduce((a, b) => a + b, 0),
          inputProduct: signal1.reduce((a, b) => a + b, 0) * signal2.reduce((a, b) => a + b, 0)
        },

        visualization: plot,

        computationTimeMs: elapsed,

        interpretation: signal2.length <= 5
          ? `Applied ${signal2.length}-point filter/kernel to signal`
          : `Convolved two signals of lengths ${signal1.length} and ${signal2.length}`
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'correlate') {
      const result = correlate(signal1, signal2, mode);

      // Find peak (best match location)
      let maxIdx = 0;
      let maxVal = result[0];
      for (let i = 1; i < result.length; i++) {
        if (result[i] > maxVal) {
          maxVal = result[i];
          maxIdx = i;
        }
      }

      // Compute normalized correlation coefficient
      const norm1 = Math.sqrt(signal1.reduce((s, x) => s + x * x, 0));
      const norm2 = Math.sqrt(signal2.reduce((s, x) => s + x * x, 0));
      const normalizedPeak = maxVal / (norm1 * norm2);

      const output = {
        operation: 'cross-correlation',
        mode,

        signal1: {
          values: signal1.slice(0, 20),
          length: signal1.length
        },
        signal2: {
          values: signal2.slice(0, 20),
          length: signal2.length
        },

        result: {
          values: result.map(v => Number(v.toFixed(8))).slice(0, 30),
          length: result.length
        },

        analysis: {
          peakValue: maxVal,
          peakIndex: maxIdx,
          normalizedPeakCorrelation: normalizedPeak,
          estimatedLag: maxIdx - (signal2.length - 1),
          interpretation: normalizedPeak > 0.8
            ? 'Strong correlation - signals are similar'
            : normalizedPeak > 0.5
            ? 'Moderate correlation'
            : 'Weak correlation - signals are dissimilar'
        },

        note: 'Peak location indicates where signal2 best matches signal1'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'autocorrelate') {
      const result = autocorrelate(signal1);

      // Find period (second peak after zero-lag)
      const midpoint = Math.floor(result.length / 2);
      let secondPeakIdx = midpoint + 1;
      let secondPeakVal = result[secondPeakIdx];

      for (let i = midpoint + 2; i < result.length - 1; i++) {
        if (result[i] > result[i - 1] && result[i] > result[i + 1] && result[i] > secondPeakVal) {
          secondPeakVal = result[i];
          secondPeakIdx = i;
          break;
        }
      }

      const period = secondPeakIdx - midpoint;

      const output = {
        operation: 'autocorrelation',

        signal: {
          values: signal1.slice(0, 20),
          length: signal1.length
        },

        result: {
          values: result.map(v => Number(v.toFixed(8))).slice(0, 30),
          length: result.length
        },

        analysis: {
          zeroLagValue: result[midpoint],
          signalEnergy: result[midpoint],
          estimatedPeriod: period > 1 && period < signal1.length / 2 ? period : 'No clear periodicity',
          normalizedAutocorrelation: result.map(v => v / result[midpoint])
            .slice(midpoint, midpoint + Math.min(10, signal1.length))
            .map(v => Number(v.toFixed(4)))
        },

        properties: {
          symmetric: 'R_xx[n] = R_xx[-n]',
          maxAtZero: 'R_xx[0] ≥ |R_xx[n]| for all n',
          fourierRelation: 'FFT of autocorrelation = power spectrum'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'deconvolve') {
      const noiseVariance = args.noise_variance || 0.01;

      // If signal2 is the kernel that was used to convolve
      // Try to recover the original signal
      const recovered = deconvolve(signal1, signal2, noiseVariance);

      // Estimate reconstruction error
      const reconvolved = convolveDirect(recovered, signal2, 'same');
      const error = signal1.slice(0, reconvolved.length).map((v, i) =>
        Math.abs(v - reconvolved[i])
      );
      const mse = error.reduce((s, e) => s + e * e, 0) / error.length;

      const output = {
        operation: 'deconvolution (Wiener)',

        observedSignal: {
          values: signal1.slice(0, 20),
          length: signal1.length
        },
        kernel: {
          values: signal2.slice(0, 20),
          length: signal2.length
        },

        recoveredSignal: {
          values: recovered.map(v => Number(v.toFixed(8))).slice(0, 20),
          length: recovered.length
        },

        quality: {
          regularizationParameter: noiseVariance,
          meanSquaredError: mse,
          snrImprovement: 10 * Math.log10(
            signal1.reduce((s, x) => s + x * x, 0) /
            error.reduce((s, x) => s + x * x, 0)
          )
        },

        method: {
          name: 'Wiener Deconvolution',
          formula: 'X(f) = Y(f) · H*(f) / (|H(f)|² + λ)',
          note: 'Regularization prevents noise amplification at frequencies where H(f) ≈ 0'
        },

        warnings: noiseVariance < 0.001
          ? ['Low regularization may amplify noise']
          : noiseVariance > 0.1
          ? ['High regularization may over-smooth result']
          : []
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function issignalconvolutionAvailable(): boolean { return true; }
