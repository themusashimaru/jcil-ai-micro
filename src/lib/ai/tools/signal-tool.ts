/**
 * SIGNAL PROCESSING TOOL
 *
 * Signal analysis using FFT (Fast Fourier Transform).
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Fast Fourier Transform (FFT)
 * - Inverse FFT
 * - Frequency spectrum analysis
 * - Power spectral density
 * - Signal generation
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fft: any = null;

async function initFFT(): Promise<boolean> {
  if (fft) return true;
  try {
    const mod = await import('fft-js');
    fft = mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const signalTool: UnifiedTool = {
  name: 'signal_process',
  description: `Perform signal processing and frequency analysis.

Operations:
- fft: Compute Fast Fourier Transform of a signal
- ifft: Compute Inverse FFT to reconstruct signal
- spectrum: Get frequency spectrum (magnitudes)
- generate: Generate test signals (sine, square, sawtooth)
- analyze: Full signal analysis with statistics

Use cases:
- Audio analysis
- Vibration analysis
- Scientific data processing
- Filter design
- Spectrum analysis`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['fft', 'ifft', 'spectrum', 'generate', 'analyze'],
        description: 'Signal processing operation',
      },
      signal: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input signal as array of samples (must be power of 2 for FFT)',
      },
      complex_signal: {
        type: 'array',
        items: { type: 'object' },
        description: 'Complex signal as [[real, imag], ...] pairs for IFFT',
      },
      sample_rate: {
        type: 'number',
        description: 'Sample rate in Hz (for frequency calculations)',
      },
      wave_type: {
        type: 'string',
        enum: ['sine', 'cosine', 'square', 'sawtooth', 'triangle'],
        description: 'Type of wave to generate',
      },
      frequency: {
        type: 'number',
        description: 'Frequency in Hz for wave generation',
      },
      duration: {
        type: 'number',
        description: 'Duration in seconds for wave generation',
      },
      amplitude: {
        type: 'number',
        description: 'Amplitude for wave generation (default: 1)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isSignalAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

function padToPowerOf2(signal: number[]): number[] {
  const targetLength = nextPowerOf2(signal.length);
  if (signal.length === targetLength) return signal;
  return [...signal, ...Array(targetLength - signal.length).fill(0)];
}

function generateWave(
  type: string,
  frequency: number,
  sampleRate: number,
  duration: number,
  amplitude: number
): number[] {
  const numSamples = Math.floor(sampleRate * duration);
  const signal: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = 2 * Math.PI * frequency * t;

    let value: number;
    switch (type) {
      case 'sine':
        value = Math.sin(phase);
        break;
      case 'cosine':
        value = Math.cos(phase);
        break;
      case 'square':
        value = Math.sin(phase) >= 0 ? 1 : -1;
        break;
      case 'sawtooth':
        value = 2 * ((frequency * t) % 1) - 1;
        break;
      case 'triangle':
        value = 2 * Math.abs(2 * ((frequency * t) % 1) - 1) - 1;
        break;
      default:
        value = Math.sin(phase);
    }

    signal.push(value * amplitude);
  }

  return signal;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeSignal(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const {
    operation,
    signal,
    complex_signal,
    sample_rate = 44100,
    wave_type = 'sine',
    frequency = 440,
    duration = 0.1,
    amplitude = 1,
  } = args;

  // Initialize library
  const initialized = await initFFT();
  if (!initialized) {
    return {
      toolCallId: toolCall.id,
      content: 'Signal processing library failed to load. Please try again.',
      isError: true,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'fft': {
        if (!signal || !Array.isArray(signal) || signal.length === 0) {
          throw new Error('Signal array required for FFT');
        }

        // Pad to power of 2
        const paddedSignal = padToPowerOf2(signal);
        const phasors = fft.fft(paddedSignal);

        // Calculate magnitudes and phases
        const magnitudes: number[] = [];
        const phases: number[] = [];

        for (const [real, imag] of phasors) {
          magnitudes.push(Math.sqrt(real * real + imag * imag));
          phases.push(Math.atan2(imag, real));
        }

        result = {
          operation: 'fft',
          inputLength: signal.length,
          fftLength: paddedSignal.length,
          wasPadded: signal.length !== paddedSignal.length,
          phasors: phasors.slice(0, 20), // First 20 complex values
          magnitudes: magnitudes.slice(0, paddedSignal.length / 2), // Positive frequencies only
          phases: phases.slice(0, 20),
          dcComponent: magnitudes[0],
          peakMagnitude: Math.max(...magnitudes.slice(1, paddedSignal.length / 2)),
        };
        break;
      }

      case 'ifft': {
        if (!complex_signal || !Array.isArray(complex_signal)) {
          throw new Error('Complex signal array required for IFFT');
        }

        const reconstructed = fft.ifft(complex_signal);

        // Extract real parts
        const realSignal = reconstructed.map((c: number[]) => c[0]);

        result = {
          operation: 'ifft',
          inputLength: complex_signal.length,
          outputLength: realSignal.length,
          reconstructedSignal: realSignal.slice(0, 50), // First 50 samples
          min: Math.min(...realSignal),
          max: Math.max(...realSignal),
        };
        break;
      }

      case 'spectrum': {
        if (!signal || !Array.isArray(signal) || signal.length === 0) {
          throw new Error('Signal array required for spectrum analysis');
        }

        const paddedSignal = padToPowerOf2(signal);
        const phasors = fft.fft(paddedSignal);
        const n = paddedSignal.length;

        // Calculate frequency bins
        const frequencies: number[] = [];
        const magnitudes: number[] = [];
        const powerSpectrum: number[] = [];

        for (let i = 0; i < n / 2; i++) {
          const freq = (i * sample_rate) / n;
          const [real, imag] = phasors[i];
          const mag = Math.sqrt(real * real + imag * imag) / n;
          const power = (real * real + imag * imag) / (n * n);

          frequencies.push(freq);
          magnitudes.push(mag);
          powerSpectrum.push(power);
        }

        // Find dominant frequencies
        const indexed = magnitudes.map((m, i) => ({
          magnitude: m,
          frequency: frequencies[i],
          index: i,
        }));
        indexed.sort((a, b) => b.magnitude - a.magnitude);
        const dominantFrequencies = indexed.slice(1, 6); // Skip DC, get top 5

        result = {
          operation: 'spectrum',
          sampleRate: sample_rate,
          signalLength: signal.length,
          fftLength: n,
          frequencyResolution: sample_rate / n,
          nyquistFrequency: sample_rate / 2,
          spectrum: frequencies.slice(0, 50).map((f, i) => ({
            frequency: f.toFixed(2),
            magnitude: magnitudes[i].toFixed(6),
            power: powerSpectrum[i].toFixed(8),
          })),
          dominantFrequencies: dominantFrequencies.map((d) => ({
            frequency: d.frequency.toFixed(2) + ' Hz',
            magnitude: d.magnitude.toFixed(6),
          })),
          totalPower: powerSpectrum.reduce((a, b) => a + b, 0).toFixed(6),
        };
        break;
      }

      case 'generate': {
        const generatedSignal = generateWave(
          wave_type,
          frequency,
          sample_rate,
          duration,
          amplitude
        );

        // Pad to power of 2 for FFT
        const paddedSignal = padToPowerOf2(generatedSignal);

        result = {
          operation: 'generate',
          waveType: wave_type,
          frequency: frequency + ' Hz',
          sampleRate: sample_rate + ' Hz',
          duration: duration + ' s',
          amplitude,
          numSamples: generatedSignal.length,
          paddedLength: paddedSignal.length,
          signal: generatedSignal.slice(0, 100), // First 100 samples
          min: Math.min(...generatedSignal),
          max: Math.max(...generatedSignal),
          rms: Math.sqrt(
            generatedSignal.reduce((sum, v) => sum + v * v, 0) / generatedSignal.length
          ).toFixed(6),
        };
        break;
      }

      case 'analyze': {
        if (!signal || !Array.isArray(signal) || signal.length === 0) {
          throw new Error('Signal array required for analysis');
        }

        // Time domain statistics
        const n = signal.length;
        const mean = signal.reduce((a, b) => a + b, 0) / n;
        const variance = signal.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
        const rms = Math.sqrt(signal.reduce((sum, v) => sum + v * v, 0) / n);

        // Zero crossings
        let zeroCrossings = 0;
        for (let i = 1; i < n; i++) {
          if ((signal[i - 1] >= 0 && signal[i] < 0) || (signal[i - 1] < 0 && signal[i] >= 0)) {
            zeroCrossings++;
          }
        }

        // Estimate frequency from zero crossings
        const estimatedFreq = zeroCrossings / 2 / (n / sample_rate);

        // FFT for frequency analysis
        const paddedSignal = padToPowerOf2(signal);
        const phasors = fft.fft(paddedSignal);
        const magnitudes = phasors.map(([r, i]: number[]) => Math.sqrt(r * r + i * i));

        // Find peak frequency
        let maxMag = 0;
        let peakBin = 0;
        for (let i = 1; i < paddedSignal.length / 2; i++) {
          if (magnitudes[i] > maxMag) {
            maxMag = magnitudes[i];
            peakBin = i;
          }
        }
        const peakFrequency = (peakBin * sample_rate) / paddedSignal.length;

        result = {
          operation: 'analyze',
          sampleRate: sample_rate,
          timeDomain: {
            length: n,
            duration: (n / sample_rate).toFixed(6) + ' s',
            mean: mean.toFixed(6),
            variance: variance.toFixed(6),
            standardDeviation: Math.sqrt(variance).toFixed(6),
            rms: rms.toFixed(6),
            min: Math.min(...signal),
            max: Math.max(...signal),
            peakToPeak: Math.max(...signal) - Math.min(...signal),
            zeroCrossings,
          },
          frequencyDomain: {
            fftLength: paddedSignal.length,
            frequencyResolution: (sample_rate / paddedSignal.length).toFixed(2) + ' Hz',
            peakFrequency: peakFrequency.toFixed(2) + ' Hz',
            estimatedFrequencyFromZeroCrossings: estimatedFreq.toFixed(2) + ' Hz',
          },
          signalPreview: signal.slice(0, 20),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Signal processing error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
