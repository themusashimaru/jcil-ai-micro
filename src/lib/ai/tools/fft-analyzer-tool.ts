/**
 * FFT-ANALYZER TOOL
 * Fast Fourier Transform frequency analysis with Cooley-Tukey algorithm
 * Supports spectral analysis, windowing, and signal processing
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const fftanalyzerTool: UnifiedTool = {
  name: 'fft_analyzer',
  description:
    'FFT frequency analysis with Cooley-Tukey algorithm, windowing functions, and spectral analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'fft',
          'ifft',
          'dft',
          'spectrum',
          'spectrogram',
          'filter',
          'convolve',
          'correlate',
          'generate',
          'window',
          'info',
          'examples',
        ],
        description: 'Operation to perform',
      },
      signal: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input signal (real values)',
      },
      signal_complex: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Complex input signal. Each entry has: re (number, real part), im (number, imaginary part)',
      },
      sample_rate: { type: 'number', description: 'Sample rate in Hz (default: 1000)' },
      window_type: {
        type: 'string',
        enum: ['rectangular', 'hamming', 'hanning', 'blackman', 'bartlett', 'kaiser', 'gaussian'],
        description: 'Window function type',
      },
      filter_type: {
        type: 'string',
        enum: ['lowpass', 'highpass', 'bandpass', 'bandstop'],
        description: 'Filter type for frequency domain filtering',
      },
      cutoff: { type: 'number', description: 'Cutoff frequency in Hz' },
      cutoff_low: { type: 'number', description: 'Low cutoff for bandpass/bandstop' },
      cutoff_high: { type: 'number', description: 'High cutoff for bandpass/bandstop' },
      signal_type: {
        type: 'string',
        enum: [
          'sine',
          'cosine',
          'square',
          'sawtooth',
          'triangle',
          'chirp',
          'noise',
          'impulse',
          'step',
        ],
        description: 'Type of signal to generate',
      },
      frequency: { type: 'number', description: 'Signal frequency in Hz' },
      frequencies: {
        type: 'array',
        items: { type: 'number' },
        description: 'Multiple frequencies for composite signals',
      },
      amplitude: { type: 'number', description: 'Signal amplitude (default: 1)' },
      duration: { type: 'number', description: 'Signal duration in seconds' },
      n_samples: { type: 'integer', description: 'Number of samples' },
      hop_size: { type: 'integer', description: 'Hop size for spectrogram' },
      window_size: { type: 'integer', description: 'Window size for spectrogram' },
      kaiser_beta: { type: 'number', description: 'Beta parameter for Kaiser window' },
      gaussian_sigma: { type: 'number', description: 'Sigma for Gaussian window' },
    },
    required: ['operation'],
  },
};

// Complex number operations
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
    im: a.re * b.im + a.im * b.re,
  };
}

function complexExp(theta: number): Complex {
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

function complexMag(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function complexPhase(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

function complexConj(c: Complex): Complex {
  return { re: c.re, im: -c.im };
}

function complexScale(c: Complex, s: number): Complex {
  return { re: c.re * s, im: c.im * s };
}

// Next power of 2
function nextPowerOf2(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// Cooley-Tukey FFT (radix-2, decimation-in-time)
function fft(signal: Complex[]): Complex[] {
  const n = signal.length;

  if (n <= 1) return signal;

  // Check if power of 2
  if ((n & (n - 1)) !== 0) {
    // Pad to next power of 2
    const paddedLength = nextPowerOf2(n);
    const padded = [...signal];
    while (padded.length < paddedLength) {
      padded.push({ re: 0, im: 0 });
    }
    return fft(padded);
  }

  // Separate even and odd elements
  const even: Complex[] = [];
  const odd: Complex[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) even.push(signal[i]);
    else odd.push(signal[i]);
  }

  // Recursive FFT
  const evenFFT = fft(even);
  const oddFFT = fft(odd);

  // Combine
  const result: Complex[] = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const twiddle = complexExp((-2 * Math.PI * k) / n);
    const t = complexMul(twiddle, oddFFT[k]);
    result[k] = complexAdd(evenFFT[k], t);
    result[k + n / 2] = complexSub(evenFFT[k], t);
  }

  return result;
}

// Inverse FFT
function ifft(spectrum: Complex[]): Complex[] {
  const n = spectrum.length;

  // Conjugate the input
  const conjugated = spectrum.map((c) => complexConj(c));

  // Apply FFT
  const transformed = fft(conjugated);

  // Conjugate and scale
  return transformed.map((c) => complexScale(complexConj(c), 1 / n));
}

// DFT for arbitrary-length signals (slower but exact)
function dft(signal: Complex[]): Complex[] {
  const n = signal.length;
  const result: Complex[] = new Array(n);

  for (let k = 0; k < n; k++) {
    result[k] = { re: 0, im: 0 };
    for (let t = 0; t < n; t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      const twiddle = complexExp(angle);
      result[k] = complexAdd(result[k], complexMul(signal[t], twiddle));
    }
  }

  return result;
}

// Window functions
function applyWindow(
  signal: number[],
  windowType: string,
  beta: number = 5,
  sigma: number = 0.4
): number[] {
  const n = signal.length;
  const windowed = new Array(n);

  for (let i = 0; i < n; i++) {
    let w = 1;

    switch (windowType) {
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
        break;
      case 'hanning':
        w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
        break;
      case 'blackman':
        w =
          0.42 -
          0.5 * Math.cos((2 * Math.PI * i) / (n - 1)) +
          0.08 * Math.cos((4 * Math.PI * i) / (n - 1));
        break;
      case 'bartlett':
        w = 1 - Math.abs((i - (n - 1) / 2) / ((n - 1) / 2));
        break;
      case 'kaiser':
        // Kaiser window using I0 approximation
        const alpha = (n - 1) / 2;
        const ratio = (i - alpha) / alpha;
        w = besselI0(beta * Math.sqrt(1 - ratio * ratio)) / besselI0(beta);
        break;
      case 'gaussian':
        const center = (n - 1) / 2;
        const x = (i - center) / (sigma * center);
        w = Math.exp(-0.5 * x * x);
        break;
      case 'rectangular':
      default:
        w = 1;
    }

    windowed[i] = signal[i] * w;
  }

  return windowed;
}

// Bessel I0 approximation for Kaiser window
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  const x2 = (x * x) / 4;

  for (let k = 1; k <= 20; k++) {
    term *= x2 / (k * k);
    sum += term;
    if (term < 1e-10) break;
  }

  return sum;
}

// Generate window coefficients
function generateWindow(
  n: number,
  windowType: string,
  beta: number = 5,
  sigma: number = 0.4
): number[] {
  const ones = new Array(n).fill(1);
  return applyWindow(ones, windowType, beta, sigma);
}

// Signal generation
function generateSignal(
  type: string,
  sampleRate: number,
  duration: number,
  frequency: number,
  amplitude: number = 1,
  frequencies?: number[]
): number[] {
  const n = Math.floor(sampleRate * duration);
  const signal = new Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;

    switch (type) {
      case 'sine':
        signal[i] = amplitude * Math.sin(2 * Math.PI * frequency * t);
        break;
      case 'cosine':
        signal[i] = amplitude * Math.cos(2 * Math.PI * frequency * t);
        break;
      case 'square':
        signal[i] = amplitude * Math.sign(Math.sin(2 * Math.PI * frequency * t));
        break;
      case 'sawtooth':
        signal[i] = amplitude * (2 * (frequency * t - Math.floor(frequency * t + 0.5)));
        break;
      case 'triangle':
        const phase = frequency * t;
        signal[i] = amplitude * (4 * Math.abs(phase - Math.floor(phase + 0.75) + 0.25) - 1);
        break;
      case 'chirp':
        // Linear chirp from frequency to 2*frequency
        const f = frequency + (frequency * t) / duration;
        signal[i] = amplitude * Math.sin(2 * Math.PI * f * t);
        break;
      case 'noise':
        signal[i] = amplitude * (2 * Math.random() - 1);
        break;
      case 'impulse':
        signal[i] = i === 0 ? amplitude : 0;
        break;
      case 'step':
        signal[i] = amplitude;
        break;
      default:
        signal[i] = 0;
    }
  }

  // Add multiple frequencies if specified
  if (frequencies && frequencies.length > 0) {
    for (const freq of frequencies) {
      for (let i = 0; i < n; i++) {
        const t = i / sampleRate;
        signal[i] += amplitude * Math.sin(2 * Math.PI * freq * t);
      }
    }
  }

  return signal;
}

// Compute magnitude spectrum
function magnitudeSpectrum(spectrum: Complex[]): number[] {
  return spectrum.map((c) => complexMag(c));
}

// Compute phase spectrum
function phaseSpectrum(spectrum: Complex[]): number[] {
  return spectrum.map((c) => complexPhase(c));
}

// Compute power spectrum (magnitude squared)
function powerSpectrum(spectrum: Complex[]): number[] {
  return spectrum.map((c) => c.re * c.re + c.im * c.im);
}

// Compute power spectral density in dB
function psdDb(spectrum: Complex[]): number[] {
  const power = powerSpectrum(spectrum);
  const maxPower = Math.max(...power);
  return power.map((p) => 10 * Math.log10(p / maxPower + 1e-10));
}

// Frequency bins
function frequencyBins(n: number, sampleRate: number): number[] {
  const bins = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i <= n / 2) {
      bins[i] = (i * sampleRate) / n;
    } else {
      bins[i] = ((i - n) * sampleRate) / n;
    }
  }
  return bins;
}

// Find dominant frequencies
function findPeaks(
  magnitude: number[],
  freqBins: number[],
  threshold: number = 0.1
): Array<{ frequency: number; magnitude: number; bin: number }> {
  const peaks: Array<{ frequency: number; magnitude: number; bin: number }> = [];
  const maxMag = Math.max(...magnitude.slice(0, Math.floor(magnitude.length / 2)));
  const thresholdValue = threshold * maxMag;

  // Only look at positive frequencies
  for (let i = 1; i < magnitude.length / 2 - 1; i++) {
    if (
      magnitude[i] > magnitude[i - 1] &&
      magnitude[i] > magnitude[i + 1] &&
      magnitude[i] > thresholdValue
    ) {
      peaks.push({
        frequency: freqBins[i],
        magnitude: magnitude[i],
        bin: i,
      });
    }
  }

  // Sort by magnitude
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  return peaks;
}

// Frequency domain filtering
function frequencyFilter(
  spectrum: Complex[],
  filterType: string,
  sampleRate: number,
  cutoff?: number,
  cutoffLow?: number,
  cutoffHigh?: number
): Complex[] {
  const n = spectrum.length;
  const filtered = spectrum.map((c) => ({ ...c }));
  const freqBins = frequencyBins(n, sampleRate);

  for (let i = 0; i < n; i++) {
    const freq = Math.abs(freqBins[i]);
    let gain = 1;

    switch (filterType) {
      case 'lowpass':
        gain = freq <= (cutoff || 0) ? 1 : 0;
        break;
      case 'highpass':
        gain = freq >= (cutoff || 0) ? 1 : 0;
        break;
      case 'bandpass':
        gain = freq >= (cutoffLow || 0) && freq <= (cutoffHigh || sampleRate / 2) ? 1 : 0;
        break;
      case 'bandstop':
        gain = freq < (cutoffLow || 0) || freq > (cutoffHigh || sampleRate / 2) ? 1 : 0;
        break;
    }

    filtered[i].re *= gain;
    filtered[i].im *= gain;
  }

  return filtered;
}

// Convolution using FFT
function convolve(signal1: number[], signal2: number[]): number[] {
  const n = nextPowerOf2(signal1.length + signal2.length - 1);

  // Pad signals
  const padded1: Complex[] = signal1.map((x) => ({ re: x, im: 0 }));
  const padded2: Complex[] = signal2.map((x) => ({ re: x, im: 0 }));
  while (padded1.length < n) padded1.push({ re: 0, im: 0 });
  while (padded2.length < n) padded2.push({ re: 0, im: 0 });

  // FFT both signals
  const fft1 = fft(padded1);
  const fft2 = fft(padded2);

  // Multiply in frequency domain
  const product = fft1.map((c, i) => complexMul(c, fft2[i]));

  // IFFT
  const result = ifft(product);

  // Return real part, trimmed to correct length
  return result.slice(0, signal1.length + signal2.length - 1).map((c) => c.re);
}

// Cross-correlation using FFT
function crossCorrelate(signal1: number[], signal2: number[]): number[] {
  const n = nextPowerOf2(signal1.length + signal2.length - 1);

  // Pad signals
  const padded1: Complex[] = signal1.map((x) => ({ re: x, im: 0 }));
  const padded2: Complex[] = signal2.map((x) => ({ re: x, im: 0 }));
  while (padded1.length < n) padded1.push({ re: 0, im: 0 });
  while (padded2.length < n) padded2.push({ re: 0, im: 0 });

  // FFT both signals
  const fft1 = fft(padded1);
  const fft2 = fft(padded2);

  // Multiply FFT1 by conjugate of FFT2
  const product = fft1.map((c, i) => complexMul(c, complexConj(fft2[i])));

  // IFFT
  const result = ifft(product);

  // Return real part
  return result.map((c) => c.re);
}

// Short-Time Fourier Transform (STFT) for spectrogram
function stft(
  signal: number[],
  windowSize: number,
  hopSize: number,
  windowType: string = 'hanning'
): { frames: Complex[][]; times: number[] } {
  const frames: Complex[][] = [];
  const times: number[] = [];
  const window = generateWindow(windowSize, windowType);

  for (let start = 0; start + windowSize <= signal.length; start += hopSize) {
    const frame = signal.slice(start, start + windowSize).map((x, i) => x * window[i]);
    const complexFrame: Complex[] = frame.map((x) => ({ re: x, im: 0 }));
    frames.push(fft(complexFrame));
    times.push(start);
  }

  return { frames, times };
}

export async function executefftanalyzer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'fft': {
        let complexSignal: Complex[];

        if (args.signal_complex) {
          complexSignal = args.signal_complex;
        } else if (args.signal) {
          complexSignal = args.signal.map((x: number) => ({ re: x, im: 0 }));
        } else {
          throw new Error('Signal required for FFT');
        }

        // Apply window if specified
        if (args.window_type && args.signal) {
          const windowed = applyWindow(
            args.signal,
            args.window_type,
            args.kaiser_beta,
            args.gaussian_sigma
          );
          complexSignal = windowed.map((x) => ({ re: x, im: 0 }));
        }

        const sampleRate = args.sample_rate || 1000;
        const spectrum = fft(complexSignal);
        const mag = magnitudeSpectrum(spectrum);
        const phase = phaseSpectrum(spectrum);
        const freqBins = frequencyBins(spectrum.length, sampleRate);
        const peaks = findPeaks(mag, freqBins);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'fft',
              input_length: complexSignal.length,
              output_length: spectrum.length,
              sample_rate: sampleRate,
              window: args.window_type || 'rectangular',
              spectrum: spectrum.slice(0, Math.min(50, spectrum.length)).map((c, i) => ({
                bin: i,
                frequency: freqBins[i].toFixed(2) + ' Hz',
                real: c.re.toFixed(6),
                imag: c.im.toFixed(6),
                magnitude: mag[i].toFixed(6),
                phase_rad: phase[i].toFixed(4),
              })),
              dominant_frequencies: peaks.slice(0, 10).map((p) => ({
                frequency: p.frequency.toFixed(2) + ' Hz',
                magnitude: p.magnitude.toFixed(4),
                bin: p.bin,
              })),
              full_spectrum_magnitude: mag.slice(0, Math.floor(spectrum.length / 2)),
              full_spectrum_phase: phase.slice(0, Math.floor(spectrum.length / 2)),
              algorithm: 'Cooley-Tukey radix-2 FFT',
              complexity: 'O(n log n)',
            },
            null,
            2
          ),
        };
      }

      case 'ifft': {
        let spectrum: Complex[];

        if (args.signal_complex) {
          spectrum = args.signal_complex;
        } else {
          throw new Error('Complex spectrum required for IFFT');
        }

        const reconstructed = ifft(spectrum);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'ifft',
              input_length: spectrum.length,
              output_length: reconstructed.length,
              reconstructed_signal: reconstructed
                .slice(0, Math.min(50, reconstructed.length))
                .map((c, i) => ({
                  index: i,
                  real: c.re.toFixed(6),
                  imag: c.im.toFixed(6),
                })),
              full_signal_real: reconstructed.map((c) => c.re),
              algorithm: 'Inverse FFT via conjugate trick',
            },
            null,
            2
          ),
        };
      }

      case 'dft': {
        let complexSignal: Complex[];

        if (args.signal_complex) {
          complexSignal = args.signal_complex;
        } else if (args.signal) {
          complexSignal = args.signal.map((x: number) => ({ re: x, im: 0 }));
        } else {
          throw new Error('Signal required for DFT');
        }

        const sampleRate = args.sample_rate || 1000;
        const spectrum = dft(complexSignal);
        const mag = magnitudeSpectrum(spectrum);
        const freqBins = frequencyBins(spectrum.length, sampleRate);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'dft',
              note: 'Direct DFT - use for arbitrary-length signals (slower than FFT)',
              input_length: complexSignal.length,
              output_length: spectrum.length,
              sample_rate: sampleRate,
              spectrum: spectrum.slice(0, Math.min(30, spectrum.length)).map((c, i) => ({
                bin: i,
                frequency: freqBins[i].toFixed(2) + ' Hz',
                real: c.re.toFixed(6),
                imag: c.im.toFixed(6),
                magnitude: mag[i].toFixed(6),
              })),
              complexity: 'O(n²)',
            },
            null,
            2
          ),
        };
      }

      case 'spectrum': {
        let signal: number[];

        if (args.signal) {
          signal = args.signal;
        } else {
          throw new Error('Signal required for spectrum analysis');
        }

        // Apply window
        const windowType = args.window_type || 'hanning';
        const windowed = applyWindow(signal, windowType, args.kaiser_beta, args.gaussian_sigma);
        const complexSignal: Complex[] = windowed.map((x) => ({ re: x, im: 0 }));

        const sampleRate = args.sample_rate || 1000;
        const spectrum = fft(complexSignal);
        const mag = magnitudeSpectrum(spectrum);
        const power = powerSpectrum(spectrum);
        const psd = psdDb(spectrum);
        const freqBins = frequencyBins(spectrum.length, sampleRate);
        const peaks = findPeaks(mag, freqBins);

        // Compute spectral statistics
        const halfN = Math.floor(spectrum.length / 2);
        const totalPower = power.slice(0, halfN).reduce((a, b) => a + b, 0);

        // Spectral centroid
        let centroidNum = 0;
        for (let i = 0; i < halfN; i++) {
          centroidNum += freqBins[i] * power[i];
        }
        const spectralCentroid = centroidNum / totalPower;

        // Spectral bandwidth
        let bandwidthNum = 0;
        for (let i = 0; i < halfN; i++) {
          bandwidthNum += Math.pow(freqBins[i] - spectralCentroid, 2) * power[i];
        }
        const spectralBandwidth = Math.sqrt(bandwidthNum / totalPower);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'spectrum',
              signal_length: signal.length,
              sample_rate: sampleRate,
              window: windowType,
              frequency_resolution: (sampleRate / spectrum.length).toFixed(4) + ' Hz',
              nyquist_frequency: sampleRate / 2 + ' Hz',
              dominant_frequencies: peaks.slice(0, 10).map((p) => ({
                frequency: p.frequency.toFixed(2) + ' Hz',
                magnitude: p.magnitude.toFixed(4),
                power_db:
                  (
                    10 *
                    Math.log10(
                      (p.magnitude * p.magnitude) / (Math.max(...mag) * Math.max(...mag)) + 1e-10
                    )
                  ).toFixed(2) + ' dB',
              })),
              spectral_statistics: {
                spectral_centroid: spectralCentroid.toFixed(2) + ' Hz',
                spectral_bandwidth: spectralBandwidth.toFixed(2) + ' Hz',
                total_power: totalPower.toFixed(4),
              },
              magnitude_spectrum: mag.slice(0, halfN),
              power_spectrum_db: psd.slice(0, halfN),
              frequency_bins: freqBins.slice(0, halfN),
            },
            null,
            2
          ),
        };
      }

      case 'spectrogram': {
        let signal: number[];

        if (args.signal) {
          signal = args.signal;
        } else {
          throw new Error('Signal required for spectrogram');
        }

        const sampleRate = args.sample_rate || 1000;
        const windowSize = args.window_size || 256;
        const hopSize = args.hop_size || windowSize / 4;
        const windowType = args.window_type || 'hanning';

        const { frames, times } = stft(signal, windowSize, hopSize, windowType);

        // Convert to magnitude spectrogram
        const spectrogramData = frames.map((frame) => {
          const mag = magnitudeSpectrum(frame);
          return mag.slice(0, Math.floor(frame.length / 2));
        });

        // Convert to dB
        const maxVal = Math.max(...spectrogramData.flat());
        const spectrogramDb = spectrogramData.map((row) =>
          row.map((val) => 20 * Math.log10(val / maxVal + 1e-10))
        );

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'spectrogram',
              signal_length: signal.length,
              sample_rate: sampleRate,
              window_size: windowSize,
              hop_size: hopSize,
              window_type: windowType,
              num_frames: frames.length,
              num_frequency_bins: spectrogramData[0]?.length || 0,
              frequency_resolution: (sampleRate / windowSize).toFixed(2) + ' Hz',
              time_resolution: ((hopSize / sampleRate) * 1000).toFixed(2) + ' ms',
              time_indices: times.map((t) => (t / sampleRate).toFixed(4)),
              spectrogram_db: spectrogramDb.slice(0, 20).map((row, i) => ({
                time: (times[i] / sampleRate).toFixed(4) + ' s',
                magnitude_db: row.slice(0, 30).map((v) => v.toFixed(1)),
              })),
              full_spectrogram: spectrogramDb,
            },
            null,
            2
          ),
        };
      }

      case 'filter': {
        let signal: number[];

        if (args.signal) {
          signal = args.signal;
        } else {
          throw new Error('Signal required for filtering');
        }

        const filterType = args.filter_type || 'lowpass';
        const sampleRate = args.sample_rate || 1000;

        // Convert to complex and FFT
        const complexSignal: Complex[] = signal.map((x) => ({ re: x, im: 0 }));
        const spectrum = fft(complexSignal);

        // Apply filter
        const filtered = frequencyFilter(
          spectrum,
          filterType,
          sampleRate,
          args.cutoff,
          args.cutoff_low,
          args.cutoff_high
        );

        // IFFT back to time domain
        const result = ifft(filtered);
        const filteredSignal = result.map((c) => c.re);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'filter',
              filter_type: filterType,
              cutoff: args.cutoff,
              cutoff_low: args.cutoff_low,
              cutoff_high: args.cutoff_high,
              sample_rate: sampleRate,
              input_length: signal.length,
              output_length: filteredSignal.length,
              original_signal: signal.slice(0, 30),
              filtered_signal: filteredSignal.slice(0, 30).map((x) => parseFloat(x.toFixed(6))),
              full_filtered_signal: filteredSignal.map((x) => parseFloat(x.toFixed(6))),
              method: 'Frequency domain filtering via FFT',
            },
            null,
            2
          ),
        };
      }

      case 'convolve': {
        if (!args.signal || (!args.signal_complex && !Array.isArray(args.signal))) {
          throw new Error('Two signals required for convolution');
        }

        // Expect signal and signal_complex as the two signals for convolution
        const signal1: number[] = args.signal;
        const signal2: number[] =
          args.signal_complex?.map((c: Complex) => c.re) ||
          (Array.isArray(args.frequencies) ? args.frequencies : [1]);

        const result = convolve(signal1, signal2);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'convolve',
              signal1_length: signal1.length,
              signal2_length: signal2.length,
              output_length: result.length,
              signal1: signal1.slice(0, 20),
              signal2: signal2.slice(0, 20),
              convolution_result: result.slice(0, 50).map((x) => parseFloat(x.toFixed(6))),
              full_result: result.map((x) => parseFloat(x.toFixed(6))),
              method: 'FFT-based fast convolution',
              complexity: 'O(n log n)',
            },
            null,
            2
          ),
        };
      }

      case 'correlate': {
        if (!args.signal) {
          throw new Error('Two signals required for correlation');
        }

        const signal1: number[] = args.signal;
        const signal2: number[] = args.frequencies || signal1; // Auto-correlation if no second signal

        const result = crossCorrelate(signal1, signal2);

        // Find lag with maximum correlation
        let maxCorr = -Infinity;
        let maxLag = 0;
        for (let i = 0; i < result.length; i++) {
          if (result[i] > maxCorr) {
            maxCorr = result[i];
            maxLag = i;
          }
        }

        // Adjust lag to be centered
        const centeredLag = maxLag > result.length / 2 ? maxLag - result.length : maxLag;

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'correlate',
              type: args.frequencies ? 'cross-correlation' : 'auto-correlation',
              signal1_length: signal1.length,
              signal2_length: signal2.length,
              output_length: result.length,
              peak_correlation: maxCorr.toFixed(6),
              lag_at_peak: centeredLag,
              correlation_result: result.slice(0, 50).map((x) => parseFloat(x.toFixed(6))),
              full_result: result.map((x) => parseFloat(x.toFixed(6))),
              method: 'FFT-based fast correlation',
            },
            null,
            2
          ),
        };
      }

      case 'generate': {
        const signalType = args.signal_type || 'sine';
        const sampleRate = args.sample_rate || 1000;
        const duration = args.duration || 0.1;
        const frequency = args.frequency || 100;
        const amplitude = args.amplitude || 1;
        const frequencies = args.frequencies;

        const signal = generateSignal(
          signalType,
          sampleRate,
          duration,
          frequency,
          amplitude,
          frequencies
        );

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'generate',
              signal_type: signalType,
              sample_rate: sampleRate,
              duration: duration + ' s',
              frequency: frequency + ' Hz',
              additional_frequencies: frequencies?.map((f: number) => f + ' Hz'),
              amplitude: amplitude,
              num_samples: signal.length,
              signal_preview: signal.slice(0, 50).map((x) => parseFloat(x.toFixed(6))),
              full_signal: signal.map((x) => parseFloat(x.toFixed(6))),
              signal_stats: {
                min: Math.min(...signal).toFixed(6),
                max: Math.max(...signal).toFixed(6),
                mean: (signal.reduce((a, b) => a + b, 0) / signal.length).toFixed(6),
                rms: Math.sqrt(signal.reduce((a, b) => a + b * b, 0) / signal.length).toFixed(6),
              },
            },
            null,
            2
          ),
        };
      }

      case 'window': {
        const windowType = args.window_type || 'hanning';
        const n = args.n_samples || 64;
        const beta = args.kaiser_beta || 5;
        const sigma = args.gaussian_sigma || 0.4;

        const window = generateWindow(n, windowType, beta, sigma);

        // Compute window properties
        const sum = window.reduce((a, b) => a + b, 0);
        const sumSquared = window.reduce((a, b) => a + b * b, 0);
        const coherentGain = sum / n;
        const noisePowerBandwidth = (n * sumSquared) / (sum * sum);

        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              operation: 'window',
              window_type: windowType,
              length: n,
              parameters: {
                kaiser_beta: windowType === 'kaiser' ? beta : undefined,
                gaussian_sigma: windowType === 'gaussian' ? sigma : undefined,
              },
              window_properties: {
                coherent_gain: coherentGain.toFixed(6),
                noise_power_bandwidth: noisePowerBandwidth.toFixed(4),
                processing_gain_db: (10 * Math.log10(n / noisePowerBandwidth)).toFixed(2) + ' dB',
              },
              window_coefficients: window.map((w) => parseFloat(w.toFixed(6))),
              available_windows: [
                'rectangular',
                'hamming',
                'hanning',
                'blackman',
                'bartlett',
                'kaiser',
                'gaussian',
              ],
            },
            null,
            2
          ),
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              tool: 'fft_analyzer',
              description: 'Fast Fourier Transform frequency analysis tool',
              algorithm: 'Cooley-Tukey radix-2 decimation-in-time FFT',
              complexity: 'O(n log n) for FFT, O(n²) for DFT',
              capabilities: [
                'Forward and inverse FFT',
                'Direct DFT for arbitrary-length signals',
                'Spectrum analysis (magnitude, phase, power)',
                'Spectrogram (Short-Time Fourier Transform)',
                'Frequency domain filtering (lowpass, highpass, bandpass, bandstop)',
                'Convolution and correlation via FFT',
                'Signal generation (sine, square, sawtooth, chirp, noise)',
                'Window functions (Hamming, Hanning, Blackman, Kaiser, etc.)',
              ],
              operations: {
                fft: 'Compute FFT of a signal with optional windowing',
                ifft: 'Inverse FFT to reconstruct time-domain signal',
                dft: 'Direct DFT for non-power-of-2 lengths',
                spectrum: 'Full spectral analysis with statistics',
                spectrogram: 'Time-frequency representation via STFT',
                filter: 'Apply frequency domain filters',
                convolve: 'Fast convolution using FFT',
                correlate: 'Cross-correlation or auto-correlation',
                generate: 'Generate test signals',
                window: 'Generate window function coefficients',
              },
              window_functions: {
                rectangular: 'No windowing (maximum frequency resolution)',
                hamming: 'Good sidelobe suppression (α=0.54)',
                hanning: 'Cosine bell, zero at endpoints',
                blackman: 'Excellent sidelobe suppression',
                bartlett: 'Triangular window',
                kaiser: 'Adjustable sidelobe attenuation via β parameter',
                gaussian: 'Smooth taper with adjustable σ',
              },
              signal_types: [
                'sine',
                'cosine',
                'square',
                'sawtooth',
                'triangle',
                'chirp',
                'noise',
                'impulse',
                'step',
              ],
              mathematical_background: {
                fft_formula: 'X[k] = Σ x[n] * e^(-j*2π*k*n/N)',
                inverse_formula: 'x[n] = (1/N) * Σ X[k] * e^(j*2π*k*n/N)',
                convolution_theorem: 'x * h = IFFT(FFT(x) · FFT(h))',
                correlation_theorem: 'Rxy = IFFT(FFT(x) · conj(FFT(y)))',
              },
            },
            null,
            2
          ),
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify(
            {
              examples: [
                {
                  description: 'FFT of a simple signal',
                  call: {
                    operation: 'fft',
                    signal: [1, 0, -1, 0, 1, 0, -1, 0],
                    sample_rate: 8,
                  },
                },
                {
                  description: 'Generate and analyze a 100Hz sine wave',
                  calls: [
                    {
                      operation: 'generate',
                      signal_type: 'sine',
                      frequency: 100,
                      sample_rate: 1000,
                      duration: 0.1,
                    },
                    {
                      operation: 'spectrum',
                      signal: '(use generated signal)',
                      sample_rate: 1000,
                      window_type: 'hanning',
                    },
                  ],
                },
                {
                  description: 'Apply lowpass filter',
                  call: {
                    operation: 'filter',
                    signal: '(your signal)',
                    filter_type: 'lowpass',
                    cutoff: 200,
                    sample_rate: 1000,
                  },
                },
                {
                  description: 'Compute spectrogram',
                  call: {
                    operation: 'spectrogram',
                    signal: '(your signal)',
                    sample_rate: 1000,
                    window_size: 256,
                    hop_size: 64,
                    window_type: 'hanning',
                  },
                },
                {
                  description: 'Generate Kaiser window',
                  call: {
                    operation: 'window',
                    window_type: 'kaiser',
                    n_samples: 64,
                    kaiser_beta: 8,
                  },
                },
                {
                  description: 'Convolve two signals',
                  call: {
                    operation: 'convolve',
                    signal: [1, 2, 3, 4],
                    frequencies: [1, 1, 1],
                  },
                },
                {
                  description: 'Auto-correlation',
                  call: {
                    operation: 'correlate',
                    signal: [1, 0, -1, 0, 1, 0, -1, 0],
                  },
                },
              ],
            },
            null,
            2
          ),
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isfftanalyzerAvailable(): boolean {
  return true;
}
