/**
 * BODE-PLOT TOOL
 * Bode plot frequency response analysis
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const bodeplotTool: UnifiedTool = {
  name: 'bode_plot',
  description: 'Bode plot for frequency response analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['plot', 'analyze', 'margins', 'asymptotic', 'info'], description: 'Operation' },
      numerator: { type: 'array', items: { type: 'number' }, description: 'Numerator coefficients [b_n, ..., b_0]' },
      denominator: { type: 'array', items: { type: 'number' }, description: 'Denominator coefficients [a_n, ..., a_0]' },
      frequency_range: { type: 'array', items: { type: 'number' }, description: '[min_freq, max_freq] in rad/s' },
      gain: { type: 'number', description: 'Overall system gain K' }
    },
    required: ['operation']
  }
};

interface Complex {
  re: number;
  im: number;
}

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return { re: Infinity, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  };
}

function cAbs(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function cArg(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

function polyEval(coeffs: number[], s: Complex): Complex {
  let result: Complex = { re: 0, im: 0 };
  for (let i = 0; i < coeffs.length; i++) {
    result = { re: result.re * s.re - result.im * s.im + coeffs[i], im: result.re * s.im + result.im * s.re };
  }
  return result;
}

// Compute frequency response
function frequencyResponse(num: number[], den: number[], omega: number): { mag: number; phase: number } {
  const s: Complex = { re: 0, im: omega };
  const numVal = polyEval(num, s);
  const denVal = polyEval(den, s);
  const G = cDiv(numVal, denVal);
  return {
    mag: 20 * Math.log10(cAbs(G)),
    phase: cArg(G) * 180 / Math.PI
  };
}

// Unwrap phase to avoid discontinuities
function unwrapPhase(phases: number[]): number[] {
  const unwrapped = [...phases];
  for (let i = 1; i < unwrapped.length; i++) {
    while (unwrapped[i] - unwrapped[i - 1] > 180) unwrapped[i] -= 360;
    while (unwrapped[i] - unwrapped[i - 1] < -180) unwrapped[i] += 360;
  }
  return unwrapped;
}

export async function executebodeplot(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'bode-plot',
        description: 'Bode plots show magnitude and phase vs. frequency on logarithmic scale',
        components: {
          magnitudePlot: '20*log10|G(jω)| in dB vs log(ω)',
          phasePlot: '∠G(jω) in degrees vs log(ω)'
        },
        keyFeatures: {
          dcGain: 'Magnitude at ω→0',
          bandwidth: 'Frequency where magnitude drops 3dB from DC',
          crossoverFrequency: 'ω_c where |G(jω)| = 1 (0 dB)',
          resonantPeak: 'Maximum magnitude (for underdamped systems)'
        },
        stabilityMargins: {
          gainMargin: 'How much gain can increase before instability (at -180° phase)',
          phaseMargin: 'How much phase can decrease before instability (at 0dB gain)',
          guideline: 'GM > 6dB and PM > 45° typically required'
        },
        asymptoticApproximation: {
          pole: '-20 dB/decade slope, -90° phase',
          zero: '+20 dB/decade slope, +90° phase',
          integrator: '-20 dB/decade starting at 0dB for K=1',
          resonance: '+40dB peak for ζ<<1 second-order systems'
        },
        operations: ['plot', 'analyze', 'margins', 'asymptotic']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'plot') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 1];
      const gain = args.gain || 1;
      const freqRange = args.frequency_range || [0.01, 1000];

      const scaledNum = num.map((c: number) => c * gain);

      const numPoints = 100;
      const logMin = Math.log10(freqRange[0]);
      const logMax = Math.log10(freqRange[1]);

      const frequencies: number[] = [];
      const magnitudes: number[] = [];
      const phases: number[] = [];

      for (let i = 0; i <= numPoints; i++) {
        const omega = Math.pow(10, logMin + (logMax - logMin) * i / numPoints);
        frequencies.push(omega);
        const resp = frequencyResponse(scaledNum, den, omega);
        magnitudes.push(resp.mag);
        phases.push(resp.phase);
      }

      const unwrappedPhases = unwrapPhase(phases);

      const result = {
        operation: 'plot',
        frequencyRange: { min: freqRange[0], max: freqRange[1], unit: 'rad/s' },
        magnitudePlot: createBodeMagnitudePlot(frequencies, magnitudes),
        phasePlot: createBodePhasePlot(frequencies, unwrappedPhases),
        keyPoints: frequencies.filter((_, i) => i % 20 === 0).map((f, idx) => ({
          frequency: f.toFixed(3),
          magnitude: magnitudes[idx * 20]?.toFixed(2) + ' dB',
          phase: unwrappedPhases[idx * 20]?.toFixed(1) + '°'
        }))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'analyze') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];
      const freqRange = args.frequency_range || [0.001, 1000];

      const numPoints = 200;
      const logMin = Math.log10(freqRange[0]);
      const logMax = Math.log10(freqRange[1]);

      const frequencies: number[] = [];
      const magnitudes: number[] = [];
      const phases: number[] = [];

      for (let i = 0; i <= numPoints; i++) {
        const omega = Math.pow(10, logMin + (logMax - logMin) * i / numPoints);
        frequencies.push(omega);
        const resp = frequencyResponse(num, den, omega);
        magnitudes.push(resp.mag);
        phases.push(resp.phase);
      }

      const unwrappedPhases = unwrapPhase(phases);

      // Find key characteristics
      const dcGain = magnitudes[0];
      const maxMag = Math.max(...magnitudes);
      const resonantPeak = maxMag > dcGain + 3 ? maxMag - dcGain : 0;
      const resonantFreq = frequencies[magnitudes.indexOf(maxMag)];

      // Bandwidth (-3dB from DC)
      const bandwidthIdx = magnitudes.findIndex(m => m < dcGain - 3);
      const bandwidth = bandwidthIdx >= 0 ? frequencies[bandwidthIdx] : null;

      // Crossover frequency (0 dB)
      let crossoverFreq = null;
      for (let i = 0; i < magnitudes.length - 1; i++) {
        if ((magnitudes[i] >= 0 && magnitudes[i + 1] < 0) ||
            (magnitudes[i] < 0 && magnitudes[i + 1] >= 0)) {
          crossoverFreq = frequencies[i];
          break;
        }
      }

      // Roll-off rate at high frequency
      const highFreqSlope = (magnitudes[magnitudes.length - 1] - magnitudes[magnitudes.length - 20]) /
        (Math.log10(frequencies[frequencies.length - 1]) - Math.log10(frequencies[frequencies.length - 20]));

      const result = {
        operation: 'analyze',
        characteristics: {
          dcGain: dcGain.toFixed(2) + ' dB',
          bandwidth: bandwidth ? bandwidth.toFixed(3) + ' rad/s' : 'Beyond range',
          bandwidthHz: bandwidth ? (bandwidth / (2 * Math.PI)).toFixed(3) + ' Hz' : 'N/A',
          resonantPeak: resonantPeak > 0 ? resonantPeak.toFixed(2) + ' dB' : 'None',
          resonantFrequency: resonantPeak > 0 ? resonantFreq.toFixed(3) + ' rad/s' : 'N/A',
          crossoverFrequency: crossoverFreq ? crossoverFreq.toFixed(3) + ' rad/s' : 'N/A',
          highFreqRolloff: highFreqSlope.toFixed(1) + ' dB/decade'
        },
        frequencyBands: {
          lowFreq: { range: `< ${(bandwidth || 1).toFixed(3)} rad/s`, behavior: 'Near DC response' },
          midFreq: { range: 'Around bandwidth', behavior: 'Transition region' },
          highFreq: { range: `> 10×bandwidth`, behavior: `Rolling off at ${highFreqSlope.toFixed(1)} dB/decade` }
        },
        systemType: {
          order: den.length - 1,
          hasIntegrator: den[den.length - 1] === 0,
          relativeOrder: den.length - num.length
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'margins') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];
      const freqRange = args.frequency_range || [0.001, 1000];

      const numPoints = 500;
      const logMin = Math.log10(freqRange[0]);
      const logMax = Math.log10(freqRange[1]);

      const frequencies: number[] = [];
      const magnitudes: number[] = [];
      const phases: number[] = [];

      for (let i = 0; i <= numPoints; i++) {
        const omega = Math.pow(10, logMin + (logMax - logMin) * i / numPoints);
        frequencies.push(omega);
        const resp = frequencyResponse(num, den, omega);
        magnitudes.push(resp.mag);
        phases.push(resp.phase);
      }

      const unwrappedPhases = unwrapPhase(phases);

      // Find gain crossover frequency (where magnitude = 0 dB)
      let gainCrossover: { freq: number; phase: number } | null = null;
      for (let i = 0; i < magnitudes.length - 1; i++) {
        if ((magnitudes[i] >= 0 && magnitudes[i + 1] < 0)) {
          // Linear interpolation
          const t = -magnitudes[i] / (magnitudes[i + 1] - magnitudes[i]);
          gainCrossover = {
            freq: frequencies[i] + t * (frequencies[i + 1] - frequencies[i]),
            phase: unwrappedPhases[i] + t * (unwrappedPhases[i + 1] - unwrappedPhases[i])
          };
          break;
        }
      }

      // Find phase crossover frequency (where phase = -180°)
      let phaseCrossover: { freq: number; mag: number } | null = null;
      for (let i = 0; i < unwrappedPhases.length - 1; i++) {
        if ((unwrappedPhases[i] >= -180 && unwrappedPhases[i + 1] < -180) ||
            (unwrappedPhases[i] < -180 && unwrappedPhases[i + 1] >= -180)) {
          const t = (-180 - unwrappedPhases[i]) / (unwrappedPhases[i + 1] - unwrappedPhases[i]);
          phaseCrossover = {
            freq: frequencies[i] + t * (frequencies[i + 1] - frequencies[i]),
            mag: magnitudes[i] + t * (magnitudes[i + 1] - magnitudes[i])
          };
          break;
        }
      }

      // Calculate margins
      const phaseMargin = gainCrossover ? 180 + gainCrossover.phase : null;
      const gainMargin = phaseCrossover ? -phaseCrossover.mag : null;

      // Stability assessment
      let stability = 'Unknown';
      if (gainMargin !== null && phaseMargin !== null) {
        if (gainMargin > 0 && phaseMargin > 0) {
          stability = 'Stable';
        } else {
          stability = 'Unstable';
        }
      } else if (phaseMargin !== null && phaseMargin > 0) {
        stability = 'Likely stable (no phase crossover in range)';
      }

      const result = {
        operation: 'margins',
        gainMargin: {
          value: gainMargin !== null ? gainMargin.toFixed(2) + ' dB' : 'Infinite (no phase crossover)',
          frequency: phaseCrossover ? phaseCrossover.freq.toFixed(3) + ' rad/s' : 'N/A',
          adequate: gainMargin === null || gainMargin > 6
        },
        phaseMargin: {
          value: phaseMargin !== null ? phaseMargin.toFixed(2) + '°' : 'N/A',
          frequency: gainCrossover ? gainCrossover.freq.toFixed(3) + ' rad/s' : 'N/A',
          adequate: phaseMargin === null || phaseMargin > 45
        },
        stability,
        designGuidelines: {
          gainMargin: 'Typically GM > 6 dB (factor of 2)',
          phaseMargin: 'Typically PM > 45° for good damping',
          relationship: 'Higher PM → less overshoot, slower response'
        },
        recommendations: {
          ifUnstable: 'Add lag compensation or reduce gain',
          ifLowPM: 'Add lead compensation or reduce crossover frequency',
          ifLowGM: 'Reduce overall loop gain'
        },
        visualization: createMarginPlot(frequencies, magnitudes, unwrappedPhases, gainCrossover, phaseCrossover)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'asymptotic') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 1];

      // Analyze structure for asymptotic approximation
      const systemOrder = den.length - 1;
      const numOrder = num.length - 1;
      const relativeOrder = systemOrder - numOrder;

      // Find corner frequencies (approximate from polynomial coefficients)
      const cornerFreqs: { freq: number; type: string; slope: number }[] = [];

      // For simple first/second order, estimate corners
      if (systemOrder === 1) {
        const tau = den[1] / den[0];
        cornerFreqs.push({ freq: 1 / tau, type: 'pole', slope: -20 });
      } else if (systemOrder === 2) {
        const wn = Math.sqrt(den[2] / den[0]);
        cornerFreqs.push({ freq: wn, type: 'complex poles', slope: -40 });
      }

      const dcGainDb = 20 * Math.log10(Math.abs(num[num.length - 1] / den[den.length - 1]));

      const result = {
        operation: 'asymptotic',
        description: 'Asymptotic (straight-line) Bode approximation',
        systemStructure: {
          numeratorOrder: numOrder,
          denominatorOrder: systemOrder,
          relativeOrder,
          dcGain: dcGainDb.toFixed(2) + ' dB'
        },
        asymptoticRules: {
          constant: '0 dB/decade, 0° phase',
          pole: {
            magnitude: '-20 dB/decade above corner frequency',
            phase: '-90° total, transitions over 1 decade around corner'
          },
          zero: {
            magnitude: '+20 dB/decade above corner frequency',
            phase: '+90° total, transitions over 1 decade around corner'
          },
          integrator: '-20 dB/decade through 0dB at ω=K, -90° constant',
          complexPoles: {
            magnitude: '-40 dB/decade, may have peak near ωn',
            phase: '-180° total'
          }
        },
        cornerFrequencies: cornerFreqs.map(c => ({
          frequency: c.freq.toFixed(3) + ' rad/s',
          type: c.type,
          slopeChange: c.slope + ' dB/decade'
        })),
        sketch: createAsymptoticSketch(dcGainDb, cornerFreqs, relativeOrder)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function createBodeMagnitudePlot(freq: number[], mag: number[]): string {
  const width = 60;
  const height = 15;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const minMag = Math.min(...mag) - 10;
  const maxMag = Math.max(...mag) + 10;
  const magRange = maxMag - minMag || 1;

  // 0 dB line
  const zeroDbY = Math.round((height - 1) * (maxMag / magRange));
  if (zeroDbY >= 0 && zeroDbY < height) {
    for (let x = 0; x < width; x++) grid[zeroDbY][x] = '─';
  }

  // Plot
  for (let i = 0; i < freq.length; i++) {
    const x = Math.floor(i * width / freq.length);
    const y = Math.round((height - 1) * ((maxMag - mag[i]) / magRange));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '●';
    }
  }

  const lines = [
    'Magnitude Plot (dB)',
    `${maxMag.toFixed(0)}dB ┐`,
    ...grid.map(row => '      │' + row.join('')),
    `${minMag.toFixed(0)}dB ┘└${'─'.repeat(width - 1)}`,
    `        ${freq[0].toExponential(0)}          →          ${freq[freq.length - 1].toExponential(0)} rad/s (log scale)`
  ];

  return lines.join('\n');
}

function createBodePhasePlot(freq: number[], phase: number[]): string {
  const width = 60;
  const height = 10;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const minPhase = Math.min(...phase, -180) - 10;
  const maxPhase = Math.max(...phase, 0) + 10;
  const phaseRange = maxPhase - minPhase || 1;

  // -180° line
  const neg180Y = Math.round((height - 1) * ((maxPhase + 180) / phaseRange));
  if (neg180Y >= 0 && neg180Y < height) {
    for (let x = 0; x < width; x++) grid[neg180Y][x] = '┄';
  }

  // Plot
  for (let i = 0; i < freq.length; i++) {
    const x = Math.floor(i * width / freq.length);
    const y = Math.round((height - 1) * ((maxPhase - phase[i]) / phaseRange));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '●';
    }
  }

  const lines = [
    'Phase Plot (degrees)',
    `${maxPhase.toFixed(0)}° ┐`,
    ...grid.map(row => '     │' + row.join('')),
    `${minPhase.toFixed(0)}° ┘└${'─'.repeat(width - 1)}`,
    `       log(ω) → (┄ = -180°)`
  ];

  return lines.join('\n');
}

function createMarginPlot(freq: number[], mag: number[], phase: number[],
  gainCross: { freq: number; phase: number } | null,
  phaseCross: { freq: number; mag: number } | null): string {

  const lines = [
    'Stability Margins Visualization',
    '─'.repeat(40)
  ];

  if (gainCross) {
    lines.push(`Gain Crossover: ω_gc = ${gainCross.freq.toFixed(3)} rad/s`);
    lines.push(`  Phase at ω_gc: ${gainCross.phase.toFixed(1)}°`);
    lines.push(`  Phase Margin: ${(180 + gainCross.phase).toFixed(1)}°`);
  }

  if (phaseCross) {
    lines.push(`Phase Crossover: ω_pc = ${phaseCross.freq.toFixed(3)} rad/s`);
    lines.push(`  Magnitude at ω_pc: ${phaseCross.mag.toFixed(1)} dB`);
    lines.push(`  Gain Margin: ${(-phaseCross.mag).toFixed(1)} dB`);
  }

  return lines.join('\n');
}

function createAsymptoticSketch(dcGain: number, corners: { freq: number; type: string; slope: number }[], relOrder: number): string {
  const lines = [
    'Asymptotic Bode Sketch',
    '─'.repeat(40),
    `DC: ${dcGain.toFixed(1)} dB flat line`
  ];

  for (const c of corners) {
    lines.push(`At ω = ${c.freq.toFixed(2)} rad/s: ${c.type}`);
    lines.push(`  Slope changes by ${c.slope} dB/decade`);
  }

  lines.push(`High frequency slope: ${-20 * relOrder} dB/decade`);

  return lines.join('\n');
}

export function isbodeplotAvailable(): boolean { return true; }
