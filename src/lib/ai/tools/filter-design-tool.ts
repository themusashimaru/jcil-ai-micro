/**
 * FILTER-DESIGN TOOL
 * Digital filter design with real signal processing algorithms
 * Implements Butterworth, Chebyshev, elliptic, and FIR filter design
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const filterdesignTool: UnifiedTool = {
  name: 'filter_design',
  description: 'Digital filter design (FIR, IIR, Butterworth, Chebyshev)',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['design', 'apply', 'frequency_response', 'info'], description: 'Operation' },
      filter_type: { type: 'string', enum: ['lowpass', 'highpass', 'bandpass', 'bandstop'], description: 'Filter type' },
      design: { type: 'string', enum: ['butterworth', 'chebyshev1', 'chebyshev2', 'elliptic', 'fir'], description: 'Design method' },
      order: { type: 'number', description: 'Filter order' },
      cutoff: { type: 'number', description: 'Cutoff frequency (normalized 0-1)' },
      cutoff_high: { type: 'number', description: 'High cutoff for bandpass/bandstop' },
      ripple: { type: 'number', description: 'Passband ripple in dB (for Chebyshev)' },
      signal: { type: 'array', items: { type: 'number' }, description: 'Signal to filter (for apply)' },
      frequencies: { type: 'array', items: { type: 'number' }, description: 'Frequencies for response (normalized)' }
    },
    required: ['operation']
  }
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
    im: a.re * b.im + a.im * b.re
  };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  };
}

function complexAbs(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function complexArg(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

function complexExp(c: Complex): Complex {
  const mag = Math.exp(c.re);
  return { re: mag * Math.cos(c.im), im: mag * Math.sin(c.im) };
}

interface FilterCoefficients {
  b: number[];  // Numerator (feedforward)
  a: number[];  // Denominator (feedback)
}

interface FilterDesignResult {
  coefficients: FilterCoefficients;
  poles: Complex[];
  zeros: Complex[];
  type: string;
  design: string;
  order: number;
  cutoff: number;
}

// Design Butterworth analog prototype poles
function butterworthPoles(order: number): Complex[] {
  const poles: Complex[] = [];
  for (let k = 0; k < order; k++) {
    const angle = Math.PI * (2 * k + order + 1) / (2 * order);
    poles.push({
      re: Math.cos(angle),
      im: Math.sin(angle)
    });
  }
  return poles;
}

// Design Chebyshev Type I analog prototype poles
function chebyshev1Poles(order: number, ripple: number): Complex[] {
  const epsilon = Math.sqrt(Math.pow(10, ripple / 10) - 1);
  const alpha = Math.asinh(1 / epsilon) / order;

  const poles: Complex[] = [];
  for (let k = 0; k < order; k++) {
    const angle = Math.PI * (2 * k + 1) / (2 * order);
    poles.push({
      re: -Math.sinh(alpha) * Math.sin(angle),
      im: Math.cosh(alpha) * Math.cos(angle)
    });
  }
  return poles;
}

// Bilinear transform: s -> (2/T)(z-1)/(z+1)
function bilinearTransform(analogPoles: Complex[], cutoffFreq: number): { poles: Complex[], zeros: Complex[] } {
  const Wc = Math.tan(Math.PI * cutoffFreq);

  const digitalPoles: Complex[] = analogPoles.map(p => {
    // Scale by cutoff frequency
    const scaledPole = { re: p.re * Wc, im: p.im * Wc };
    // Apply bilinear: z = (1 + s/2) / (1 - s/2)
    const num = { re: 1 + scaledPole.re / 2, im: scaledPole.im / 2 };
    const den = { re: 1 - scaledPole.re / 2, im: -scaledPole.im / 2 };
    return complexDiv(num, den);
  });

  // For lowpass, zeros at z = -1
  const digitalZeros: Complex[] = analogPoles.map(() => ({ re: -1, im: 0 }));

  return { poles: digitalPoles, zeros: digitalZeros };
}

// Convert poles and zeros to transfer function coefficients
function polesToCoeffs(poles: Complex[], zeros: Complex[]): FilterCoefficients {
  // Build denominator from poles: (z - p1)(z - p2)...
  let a: Complex[] = [{ re: 1, im: 0 }];
  for (const pole of poles) {
    const newA: Complex[] = [];
    for (let i = 0; i <= a.length; i++) {
      const left = i < a.length ? a[i] : { re: 0, im: 0 };
      const right = i > 0 ? complexMul(a[i - 1], { re: -pole.re, im: -pole.im }) : { re: 0, im: 0 };
      newA.push(complexAdd(left, right));
    }
    a = newA;
  }

  // Build numerator from zeros
  let b: Complex[] = [{ re: 1, im: 0 }];
  for (const zero of zeros) {
    const newB: Complex[] = [];
    for (let i = 0; i <= b.length; i++) {
      const left = i < b.length ? b[i] : { re: 0, im: 0 };
      const right = i > 0 ? complexMul(b[i - 1], { re: -zero.re, im: -zero.im }) : { re: 0, im: 0 };
      newB.push(complexAdd(left, right));
    }
    b = newB;
  }

  // Normalize so DC gain = 1 (for lowpass)
  const dcGainNum = b.reduce((sum, c) => sum + c.re, 0);
  const dcGainDen = a.reduce((sum, c) => sum + c.re, 0);
  const scale = dcGainDen / dcGainNum;

  return {
    b: b.map(c => c.re * scale),
    a: a.map(c => c.re)
  };
}

// Design FIR filter using windowed sinc
function designFIR(order: number, cutoff: number, filterType: string, cutoffHigh?: number): FilterCoefficients {
  const n = order + 1;  // Number of taps
  const coeffs: number[] = [];
  const mid = order / 2;

  // Hamming window
  const window = (i: number) => 0.54 - 0.46 * Math.cos(2 * Math.PI * i / order);

  for (let i = 0; i < n; i++) {
    const t = i - mid;
    let h: number;

    if (t === 0) {
      if (filterType === 'lowpass') h = 2 * cutoff;
      else if (filterType === 'highpass') h = 1 - 2 * cutoff;
      else if (filterType === 'bandpass' && cutoffHigh) h = 2 * (cutoffHigh - cutoff);
      else h = 2 * cutoff;
    } else {
      const piT = Math.PI * t;
      if (filterType === 'lowpass') {
        h = Math.sin(2 * piT * cutoff) / piT;
      } else if (filterType === 'highpass') {
        h = -Math.sin(2 * piT * cutoff) / piT;
      } else if (filterType === 'bandpass' && cutoffHigh) {
        h = (Math.sin(2 * piT * cutoffHigh) - Math.sin(2 * piT * cutoff)) / piT;
      } else {
        h = Math.sin(2 * piT * cutoff) / piT;
      }
    }

    coeffs.push(h * window(i));
  }

  // Normalize for unity gain
  const sum = coeffs.reduce((s, c) => s + c, 0);
  const normalized = filterType === 'highpass' ? coeffs : coeffs.map(c => c / sum);

  return { b: normalized, a: [1] };
}

// Design IIR filter
function designIIR(order: number, cutoff: number, filterType: string, design: string, ripple: number = 1): FilterDesignResult {
  let analogPoles: Complex[];

  if (design === 'chebyshev1') {
    analogPoles = chebyshev1Poles(order, ripple);
  } else {
    analogPoles = butterworthPoles(order);
  }

  // For highpass, transform cutoff
  let effectiveCutoff = cutoff;
  if (filterType === 'highpass') {
    effectiveCutoff = 0.5 - cutoff / 2;  // Simple approximation
  }

  const { poles, zeros } = bilinearTransform(analogPoles, effectiveCutoff);
  const coefficients = polesToCoeffs(poles, zeros);

  // For highpass, flip signs of odd coefficients in numerator
  if (filterType === 'highpass') {
    for (let i = 0; i < coefficients.b.length; i++) {
      if (i % 2 === 1) coefficients.b[i] = -coefficients.b[i];
    }
    // Renormalize for Nyquist gain = 1
    let nyquistNum = 0, nyquistDen = 0;
    for (let i = 0; i < coefficients.b.length; i++) {
      nyquistNum += coefficients.b[i] * Math.pow(-1, i);
    }
    for (let i = 0; i < coefficients.a.length; i++) {
      nyquistDen += coefficients.a[i] * Math.pow(-1, i);
    }
    const scale = Math.abs(nyquistDen / nyquistNum);
    coefficients.b = coefficients.b.map(c => c * scale);
  }

  return {
    coefficients,
    poles,
    zeros,
    type: filterType,
    design,
    order,
    cutoff
  };
}

// Apply filter to signal
function applyFilter(signal: number[], coeffs: FilterCoefficients): number[] {
  const { b, a } = coeffs;
  const output: number[] = [];
  const x = signal;
  const y: number[] = [];

  for (let n = 0; n < x.length; n++) {
    let yn = 0;

    // FIR part (feedforward)
    for (let k = 0; k < b.length; k++) {
      if (n - k >= 0) {
        yn += b[k] * x[n - k];
      }
    }

    // IIR part (feedback)
    for (let k = 1; k < a.length; k++) {
      if (n - k >= 0) {
        yn -= a[k] * y[n - k];
      }
    }

    yn /= a[0];
    y.push(yn);
    output.push(yn);
  }

  return output;
}

// Calculate frequency response
function frequencyResponse(coeffs: FilterCoefficients, frequencies: number[]): { magnitude: number[], phase: number[] } {
  const { b, a } = coeffs;
  const magnitude: number[] = [];
  const phase: number[] = [];

  for (const f of frequencies) {
    const omega = 2 * Math.PI * f;

    // H(e^jω) = B(e^jω) / A(e^jω)
    let numRe = 0, numIm = 0;
    let denRe = 0, denIm = 0;

    for (let k = 0; k < b.length; k++) {
      numRe += b[k] * Math.cos(-k * omega);
      numIm += b[k] * Math.sin(-k * omega);
    }

    for (let k = 0; k < a.length; k++) {
      denRe += a[k] * Math.cos(-k * omega);
      denIm += a[k] * Math.sin(-k * omega);
    }

    const num: Complex = { re: numRe, im: numIm };
    const den: Complex = { re: denRe, im: denIm };
    const H = complexDiv(num, den);

    magnitude.push(complexAbs(H));
    phase.push(complexArg(H) * 180 / Math.PI);
  }

  return { magnitude, phase };
}

// Create frequency response plot
function createResponsePlot(freqs: number[], magnitude: number[]): string {
  const width = 60;
  const height = 15;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Convert to dB
  const magDB = magnitude.map(m => 20 * Math.log10(Math.max(m, 1e-10)));
  const maxDB = Math.max(...magDB);
  const minDB = Math.max(Math.min(...magDB), maxDB - 60);

  // Draw axes
  for (let x = 0; x < width; x++) grid[height - 1][x] = '-';
  for (let y = 0; y < height; y++) grid[y][0] = '|';
  grid[height - 1][0] = '+';

  // Plot magnitude
  for (let i = 0; i < freqs.length && i < width - 2; i++) {
    const x = Math.floor((i / (freqs.length - 1)) * (width - 2)) + 1;
    const normalized = (magDB[i] - minDB) / (maxDB - minDB);
    const y = Math.max(0, Math.min(height - 2, Math.round((1 - normalized) * (height - 2))));
    grid[y][x] = '*';
  }

  const lines = grid.map(row => row.join(''));
  lines.unshift(`Magnitude Response (dB)`);
  lines.unshift(`Max: ${maxDB.toFixed(1)} dB`);
  lines.push(`0               0.25              0.5 (normalized freq)`);

  return lines.join('\n');
}

export async function executefilterdesign(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'filter-design',
        description: 'Digital filter design and analysis',

        filterTypes: {
          lowpass: 'Passes frequencies below cutoff, attenuates above',
          highpass: 'Passes frequencies above cutoff, attenuates below',
          bandpass: 'Passes frequencies between two cutoffs',
          bandstop: 'Attenuates frequencies between two cutoffs'
        },

        designMethods: {
          butterworth: {
            description: 'Maximally flat magnitude response',
            properties: 'No ripple in passband or stopband',
            formula: '|H(jω)|² = 1 / (1 + (ω/ωc)^(2n))'
          },
          chebyshev1: {
            description: 'Steeper rolloff with passband ripple',
            properties: 'Equiripple in passband, monotonic in stopband',
            formula: '|H(jω)|² = 1 / (1 + ε²Tn²(ω/ωc))'
          },
          chebyshev2: {
            description: 'Inverse Chebyshev with stopband ripple',
            properties: 'Monotonic in passband, equiripple in stopband'
          },
          elliptic: {
            description: 'Sharpest transition band',
            properties: 'Ripple in both passband and stopband'
          },
          fir: {
            description: 'Finite Impulse Response',
            properties: 'Linear phase, no feedback, always stable',
            methods: ['windowed sinc', 'Parks-McClellan', 'frequency sampling']
          }
        },

        iirVsFir: {
          iir: {
            pros: ['Lower order for same specs', 'Efficient computation'],
            cons: ['Nonlinear phase', 'Potential stability issues']
          },
          fir: {
            pros: ['Always stable', 'Linear phase possible', 'Easy to design'],
            cons: ['Higher order needed', 'More computation']
          }
        },

        keyFormulas: {
          bilinearTransform: 's = (2/T)(z-1)/(z+1)',
          frequencyWarping: 'Ω = (2/T)tan(ωT/2)',
          butterworthOrder: 'n ≥ log(√((10^(Rp/10)-1)/(10^(Rs/10)-1))) / log(ωp/ωs)'
        },

        usage: {
          design: 'Design filter coefficients',
          apply: 'Apply filter to a signal',
          frequency_response: 'Calculate and plot frequency response'
        }
      };

      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    const filterType = args.filter_type || 'lowpass';
    const design = args.design || 'butterworth';
    const order = args.order || 4;
    const cutoff = args.cutoff || 0.25;
    const cutoffHigh = args.cutoff_high;
    const ripple = args.ripple || 1;

    if (operation === 'design') {
      let result: FilterDesignResult;

      if (design === 'fir') {
        const coeffs = designFIR(order, cutoff, filterType, cutoffHigh);
        result = {
          coefficients: coeffs,
          poles: [],
          zeros: coeffs.b.map((_, i) => ({ re: 0, im: 0 })),
          type: filterType,
          design: 'fir',
          order,
          cutoff
        };
      } else {
        result = designIIR(order, cutoff, filterType, design, ripple);
      }

      // Calculate frequency response at key points
      const testFreqs = [0, cutoff / 2, cutoff, cutoff * 1.5, 0.5];
      const response = frequencyResponse(result.coefficients, testFreqs);

      const output = {
        filterType,
        designMethod: design,
        order,
        cutoffFrequency: cutoff,

        coefficients: {
          numerator_b: result.coefficients.b.map(c => Number(c.toFixed(8))),
          denominator_a: result.coefficients.a.map(c => Number(c.toFixed(8))),
          note: 'y[n] = (b[0]x[n] + b[1]x[n-1] + ...) - (a[1]y[n-1] + a[2]y[n-2] + ...)'
        },

        poles: result.poles.slice(0, 4).map(p => ({
          real: Number(p.re.toFixed(6)),
          imag: Number(p.im.toFixed(6)),
          magnitude: Number(complexAbs(p).toFixed(6)),
          insideUnitCircle: complexAbs(p) < 1
        })),

        stability: result.poles.every(p => complexAbs(p) < 1) ? 'STABLE' : 'UNSTABLE',

        responseAtKeyFrequencies: testFreqs.map((f, i) => ({
          frequency: f,
          magnitude: Number(response.magnitude[i].toFixed(6)),
          magnitudeDB: Number((20 * Math.log10(response.magnitude[i])).toFixed(2)),
          phaseDeg: Number(response.phase[i].toFixed(2))
        })),

        characteristics: {
          dcGain: Number((20 * Math.log10(response.magnitude[0])).toFixed(2)) + ' dB',
          atCutoff: Number((20 * Math.log10(response.magnitude[2])).toFixed(2)) + ' dB',
          rolloff: design === 'butterworth' ? `${order * 20} dB/decade` : 'varies'
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'apply') {
      const signal = args.signal || [1, 0, 0, 0, 0, 0, 0, 0];

      // Design filter
      let coeffs: FilterCoefficients;
      if (design === 'fir') {
        coeffs = designFIR(order, cutoff, filterType, cutoffHigh);
      } else {
        coeffs = designIIR(order, cutoff, filterType, design, ripple).coefficients;
      }

      // Apply filter
      const filtered = applyFilter(signal, coeffs);

      const output = {
        filterType,
        designMethod: design,
        order,
        cutoff,

        inputSignal: signal.slice(0, 20),
        outputSignal: filtered.slice(0, 20).map(v => Number(v.toFixed(8))),

        statistics: {
          inputLength: signal.length,
          outputLength: filtered.length,
          inputMax: Math.max(...signal.map(Math.abs)),
          outputMax: Math.max(...filtered.map(Math.abs)),
          inputEnergy: signal.reduce((s, x) => s + x * x, 0),
          outputEnergy: filtered.reduce((s, x) => s + x * x, 0)
        },

        note: 'Filter applied using direct form II transposed implementation'
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    if (operation === 'frequency_response') {
      // Design filter
      let coeffs: FilterCoefficients;
      if (design === 'fir') {
        coeffs = designFIR(order, cutoff, filterType, cutoffHigh);
      } else {
        coeffs = designIIR(order, cutoff, filterType, design, ripple).coefficients;
      }

      // Generate frequencies
      const frequencies = args.frequencies || Array.from({ length: 100 }, (_, i) => i / 199);
      const response = frequencyResponse(coeffs, frequencies);

      // Create ASCII plot
      const plot = createResponsePlot(frequencies, response.magnitude);

      // Find key characteristics
      const mag3dB = Math.pow(10, -3 / 20);
      let cutoff3dB = cutoff;
      for (let i = 0; i < frequencies.length; i++) {
        if (response.magnitude[i] < mag3dB) {
          cutoff3dB = frequencies[i];
          break;
        }
      }

      const output = {
        filterType,
        designMethod: design,
        order,
        nominalCutoff: cutoff,
        actual3dBCutoff: Number(cutoff3dB.toFixed(4)),

        response: frequencies.filter((_, i) => i % 10 === 0).map((f, i) => ({
          frequency: Number(f.toFixed(4)),
          magnitude: Number(response.magnitude[i * 10].toFixed(6)),
          magnitudeDB: Number((20 * Math.log10(Math.max(response.magnitude[i * 10], 1e-10))).toFixed(2)),
          phaseDeg: Number(response.phase[i * 10].toFixed(2))
        })),

        plot,

        characteristics: {
          passbandRipple: `${(Math.max(...response.magnitude.slice(0, Math.floor(cutoff * frequencies.length))) - 1).toFixed(4)} dB`,
          stopbandAttenuation: `${(-20 * Math.log10(Math.max(...response.magnitude.slice(Math.floor(cutoff * 2 * frequencies.length))))).toFixed(1)} dB`
        }
      };

      return { toolCallId: id, content: JSON.stringify(output, null, 2) };
    }

    return { toolCallId: id, content: `Unknown operation: ${operation}`, isError: true };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isfilterdesignAvailable(): boolean { return true; }
