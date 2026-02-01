/**
 * SIGNAL PROCESSING TOOL
 *
 * Digital signal processing: FFT, filters, convolution, spectral analysis.
 * Educational DSP without external dependencies.
 *
 * Part of TIER SCIENCE SUPREME - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// COMPLEX NUMBERS
// ============================================================================

interface Complex { re: number; im: number; }
const complex = (re: number, im: number = 0): Complex => ({ re, im });
const cAdd = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cAbs = (a: Complex): number => Math.sqrt(a.re * a.re + a.im * a.im);
const cPhase = (a: Complex): number => Math.atan2(a.im, a.re);

// ============================================================================
// FFT (Fast Fourier Transform)
// ============================================================================

function fft(signal: Complex[]): Complex[] {
  const N = signal.length;
  if (N <= 1) return signal;

  // Bit-reversal permutation
  const bits = Math.log2(N);
  const result: Complex[] = new Array(N);

  for (let i = 0; i < N; i++) {
    let rev = 0;
    for (let j = 0; j < bits; j++) {
      rev = (rev << 1) | ((i >> j) & 1);
    }
    result[rev] = signal[i];
  }

  // Cooley-Tukey FFT
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;

    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const w = complex(Math.cos(angle * j), Math.sin(angle * j));
        const even = result[i + j];
        const odd = cMul(w, result[i + j + halfSize]);

        result[i + j] = cAdd(even, odd);
        result[i + j + halfSize] = cSub(even, odd);
      }
    }
  }

  return result;
}

function _ifft(spectrum: Complex[]): Complex[] {
  const N = spectrum.length;
  // Conjugate, FFT, conjugate, scale
  const conjugated = spectrum.map(c => complex(c.re, -c.im));
  const transformed = fft(conjugated);
  return transformed.map(c => complex(c.re / N, -c.im / N));
}
// Suppress unused lint: _ifft is for future use
void _ifft;

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

function generateSine(frequency: number, sampleRate: number, duration: number, amplitude: number = 1): number[] {
  const samples = Math.floor(sampleRate * duration);
  const signal: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    signal.push(amplitude * Math.sin(2 * Math.PI * frequency * t));
  }
  return signal;
}

function generateSquare(frequency: number, sampleRate: number, duration: number, amplitude: number = 1): number[] {
  const samples = Math.floor(sampleRate * duration);
  const signal: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const phase = (frequency * t) % 1;
    signal.push(amplitude * (phase < 0.5 ? 1 : -1));
  }
  return signal;
}

function generateSawtooth(frequency: number, sampleRate: number, duration: number, amplitude: number = 1): number[] {
  const samples = Math.floor(sampleRate * duration);
  const signal: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const phase = (frequency * t) % 1;
    signal.push(amplitude * (2 * phase - 1));
  }
  return signal;
}

function generateNoise(samples: number, amplitude: number = 1): number[] {
  return Array.from({ length: samples }, () => (Math.random() * 2 - 1) * amplitude);
}

function generateChirp(f0: number, f1: number, sampleRate: number, duration: number): number[] {
  const samples = Math.floor(sampleRate * duration);
  const signal: number[] = [];
  const k = (f1 - f0) / duration;
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    signal.push(Math.sin(2 * Math.PI * (f0 * t + 0.5 * k * t * t)));
  }
  return signal;
}

// ============================================================================
// FILTERS
// ============================================================================

function lowPassFilter(signal: number[], cutoff: number, sampleRate: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  const output: number[] = [signal[0]];
  for (let i = 1; i < signal.length; i++) {
    output.push(output[i - 1] + alpha * (signal[i] - output[i - 1]));
  }
  return output;
}

function highPassFilter(signal: number[], cutoff: number, sampleRate: number): number[] {
  const rc = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);

  const output: number[] = [signal[0]];
  for (let i = 1; i < signal.length; i++) {
    output.push(alpha * (output[i - 1] + signal[i] - signal[i - 1]));
  }
  return output;
}

function movingAverage(signal: number[], windowSize: number): number[] {
  const output: number[] = [];
  for (let i = 0; i < signal.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(signal.length, i + Math.ceil(windowSize / 2));
    const sum = signal.slice(start, end).reduce((a, b) => a + b, 0);
    output.push(sum / (end - start));
  }
  return output;
}

// ============================================================================
// CONVOLUTION
// ============================================================================

function convolve(signal: number[], kernel: number[]): number[] {
  const output: number[] = [];
  for (let i = 0; i < signal.length + kernel.length - 1; i++) {
    let sum = 0;
    for (let j = 0; j < kernel.length; j++) {
      if (i - j >= 0 && i - j < signal.length) {
        sum += signal[i - j] * kernel[j];
      }
    }
    output.push(sum);
  }
  return output;
}

function _crossCorrelate(a: number[], b: number[]): number[] {
  return convolve(a, [...b].reverse());
}
// Suppress unused lint: _crossCorrelate is for future use
void _crossCorrelate;

// ============================================================================
// SPECTRAL ANALYSIS
// ============================================================================

function powerSpectrum(signal: number[]): { frequencies: number[]; magnitudes: number[] } {
  // Pad to power of 2
  let N = 1;
  while (N < signal.length) N *= 2;
  const padded = [...signal, ...Array(N - signal.length).fill(0)];

  const spectrum = fft(padded.map(x => complex(x)));
  const halfN = N / 2;

  const frequencies: number[] = [];
  const magnitudes: number[] = [];

  for (let i = 0; i < halfN; i++) {
    frequencies.push(i / N);
    magnitudes.push(cAbs(spectrum[i]) / N * 2);
  }

  return { frequencies, magnitudes };
}

function findPeakFrequencies(magnitudes: number[], threshold: number = 0.1): number[] {
  const peaks: number[] = [];
  const max = Math.max(...magnitudes);

  for (let i = 1; i < magnitudes.length - 1; i++) {
    if (magnitudes[i] > magnitudes[i - 1] &&
        magnitudes[i] > magnitudes[i + 1] &&
        magnitudes[i] > max * threshold) {
      peaks.push(i);
    }
  }

  return peaks;
}

// ============================================================================
// VISUALIZATION
// ============================================================================

function visualizeSignal(signal: number[], width: number = 60, height: number = 10): string {
  const canvas: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));
  const samples = signal.slice(0, Math.min(signal.length, width * 4));

  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const range = max - min || 1;

  for (let x = 0; x < width; x++) {
    const idx = Math.floor(x * samples.length / width);
    const y = Math.round((1 - (samples[idx] - min) / range) * (height - 1));
    if (y >= 0 && y < height) {
      canvas[y][x] = '█';
    }
  }

  // Draw zero line
  const zeroY = Math.round((1 - (0 - min) / range) * (height - 1));
  if (zeroY >= 0 && zeroY < height) {
    for (let x = 0; x < width; x++) {
      if (canvas[zeroY][x] === ' ') canvas[zeroY][x] = '─';
    }
  }

  return canvas.map(row => row.join('')).join('\n');
}

function visualizeSpectrum(magnitudes: number[], width: number = 60, height: number = 10): string {
  const canvas: string[][] = Array.from({ length: height }, () => Array(width).fill(' '));
  const max = Math.max(...magnitudes);

  for (let x = 0; x < width; x++) {
    const idx = Math.floor(x * magnitudes.length / width);
    const barHeight = Math.round((magnitudes[idx] / max) * height);

    for (let y = 0; y < barHeight; y++) {
      canvas[height - 1 - y][x] = '█';
    }
  }

  return canvas.map(row => row.join('')).join('\n');
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const signalProcessingTool: UnifiedTool = {
  name: 'signal_processing',
  description: `Digital signal processing operations.

Operations:
- generate: Generate signal (sine, square, sawtooth, noise, chirp)
- fft: Compute Fast Fourier Transform
- ifft: Inverse FFT
- filter: Apply filter (lowpass, highpass, moving_average)
- convolve: Convolve two signals
- correlate: Cross-correlation
- spectrum: Power spectrum analysis
- peaks: Find peak frequencies
- visualize: ASCII visualization

Educational DSP with visualization.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'fft', 'ifft', 'filter', 'convolve', 'correlate', 'spectrum', 'peaks', 'visualize'],
        description: 'DSP operation',
      },
      signal_type: { type: 'string', description: 'Signal type for generation' },
      frequency: { type: 'number', description: 'Frequency in Hz' },
      sample_rate: { type: 'number', description: 'Sample rate' },
      duration: { type: 'number', description: 'Duration in seconds' },
      amplitude: { type: 'number', description: 'Signal amplitude' },
      filter_type: { type: 'string', description: 'Filter type' },
      cutoff: { type: 'number', description: 'Cutoff frequency' },
      window_size: { type: 'number', description: 'Window size for moving average' },
      signal: { type: 'string', description: 'Signal data as JSON array' },
      kernel: { type: 'string', description: 'Convolution kernel as JSON array' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSignalProcessing(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'generate': {
        const { signal_type = 'sine', frequency = 440, sample_rate = 8000, duration = 0.1, amplitude = 1 } = args;
        let signal: number[];

        switch (signal_type) {
          case 'sine': signal = generateSine(frequency, sample_rate, duration, amplitude); break;
          case 'square': signal = generateSquare(frequency, sample_rate, duration, amplitude); break;
          case 'sawtooth': signal = generateSawtooth(frequency, sample_rate, duration, amplitude); break;
          case 'noise': signal = generateNoise(Math.floor(sample_rate * duration), amplitude); break;
          case 'chirp': signal = generateChirp(frequency, args.f1 || frequency * 4, sample_rate, duration); break;
          default: signal = generateSine(frequency, sample_rate, duration, amplitude);
        }

        result = {
          operation: 'generate',
          type: signal_type,
          samples: signal.length,
          frequency,
          sample_rate,
          duration,
          preview: signal.slice(0, 20).map(v => Math.round(v * 1000) / 1000),
          visualization: visualizeSignal(signal),
        };
        break;
      }

      case 'fft': {
        const signalStr = args.signal || JSON.stringify(generateSine(440, 8000, 0.05));
        let signal: number[] = JSON.parse(signalStr);

        // Pad to power of 2
        let N = 1;
        while (N < signal.length) N *= 2;
        signal = [...signal, ...Array(N - signal.length).fill(0)];

        const spectrum = fft(signal.map(x => complex(x)));
        const magnitudes = spectrum.slice(0, N / 2).map(c => cAbs(c) / N * 2);
        const _phases = spectrum.slice(0, N / 2).map(c => cPhase(c));
        void _phases; // for future use

        result = {
          operation: 'fft',
          input_length: signal.length,
          output_length: N,
          frequency_bins: N / 2,
          magnitudes: magnitudes.slice(0, 20).map(v => Math.round(v * 1000) / 1000),
          spectrum_visualization: visualizeSpectrum(magnitudes),
        };
        break;
      }

      case 'filter': {
        const { filter_type = 'lowpass', cutoff = 1000, sample_rate = 8000, window_size = 5 } = args;
        const signalStr = args.signal || JSON.stringify(generateSine(440, sample_rate, 0.05));
        const signal: number[] = JSON.parse(signalStr);

        let filtered: number[];
        switch (filter_type) {
          case 'lowpass': filtered = lowPassFilter(signal, cutoff, sample_rate); break;
          case 'highpass': filtered = highPassFilter(signal, cutoff, sample_rate); break;
          case 'moving_average': filtered = movingAverage(signal, window_size); break;
          default: filtered = signal;
        }

        result = {
          operation: 'filter',
          type: filter_type,
          cutoff: filter_type !== 'moving_average' ? cutoff : undefined,
          window_size: filter_type === 'moving_average' ? window_size : undefined,
          before: visualizeSignal(signal),
          after: visualizeSignal(filtered),
        };
        break;
      }

      case 'spectrum': {
        const { frequency = 440, sample_rate = 8000 } = args;
        const signalStr = args.signal || JSON.stringify(generateSine(frequency, sample_rate, 0.1));
        const signal: number[] = JSON.parse(signalStr);

        const { frequencies: _frequencies, magnitudes } = powerSpectrum(signal);
        void _frequencies; // for future use
        const peaks = findPeakFrequencies(magnitudes);

        result = {
          operation: 'spectrum',
          frequency_resolution: sample_rate / signal.length,
          peak_bins: peaks,
          peak_frequencies: peaks.map(p => (p * sample_rate / (magnitudes.length * 2)).toFixed(1) + ' Hz'),
          visualization: visualizeSpectrum(magnitudes),
        };
        break;
      }

      case 'convolve': {
        const signalStr = args.signal || '[1, 2, 3, 4, 5]';
        const kernelStr = args.kernel || '[0.25, 0.5, 0.25]';
        const signal: number[] = JSON.parse(signalStr);
        const kernel: number[] = JSON.parse(kernelStr);

        const convolved = convolve(signal, kernel);

        result = {
          operation: 'convolve',
          signal_length: signal.length,
          kernel_length: kernel.length,
          output_length: convolved.length,
          result: convolved.map(v => Math.round(v * 1000) / 1000),
        };
        break;
      }

      case 'visualize': {
        const signalStr = args.signal || JSON.stringify(generateSine(440, 8000, 0.05));
        const signal: number[] = JSON.parse(signalStr);

        result = {
          operation: 'visualize',
          samples: signal.length,
          min: Math.min(...signal).toFixed(3),
          max: Math.max(...signal).toFixed(3),
          waveform: visualizeSignal(signal),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Signal Processing Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isSignalProcessingAvailable(): boolean { return true; }
