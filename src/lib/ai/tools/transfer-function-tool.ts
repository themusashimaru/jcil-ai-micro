/**
 * TRANSFER-FUNCTION TOOL
 * Transfer function analysis for control systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const transferfunctionTool: UnifiedTool = {
  name: 'transfer_function',
  description: 'Transfer function representation and analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'poles_zeros', 'step_response', 'impulse_response', 'frequency_response', 'info'], description: 'Operation' },
      numerator: { type: 'array', items: { type: 'number' }, description: 'Numerator coefficients [b_n, b_{n-1}, ..., b_0]' },
      denominator: { type: 'array', items: { type: 'number' }, description: 'Denominator coefficients [a_n, a_{n-1}, ..., a_0]' },
      time_end: { type: 'number', description: 'End time for response simulation' },
      frequency_range: { type: 'array', items: { type: 'number' }, description: '[min_freq, max_freq] in rad/s' }
    },
    required: ['operation']
  }
};

// Complex number type
interface Complex {
  re: number;
  im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
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

function cSqrt(c: Complex): Complex {
  const r = cAbs(c);
  const theta = cArg(c);
  return {
    re: Math.sqrt(r) * Math.cos(theta / 2),
    im: Math.sqrt(r) * Math.sin(theta / 2)
  };
}

// Evaluate polynomial at complex point
function polyEval(coeffs: number[], s: Complex): Complex {
  let result: Complex = { re: 0, im: 0 };
  for (let i = 0; i < coeffs.length; i++) {
    result = cAdd(cMul(result, s), { re: coeffs[i], im: 0 });
  }
  return result;
}

// Find roots of polynomial using companion matrix / numerical methods
function findRoots(coeffs: number[]): Complex[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [];
  if (n === 1) {
    return [{ re: -coeffs[1] / coeffs[0], im: 0 }];
  }
  if (n === 2) {
    const a = coeffs[0], b = coeffs[1], c = coeffs[2];
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const sqrtD = Math.sqrt(discriminant);
      return [
        { re: (-b + sqrtD) / (2 * a), im: 0 },
        { re: (-b - sqrtD) / (2 * a), im: 0 }
      ];
    } else {
      const sqrtD = Math.sqrt(-discriminant);
      return [
        { re: -b / (2 * a), im: sqrtD / (2 * a) },
        { re: -b / (2 * a), im: -sqrtD / (2 * a) }
      ];
    }
  }

  // For higher order, use Durand-Kerner method
  const roots: Complex[] = [];
  const normalized = coeffs.map(c => c / coeffs[0]);

  // Initial guesses
  for (let i = 0; i < n; i++) {
    const angle = 2 * Math.PI * i / n + 0.1;
    roots.push({ re: Math.cos(angle), im: Math.sin(angle) });
  }

  // Iterate
  for (let iter = 0; iter < 100; iter++) {
    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      const num = polyEval(normalized, roots[i]);
      let denom: Complex = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          denom = cMul(denom, cSub(roots[i], roots[j]));
        }
      }
      const delta = cDiv(num, denom);
      roots[i] = cSub(roots[i], delta);
      maxChange = Math.max(maxChange, cAbs(delta));
    }
    if (maxChange < 1e-10) break;
  }

  return roots;
}

// Compute step response using inverse Laplace transform (partial fractions)
function stepResponse(num: number[], den: number[], tEnd: number, points: number = 100): { t: number[]; y: number[] } {
  const t: number[] = [];
  const y: number[] = [];
  const dt = tEnd / points;

  // For simple systems, use analytical approximation
  // Find poles
  const poles = findRoots(den);

  // DC gain = num(0) / den(0)
  const dcGain = num[num.length - 1] / den[den.length - 1];

  // Estimate response based on poles
  for (let i = 0; i <= points; i++) {
    const time = i * dt;
    t.push(time);

    // Simplified response calculation
    let response = dcGain;
    for (const pole of poles) {
      if (Math.abs(pole.im) < 0.001) {
        // Real pole
        response -= dcGain * Math.exp(pole.re * time) / poles.length;
      } else if (pole.im > 0) {
        // Complex conjugate pair
        const sigma = pole.re;
        const omega = pole.im;
        response -= (dcGain / poles.length) * Math.exp(sigma * time) *
          (Math.cos(omega * time) + (sigma / omega) * Math.sin(omega * time));
      }
    }
    y.push(response);
  }

  return { t, y };
}

// Compute impulse response
function impulseResponse(num: number[], den: number[], tEnd: number, points: number = 100): { t: number[]; y: number[] } {
  const t: number[] = [];
  const y: number[] = [];
  const dt = tEnd / points;

  const poles = findRoots(den);

  for (let i = 0; i <= points; i++) {
    const time = i * dt;
    t.push(time);

    let response = 0;
    for (const pole of poles) {
      if (Math.abs(pole.im) < 0.001) {
        // Real pole
        response += Math.exp(pole.re * time);
      } else if (pole.im > 0) {
        // Complex conjugate pair
        const sigma = pole.re;
        const omega = pole.im;
        response += 2 * Math.exp(sigma * time) * Math.cos(omega * time);
      }
    }
    y.push(response * num[num.length - 1] / den[0]);
  }

  return { t, y };
}

function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-6) return c.re.toFixed(4);
  if (Math.abs(c.re) < 1e-6) return `${c.im.toFixed(4)}j`;
  const sign = c.im >= 0 ? '+' : '-';
  return `${c.re.toFixed(4)}${sign}${Math.abs(c.im).toFixed(4)}j`;
}

export async function executetransferfunction(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'transfer-function',
        description: 'Transfer function G(s) = N(s)/D(s) analysis',
        concepts: {
          definition: 'G(s) = Y(s)/U(s) - ratio of Laplace transforms of output to input',
          numerator: 'N(s) = b_n*s^n + b_{n-1}*s^{n-1} + ... + b_0',
          denominator: 'D(s) = a_m*s^m + a_{m-1}*s^{m-1} + ... + a_0'
        },
        keyProperties: {
          poles: 'Roots of denominator - determine stability and response shape',
          zeros: 'Roots of numerator - affect response magnitude',
          dcGain: 'G(0) = steady-state response to unit step',
          bandwidth: 'Frequency at which |G(jω)| drops 3dB'
        },
        stability: {
          criterion: 'System stable if all poles have negative real parts',
          BIBO: 'Bounded Input Bounded Output stability'
        },
        commonForms: {
          firstOrder: 'G(s) = K/(τs + 1), K=gain, τ=time constant',
          secondOrder: 'G(s) = ω_n²/(s² + 2ζω_n*s + ω_n²), ζ=damping, ω_n=natural frequency',
          integrator: 'G(s) = K/s',
          differentiator: 'G(s) = Ks'
        },
        operations: ['create', 'poles_zeros', 'step_response', 'impulse_response', 'frequency_response']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'create') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 1];

      // Build polynomial string
      const numStr = num.map((c: number, i: number) => {
        const power = num.length - 1 - i;
        if (power === 0) return c.toString();
        if (power === 1) return `${c}s`;
        return `${c}s^${power}`;
      }).join(' + ');

      const denStr = den.map((c: number, i: number) => {
        const power = den.length - 1 - i;
        if (power === 0) return c.toString();
        if (power === 1) return `${c}s`;
        return `${c}s^${power}`;
      }).join(' + ');

      // Find poles and zeros
      const poles = findRoots(den);
      const zeros = num.length > 1 ? findRoots(num) : [];

      // DC gain
      const dcGain = num[num.length - 1] / den[den.length - 1];

      // Stability
      const isStable = poles.every(p => p.re < 0);
      const isMarginally = poles.some(p => Math.abs(p.re) < 1e-6);

      const result = {
        operation: 'create',
        transferFunction: {
          latex: `G(s) = \\frac{${numStr}}{${denStr}}`,
          numerator: num,
          denominator: den,
          order: den.length - 1
        },
        poles: poles.map(p => ({
          value: formatComplex(p),
          real: p.re,
          imag: p.im,
          stable: p.re < 0
        })),
        zeros: zeros.map(z => ({
          value: formatComplex(z),
          real: z.re,
          imag: z.im
        })),
        properties: {
          dcGain,
          isStable,
          isMarginally: isMarginally && !isStable,
          relativeOrder: den.length - num.length
        },
        diagram: createPoleZeroPlot(poles, zeros)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'poles_zeros') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];

      const poles = findRoots(den);
      const zeros = num.length > 1 ? findRoots(num) : [];

      // Classify poles
      const poleAnalysis = poles.map(p => {
        let type = '';
        let effect = '';

        if (Math.abs(p.im) < 1e-6) {
          type = 'Real';
          if (p.re < 0) {
            effect = `Exponential decay with τ = ${(-1 / p.re).toFixed(3)}s`;
          } else if (p.re > 0) {
            effect = 'Exponential growth (unstable)';
          } else {
            effect = 'Constant (marginally stable)';
          }
        } else {
          type = 'Complex conjugate';
          const sigma = p.re;
          const omega = Math.abs(p.im);
          const zeta = -sigma / Math.sqrt(sigma * sigma + omega * omega);
          if (sigma < 0) {
            effect = `Damped oscillation: ζ=${zeta.toFixed(3)}, ω_n=${Math.sqrt(sigma * sigma + omega * omega).toFixed(3)} rad/s`;
          } else if (sigma > 0) {
            effect = 'Growing oscillation (unstable)';
          } else {
            effect = 'Sustained oscillation (marginally stable)';
          }
        }

        return {
          pole: formatComplex(p),
          type,
          effect,
          timeConstant: p.re !== 0 ? -1 / p.re : Infinity
        };
      });

      const result = {
        operation: 'poles_zeros',
        poles: poleAnalysis,
        zeros: zeros.map(z => ({ value: formatComplex(z) })),
        stability: {
          stable: poles.every(p => p.re < 0),
          dominantPole: poles.reduce((a, b) => a.re > b.re ? a : b),
          settlingTime: poles.every(p => p.re < 0) ?
            `~${(4 / Math.abs(Math.max(...poles.map(p => p.re)))).toFixed(2)}s (4τ)` : 'N/A (unstable)'
        },
        plot: createPoleZeroPlot(poles, zeros)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'step_response') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];
      const tEnd = args.time_end || 10;

      const response = stepResponse(num, den, tEnd);
      const poles = findRoots(den);

      // Find characteristics
      const finalValue = response.y[response.y.length - 1];
      const maxValue = Math.max(...response.y);
      const overshoot = finalValue > 0 ? ((maxValue - finalValue) / finalValue * 100) : 0;

      // Rise time (10% to 90%)
      const idx10 = response.y.findIndex(v => v >= 0.1 * finalValue);
      const idx90 = response.y.findIndex(v => v >= 0.9 * finalValue);
      const riseTime = idx10 >= 0 && idx90 >= 0 ?
        response.t[idx90] - response.t[idx10] : undefined;

      // Settling time (2% band)
      let settlingTime = tEnd;
      for (let i = response.y.length - 1; i >= 0; i--) {
        if (Math.abs(response.y[i] - finalValue) > 0.02 * Math.abs(finalValue)) {
          settlingTime = response.t[i];
          break;
        }
      }

      const result = {
        operation: 'step_response',
        characteristics: {
          finalValue: finalValue.toFixed(4),
          overshoot: overshoot.toFixed(2) + '%',
          riseTime: riseTime ? riseTime.toFixed(3) + 's' : 'N/A',
          settlingTime: settlingTime.toFixed(3) + 's',
          peakValue: maxValue.toFixed(4),
          peakTime: response.t[response.y.indexOf(maxValue)].toFixed(3) + 's'
        },
        stable: poles.every(p => p.re < 0),
        plot: createResponsePlot(response.t, response.y, 'Step Response'),
        samplePoints: response.t.filter((_, i) => i % 10 === 0).map((t, i) => ({
          t: t.toFixed(3),
          y: response.y[i * 10]?.toFixed(4)
        }))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'impulse_response') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];
      const tEnd = args.time_end || 10;

      const response = impulseResponse(num, den, tEnd);
      const poles = findRoots(den);

      const maxAbs = Math.max(...response.y.map(Math.abs));
      const peakTime = response.t[response.y.map(Math.abs).indexOf(maxAbs)];

      const result = {
        operation: 'impulse_response',
        characteristics: {
          peakValue: maxAbs.toFixed(4),
          peakTime: peakTime.toFixed(3) + 's',
          decayRate: poles.every(p => p.re < 0) ?
            Math.max(...poles.map(p => p.re)).toFixed(4) : 'Unstable'
        },
        stable: poles.every(p => p.re < 0),
        plot: createResponsePlot(response.t, response.y, 'Impulse Response'),
        note: 'Impulse response h(t) is the inverse Laplace transform of G(s)'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'frequency_response') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];
      const freqRange = args.frequency_range || [0.01, 100];

      const frequencies: number[] = [];
      const magnitude: number[] = [];
      const phase: number[] = [];

      const numPoints = 50;
      const logMin = Math.log10(freqRange[0]);
      const logMax = Math.log10(freqRange[1]);

      for (let i = 0; i <= numPoints; i++) {
        const omega = Math.pow(10, logMin + (logMax - logMin) * i / numPoints);
        frequencies.push(omega);

        const s: Complex = { re: 0, im: omega };
        const numVal = polyEval(num, s);
        const denVal = polyEval(den, s);
        const G = cDiv(numVal, denVal);

        magnitude.push(20 * Math.log10(cAbs(G)));
        phase.push(cArg(G) * 180 / Math.PI);
      }

      // Find bandwidth (-3dB point)
      const dcMag = magnitude[0];
      const bandwidthIdx = magnitude.findIndex(m => m < dcMag - 3);
      const bandwidth = bandwidthIdx >= 0 ? frequencies[bandwidthIdx] : null;

      const result = {
        operation: 'frequency_response',
        dcGain: dcMag.toFixed(2) + ' dB',
        bandwidth: bandwidth ? bandwidth.toFixed(3) + ' rad/s' : 'N/A',
        bandwidthHz: bandwidth ? (bandwidth / (2 * Math.PI)).toFixed(3) + ' Hz' : 'N/A',
        sampleFrequencies: frequencies.filter((_, i) => i % 10 === 0).map((f, i) => ({
          omega: f.toFixed(3),
          magDb: magnitude[i * 10]?.toFixed(2),
          phaseDeg: phase[i * 10]?.toFixed(1)
        })),
        note: 'Use bode_plot tool for detailed Bode analysis'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function createPoleZeroPlot(poles: Complex[], zeros: Complex[]): string {
  const width = 40;
  const height = 20;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Find scale
  const allPoints = [...poles, ...zeros];
  const maxRe = Math.max(2, ...allPoints.map(p => Math.abs(p.re)));
  const maxIm = Math.max(2, ...allPoints.map(p => Math.abs(p.im)));

  // Draw axes
  const centerY = Math.floor(height / 2);
  const centerX = Math.floor(width / 2);

  for (let x = 0; x < width; x++) grid[centerY][x] = '─';
  for (let y = 0; y < height; y++) grid[y][centerX] = '│';
  grid[centerY][centerX] = '┼';

  // Plot poles (x) and zeros (o)
  for (const p of poles) {
    const x = Math.round(centerX + (p.re / maxRe) * (width / 2 - 2));
    const y = Math.round(centerY - (p.im / maxIm) * (height / 2 - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '×';
    }
  }

  for (const z of zeros) {
    const x = Math.round(centerX + (z.re / maxRe) * (width / 2 - 2));
    const y = Math.round(centerY - (z.im / maxIm) * (height / 2 - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '○';
    }
  }

  const lines = [
    `Pole-Zero Plot (× = pole, ○ = zero)`,
    `Im ↑  Scale: Re ±${maxRe.toFixed(1)}, Im ±${maxIm.toFixed(1)}`,
    ...grid.map(row => row.join('')),
    `     → Re   (Left half = stable)`
  ];

  return lines.join('\n');
}

function createResponsePlot(t: number[], y: number[], title: string): string {
  const width = 50;
  const height = 15;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  const maxY = Math.max(...y.map(Math.abs), 0.1);
  const minY = Math.min(...y, 0);
  const rangeY = maxY - minY || 1;

  // Draw axes
  const zeroY = Math.round((height - 1) * (maxY / rangeY));
  for (let x = 0; x < width; x++) {
    if (zeroY >= 0 && zeroY < height) grid[zeroY][x] = '─';
  }

  // Plot response
  for (let i = 0; i < t.length && i < width; i++) {
    const plotX = Math.floor(i * width / t.length);
    const plotY = Math.round((height - 1) * (1 - (y[i] - minY) / rangeY));
    if (plotX >= 0 && plotX < width && plotY >= 0 && plotY < height) {
      grid[plotY][plotX] = '█';
    }
  }

  const lines = [
    title,
    `y ↑  max: ${maxY.toFixed(3)}`,
    ...grid.map(row => row.join('')),
    `   └${'─'.repeat(width - 3)}→ t (0 to ${t[t.length - 1].toFixed(1)}s)`
  ];

  return lines.join('\n');
}

export function istransferfunctionAvailable(): boolean { return true; }
