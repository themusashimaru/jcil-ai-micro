/**
 * BODE-PLOT TOOL
 * Bode plot frequency response analysis for control systems
 *
 * Features:
 * - Magnitude and phase response computation
 * - Transfer function representation
 * - Gain and phase margins
 * - Crossover frequencies
 * - Nyquist plot data
 * - Stability analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const bodeplotTool: UnifiedTool = {
  name: 'bode_plot',
  description:
    'Bode plot frequency response analysis with gain/phase margins and stability analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['plot', 'margins', 'stability', 'nyquist', 'transfer_function', 'info'],
        description: 'Operation to perform',
      },
      numerator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Transfer function numerator coefficients (highest power first)',
      },
      denominator: {
        type: 'array',
        items: { type: 'number' },
        description: 'Transfer function denominator coefficients (highest power first)',
      },
      freq_min: {
        type: 'number',
        description: 'Minimum frequency (rad/s)',
      },
      freq_max: {
        type: 'number',
        description: 'Maximum frequency (rad/s)',
      },
      num_points: {
        type: 'number',
        description: 'Number of frequency points',
      },
      preset: {
        type: 'string',
        enum: ['first_order', 'second_order', 'pid', 'lead_lag', 'integrator', 'differentiator'],
        description: 'Preset system type',
      },
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

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return { re: Infinity, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

function complexMag(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function complexPhase(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

export function complexFromPolar(mag: number, phase: number): Complex {
  return { re: mag * Math.cos(phase), im: mag * Math.sin(phase) };
}

// Evaluate polynomial at complex value s = jω
function evalPoly(coeffs: number[], s: Complex): Complex {
  let result: Complex = { re: 0, im: 0 };
  let power: Complex = { re: 1, im: 0 };

  // Coefficients from highest power to lowest
  const reversed = [...coeffs].reverse();

  for (const coeff of reversed) {
    result = complexAdd(result, { re: coeff * power.re, im: coeff * power.im });
    power = complexMul(power, s);
  }

  return result;
}

// Transfer function H(s) = num(s) / den(s)
function transferFunction(numerator: number[], denominator: number[], omega: number): Complex {
  const s: Complex = { re: 0, im: omega }; // s = jω
  const num = evalPoly(numerator, s);
  const den = evalPoly(denominator, s);
  return complexDiv(num, den);
}

// Generate Bode plot data
function generateBodeData(
  numerator: number[],
  denominator: number[],
  freqMin: number,
  freqMax: number,
  numPoints: number
): { frequency: number[]; magnitude: number[]; phase: number[]; magnitudeDB: number[] } {
  const frequency: number[] = [];
  const magnitude: number[] = [];
  const phase: number[] = [];
  const magnitudeDB: number[] = [];

  // Logarithmic frequency spacing
  const logMin = Math.log10(freqMin);
  const logMax = Math.log10(freqMax);
  const logStep = (logMax - logMin) / (numPoints - 1);

  let prevPhase = 0;
  let phaseOffset = 0;

  for (let i = 0; i < numPoints; i++) {
    const omega = Math.pow(10, logMin + i * logStep);
    frequency.push(omega);

    const H = transferFunction(numerator, denominator, omega);
    const mag = complexMag(H);
    let ph = (complexPhase(H) * 180) / Math.PI;

    // Unwrap phase
    while (ph - prevPhase > 180) {
      phaseOffset -= 360;
    }
    while (ph - prevPhase < -180) {
      phaseOffset += 360;
    }
    ph += phaseOffset;
    prevPhase = ph - phaseOffset;

    magnitude.push(mag);
    magnitudeDB.push(20 * Math.log10(mag || 1e-10));
    phase.push(ph);
  }

  return { frequency, magnitude, phase, magnitudeDB };
}

// Find gain margin and phase margin
function calculateMargins(
  numerator: number[],
  denominator: number[],
  freqMin: number = 0.001,
  freqMax: number = 1000
): {
  gainMargin: number;
  gainMarginDB: number;
  phaseMargin: number;
  gainCrossoverFreq: number | null;
  phaseCrossoverFreq: number | null;
  isStable: boolean;
} {
  const numPoints = 1000;
  const data = generateBodeData(numerator, denominator, freqMin, freqMax, numPoints);

  let gainCrossoverFreq: number | null = null;
  let phaseCrossoverFreq: number | null = null;
  let phaseAtGainCrossover: number | null = null;
  let magAtPhaseCrossover: number | null = null;

  // Find gain crossover (where magnitude = 1 or 0 dB)
  for (let i = 1; i < numPoints; i++) {
    if (
      (data.magnitudeDB[i - 1] >= 0 && data.magnitudeDB[i] < 0) ||
      (data.magnitudeDB[i - 1] <= 0 && data.magnitudeDB[i] > 0)
    ) {
      // Linear interpolation
      const ratio = -data.magnitudeDB[i - 1] / (data.magnitudeDB[i] - data.magnitudeDB[i - 1]);
      gainCrossoverFreq =
        data.frequency[i - 1] + ratio * (data.frequency[i] - data.frequency[i - 1]);
      phaseAtGainCrossover = data.phase[i - 1] + ratio * (data.phase[i] - data.phase[i - 1]);
      break;
    }
  }

  // Find phase crossover (where phase = -180°)
  for (let i = 1; i < numPoints; i++) {
    if (
      (data.phase[i - 1] >= -180 && data.phase[i] < -180) ||
      (data.phase[i - 1] <= -180 && data.phase[i] > -180)
    ) {
      const ratio = (-180 - data.phase[i - 1]) / (data.phase[i] - data.phase[i - 1]);
      phaseCrossoverFreq =
        data.frequency[i - 1] + ratio * (data.frequency[i] - data.frequency[i - 1]);
      magAtPhaseCrossover =
        data.magnitudeDB[i - 1] + ratio * (data.magnitudeDB[i] - data.magnitudeDB[i - 1]);
      break;
    }
  }

  const phaseMargin = phaseAtGainCrossover !== null ? 180 + phaseAtGainCrossover : Infinity;
  const gainMarginDB = magAtPhaseCrossover !== null ? -magAtPhaseCrossover : Infinity;
  const gainMargin =
    magAtPhaseCrossover !== null ? Math.pow(10, -magAtPhaseCrossover / 20) : Infinity;

  const isStable =
    (phaseMargin > 0 || phaseMargin === Infinity) &&
    (gainMarginDB > 0 || gainMarginDB === Infinity);

  return {
    gainMargin,
    gainMarginDB,
    phaseMargin,
    gainCrossoverFreq,
    phaseCrossoverFreq,
    isStable,
  };
}

// Generate Nyquist plot data
function generateNyquistData(
  numerator: number[],
  denominator: number[],
  freqMin: number,
  freqMax: number,
  numPoints: number
): { real: number[]; imag: number[]; frequency: number[] } {
  const real: number[] = [];
  const imag: number[] = [];
  const frequency: number[] = [];

  const logMin = Math.log10(freqMin);
  const logMax = Math.log10(freqMax);
  const logStep = (logMax - logMin) / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const omega = Math.pow(10, logMin + i * logStep);
    const H = transferFunction(numerator, denominator, omega);

    frequency.push(omega);
    real.push(H.re);
    imag.push(H.im);
  }

  return { real, imag, frequency };
}

// Analyze transfer function properties
function analyzeTransferFunction(
  numerator: number[],
  denominator: number[]
): {
  order: number;
  type: number;
  dcGain: number;
  zeros: number[];
  poles: Complex[];
  isProper: boolean;
  isStrictlyProper: boolean;
} {
  const numOrder = numerator.length - 1;
  const denOrder = denominator.length - 1;

  // DC gain (s = 0)
  const dcNum = numerator[numerator.length - 1];
  const dcDen = denominator[denominator.length - 1];
  const dcGain = dcDen !== 0 ? dcNum / dcDen : Infinity;

  // System type (number of integrators at origin)
  let type = 0;
  let i = denominator.length - 1;
  while (i >= 0 && denominator[i] === 0) {
    type++;
    i--;
  }

  // Find roots (simplified for low orders)
  const zeros: number[] = [];
  const poles: Complex[] = [];

  // For first and second order only
  if (numOrder === 1 && numerator[0] !== 0) {
    zeros.push(-numerator[1] / numerator[0]);
  }

  if (denOrder === 1 && denominator[0] !== 0) {
    poles.push({ re: -denominator[1] / denominator[0], im: 0 });
  } else if (denOrder === 2 && denominator[0] !== 0) {
    const a = denominator[0];
    const b = denominator[1];
    const c = denominator[2];
    const discriminant = b * b - 4 * a * c;

    if (discriminant >= 0) {
      poles.push({ re: (-b + Math.sqrt(discriminant)) / (2 * a), im: 0 });
      poles.push({ re: (-b - Math.sqrt(discriminant)) / (2 * a), im: 0 });
    } else {
      const realPart = -b / (2 * a);
      const imagPart = Math.sqrt(-discriminant) / (2 * a);
      poles.push({ re: realPart, im: imagPart });
      poles.push({ re: realPart, im: -imagPart });
    }
  }

  return {
    order: denOrder,
    type,
    dcGain,
    zeros,
    poles,
    isProper: denOrder >= numOrder,
    isStrictlyProper: denOrder > numOrder,
  };
}

// Preset transfer functions
function getPresetSystem(preset: string): {
  numerator: number[];
  denominator: number[];
  description: string;
} {
  switch (preset) {
    case 'first_order':
      return {
        numerator: [1],
        denominator: [1, 1], // 1/(s+1)
        description: 'First-order low-pass: 1/(s+1), τ=1s',
      };

    case 'second_order':
      return {
        numerator: [1],
        denominator: [1, 0.5, 1], // 1/(s² + 0.5s + 1)
        description: 'Second-order: ωn=1, ζ=0.25 (underdamped)',
      };

    case 'pid':
      return {
        numerator: [1, 2, 1], // Kp + Ki/s + Kd*s = (s² + 2s + 1)/s
        denominator: [1, 0],
        description: 'PID controller: Kp=2, Ki=1, Kd=1',
      };

    case 'lead_lag':
      return {
        numerator: [1, 10],
        denominator: [1, 1], // (s+10)/(s+1)
        description: 'Lead compensator: (s+10)/(s+1)',
      };

    case 'integrator':
      return {
        numerator: [1],
        denominator: [1, 0], // 1/s
        description: 'Pure integrator: 1/s',
      };

    case 'differentiator':
      return {
        numerator: [1, 0],
        denominator: [1], // s
        description: 'Differentiator: s',
      };

    default:
      return {
        numerator: [1],
        denominator: [1, 1],
        description: 'Default first-order',
      };
  }
}

export async function executebodeplot(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            tool: 'bode_plot',
            description: 'Bode plot frequency response analysis for control systems',
            operations: {
              plot: 'Generate Bode plot data (magnitude and phase vs frequency)',
              margins: 'Calculate gain margin and phase margin',
              stability: 'Analyze system stability',
              nyquist: 'Generate Nyquist plot data',
              transfer_function: 'Analyze transfer function properties',
            },
            presets: {
              first_order: '1/(s+1) - Simple first-order low-pass',
              second_order: '1/(s²+0.5s+1) - Underdamped second-order',
              pid: 'PID controller transfer function',
              lead_lag: '(s+10)/(s+1) - Lead compensator',
              integrator: '1/s - Pure integrator',
              differentiator: 's - Pure differentiator',
            },
            features: [
              'Magnitude (dB) and phase (deg) computation',
              'Gain and phase margin calculation',
              'Crossover frequency identification',
              'Nyquist plot generation',
              'Pole-zero analysis',
              'Stability determination',
            ],
            example: {
              operation: 'plot',
              numerator: [1],
              denominator: [1, 2, 1],
              freq_min: 0.01,
              freq_max: 100,
            },
          },
          null,
          2
        ),
      };
    }

    // Get transfer function
    let numerator: number[];
    let denominator: number[];
    let description = 'Custom transfer function';

    if (args.preset) {
      const preset = getPresetSystem(args.preset);
      numerator = preset.numerator;
      denominator = preset.denominator;
      description = preset.description;
    } else {
      numerator = args.numerator || [1];
      denominator = args.denominator || [1, 1];
    }

    const freqMin = args.freq_min || 0.01;
    const freqMax = args.freq_max || 100;
    const numPoints = args.num_points || 100;

    if (operation === 'plot') {
      const data = generateBodeData(numerator, denominator, freqMin, freqMax, numPoints);

      // Sample the data for response (every 10th point)
      const sampleIndices = Array.from({ length: Math.ceil(numPoints / 10) }, (_, i) => i * 10);
      sampleIndices.push(numPoints - 1);

      const sampledData = sampleIndices
        .filter((i) => i < numPoints)
        .map((i) => ({
          frequency: parseFloat(data.frequency[i].toFixed(4)),
          magnitude_dB: parseFloat(data.magnitudeDB[i].toFixed(2)),
          phase_deg: parseFloat(data.phase[i].toFixed(2)),
        }));

      // Key points
      const maxMag = Math.max(...data.magnitudeDB);
      const minMag = Math.min(...data.magnitudeDB);
      const maxMagFreq = data.frequency[data.magnitudeDB.indexOf(maxMag)];

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'plot',
            transfer_function: {
              numerator,
              denominator,
              description,
            },
            frequency_range: { min: freqMin, max: freqMax, unit: 'rad/s' },
            num_points: numPoints,
            bode_data_sample: sampledData,
            key_points: {
              max_magnitude_dB: maxMag,
              min_magnitude_dB: minMag,
              peak_frequency: maxMagFreq,
              dc_gain_dB: data.magnitudeDB[0],
              high_freq_rolloff:
                (data.magnitudeDB[numPoints - 1] - data.magnitudeDB[numPoints - 11]) /
                Math.log10(data.frequency[numPoints - 1] / data.frequency[numPoints - 11]),
            },
          },
          null,
          2
        ),
      };
    }

    if (operation === 'margins') {
      const margins = calculateMargins(numerator, denominator, freqMin, freqMax);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'margins',
            transfer_function: { numerator, denominator, description },
            gain_margin: {
              linear: margins.gainMargin === Infinity ? 'Infinite' : margins.gainMargin,
              dB: margins.gainMarginDB === Infinity ? 'Infinite' : margins.gainMarginDB,
              crossover_frequency: margins.phaseCrossoverFreq,
            },
            phase_margin: {
              degrees: margins.phaseMargin === Infinity ? 'Infinite' : margins.phaseMargin,
              crossover_frequency: margins.gainCrossoverFreq,
            },
            stability: {
              is_stable: margins.isStable,
              recommendation:
                margins.phaseMargin < 30
                  ? 'Low phase margin - consider adding phase lead'
                  : margins.phaseMargin < 60
                    ? 'Adequate stability margin'
                    : 'Good stability margin',
            },
          },
          null,
          2
        ),
      };
    }

    if (operation === 'stability') {
      const margins = calculateMargins(numerator, denominator, freqMin, freqMax);
      const tfAnalysis = analyzeTransferFunction(numerator, denominator);

      // Check pole stability
      const unstablePoles = tfAnalysis.poles.filter((p) => p.re >= 0);

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'stability',
            transfer_function: { numerator, denominator, description },
            bode_stability: {
              is_stable: margins.isStable,
              gain_margin_dB: margins.gainMarginDB,
              phase_margin_deg: margins.phaseMargin,
            },
            pole_analysis: {
              poles: tfAnalysis.poles.map((p) => ({
                real: p.re,
                imaginary: p.im,
                magnitude: Math.sqrt(p.re * p.re + p.im * p.im),
                stable: p.re < 0,
              })),
              has_unstable_poles: unstablePoles.length > 0,
              num_unstable_poles: unstablePoles.length,
            },
            system_properties: {
              order: tfAnalysis.order,
              type: tfAnalysis.type,
              dc_gain: tfAnalysis.dcGain,
              is_proper: tfAnalysis.isProper,
            },
            recommendations: [
              !margins.isStable ? 'System is UNSTABLE - redesign required' : 'System is stable',
              margins.phaseMargin < 30 ? 'Consider adding phase lead compensation' : null,
              margins.gainMarginDB < 6 ? 'Consider reducing loop gain' : null,
              tfAnalysis.type > 1 ? 'Multiple integrators may cause oscillation' : null,
            ].filter(Boolean),
          },
          null,
          2
        ),
      };
    }

    if (operation === 'nyquist') {
      const data = generateNyquistData(numerator, denominator, freqMin, freqMax, numPoints);
      const margins = calculateMargins(numerator, denominator, freqMin, freqMax);

      // Sample data
      const sampleIndices = Array.from({ length: Math.ceil(numPoints / 10) }, (_, i) => i * 10);

      const sampledData = sampleIndices
        .filter((i) => i < numPoints)
        .map((i) => ({
          frequency: parseFloat(data.frequency[i].toFixed(4)),
          real: parseFloat(data.real[i].toFixed(4)),
          imaginary: parseFloat(data.imag[i].toFixed(4)),
        }));

      // Find closest approach to -1
      let minDist = Infinity;
      let closestFreq = 0;
      for (let i = 0; i < numPoints; i++) {
        const dist = Math.sqrt((data.real[i] + 1) ** 2 + data.imag[i] ** 2);
        if (dist < minDist) {
          minDist = dist;
          closestFreq = data.frequency[i];
        }
      }

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'nyquist',
            transfer_function: { numerator, denominator, description },
            nyquist_data_sample: sampledData,
            critical_point: {
              location: [-1, 0],
              closest_approach: minDist,
              closest_frequency: closestFreq,
            },
            encirclements:
              minDist < 1 ? 'May encircle -1 (check full contour)' : 'Does not encircle -1',
            stability_indication: margins.isStable
              ? 'Nyquist curve does not encircle -1: stable'
              : 'Nyquist curve may encircle -1: potentially unstable',
          },
          null,
          2
        ),
      };
    }

    if (operation === 'transfer_function') {
      const analysis = analyzeTransferFunction(numerator, denominator);

      // Build string representation
      const numStr =
        numerator
          .map((c, i) => {
            const power = numerator.length - 1 - i;
            if (c === 0) return '';
            const term = power === 0 ? `${c}` : power === 1 ? `${c}s` : `${c}s^${power}`;
            return term;
          })
          .filter(Boolean)
          .join(' + ') || '0';

      const denStr =
        denominator
          .map((c, i) => {
            const power = denominator.length - 1 - i;
            if (c === 0) return '';
            const term = power === 0 ? `${c}` : power === 1 ? `${c}s` : `${c}s^${power}`;
            return term;
          })
          .filter(Boolean)
          .join(' + ') || '1';

      return {
        toolCallId: id,
        content: JSON.stringify(
          {
            operation: 'transfer_function',
            representation: {
              numerator: numStr,
              denominator: denStr,
              latex: `H(s) = \\frac{${numStr}}{${denStr}}`,
            },
            properties: {
              order: analysis.order,
              type: analysis.type,
              dc_gain: analysis.dcGain,
              is_proper: analysis.isProper,
              is_strictly_proper: analysis.isStrictlyProper,
            },
            zeros: analysis.zeros,
            poles: analysis.poles.map((p) => ({
              real: p.re,
              imaginary: p.im,
              stable: p.re < 0,
            })),
            description,
          },
          null,
          2
        ),
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(
        {
          error: `Unknown operation: ${operation}`,
          available_operations: [
            'plot',
            'margins',
            'stability',
            'nyquist',
            'transfer_function',
            'info',
          ],
        },
        null,
        2
      ),
      isError: true,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isbodeplotAvailable(): boolean {
  return true;
}
