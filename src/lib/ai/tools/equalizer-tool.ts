/**
 * EQUALIZER TOOL
 * Comprehensive audio equalizer with parametric and graphic EQ
 * Implements biquad filters, FFT-based EQ, and band analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const equalizerTool: UnifiedTool = {
  name: 'equalizer',
  description: 'Audio equalizer with parametric EQ, graphic EQ, and spectrum analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'info',
          'examples',
          'demo',
          'parametric',
          'graphic',
          'shelving',
          'analyze',
          'design_filter',
          'frequency_response',
        ],
        description: 'Operation to perform',
      },
      signal: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input audio signal samples',
      },
      sampleRate: {
        type: 'number',
        description: 'Sample rate in Hz (default: 44100)',
      },
      bands: {
        type: 'array',
        items: { type: 'object' },
        description:
          'Parametric EQ bands. Each band has: frequency (number), gain (number), q (number)',
      },
      graphicBands: {
        type: 'array',
        items: { type: 'number' },
        description: 'Graphic EQ gains in dB (e.g., 10 bands or 31 bands)',
      },
      filterType: {
        type: 'string',
        enum: [
          'lowpass',
          'highpass',
          'bandpass',
          'notch',
          'peak',
          'lowshelf',
          'highshelf',
          'allpass',
        ],
        description: 'Filter type for design',
      },
      frequency: {
        type: 'number',
        description: 'Center/cutoff frequency in Hz',
      },
      gain: {
        type: 'number',
        description: 'Gain in dB',
      },
      q: {
        type: 'number',
        description: 'Q factor (quality/bandwidth)',
      },
    },
    required: ['operation'],
  },
};

// Biquad filter coefficients
interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

// Biquad filter state
interface BiquadFilter {
  coeffs: BiquadCoefficients;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

// Calculate biquad filter coefficients
function calculateBiquadCoeffs(
  type: string,
  frequency: number,
  sampleRate: number,
  q: number,
  gain: number
): BiquadCoefficients {
  const w0 = (2 * Math.PI * frequency) / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * q);
  const A = Math.pow(10, gain / 40); // sqrt of amplitude

  let b0 = 0,
    b1 = 0,
    b2 = 0,
    a0 = 1,
    a1 = 0,
    a2 = 0;

  switch (type) {
    case 'lowpass':
      b0 = (1 - cosw0) / 2;
      b1 = 1 - cosw0;
      b2 = (1 - cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;

    case 'highpass':
      b0 = (1 + cosw0) / 2;
      b1 = -(1 + cosw0);
      b2 = (1 + cosw0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;

    case 'bandpass':
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;

    case 'notch':
      b0 = 1;
      b1 = -2 * cosw0;
      b2 = 1;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;

    case 'peak':
      b0 = 1 + alpha * A;
      b1 = -2 * cosw0;
      b2 = 1 - alpha * A;
      a0 = 1 + alpha / A;
      a1 = -2 * cosw0;
      a2 = 1 - alpha / A;
      break;

    case 'lowshelf': {
      const sqrtA = Math.sqrt(A);
      b0 = A * (A + 1 - (A - 1) * cosw0 + 2 * sqrtA * alpha);
      b1 = 2 * A * (A - 1 - (A + 1) * cosw0);
      b2 = A * (A + 1 - (A - 1) * cosw0 - 2 * sqrtA * alpha);
      a0 = A + 1 + (A - 1) * cosw0 + 2 * sqrtA * alpha;
      a1 = -2 * (A - 1 + (A + 1) * cosw0);
      a2 = A + 1 + (A - 1) * cosw0 - 2 * sqrtA * alpha;
      break;
    }

    case 'highshelf': {
      const sqrtA = Math.sqrt(A);
      b0 = A * (A + 1 + (A - 1) * cosw0 + 2 * sqrtA * alpha);
      b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
      b2 = A * (A + 1 + (A - 1) * cosw0 - 2 * sqrtA * alpha);
      a0 = A + 1 - (A - 1) * cosw0 + 2 * sqrtA * alpha;
      a1 = 2 * (A - 1 - (A + 1) * cosw0);
      a2 = A + 1 - (A - 1) * cosw0 - 2 * sqrtA * alpha;
      break;
    }

    case 'allpass':
      b0 = 1 - alpha;
      b1 = -2 * cosw0;
      b2 = 1 + alpha;
      a0 = 1 + alpha;
      a1 = -2 * cosw0;
      a2 = 1 - alpha;
      break;
  }

  // Normalize coefficients
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

// Create biquad filter
function createBiquadFilter(coeffs: BiquadCoefficients): BiquadFilter {
  return {
    coeffs,
    x1: 0,
    x2: 0,
    y1: 0,
    y2: 0,
  };
}

// Process sample through biquad filter
function processBiquad(filter: BiquadFilter, input: number): number {
  const { b0, b1, b2, a1, a2 } = filter.coeffs;

  const output = b0 * input + b1 * filter.x1 + b2 * filter.x2 - a1 * filter.y1 - a2 * filter.y2;

  filter.x2 = filter.x1;
  filter.x1 = input;
  filter.y2 = filter.y1;
  filter.y1 = output;

  return output;
}

// Calculate frequency response of biquad filter
function calculateFrequencyResponse(
  coeffs: BiquadCoefficients,
  sampleRate: number,
  numPoints: number = 100
): { frequencies: number[]; magnitude: number[]; phase: number[] } {
  const frequencies: number[] = [];
  const magnitude: number[] = [];
  const phase: number[] = [];

  // Logarithmic frequency spacing
  const minFreq = 20;
  const maxFreq = sampleRate / 2;

  for (let i = 0; i < numPoints; i++) {
    const freq = minFreq * Math.pow(maxFreq / minFreq, i / (numPoints - 1));
    frequencies.push(freq);

    const w = (2 * Math.PI * freq) / sampleRate;
    const cosw = Math.cos(w);
    const cos2w = Math.cos(2 * w);
    const sinw = Math.sin(w);
    const sin2w = Math.sin(2 * w);

    // Numerator
    const numReal = coeffs.b0 + coeffs.b1 * cosw + coeffs.b2 * cos2w;
    const numImag = -coeffs.b1 * sinw - coeffs.b2 * sin2w;

    // Denominator
    const denReal = 1 + coeffs.a1 * cosw + coeffs.a2 * cos2w;
    const denImag = -coeffs.a1 * sinw - coeffs.a2 * sin2w;

    // Complex division
    const denMagSq = denReal * denReal + denImag * denImag;
    const respReal = (numReal * denReal + numImag * denImag) / denMagSq;
    const respImag = (numImag * denReal - numReal * denImag) / denMagSq;

    const mag = Math.sqrt(respReal * respReal + respImag * respImag);
    magnitude.push(20 * Math.log10(Math.max(mag, 1e-10)));
    phase.push((Math.atan2(respImag, respReal) * 180) / Math.PI);
  }

  return { frequencies, magnitude, phase };
}

// Parametric EQ with multiple bands
function parametricEQ(
  signal: number[],
  sampleRate: number,
  bands: { frequency: number; gain: number; q: number }[]
): { output: number[]; analysis: object } {
  // Create filter for each band
  const filters: BiquadFilter[] = bands.map((band) =>
    createBiquadFilter(calculateBiquadCoeffs('peak', band.frequency, sampleRate, band.q, band.gain))
  );

  // Process signal through cascade of filters
  const output: number[] = new Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    let sample = signal[i];
    for (const filter of filters) {
      sample = processBiquad(filter, sample);
    }
    output[i] = sample;
  }

  // Calculate combined frequency response
  const responses = bands.map((band) => {
    const coeffs = calculateBiquadCoeffs('peak', band.frequency, sampleRate, band.q, band.gain);
    return calculateFrequencyResponse(coeffs, sampleRate, 50);
  });

  // Sum responses (in dB domain, approximately)
  const combinedMagnitude = responses[0].magnitude.map((_, i) =>
    responses.reduce((sum, resp) => sum + resp.magnitude[i], 0)
  );

  return {
    output,
    analysis: {
      type: 'Parametric EQ',
      bandCount: bands.length,
      bands: bands.map((band, _i) => ({
        frequency: band.frequency + ' Hz',
        gain: band.gain + ' dB',
        q: band.q,
        bandwidth: (band.frequency / band.q).toFixed(1) + ' Hz',
      })),
      frequencyResponse: {
        frequencies: responses[0].frequencies
          .filter((_, i) => i % 5 === 0)
          .map((f) => f.toFixed(0) + ' Hz'),
        magnitude: combinedMagnitude.filter((_, i) => i % 5 === 0).map((m) => m.toFixed(2) + ' dB'),
      },
    },
  };
}

// Graphic EQ with fixed frequency bands
function graphicEQ(
  signal: number[],
  sampleRate: number,
  gains: number[],
  bandCount: 10 | 31 = 10
): { output: number[]; analysis: object } {
  // Standard ISO center frequencies
  const isoFrequencies10 = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const isoFrequencies31 = [
    20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250,
    1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
  ];

  const frequencies = bandCount === 31 ? isoFrequencies31 : isoFrequencies10;
  const usedGains = gains.slice(0, frequencies.length);

  // Pad gains if needed
  while (usedGains.length < frequencies.length) {
    usedGains.push(0);
  }

  // Calculate Q for octave bands
  // For 1-octave bands (10-band): Q ≈ 1.41
  // For 1/3-octave bands (31-band): Q ≈ 4.32
  const q = bandCount === 31 ? 4.32 : 1.41;

  // Create filters
  const bands = frequencies.map((freq, i) => ({
    frequency: freq,
    gain: usedGains[i],
    q,
  }));

  // Only create filters for non-zero gains (optimization)
  const activeFilters: BiquadFilter[] = [];
  const activeBands: typeof bands = [];

  for (let i = 0; i < bands.length; i++) {
    if (Math.abs(bands[i].gain) > 0.1) {
      activeBands.push(bands[i]);
      activeFilters.push(
        createBiquadFilter(
          calculateBiquadCoeffs('peak', bands[i].frequency, sampleRate, bands[i].q, bands[i].gain)
        )
      );
    }
  }

  // Process signal
  const output: number[] = new Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    let sample = signal[i];
    for (const filter of activeFilters) {
      sample = processBiquad(filter, sample);
    }
    output[i] = sample;
  }

  return {
    output,
    analysis: {
      type: `${bandCount}-Band Graphic EQ`,
      bandType: bandCount === 31 ? '1/3 Octave' : '1 Octave',
      q,
      bands: bands.map((b) => ({
        frequency: b.frequency + ' Hz',
        gain: b.gain.toFixed(1) + ' dB',
      })),
      activeBands: activeBands.length,
      visualizer: bands.map((b) => {
        const bars = Math.round(((b.gain + 12) / 24) * 10);
        return (
          '|' +
          '█'.repeat(Math.max(0, Math.min(10, bars))) +
          ' '.repeat(10 - Math.max(0, Math.min(10, bars))) +
          '|'
        );
      }),
    },
  };
}

// Shelving filter (bass/treble)
function shelvingEQ(
  signal: number[],
  sampleRate: number,
  lowShelfFreq: number,
  lowShelfGain: number,
  highShelfFreq: number,
  highShelfGain: number
): { output: number[]; analysis: object } {
  // Create low shelf filter
  const lowShelfCoeffs = calculateBiquadCoeffs(
    'lowshelf',
    lowShelfFreq,
    sampleRate,
    0.707,
    lowShelfGain
  );
  const lowShelfFilter = createBiquadFilter(lowShelfCoeffs);

  // Create high shelf filter
  const highShelfCoeffs = calculateBiquadCoeffs(
    'highshelf',
    highShelfFreq,
    sampleRate,
    0.707,
    highShelfGain
  );
  const highShelfFilter = createBiquadFilter(highShelfCoeffs);

  // Process
  const output: number[] = new Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    let sample = signal[i];
    sample = processBiquad(lowShelfFilter, sample);
    sample = processBiquad(highShelfFilter, sample);
    output[i] = sample;
  }

  // Combined frequency response
  const lowResp = calculateFrequencyResponse(lowShelfCoeffs, sampleRate, 50);
  const highResp = calculateFrequencyResponse(highShelfCoeffs, sampleRate, 50);
  const combinedMag = lowResp.magnitude.map((m, i) => m + highResp.magnitude[i]);

  return {
    output,
    analysis: {
      type: 'Shelving EQ (Bass/Treble)',
      lowShelf: {
        frequency: lowShelfFreq + ' Hz',
        gain: lowShelfGain + ' dB',
      },
      highShelf: {
        frequency: highShelfFreq + ' Hz',
        gain: highShelfGain + ' dB',
      },
      frequencyResponse: {
        frequencies: lowResp.frequencies.filter((_, i) => i % 10 === 0).map((f) => f.toFixed(0)),
        magnitude: combinedMag.filter((_, i) => i % 10 === 0).map((m) => m.toFixed(2)),
      },
    },
  };
}

// Spectrum analysis
function analyzeSpectrum(signal: number[], sampleRate: number, fftSize: number = 1024): object {
  // Simple DFT for analysis (FFT would be faster for large sizes)
  const N = Math.min(signal.length, fftSize);
  const spectrum: { frequency: number; magnitude: number }[] = [];

  // Apply Hanning window
  const windowed = new Array(N);
  for (let i = 0; i < N; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = signal[i] * window;
  }

  // DFT (compute only positive frequencies)
  const numBins = Math.floor(N / 2);

  for (let k = 0; k < numBins; k++) {
    let real = 0;
    let imag = 0;

    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      real += windowed[n] * Math.cos(angle);
      imag += windowed[n] * Math.sin(angle);
    }

    const magnitude = Math.sqrt(real * real + imag * imag) / N;
    const frequency = (k * sampleRate) / N;

    if (frequency > 0) {
      spectrum.push({
        frequency,
        magnitude: 20 * Math.log10(Math.max(magnitude, 1e-10)),
      });
    }
  }

  // Find peaks
  const peaks: { frequency: number; magnitude: number }[] = [];
  for (let i = 1; i < spectrum.length - 1; i++) {
    if (
      spectrum[i].magnitude > spectrum[i - 1].magnitude &&
      spectrum[i].magnitude > spectrum[i + 1].magnitude &&
      spectrum[i].magnitude > -40
    ) {
      peaks.push(spectrum[i]);
    }
  }
  peaks.sort((a, b) => b.magnitude - a.magnitude);

  // Band energy analysis
  const bands = [
    { name: 'Sub Bass', low: 20, high: 60 },
    { name: 'Bass', low: 60, high: 250 },
    { name: 'Low Mids', low: 250, high: 500 },
    { name: 'Mids', low: 500, high: 2000 },
    { name: 'High Mids', low: 2000, high: 4000 },
    { name: 'Presence', low: 4000, high: 6000 },
    { name: 'Brilliance', low: 6000, high: 20000 },
  ];

  const bandEnergy = bands.map((band) => {
    const binsInBand = spectrum.filter((s) => s.frequency >= band.low && s.frequency < band.high);
    if (binsInBand.length === 0) return { ...band, energy: -100 };
    const avgMag =
      binsInBand.reduce((sum, s) => sum + Math.pow(10, s.magnitude / 20), 0) / binsInBand.length;
    return { ...band, energy: 20 * Math.log10(avgMag) };
  });

  return {
    fftSize: N,
    frequencyResolution: (sampleRate / N).toFixed(2) + ' Hz',
    nyquistFrequency: sampleRate / 2,
    spectrumPreview: spectrum
      .filter((_, i) => i % 10 === 0)
      .map((s) => ({
        frequency: s.frequency.toFixed(0) + ' Hz',
        magnitude: s.magnitude.toFixed(1) + ' dB',
      })),
    topPeaks: peaks.slice(0, 5).map((p) => ({
      frequency: p.frequency.toFixed(1) + ' Hz',
      magnitude: p.magnitude.toFixed(1) + ' dB',
    })),
    bandAnalysis: bandEnergy.map((b) => ({
      band: b.name,
      range: `${b.low}-${b.high} Hz`,
      energy: b.energy.toFixed(1) + ' dB',
    })),
  };
}

export async function executeequalizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      bands = [],
      graphicBands = [],
      filterType = 'peak',
      frequency = 1000,
      gain = 0,
      q = 1.0,
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'equalizer',
          description: 'Comprehensive audio equalizer with multiple EQ types',
          eqTypes: {
            parametric: 'Fully adjustable bands with frequency, gain, and Q control',
            graphic: '10-band or 31-band ISO standard frequencies',
            shelving: 'Bass and treble tone controls',
          },
          filterTypes: [
            'lowpass',
            'highpass',
            'bandpass',
            'notch',
            'peak',
            'lowshelf',
            'highshelf',
            'allpass',
          ],
          operations: [
            'parametric - Multi-band parametric EQ',
            'graphic - Fixed-frequency graphic EQ',
            'shelving - Bass/treble controls',
            'analyze - Spectrum analysis',
            'design_filter - Design individual filter',
            'frequency_response - Calculate filter response',
          ],
          parameters: {
            frequency: 'Center/cutoff frequency in Hz',
            gain: 'Boost/cut in dB',
            q: 'Quality factor (higher = narrower bandwidth)',
          },
        };
        break;

      case 'examples':
        result = {
          parametricEQ: {
            description: 'Three-band parametric EQ',
            parameters: {
              operation: 'parametric',
              signal: [0.5, 0.3, 0.1, -0.2],
              bands: [
                { frequency: 100, gain: 3, q: 1.5 },
                { frequency: 1000, gain: -2, q: 2.0 },
                { frequency: 8000, gain: 4, q: 1.0 },
              ],
            },
          },
          graphicEQ: {
            description: '10-band graphic EQ',
            parameters: {
              operation: 'graphic',
              signal: [0.5, 0.3, 0.1, -0.2],
              graphicBands: [3, 2, 1, 0, -1, 0, 1, 2, 3, 4],
            },
          },
          filterDesign: {
            description: 'Design a peak filter',
            parameters: {
              operation: 'design_filter',
              filterType: 'peak',
              frequency: 2000,
              gain: 6,
              q: 2.0,
            },
          },
        };
        break;

      case 'demo':
        // Generate test signal with harmonics
        const demoSignal: number[] = [];
        const testFreqs = [100, 500, 2000, 8000];
        for (let i = 0; i < 1024; i++) {
          let sample = 0;
          for (const f of testFreqs) {
            sample += Math.sin((2 * Math.PI * f * i) / sampleRate) * 0.25;
          }
          demoSignal.push(sample);
        }

        // Apply parametric EQ
        const demoBands = [
          { frequency: 100, gain: -6, q: 2 },
          { frequency: 2000, gain: 6, q: 1.5 },
        ];

        const demoResult = parametricEQ(demoSignal, sampleRate, demoBands);

        result = {
          demo: 'Parametric EQ on multi-frequency test signal',
          inputSignal: {
            type: 'Multi-tone (100Hz, 500Hz, 2kHz, 8kHz)',
            length: demoSignal.length,
          },
          eqSettings: demoBands,
          outputPreview: demoResult.output.slice(0, 50).map((v) => v.toFixed(4)),
          analysis: demoResult.analysis,
        };
        break;

      case 'parametric':
        if (signal.length === 0) {
          throw new Error('Signal array is required for parametric operation');
        }
        if (bands.length === 0) {
          throw new Error('At least one EQ band is required');
        }

        const paramResult = parametricEQ(signal, sampleRate, bands);

        result = {
          operation: 'parametric',
          inputLength: signal.length,
          output: paramResult.output.slice(0, 100),
          analysis: paramResult.analysis,
        };
        break;

      case 'graphic':
        if (signal.length === 0) {
          throw new Error('Signal array is required for graphic operation');
        }

        const bandCount = graphicBands.length > 15 ? 31 : 10;
        const graphicResult = graphicEQ(signal, sampleRate, graphicBands, bandCount as 10 | 31);

        result = {
          operation: 'graphic',
          inputLength: signal.length,
          output: graphicResult.output.slice(0, 100),
          analysis: graphicResult.analysis,
        };
        break;

      case 'shelving':
        if (signal.length === 0) {
          throw new Error('Signal array is required for shelving operation');
        }

        const shelvingResult = shelvingEQ(
          signal,
          sampleRate,
          args.lowShelfFreq || 200,
          args.lowShelfGain || 0,
          args.highShelfFreq || 3000,
          args.highShelfGain || 0
        );

        result = {
          operation: 'shelving',
          inputLength: signal.length,
          output: shelvingResult.output.slice(0, 100),
          analysis: shelvingResult.analysis,
        };
        break;

      case 'analyze':
        if (signal.length === 0) {
          throw new Error('Signal array is required for analyze operation');
        }

        result = {
          operation: 'analyze',
          analysis: analyzeSpectrum(signal, sampleRate, args.fftSize || 1024),
        };
        break;

      case 'design_filter':
        const coeffs = calculateBiquadCoeffs(filterType, frequency, sampleRate, q, gain);

        result = {
          operation: 'design_filter',
          filterType,
          parameters: {
            frequency: frequency + ' Hz',
            gain: gain + ' dB',
            q,
            sampleRate: sampleRate + ' Hz',
          },
          coefficients: {
            b0: coeffs.b0.toFixed(10),
            b1: coeffs.b1.toFixed(10),
            b2: coeffs.b2.toFixed(10),
            a1: coeffs.a1.toFixed(10),
            a2: coeffs.a2.toFixed(10),
          },
          differenceEquation: `y[n] = ${coeffs.b0.toFixed(4)}*x[n] + ${coeffs.b1.toFixed(4)}*x[n-1] + ${coeffs.b2.toFixed(4)}*x[n-2] - ${coeffs.a1.toFixed(4)}*y[n-1] - ${coeffs.a2.toFixed(4)}*y[n-2]`,
        };
        break;

      case 'frequency_response':
        const respCoeffs = calculateBiquadCoeffs(filterType, frequency, sampleRate, q, gain);
        const response = calculateFrequencyResponse(respCoeffs, sampleRate, 100);

        result = {
          operation: 'frequency_response',
          filterType,
          parameters: { frequency, gain, q },
          response: {
            frequencies: response.frequencies
              .filter((_, i) => i % 10 === 0)
              .map((f) => f.toFixed(0) + ' Hz'),
            magnitude: response.magnitude
              .filter((_, i) => i % 10 === 0)
              .map((m) => m.toFixed(2) + ' dB'),
            phase: response.phase.filter((_, i) => i % 10 === 0).map((p) => p.toFixed(1) + '°'),
          },
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: [
            'info',
            'examples',
            'demo',
            'parametric',
            'graphic',
            'shelving',
            'analyze',
            'design_filter',
            'frequency_response',
          ],
        };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error: ${err}`,
      isError: true,
    };
  }
}

export function isequalizerAvailable(): boolean {
  return true;
}
